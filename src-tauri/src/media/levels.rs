//! The levels clip: black and white video for measuring how the webview draws video levels.

use std::sync::Arc;

use tauri::State;

use super::proxy::{ProxyJobs, command, find_tools};
use super::registry::MediaRegistry;
use super::stopper::ENCODERS;
use crate::error::{AppError, AppResult};

/// A tiny clip of black and white, for measuring how the webview draws video levels. Registered
/// like media, so it reaches a media element the same way. Made once, in the app's cache folder.
/// Returns its media id.
#[tauri::command]
pub async fn media_levels_clip(
    jobs: State<'_, ProxyJobs>,
    registry: State<'_, Arc<MediaRegistry>>,
) -> AppResult<String> {
    const ID: &str = "media-levels";
    let tools =
        find_tools().ok_or_else(|| AppError::Unavailable("FFmpeg was not found".to_owned()))?;
    let folder = jobs.cache_dir().parent().unwrap_or(jobs.cache_dir());
    tokio::fs::create_dir_all(folder).await?;
    let clip = folder.join("levels.mp4");
    if !tokio::fs::try_exists(&clip).await.unwrap_or(false) {
        // Counted like every encoder, so quitting stops it; written aside and renamed when done,
        // because an existing clip is reused as it is and a half-written one would spoil every measure.
        let Some(_running) = ENCODERS.enter() else {
            return Err(AppError::Unavailable("Cancelled".into()));
        };
        let partial = folder.join("levels.partial.mp4");
        let mut child = command(&tools.ffmpeg)
            .args(["-hide_banner", "-loglevel", "error", "-y"])
            .args(["-f", "lavfi", "-i", "color=black:s=64x64:r=30:d=0.5"])
            .args(["-f", "lavfi", "-i", "color=white:s=64x64:r=30:d=0.5"])
            .args(["-filter_complex", "hstack,format=yuv420p"])
            .args(["-colorspace", "bt709", "-color_primaries", "bt709"])
            .args(["-color_trc", "bt709", "-color_range", "tv"])
            .args(["-c:v", "libx264", "-crf", "1", "-movflags", "+faststart"])
            .arg(&partial)
            .spawn()?;
        let status = tokio::select! {
            status = child.wait() => status?,
            () = ENCODERS.stopping() => {
                let _ = child.kill().await;
                return Err(AppError::Unavailable("Cancelled".into()));
            }
        };
        if !status.success() {
            return Err(AppError::Unavailable(
                "Could not make the levels clip".into(),
            ));
        }
        tokio::fs::rename(&partial, &clip).await?;
    }
    let size = tokio::fs::metadata(&clip).await?.len();
    registry.register(ID, &clip, size)?;
    Ok(ID.to_owned())
}
