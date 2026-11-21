//! Project files: reading and writing them anywhere on disk, and the list of recent projects.
//! Which project is open, and everything else about it, lives in TypeScript.

pub mod commands;

use std::path::{Path, PathBuf};

use tokio::io::AsyncReadExt;

use crate::error::{AppError, AppResult};

/// A path from the webview or an agent, kept to one kind of file: absolute, ending in
/// `.<extension>` (any case). Shared by every module that reads or writes files by path.
pub fn file_path(raw: &str, extension: &str) -> AppResult<PathBuf> {
    let path = PathBuf::from(raw);
    let matches = path
        .extension()
        .is_some_and(|e| e.eq_ignore_ascii_case(extension));
    if !path.is_absolute() || !matches {
        return Err(AppError::InvalidInput(format!(
            "Not an absolute path to a .{extension} file: {raw}"
        )));
    }
    Ok(path)
}

/// Refuses a file over `max` bytes before reading it.
fn check_size(raw: &str, bytes: u64, max: u64, what: &str) -> AppResult<()> {
    if bytes > max {
        return Err(AppError::InvalidInput(format!(
            "{raw} is larger than {} MB, too large for {what}",
            max / (1024 * 1024)
        )));
    }
    Ok(())
}

/// The UTF-8 text of `file` (`raw` is its path as given), at most `max` bytes. It is opened once
/// and read through a cap, so one that grows after the size check is still refused.
pub async fn read_text(raw: &str, file: &Path, max: u64, what: &str) -> AppResult<String> {
    // Checked before opening too: opening a FIFO or device would block until something writes to it.
    if let Ok(meta) = tokio::fs::metadata(file).await
        && !meta.is_file()
    {
        return Err(AppError::InvalidInput(format!("Not a file: {raw}")));
    }
    let opened = match tokio::fs::File::open(file).await {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(AppError::NotFound(format!("File not found: {raw}")));
        }
        result => result?,
    };
    let meta = opened.metadata().await?;
    if !meta.is_file() {
        return Err(AppError::InvalidInput(format!("Not a file: {raw}")));
    }
    check_size(raw, meta.len(), max, what)?;
    let mut bytes = Vec::with_capacity(meta.len() as usize);
    opened.take(max + 1).read_to_end(&mut bytes).await?;
    check_size(raw, bytes.len() as u64, max, what)?;
    String::from_utf8(bytes)
        .map_err(|_| AppError::InvalidInput(format!("{raw} is not a text file (UTF-8)")))
}
