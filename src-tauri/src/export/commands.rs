//! Tauri commands of the export module.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use serde::Serialize;
use tauri::State;

use super::encoders::{Capabilities, capabilities};
use super::job::Job;
use super::recipe::{ExportSpec, Format};
use super::{FrameUrl, Jobs, PartialNotes};
use crate::error::{AppError, AppResult};
use crate::media::MediaRegistry;
use crate::media::proxy::{Tools, command, ffprobe, find_tools};
use crate::media::server::random_token;

/// Where a started export takes its frames.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartedExport {
    job_id: String,
    frame_url: String,
}

/// What FFmpeg on this machine can write.
#[tauri::command]
pub async fn export_capabilities() -> Capabilities {
    capabilities().await.clone()
}

/// The encoder on the graphics card for this export, if it asked for one and one works.
async fn card_for(spec: &ExportSpec) -> Option<String> {
    if !spec.hardware {
        return None;
    }
    let found = capabilities().await;
    match spec.format {
        Format::H264 => found.h264_card.clone(),
        Format::H265 => found.h265_card.clone(),
        _ => None,
    }
}

/// Marks the sounds of one-channel files.
async fn find_mono(tools: &Tools, spec: &mut ExportSpec) {
    let mut known: HashMap<String, bool> = HashMap::new();
    for segment in &mut spec.sound {
        if let Some(mono) = known.get(&segment.path) {
            segment.mono = *mono;
            continue;
        }
        let probe = ffprobe(tools, Path::new(&segment.path), false).await;
        let mono = probe.is_ok_and(|probe| probe.audio_channels == Some(1));
        known.insert(segment.path.clone(), mono);
        segment.mono = mono;
    }
}

/// A tiny clip of black and white, for measuring how the webview draws video levels. Registered
/// like media, so it reaches a media element the same way. Returns its media id.
#[tauri::command]
pub async fn export_levels_clip(
    notes: State<'_, PartialNotes>,
    registry: State<'_, Arc<MediaRegistry>>,
) -> AppResult<String> {
    const ID: &str = "export-levels";
    let tools =
        find_tools().ok_or_else(|| AppError::Unavailable("FFmpeg was not found".to_owned()))?;
    let folder = notes.0.parent().unwrap_or(&notes.0);
    tokio::fs::create_dir_all(folder).await?;
    let clip = folder.join("levels.mp4");
    if !tokio::fs::try_exists(&clip).await.unwrap_or(false) {
        let status = command(&tools.ffmpeg)
            .args(["-hide_banner", "-loglevel", "error", "-y"])
            .args(["-f", "lavfi", "-i", "color=black:s=64x64:r=30:d=0.5"])
            .args(["-f", "lavfi", "-i", "color=white:s=64x64:r=30:d=0.5"])
            .args(["-filter_complex", "hstack,format=yuv420p"])
            .args(["-colorspace", "bt709", "-color_primaries", "bt709"])
            .args(["-color_trc", "bt709", "-color_range", "tv"])
            .args(["-c:v", "libx264", "-crf", "1", "-movflags", "+faststart"])
            .arg(&clip)
            .status()
            .await?;
        if !status.success() {
            return Err(AppError::Unavailable(
                "Could not make the levels clip".into(),
            ));
        }
    }
    let size = tokio::fs::metadata(&clip).await?.len();
    registry.register(ID, &clip, size)?;
    Ok(ID.to_owned())
}

/// Starts FFmpeg. Frames go to the returned URL, one POST each, then `export_finish`.
#[tauri::command]
pub async fn export_begin(
    mut spec: ExportSpec,
    jobs: State<'_, Arc<Jobs>>,
    frame_url: State<'_, FrameUrl>,
    notes: State<'_, PartialNotes>,
) -> AppResult<StartedExport> {
    let Some(tools) = find_tools() else {
        return Err(AppError::Unavailable(
            "FFmpeg was not found. Install FFmpeg to export videos.".into(),
        ));
    };
    let base = frame_url
        .0
        .read()
        .ok()
        .and_then(|url| url.clone())
        .ok_or_else(|| AppError::Unavailable("The export route is not ready".into()))?;
    if let Some(folder) = Path::new(&spec.output).parent() {
        tokio::fs::create_dir_all(folder).await?;
    }
    find_mono(&tools, &mut spec).await;
    let card = card_for(&spec).await;
    let job = Job::start(&tools, &spec, card.as_deref()).map_err(AppError::Unavailable)?;
    let job_id = random_token()?;
    tokio::fs::create_dir_all(&notes.0).await?;
    let partial = job.partial.display().to_string();
    tokio::fs::write(notes.0.join(&job_id), partial).await?;
    jobs.add(job_id.clone(), Arc::new(job));
    Ok(StartedExport {
        frame_url: format!("{base}/{job_id}"),
        job_id,
    })
}

/// Waits for FFmpeg to finish and returns the path of the file.
#[tauri::command]
pub async fn export_finish(
    job_id: String,
    jobs: State<'_, Arc<Jobs>>,
    notes: State<'_, PartialNotes>,
) -> AppResult<String> {
    let job = jobs
        .get(&job_id)
        .ok_or_else(|| AppError::NotFound("That export is not running".into()))?;
    let outcome = job.finish().await;
    jobs.take(&job_id);
    let _ = tokio::fs::remove_file(notes.0.join(&job_id)).await;
    let path = outcome.map_err(AppError::Unavailable)?;
    Ok(path.display().to_string())
}

/// Stops an export and removes what it wrote. An export that already ended is left alone.
#[tauri::command]
pub async fn export_cancel(
    job_id: String,
    jobs: State<'_, Arc<Jobs>>,
    notes: State<'_, PartialNotes>,
) -> AppResult<()> {
    if let Some(job) = jobs.take(&job_id) {
        job.cancel().await;
    }
    let _ = tokio::fs::remove_file(notes.0.join(&job_id)).await;
    Ok(())
}

/// Bytes free on the disk of `folder`, or of the nearest parent that exists.
#[tauri::command]
pub async fn export_free_space(folder: String) -> AppResult<u64> {
    let path = PathBuf::from(folder);
    let existing = path.ancestors().find(|p| p.exists()).unwrap_or(&path);
    Ok(fs2::available_space(existing)?)
}

/// `path` if it's free, otherwise the first of `name (2).ext`, `name (3).ext`… that is.
#[tauri::command]
pub async fn export_unique_path(path: String) -> String {
    let wanted = PathBuf::from(&path);
    if !wanted.exists() {
        return path;
    }
    let stem = wanted
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let extension = wanted
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    (2u32..)
        .map(|n| wanted.with_file_name(format!("{stem} ({n}){extension}")))
        .find(|candidate| !candidate.exists())
        .map_or(path, |free| free.display().to_string())
}
