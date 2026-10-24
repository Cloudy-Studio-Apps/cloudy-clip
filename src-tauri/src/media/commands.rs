//! Tauri commands of the media module.

use std::path::PathBuf;
use std::sync::Arc;

use serde::Serialize;
use tauri::State;

use super::MediaServerUrl;
use super::registry::{MediaRegistry, RegisteredMedia};
use crate::error::AppError;

/// Outcome for one path. Imports are per-file: one bad file never fails the batch.
#[derive(Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum RegisterOutcome {
    Ok { media: RegisteredMedia },
    Error { path: String, error: AppError },
}

/// Validates local files and allows the webview to stream them from the media server.
#[tauri::command]
pub async fn media_register(
    paths: Vec<String>,
    registry: State<'_, Arc<MediaRegistry>>,
) -> Result<Vec<RegisterOutcome>, AppError> {
    let mut outcomes = Vec::with_capacity(paths.len());
    for raw in paths {
        let path = PathBuf::from(&raw);
        let outcome = match tokio::fs::metadata(&path).await {
            Ok(meta) if meta.is_file() => match registry.register(&path, meta.len()) {
                Ok(media) => RegisterOutcome::Ok { media },
                Err(error) => RegisterOutcome::Error { path: raw, error },
            },
            Ok(_) => RegisterOutcome::Error {
                path: raw.clone(),
                error: AppError::InvalidInput(format!("Not a file: {raw}")),
            },
            Err(_) => RegisterOutcome::Error {
                path: raw.clone(),
                error: AppError::NotFound(format!("File not found: {raw}")),
            },
        };
        outcomes.push(outcome);
    }
    Ok(outcomes)
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
