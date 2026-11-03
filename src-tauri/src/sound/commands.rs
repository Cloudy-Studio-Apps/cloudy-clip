//! Tauri commands of the sound module.

use std::sync::Arc;

use tauri::State;

use super::floor::{MEASURE_ARGS, parse_floor, stretch_args};
use crate::error::AppError;
use crate::media::MediaRegistry;
use crate::media::denoise::AFFTDN_NF;
use crate::media::proxy::{command, find_tools};

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
