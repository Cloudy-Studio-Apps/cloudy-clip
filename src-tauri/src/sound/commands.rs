//! Tauri commands of the sound module.

use std::sync::Arc;

use serde::Serialize;
use tauri::State;
use tauri::ipc::Channel;

use super::denoise::{AFFTDN_NF, AFFTDN_NR, Denoised, MEASURE_ARGS, parse_floor, stretch_args};
use crate::error::AppError;
use crate::media::MediaRegistry;
use crate::media::derived::DerivedKind;
use crate::media::proxy::{ProxyJobs, command, find_tools};
use crate::media::reversed::Reversed;

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
/// returns it; with `reversed`, then a copy of that which runs backwards (for a reversed clip, so it
/// sounds as export's denoise-then-reverse). The media server streams it at
/// `<url>/<id>?derived=<name>`. `on_progress` gets 0..1 over both steps.
#[tauri::command]
pub async fn sound_denoise(
    id: String,
    amount_db: f64,
    floor_db: f64,
    reversed: bool,
    on_progress: Channel<f32>,
    registry: State<'_, Arc<MediaRegistry>>,
    proxies: State<'_, ProxyJobs>,
) -> Result<DenoisedFile, AppError> {
    let denoised = Denoised {
        amount_db: within(amount_db, AFFTDN_NR, "amount")?,
        floor_db: within(floor_db, AFFTDN_NF, "noise floor")?,
    };
    let steps = if reversed { 2.0 } else { 1.0 };
    let channel = &on_progress;
    let report = |step: f32| {
        move |progress: f32| {
            let _ = channel.send((step + progress) / steps);
        }
    };
    let failed = AppError::Unavailable;
    let path = proxies
        .prepare(&registry, &id, &denoised, &report(0.0))
        .await
        .map_err(failed)?;
    if !reversed {
        return Ok(DenoisedFile {
            path: path.display().to_string(),
            name: denoised.name(),
        });
    }
    let backwards = Reversed {
        full: false,
        of: Some(denoised.name()),
    };
    let path = proxies
        .prepare(&registry, &id, &backwards, &report(1.0))
        .await
        .map_err(failed)?;
    Ok(DenoisedFile {
        path: path.display().to_string(),
        name: backwards.name(),
    })
}

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
