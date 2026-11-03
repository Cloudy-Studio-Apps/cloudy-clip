//! Tauri commands of the media module.

use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::{AppHandle, State};

use super::MediaServerUrl;
use super::denoise::{AFFTDN_NF, AFFTDN_NR, Denoised};
use super::derived::DerivedKind;
use super::proxy::ProxyJobs;
use super::registry::{MediaFile, MediaRegistry, RegisteredMedia, describe};
use super::reversed::Reversed;
use crate::error::AppError;

/// A file to register, under the id the frontend gave it.
#[derive(Deserialize)]
pub struct RegisterFile {
    id: String,
    path: String,
}

/// Outcome for one path. Imports are per-file: one bad file never fails the batch.
#[derive(Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum RegisterOutcome {
    Ok {
        media: RegisteredMedia,
    },
    Error {
        id: String,
        path: String,
        error: AppError,
    },
}

/// Validates local files and allows the webview to stream them from the media server.
/// Each accepted file also enters the proxy pipeline (progress arrives as `media://proxy`).
#[tauri::command]
pub async fn media_register(
    app: AppHandle,
    files: Vec<RegisterFile>,
    registry: State<'_, Arc<MediaRegistry>>,
    proxies: State<'_, ProxyJobs>,
) -> Result<Vec<RegisterOutcome>, AppError> {
    let mut outcomes = Vec::with_capacity(files.len());
    for RegisterFile { id, path: raw } in files {
        let path = PathBuf::from(&raw);
        let outcome = match tokio::fs::metadata(&path).await {
            Ok(meta) if meta.is_file() => match registry.register(&id, &path, meta.len()) {
                Ok(media) => {
                    proxies.start(
                        app.clone(),
                        registry.inner().clone(),
                        media.id.clone(),
                        media.generation,
                        path.clone(),
                        media.kind,
                    );
                    RegisterOutcome::Ok { media }
                }
                Err(error) => RegisterOutcome::Error {
                    id,
                    path: raw,
                    error,
                },
            },
            Ok(_) => RegisterOutcome::Error {
                id,
                path: raw.clone(),
                error: AppError::InvalidInput(format!("Not a file: {raw}")),
            },
            Err(_) => RegisterOutcome::Error {
                id,
                path: raw.clone(),
                error: AppError::NotFound(format!("File not found: {raw}")),
            },
        };
        outcomes.push(outcome);
    }
    Ok(outcomes)
}

/// What a file is, without registering it: how a relink checks the file before it writes.
#[tauri::command]
pub async fn media_stat(path: String) -> Result<MediaFile, AppError> {
    let file = PathBuf::from(&path);
    let meta = tokio::fs::metadata(&file)
        .await
        .map_err(|_| AppError::NotFound(format!("File not found: {path}")))?;
    if !meta.is_file() {
        return Err(AppError::InvalidInput(format!("Not a file: {path}")));
    }
    describe(&file, meta.len())
}

/// Makes the full-size copy export draws from, for a file that previews through a proxy.
/// `on_progress` gets 0..1. Returns whether the file has one.
#[tauri::command]
pub async fn media_prepare_master(
    id: String,
    on_progress: Channel<f32>,
    registry: State<'_, Arc<MediaRegistry>>,
    proxies: State<'_, ProxyJobs>,
) -> Result<bool, AppError> {
    let report = |progress: f32| {
        let _ = on_progress.send(progress);
    };
    proxies
        .prepare_master(&registry, &id, report)
        .await
        .map_err(AppError::Unavailable)
}

/// Makes the copy of a file that runs backwards, for preview or, with `full`, for export.
/// `on_progress` gets 0..1.
#[tauri::command]
pub async fn media_prepare_reversed(
    id: String,
    full: bool,
    on_progress: Channel<f32>,
    registry: State<'_, Arc<MediaRegistry>>,
    proxies: State<'_, ProxyJobs>,
) -> Result<(), AppError> {
    let report = |progress: f32| {
        let _ = on_progress.send(progress);
    };
    proxies
        .prepare(&registry, &id, &Reversed { full, of: None }, &report)
        .await
        .map(|_| ())
        .map_err(AppError::Unavailable)
}

/// A derived file: where it is for export, and the name the media server streams it under.
#[derive(Serialize)]
pub struct DerivedFile {
    path: String,
    name: String,
}

/// What a rendering of noise reduction made: the file, and its reversed copy when asked for.
#[derive(Serialize)]
pub struct DenoisedFiles {
    forward: DerivedFile,
    reversed: Option<DerivedFile>,
}

/// Settings of noise reduction whose files are kept, and whether their reversed copy is too.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeptDenoise {
    amount_db: f64,
    floor_db: f64,
    reversed: bool,
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

/// The reversed copy of a denoised file, at preview quality: what a reversed clip plays.
fn reversed_of(denoised: &Denoised) -> Reversed {
    Reversed {
        full: false,
        of: Some(denoised.name()),
    }
}

/// Renders a file's sound with its noise taken away (`afftdn`), once per file and settings; with
/// `reversed`, then a copy of that which runs backwards (for a reversed clip, so it sounds as
/// export's denoise-then-reverse). Returns both files it made or found, each streamed at
/// `<url>/<id>?derived=<name>`. `on_progress` gets 0..1 over both steps.
#[tauri::command]
pub async fn media_denoise(
    id: String,
    amount_db: f64,
    floor_db: f64,
    reversed: bool,
    on_progress: Channel<f32>,
    registry: State<'_, Arc<MediaRegistry>>,
    proxies: State<'_, ProxyJobs>,
) -> Result<DenoisedFiles, AppError> {
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
    let file = |path: std::path::PathBuf, name: String| DerivedFile {
        path: path.display().to_string(),
        name,
    };
    let path = proxies
        .prepare(&registry, &id, &denoised, &report(0.0))
        .await
        .map_err(AppError::Unavailable)?;
    let forward = file(path, denoised.name());
    if !reversed {
        return Ok(DenoisedFiles {
            forward,
            reversed: None,
        });
    }
    let backwards = reversed_of(&denoised);
    let path = proxies
        .prepare(&registry, &id, &backwards, &report(1.0))
        .await
        .map_err(AppError::Unavailable)?;
    Ok(DenoisedFiles {
        forward,
        reversed: Some(file(path, backwards.name())),
    })
}

/// Deletes a file's noise reduction renderings (and their reversed copies) of every setting but
/// those in `keep`: of older recipes too. Only files of the cache are touched.
#[tauri::command]
pub async fn media_drop_denoised(
    id: String,
    keep: Vec<KeptDenoise>,
    registry: State<'_, Arc<MediaRegistry>>,
    proxies: State<'_, ProxyJobs>,
) -> Result<(), AppError> {
    let names: Vec<String> = keep
        .iter()
        .flat_map(|kept| {
            let denoised = Denoised {
                amount_db: kept.amount_db,
                floor_db: kept.floor_db,
            };
            let backwards = kept.reversed.then(|| reversed_of(&denoised).name());
            [Some(denoised.name()), backwards].into_iter().flatten()
        })
        .collect();
    proxies
        .drop_derived(&registry, &id, Denoised::FAMILY, &names)
        .await
        .map_err(AppError::Unavailable)
}

/// Base URL the webview streams media from: `<url>/<media id>`.
#[tauri::command]
pub async fn media_server_url(state: State<'_, MediaServerUrl>) -> Result<String, AppError> {
    // The server binds in the background at startup; wait briefly if asked very early.
    for _ in 0..50 {
        if let Some(url) = state.0.read().ok().and_then(|u| u.clone()) {
            return Ok(url);
        }
        tokio::time::sleep(std::time::Duration::from_millis(20)).await;
    }
    Err(AppError::Unavailable(
        "The media server is not running".into(),
    ))
}
