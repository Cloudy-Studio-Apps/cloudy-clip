//! Tauri commands of the workspace module.

use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};
use tokio::io::AsyncWriteExt;

use crate::error::{AppError, AppResult};

const EXTENSION: &str = "cclip";
const RECENTS_FILE: &str = "recent.json";

/// Project commands take paths from the webview and from agents, so they only touch project files.
fn project_path(raw: &str) -> AppResult<PathBuf> {
    let path = PathBuf::from(raw);
    let is_project = path.extension().is_some_and(|e| e == EXTENSION);
    if !path.is_absolute() || !is_project {
        return Err(AppError::InvalidInput(format!(
            "Not an absolute path to a .{EXTENSION} file: {raw}"
        )));
    }
    Ok(path)
}

/// Writes next to the target and renames over it, so a crash never leaves half a file.
async fn write_atomic(path: &Path, contents: &str) -> AppResult<()> {
    let parent = path
        .parent()
        .ok_or_else(|| AppError::InvalidInput(format!("No folder in {}", path.display())))?;
    tokio::fs::create_dir_all(parent).await?;
    let temporary = path.with_extension("cclip.tmp");
    let mut file = tokio::fs::File::create(&temporary).await?;
    file.write_all(contents.as_bytes()).await?;
    file.sync_all().await?;
    drop(file);
    tokio::fs::rename(&temporary, path).await?;
    Ok(())
}

/// Text of a project file.
#[tauri::command]
pub async fn workspace_read(path: String) -> Result<String, AppError> {
    let file = project_path(&path)?;
    match tokio::fs::read_to_string(&file).await {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            Err(AppError::NotFound(format!("File not found: {path}")))
        }
        result => Ok(result?),
    }
}

/// Saves a project file, creating its folder when needed.
#[tauri::command]
pub async fn workspace_write(path: String, contents: String) -> Result<(), AppError> {
    write_atomic(&project_path(&path)?, &contents).await
}

/// Renames a project file. Never overwrites.
#[tauri::command]
pub async fn workspace_rename(from: String, to: String) -> Result<(), AppError> {
    let source = project_path(&from)?;
    let target = project_path(&to)?;
    if tokio::fs::try_exists(&target).await? {
        return Err(AppError::InvalidInput(format!("Already exists: {to}")));
    }
    tokio::fs::rename(&source, &target).await?;
    Ok(())
}

/// A path for a new project in `folder`: `stem`, or `stem 2`, `stem 3`... if taken.
#[tauri::command]
pub async fn workspace_unique_path(folder: String, stem: String) -> Result<String, AppError> {
    let folder = PathBuf::from(folder);
    for n in 1u32.. {
        let name = match n {
            1 => format!("{stem}.{EXTENSION}"),
            _ => format!("{stem} {n}.{EXTENSION}"),
        };
        let path = folder.join(name);
        if !tokio::fs::try_exists(&path).await? {
            return Ok(path.display().to_string());
        }
    }
    Err(AppError::Unavailable("No free project name".into()))
}

/// Which of these files exist: projects in the recent list, and media when a project opens.
#[tauri::command]
pub async fn workspace_exists(paths: Vec<String>) -> Vec<bool> {
    let mut found = Vec::with_capacity(paths.len());
    for path in paths {
        found.push(tokio::fs::try_exists(&path).await.unwrap_or(false));
    }
    found
}

fn recents_path(app: &AppHandle) -> AppResult<PathBuf> {
    let folder = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Unavailable(format!("No app data folder: {e}")))?;
    Ok(folder.join(RECENTS_FILE))
}

/// The saved recent list, empty when there is none yet.
#[tauri::command]
pub async fn workspace_recents_read(app: AppHandle) -> Result<String, AppError> {
    match tokio::fs::read_to_string(recents_path(&app)?).await {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        result => Ok(result?),
    }
}

/// Saves the recent list.
#[tauri::command]
pub async fn workspace_recents_write(app: AppHandle, contents: String) -> Result<(), AppError> {
    write_atomic(&recents_path(&app)?, &contents).await
}
