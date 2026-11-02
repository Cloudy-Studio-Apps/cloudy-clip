//! Reversed copies: a media element only plays forwards, so a clip that runs backwards plays a
//! copy of its file that is backwards from start to end.
//!
//! - FFmpeg's `reverse` filter holds everything it reverses in memory, so a long file is cut into
//!   [`SEGMENT_US`] pieces, each reversed alone, then joined last to first without encoding again.
//! - Each file gets a preview copy and, for export, a full-quality one. Both follow the proxy
//!   rules: one video and one audio stream, no timecode or data tracks.
//! - Cached beside the proxies and written under a temporary name, one encode at a time.

use std::path::{Path, PathBuf};

use super::proxy::{ProxyJobs, Tools, cache_path, command, ffprobe, find_tools, run_encoder};
use super::registry::MediaRegistry;

/// Length of a piece, a size whose frames fit in memory at any resolution we expect.
const SEGMENT_US: u64 = 10_000_000;

/// The pieces of a file, as `(start, end)`.
fn segments(duration_us: u64) -> Vec<(u64, u64)> {
    (0..duration_us.div_ceil(SEGMENT_US))
        .map(|n| (n * SEGMENT_US, ((n + 1) * SEGMENT_US).min(duration_us)))
        .collect()
}

/// A path as the concat demuxer's list reads it.
fn list_entry(path: &Path) -> String {
    format!(
        "file '{}'\n",
        path.display().to_string().replace('\'', "'\\''")
    )
}

/// The concat list: the last piece first, since each piece runs backwards.
fn joined_list(parts: &[PathBuf]) -> String {
    parts.iter().rev().map(|part| list_entry(part)).collect()
}

/// What FFmpeg does to one piece, after its input.
fn segment_args(full: bool) -> Vec<&'static str> {
    let quality = if full { "14" } else { "23" };
    vec![
        "-map_metadata",
        "-1",
        "-map_chapters",
        "-1",
        "-dn",
        "-sn",
        "-map",
        "0:v:0?",
        "-map",
        "0:a:0?",
        "-vf",
        "reverse,scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-af",
        "areverse",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        quality,
        "-pix_fmt",
        "yuv420p",
        "-profile:v",
        "high",
        "-g",
        "15",
        "-keyint_min",
        "15",
        "-sc_threshold",
        "0",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-ar",
        "48000",
        "-write_tmcd",
        "0",
        "-f",
        "mp4",
    ]
}

/// Reverses a file into `target`, reporting 0..1.
async fn encode_reversed(
    tools: &Tools,
    source: &Path,
    target: &Path,
    duration_us: u64,
    full: bool,
    on_progress: &impl Fn(f32),
) -> Result<(), String> {
    let folder = target.with_extension("parts");
    tokio::fs::create_dir_all(&folder)
        .await
        .map_err(|e| format!("Could not make room for the reversed copy: {e}"))?;
    let pieces = segments(duration_us);
    let mut parts = Vec::with_capacity(pieces.len());
    for (index, (start, end)) in pieces.iter().copied().enumerate() {
        let part = folder.join(format!("{index}.mp4"));
        let mut cmd = command(&tools.ffmpeg);
        cmd.args(["-hide_banner", "-nostats", "-loglevel", "error", "-y"])
            .args(["-ss", &seconds(start), "-t", &seconds(end - start), "-i"])
            .arg(source)
            .args(segment_args(full))
            .arg(&part);
        let done = index as f32 / pieces.len() as f32;
        let step = 1.0 / pieces.len() as f32;
        run_encoder(cmd, Some(end - start), |progress| {
            on_progress(done + progress * step);
        })
        .await
        .map_err(|detail| format!("Could not reverse this file: {detail}"))?;
        parts.push(part);
    }

    let list = folder.join("list.txt");
    tokio::fs::write(&list, joined_list(&parts))
        .await
        .map_err(|e| format!("Could not join the reversed copy: {e}"))?;
    let partial = target.with_extension("partial.mp4");
    let mut cmd = command(&tools.ffmpeg);
    cmd.args(["-hide_banner", "-nostats", "-loglevel", "error", "-y"])
        .args(["-f", "concat", "-safe", "0", "-i"])
        .arg(&list)
        .args([
            "-c",
            "copy",
            "-dn",
            "-write_tmcd",
            "0",
            "-movflags",
            "+faststart",
        ])
        .args(["-map_metadata", "-1", "-f", "mp4"])
        .arg(&partial);
    let joined = run_encoder(cmd, Some(duration_us), |_| {}).await;
    let _ = tokio::fs::remove_dir_all(&folder).await;
    joined.map_err(|detail| format!("Could not join the reversed copy: {detail}"))?;
    tokio::fs::rename(&partial, target)
        .await
        .map_err(|e| format!("Could not save the reversed copy: {e}"))
}

fn seconds(micros: u64) -> String {
    format!("{:.6}", micros as f64 / 1_000_000.0)
}

impl ProxyJobs {
    /// Makes sure a file has a reversed copy, for preview or, with `full`, for export.
    pub async fn prepare_reversed(
        &self,
        registry: &MediaRegistry,
        id: &str,
        full: bool,
        on_progress: impl Fn(f32),
    ) -> Result<(), String> {
        let (source, generation) = registry
            .reverse_source(id, full)
            .ok_or("Unknown media id")?;
        let tools = find_tools().ok_or("FFmpeg was not found")?;
        let name = if full {
            "reversed.master.mp4"
        } else {
            "reversed.mp4"
        };
        let target = cache_path(self.cache_dir(), &source, name).await?;
        if !tokio::fs::try_exists(&target).await.unwrap_or(false) {
            let _permit = self
                .encoder()
                .acquire()
                .await
                .map_err(|_| "Encoder unavailable".to_owned())?;
            // Another job may have made it while this one waited.
            if !tokio::fs::try_exists(&target).await.unwrap_or(false) {
                let duration = ffprobe(&tools, &source, false)
                    .await?
                    .duration_us
                    .ok_or("This file doesn't say how long it is")?;
                encode_reversed(&tools, &source, &target, duration, full, &on_progress).await?;
            }
        }
        registry.set_reversed(id, generation, full, target);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn segments_cover_the_file_without_overlap() {
        assert_eq!(
            segments(25_000_000),
            [
                (0, 10_000_000),
                (10_000_000, 20_000_000),
                (20_000_000, 25_000_000)
            ]
        );
    }

    #[test]
    fn the_joined_list_runs_from_last_to_first() {
        let parts = [PathBuf::from("/a/0.mp4"), PathBuf::from("/a/1.mp4")];
        assert_eq!(joined_list(&parts), "file '/a/1.mp4'\nfile '/a/0.mp4'\n");
    }

    #[test]
    fn a_quote_in_a_path_survives_the_list() {
        assert_eq!(list_entry(Path::new("/a'b.mp4")), "file '/a'\\''b.mp4'\n");
    }

    #[test]
    fn a_segment_has_one_video_and_one_audio_stream_and_no_timecode() {
        let args = segment_args(false);
        for needed in ["0:v:0?", "0:a:0?", "-dn", "-write_tmcd", "-map_metadata"] {
            assert!(args.contains(&needed), "{needed}");
        }
    }
}
