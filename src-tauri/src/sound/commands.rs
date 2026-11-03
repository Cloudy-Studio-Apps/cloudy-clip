//! Tauri commands of the sound module.

use std::sync::Arc;

use serde::Serialize;
use tauri::State;
use tauri::ipc::Channel;

use super::denoise::{Denoised, MEASURE_ARGS, parse_floor, stretch_args};
use crate::error::AppError;
use crate::media::MediaRegistry;
use crate::media::derived::DerivedKind;
use crate::media::proxy::{ProxyJobs, command, find_tools};

/// How much noise reduction takes away, in dB (the document's `EFFECT_RANGES.denoise`).
const AMOUNT_DB: (f64, f64) = (0.0, 40.0);
/// The noise floors it removes, in dBFS: what `afftdn` accepts.
const FLOOR_DB: (f64, f64) = (-80.0, -20.0);

/// A rendered file: where it is for export, and the name the media server streams it under.
#[derive(Serialize)]
pub struct DenoisedFile {
    path: String,
    name: String,
}

fn within(value: f64, (min, max): (f64, f64), what: &str) -> Result<f64, AppError> {
    if value.is_finite() && (min..=max).contains(&value) {
        Ok(value)
    } else {
        Err(AppError::InvalidInput(format!(
            "The {what} must be from {min} to {max} dB"
        )))
    }
}

/// Renders a file's sound with its noise taken away (`afftdn`), once per file and settings, and
/// returns it. The media server streams it at `<url>/<id>?derived=<name>`. `on_progress` gets 0..1.
#[tauri::command]
pub async fn sound_denoise(
    id: String,
    amount_db: f64,
    floor_db: f64,
    on_progress: Channel<f32>,
    registry: State<'_, Arc<MediaRegistry>>,
    proxies: State<'_, ProxyJobs>,
) -> Result<DenoisedFile, AppError> {
    let kind = Denoised {
        amount_db: within(amount_db, AMOUNT_DB, "amount")?,
        floor_db: within(floor_db, FLOOR_DB, "noise floor")?,
    };
    let report = |progress: f32| {
        let _ = on_progress.send(progress);
    };
    let path = proxies
        .prepare(&registry, &id, &kind, &report)
        .await
        .map_err(AppError::Unavailable)?;
    Ok(DenoisedFile {
        path: path.display().to_string(),
        name: kind.name(),
    })
}

/// The noise floor of `from..to` (microseconds) of a file's sound, in dBFS, within what noise
/// reduction accepts: the stretch should hold only the noise.
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
    let floor = parse_floor(&stderr).unwrap_or(FLOOR_DB.0);
    Ok(floor.round().clamp(FLOOR_DB.0, FLOOR_DB.1))
}
