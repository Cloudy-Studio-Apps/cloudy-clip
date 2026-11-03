//! Tauri commands of the sound module.

use std::path::PathBuf;
use std::sync::Arc;

use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, State};

use super::floor::{MEASURE_ARGS, parse_floor, stretch_args};
use super::record::{TakeStarted, TakeWritten, Takes};
use crate::error::AppError;
use crate::media::denoise::AFFTDN_NF;
use crate::media::proxy::{command, find_tools};
use crate::media::{MediaRegistry, cache_root};

/// The noise floor of `from..to` (microseconds) of a file's sound, in dBFS, within what noise
/// reduction (`afftdn`) accepts: the stretch should hold only the noise.
#[tauri::command]
pub async fn sound_measure_floor(
    id: String,
    from: u64,
    to: u64,
    registry: State<'_, Arc<MediaRegistry>>,
) -> Result<f64, AppError> {
    if to <= from {
        return Err(AppError::InvalidInput("The stretch is empty".into()));
    }
    let (source, _) = registry
        .original_of(&id)
        .ok_or_else(|| AppError::NotFound("Unknown media id".into()))?;
    let tools = find_tools().ok_or_else(|| AppError::Unavailable("FFmpeg was not found".into()))?;
    let output = command(&tools.ffmpeg)
        .args(["-hide_banner", "-nostats"])
        .args(stretch_args(from, to))
        .arg("-i")
        .arg(&source)
        .args(MEASURE_ARGS)
        .output()
        .await?;
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !output.status.success() {
        let reason = stderr.lines().last().unwrap_or("unknown error");
        return Err(AppError::Unavailable(format!(
            "Could not measure the noise: {reason}"
        )));
    }
    // Digital silence has no floor: the lowest one noise reduction takes.
    let floor = parse_floor(&stderr).unwrap_or(AFFTDN_NF.0);
    Ok(floor.round().clamp(AFFTDN_NF.0, AFFTDN_NF.1))
}

/// Starts a recording: a new WAV file `stem.wav` (or `stem 2.wav`...; never overwrites) in the
/// project's folder, or, for a project with no file yet, in `recordings` in the app's cache.
/// Returns the take's id, for `sound_record_write`, and its path.
#[tauri::command]
pub async fn sound_record_begin(
    project_dir: Option<String>,
    stem: String,
    sample_rate: u32,
    app: AppHandle,
    takes: State<'_, Takes>,
) -> Result<TakeStarted, AppError> {
    let folder = match project_dir {
        Some(dir) => {
            let dir = PathBuf::from(dir);
            if !dir.is_absolute() {
                return Err(AppError::InvalidInput(format!(
                    "Not an absolute folder: {}",
                    dir.display()
                )));
            }
            dir
        }
        None => cache_root(&app).join("recordings"),
    };
    takes.begin(&folder, &stem, sample_rate).await
}

/// Appends a chunk of a recording: the body is raw 16-bit little-endian mono samples, the headers
/// `id` (from `sound_record_begin`) and `done` (`1` on the last chunk, which closes the take;
/// a take with no samples leaves no file).
#[tauri::command]
pub async fn sound_record_write(
    request: Request<'_>,
    takes: State<'_, Takes>,
) -> Result<TakeWritten, AppError> {
    // Raw bytes; IPC's postMessage fallback turns them into a JSON array of numbers.
    let parsed: Vec<u8>;
    let samples: &[u8] = match request.body() {
        InvokeBody::Raw(bytes) => bytes,
        InvokeBody::Json(value) => {
            parsed = serde_json::from_value(value.clone())
                .map_err(|_| AppError::InvalidInput("Samples must be bytes".into()))?;
            &parsed
        }
    };
    let header = |name: &str| request.headers().get(name).and_then(|v| v.to_str().ok());
    let id = header("id").ok_or_else(|| AppError::InvalidInput("No recording id".into()))?;
    let done = header("done") == Some("1");
    takes.write(id, samples, done).await
}
