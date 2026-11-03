//! Reversed copies: a media element only plays forwards, so a clip that runs backwards plays a
//! copy of its file that is backwards from start to end.
//!
//! - FFmpeg's `reverse` filter holds everything it reverses in memory, so a long file is cut into
//!   [`SEGMENT_US`] pieces, each reversed alone, then joined last to first.
//! - Picture is joined without encoding again. Sound stays plain samples until the join, where
//!   it's encoded once: pieces of encoded sound each add a gap, and over minutes that drifts.
//! - Each file gets a preview copy and, for export, a full-quality one. Both follow the proxy
//!   rules: one video and one audio stream, no timecode or data tracks.
//! - A derived file ([`super::derived`]): cached beside the proxies, one encode at a time.

use std::future::Future;
use std::path::{Path, PathBuf};

use super::derived::{DerivedKind, quiet};
use super::proxy::{Probe, Tools, ffprobe, run_encoder};
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

/// What FFmpeg does to one piece of picture, after its input.
fn picture_args(full: bool) -> Vec<&'static str> {
    let quality = if full { "14" } else { "23" };
    vec![
        "-map_metadata",
        "-1",
        "-map_chapters",
        "-1",
        "-dn",
        "-sn",
        "-an",
        "-map",
        "0:v:0",
        "-vf",
        "reverse,scale=trunc(iw/2)*2:trunc(ih/2)*2",
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
        "-write_tmcd",
        "0",
        "-f",
        "mp4",
    ]
}

/// How the whole sound is cut: plain samples in one pass, so no piece gains or loses any. Seeking
/// to each piece instead drifts by a few milliseconds a piece, which adds up over a long file.
fn sound_cut_args() -> Vec<String> {
    let piece = SEGMENT_US as f64 / 1_000_000.0;
    ["-map_metadata", "-1", "-dn", "-sn", "-vn", "-map", "0:a:0"]
        .into_iter()
        .chain(["-c:a", "pcm_s16le", "-ar", "48000", "-f", "segment"])
        .map(str::to_owned)
        .chain(["-segment_time".to_owned(), format!("{piece}")])
        .collect()
}

/// The maps and codecs of the finished copy. Sound is encoded once, over all of it.
fn join_args(picture: bool, sound: bool) -> Vec<&'static str> {
    let mut args = vec!["-dn", "-write_tmcd", "0", "-movflags", "+faststart"];
    args.extend(["-map_metadata", "-1"]);
    if picture {
        args.extend(["-map", "0:v:0", "-c:v", "copy"]);
    }
    if sound {
        args.extend(["-map", if picture { "1:a:0" } else { "0:a:0" }]);
        args.extend(["-c:a", "aac", "-b:a", "192k"]);
    }
    args.extend(["-f", "mp4"]);
    args
}

/// The picture reversed piece by piece, first piece first.
async fn reverse_picture(
    tools: &Tools,
    source: &Path,
    folder: &Path,
    duration_us: u64,
    full: bool,
    on_progress: &(dyn Fn(f32) + Sync),
) -> Result<Vec<PathBuf>, String> {
    let pieces = segments(duration_us);
    let mut parts = Vec::with_capacity(pieces.len());
    for (index, (start, end)) in pieces.iter().copied().enumerate() {
        let part = folder.join(format!("picture{index}.mp4"));
        let mut cmd = quiet(tools);
        cmd.args(["-ss", &seconds(start), "-t", &seconds(end - start), "-i"])
            .arg(source)
            .args(picture_args(full))
            .arg(&part);
        let done = index as f32 / pieces.len() as f32;
        let step = 1.0 / pieces.len() as f32;
        run_encoder(cmd, Some(end - start), |progress| {
            on_progress(done + progress * step);
        })
        .await?;
        parts.push(part);
    }
    Ok(parts)
}

/// The sound cut in one pass, then each piece reversed, first piece first.
async fn reverse_sound(
    tools: &Tools,
    source: &Path,
    folder: &Path,
) -> Result<Vec<PathBuf>, String> {
    let mut cmd = quiet(tools);
    cmd.arg("-i")
        .arg(source)
        .args(sound_cut_args())
        .arg(folder.join("cut%d.wav"));
    run_encoder(cmd, None, |_| {}).await?;
    let mut parts = Vec::new();
    loop {
        let cut = folder.join(format!("cut{}.wav", parts.len()));
        if !tokio::fs::try_exists(&cut).await.unwrap_or(false) {
            return Ok(parts);
        }
        let part = folder.join(format!("sound{}.wav", parts.len()));
        let mut cmd = quiet(tools);
        cmd.arg("-i")
            .arg(&cut)
            .args(["-af", "areverse", "-c:a", "pcm_s16le"])
            .arg(&part);
        run_encoder(cmd, None, |_| {}).await?;
        tokio::fs::remove_file(&cut).await.ok();
        parts.push(part);
    }
}

/// Writes a concat list, for the next input of `cmd`.
async fn add_list(
    cmd: &mut tokio::process::Command,
    folder: &Path,
    name: &str,
    parts: &[PathBuf],
) -> Result<(), String> {
    let list = folder.join(name);
    tokio::fs::write(&list, joined_list(parts))
        .await
        .map_err(|e| format!("Could not join the reversed copy: {e}"))?;
    cmd.args(["-f", "concat", "-safe", "0", "-i"]).arg(&list);
    Ok(())
}

/// Everything but the cleanup of [`encode_reversed`].
async fn make_reversed(
    tools: &Tools,
    source: &Path,
    target: &Path,
    folder: &Path,
    probe: &Probe,
    full: bool,
    on_progress: &(dyn Fn(f32) + Sync),
) -> Result<(), String> {
    let duration_us = probe
        .duration_us
        .ok_or("This file doesn't say how long it is")?;
    let (picture, sound) = (probe.video_codec.is_some(), probe.audio_codec.is_some());
    let frames = if picture {
        reverse_picture(tools, source, folder, duration_us, full, on_progress).await?
    } else {
        Vec::new()
    };
    let samples = if sound {
        reverse_sound(tools, source, folder).await?
    } else {
        Vec::new()
    };
    let partial = target.with_extension("partial.mp4");
    let mut cmd = quiet(tools);
    if picture {
        add_list(&mut cmd, folder, "picture.txt", &frames).await?;
    }
    if sound {
        add_list(&mut cmd, folder, "sound.txt", &samples).await?;
    }
    cmd.args(join_args(picture, sound)).arg(&partial);
    run_encoder(cmd, Some(duration_us), |_| {}).await?;
    tokio::fs::rename(&partial, target)
        .await
        .map_err(|e| format!("Could not save the reversed copy: {e}"))
}

/// Reverses a file into `target`, reporting 0..1.
async fn encode_reversed(
    tools: &Tools,
    source: &Path,
    target: &Path,
    probe: &Probe,
    full: bool,
    on_progress: &(dyn Fn(f32) + Sync),
) -> Result<(), String> {
    let folder = target.with_extension("parts");
    tokio::fs::create_dir_all(&folder)
        .await
        .map_err(|e| format!("Could not make room for the reversed copy: {e}"))?;
    let made = make_reversed(tools, source, target, &folder, probe, full, on_progress).await;
    let _ = tokio::fs::remove_dir_all(&folder).await;
    made.map_err(|detail| format!("Could not reverse this file: {detail}"))
}

fn seconds(micros: u64) -> String {
    format!("{:.6}", micros as f64 / 1_000_000.0)
}

/// The copy of a file that runs backwards: for preview, or at full quality for export.
pub(crate) struct Reversed {
    pub(crate) full: bool,
}

impl DerivedKind for Reversed {
    fn name(&self) -> String {
        if self.full {
            "reversed.master.mp4".into()
        } else {
            "reversed.mp4".into()
        }
    }

    fn source(&self, registry: &MediaRegistry, id: &str) -> Option<(PathBuf, u64)> {
        registry.reverse_source(id, self.full)
    }

    fn make(
        &self,
        tools: &Tools,
        source: &Path,
        target: &Path,
        on_progress: &(dyn Fn(f32) + Sync),
    ) -> impl Future<Output = Result<(), String>> + Send {
        let full = self.full;
        async move {
            let probe = ffprobe(tools, source, false).await?;
            encode_reversed(tools, source, target, &probe, full, on_progress).await
        }
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
    fn a_picture_piece_has_one_video_stream_and_no_timecode() {
        let args = picture_args(false);
        for needed in ["0:v:0", "-an", "-dn", "-write_tmcd", "-map_metadata"] {
            assert!(args.contains(&needed), "{needed}");
        }
    }

    #[test]
    fn sound_is_cut_as_plain_samples_in_one_pass() {
        let args = sound_cut_args();
        for needed in ["pcm_s16le", "segment", "-vn"] {
            assert!(args.iter().any(|arg| arg == needed), "{needed}");
        }
    }

    #[test]
    fn the_copy_encodes_sound_once_and_keeps_the_picture() {
        let args = join_args(true, true);
        assert!(args.windows(2).any(|pair| pair == ["-c:v", "copy"]));
        assert!(args.windows(2).any(|pair| pair == ["-map", "1:a:0"]));
        assert!(args.windows(2).any(|pair| pair == ["-c:a", "aac"]));
    }

    #[test]
    fn a_file_with_only_sound_has_no_picture_to_map() {
        let args = join_args(false, true);
        assert!(args.windows(2).any(|pair| pair == ["-map", "0:a:0"]));
        assert!(!args.contains(&"0:v:0"));
    }
}
