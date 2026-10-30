//! Images: what the webview can't show gets a PNG, and animated files get their frames.
//!
//! Part of the proxy pipeline, so conversions share its one-at-a-time encoder and its cache.
//!
//! - A still in a format the webview shows, at most [`MAX_STILL_SIDE`] on its long side, is served
//!   as it is. Anything else is converted to one PNG, served as the entry's proxy.
//! - A file with more than one frame is animated, whatever its extension says (a `.png` can be an
//!   APNG). Its frames go into a folder as PNGs, which every FFmpeg build can write and which keep
//!   transparency: a video proxy can't do that on every platform. They are served by number.
//! - The extension can't say which is which, so the frames are counted here.
//! - The original stays registered, so a failed conversion shows the first frame.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use tokio::sync::Semaphore;

use super::proxy::{
    Probe, ProbeMeta, ProxyState, Tools, cache_path, command, ffprobe, run_encoder,
};
use super::registry::{MediaRegistry, always_converted};

/// Stills never exceed this on their long side.
const MAX_STILL_SIDE: u64 = 3840;
/// Frames of animated images never exceed this on their long side.
const MAX_FRAME_SIDE: u64 = 1280;
const MAX_FRAME_RATE: f64 = 30.0;
/// GIF's usual rate, for a file that gives none.
const DEFAULT_FRAME_RATE: f64 = 10.0;

/// What preparing one image needs from the pipeline.
pub(super) struct ImageJob<'a> {
    pub tools: &'a Tools,
    pub cache_dir: &'a Path,
    pub encoder: &'a Arc<Semaphore>,
    pub registry: &'a Arc<MediaRegistry>,
    pub id: &'a str,
    pub path: &'a Path,
}

/// The rate frames are extracted at.
fn frame_rate(fps: Option<f64>) -> f64 {
    fps.unwrap_or(DEFAULT_FRAME_RATE).min(MAX_FRAME_RATE)
}

/// The filter that keeps a picture within `side` on its long side.
fn fit_within(side: u64) -> String {
    format!("scale=w='min({side},iw)':h='min({side},ih)':force_original_aspect_ratio=decrease")
}

/// Takes an image through the pipeline, reporting through `emit` (state, progress, message,
/// whether it has sound, meta). Never fails: what goes wrong is reported.
pub(super) async fn prepare(
    job: ImageJob<'_>,
    emit: impl Fn(ProxyState, Option<f32>, Option<String>, Option<bool>, Option<ProbeMeta>),
) {
    let report = |state, progress, message, meta| emit(state, progress, message, Some(false), meta);
    // ffprobe misreads SVG sizes, and the webview draws them anyway.
    let is_svg = job
        .path
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case("svg"));
    if is_svg {
        report(ProxyState::Skipped, None, None, None);
        return;
    }
    let probe = match ffprobe(job.tools, job.path, true).await {
        Ok(probe) => probe,
        Err(message) => return report(ProxyState::Error, None, Some(message), None),
    };

    let outcome = if probe.frames.is_some_and(|frames| frames > 1) {
        prepare_animation(&job, &probe, &report).await
    } else {
        prepare_still(&job, &probe, &report).await
    };
    if let Err(message) = outcome {
        report(ProxyState::Error, None, Some(message), None);
    }
}

/// Waits for the encoder, reporting why, and runs `work` holding it.
async fn encode_with<F: Future<Output = Result<(), String>>>(
    job: &ImageJob<'_>,
    reason: &str,
    report: &impl Fn(ProxyState, Option<f32>, Option<String>, Option<ProbeMeta>),
    work: F,
) -> Result<(), String> {
    report(ProxyState::Queued, Some(0.0), Some(reason.to_owned()), None);
    let _permit = job
        .encoder
        .acquire()
        .await
        .map_err(|_| "Encoder unavailable".to_owned())?;
    report(
        ProxyState::Encoding,
        Some(0.0),
        Some(reason.to_owned()),
        None,
    );
    work.await
}

async fn prepare_still(
    job: &ImageJob<'_>,
    probe: &Probe,
    report: &impl Fn(ProxyState, Option<f32>, Option<String>, Option<ProbeMeta>),
) -> Result<(), String> {
    let (width, height) = probe.shown_size();
    if !always_converted(job.path) && width.max(height) <= MAX_STILL_SIDE {
        report(ProxyState::Skipped, None, None, None);
        return Ok(());
    }
    let reason = "Converting this image for editing";
    let target = cache_path(job.cache_dir, job.path, "png").await?;
    if !tokio::fs::try_exists(&target).await.unwrap_or(false) {
        encode_with(job, reason, report, convert_still(job, &target)).await?;
    }
    job.registry.set_proxy(job.id, target);
    report(ProxyState::Ready, Some(1.0), Some(reason.to_owned()), None);
    Ok(())
}

async fn convert_still(job: &ImageJob<'_>, target: &Path) -> Result<(), String> {
    let partial = target.with_extension("partial.png");
    let mut cmd = command(&job.tools.ffmpeg);
    cmd.args(["-hide_banner", "-nostats", "-loglevel", "error", "-y", "-i"])
        .arg(job.path)
        .args(["-vf", &fit_within(MAX_STILL_SIDE)])
        .args(["-frames:v", "1", "-update", "1", "-pix_fmt", "rgba"])
        .args(["-f", "image2"])
        .arg(&partial);
    if let Err(detail) = run_encoder(cmd, None, |_| {}).await {
        let _ = tokio::fs::remove_file(&partial).await;
        return Err(format!("Could not convert this image: {detail}"));
    }
    tokio::fs::rename(&partial, target)
        .await
        .map_err(|e| format!("Could not save the converted image: {e}"))
}

async fn prepare_animation(
    job: &ImageJob<'_>,
    probe: &Probe,
    report: &impl Fn(ProxyState, Option<f32>, Option<String>, Option<ProbeMeta>),
) -> Result<(), String> {
    let reason = "Preparing the animation";
    let rate = frame_rate(probe.fps);
    let folder = cache_path(job.cache_dir, job.path, "frames").await?;
    if !tokio::fs::try_exists(&folder).await.unwrap_or(false) {
        let length = probe.frames.unwrap_or(0) as f64 / probe.fps.unwrap_or(rate);
        let duration_us = probe.duration_us.or(Some((length * 1_000_000.0) as u64));
        let on_progress = |p: f32| report(ProxyState::Encoding, Some(p), None, None);
        let work = extract_frames(job, &folder, rate, duration_us, on_progress);
        encode_with(job, reason, report, work).await?;
    }
    let frames = count_frames(&folder).await?;
    job.registry.set_frames(job.id, folder);
    let (width, height) = probe.shown_size();
    let meta = ProbeMeta {
        width,
        height,
        fps: Some(rate),
        duration: (frames as f64 / rate * 1_000_000.0).round() as u64,
        frames: Some(frames),
    };
    report(
        ProxyState::Ready,
        Some(1.0),
        Some(reason.to_owned()),
        Some(meta),
    );
    Ok(())
}

async fn extract_frames(
    job: &ImageJob<'_>,
    folder: &PathBuf,
    rate: f64,
    duration_us: Option<u64>,
    on_progress: impl Fn(f32),
) -> Result<(), String> {
    let partial = folder.with_extension("partial.frames");
    let _ = tokio::fs::remove_dir_all(&partial).await;
    tokio::fs::create_dir_all(&partial)
        .await
        .map_err(|e| format!("Could not create the frames folder: {e}"))?;
    // A steady rate, so the frame at a time is a division away.
    let filter = format!("fps={rate},{}", fit_within(MAX_FRAME_SIDE));
    let mut cmd = command(&job.tools.ffmpeg);
    cmd.args(["-hide_banner", "-nostats", "-loglevel", "error", "-y", "-i"])
        .arg(job.path)
        .args(["-vf", &filter])
        .args(["-pix_fmt", "rgba", "-start_number", "0", "-f", "image2"])
        .arg(partial.join("%05d.png"));
    if let Err(detail) = run_encoder(cmd, duration_us, on_progress).await {
        let _ = tokio::fs::remove_dir_all(&partial).await;
        return Err(format!("Could not read the animation: {detail}"));
    }
    tokio::fs::rename(&partial, folder)
        .await
        .map_err(|e| format!("Could not save the frames: {e}"))
}

async fn count_frames(folder: &Path) -> Result<u64, String> {
    let failed = |e: std::io::Error| format!("Could not read the frames: {e}");
    let mut entries = tokio::fs::read_dir(folder).await.map_err(failed)?;
    let mut count = 0;
    while entries.next_entry().await.map_err(failed)?.is_some() {
        count += 1;
    }
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frame_rate_is_capped_and_defaults_for_a_file_that_gives_none() {
        assert_eq!(frame_rate(Some(50.0)), 30.0);
        assert_eq!(frame_rate(Some(12.5)), 12.5);
        assert_eq!(frame_rate(None), 10.0);
    }
}
