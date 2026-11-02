//! Tauri commands of the media module.

use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::{AppHandle, State};

use super::MediaServerUrl;
use super::proxy::ProxyJobs;
use super::registry::{MediaFile, MediaRegistry, RegisteredMedia, describe};
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
        .prepare_reversed(&registry, &id, full, report)
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
