//! Test clips for measuring how the webview draws video: its levels, and which matrix it decodes
//! HD video with.

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
    let args = [
        "-f",
        "lavfi",
        "-i",
        "color=black:s=64x64:r=30:d=0.5",
        "-f",
        "lavfi",
        "-i",
        "color=white:s=64x64:r=30:d=0.5",
        "-filter_complex",
        "hstack,format=yuv420p",
        "-colorspace",
        "bt709",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        "-color_range",
        "tv",
    ];
    test_clip(&jobs, &registry, "media-levels", "levels", &args).await
}

/// A tiny 1280×720 clip of 75% yellow stored with the BT.709 matrix, for measuring which matrix
/// the webview decodes HD video with: untagged, or with `tagged` its BT.709 tags. Made and
/// registered like the levels clip. Returns its media id.
#[tauri::command]
pub async fn media_matrix_clip(
    jobs: State<'_, ProxyJobs>,
    registry: State<'_, Arc<MediaRegistry>>,
    tagged: bool,
) -> AppResult<String> {
    // The scale writes BT.709 values; setparams then states the tags, or clears them.
    let tags = if tagged {
        "colorspace=bt709:color_primaries=bt709:color_trc=bt709:range=tv"
    } else {
        "colorspace=unknown:color_primaries=unknown:color_trc=unknown:range=unknown"
    };
    let filter =
        format!("scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams={tags}");
    let args = [
        "-f",
        "lavfi",
        "-i",
        "color=c=0xBFBF00:s=1280x720:r=30:d=0.5",
        "-vf",
        &filter,
    ];
    let (id, name) = if tagged {
        ("media-matrix-709", "matrix-709")
    } else {
        ("media-matrix", "matrix")
    };
    test_clip(&jobs, &registry, id, name, &args).await
}

/// Makes `<name>.mp4` in the app's cache folder once from FFmpeg's `args` (inputs, filters and
/// tags), and registers it under `id`.
async fn test_clip(
    jobs: &ProxyJobs,
    registry: &MediaRegistry,
    id: &str,
    name: &str,
    args: &[&str],
) -> AppResult<String> {
    let tools =
        find_tools().ok_or_else(|| AppError::Unavailable("FFmpeg was not found".to_owned()))?;
    let folder = jobs.cache_dir().parent().unwrap_or(jobs.cache_dir());
    tokio::fs::create_dir_all(folder).await?;
    let clip = folder.join(format!("{name}.mp4"));
    if !tokio::fs::try_exists(&clip).await.unwrap_or(false) {
        // Counted like every encoder, so quitting stops it; written aside and renamed when done,
        // because an existing clip is reused as it is and a half-written one would spoil every measure.
        let Some(_running) = ENCODERS.enter() else {
            return Err(AppError::Unavailable("Cancelled".into()));
        };
        let partial = folder.join(format!("{name}.partial.mp4"));
        let mut child = command(&tools.ffmpeg)
            .args(["-hide_banner", "-loglevel", "error", "-y"])
            .args(args)
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
            return Err(AppError::Unavailable(format!(
                "Could not make the {name} clip"
            )));
        }
        tokio::fs::rename(&partial, &clip).await?;
    }
    let size = tokio::fs::metadata(&clip).await?.len();
    registry.register(id, &clip, size)?;
    Ok(id.to_owned())
}
