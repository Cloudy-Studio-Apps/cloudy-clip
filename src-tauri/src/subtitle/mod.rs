//! Subtitle module: reading and writing `.srt` / `.vtt` files. Parsing and writing their cues
//! lives in TypeScript.

use std::path::PathBuf;

use crate::error::{AppError, AppResult};
use crate::workspace::{file_path, read_text};

/// The largest subtitle file read or written: far beyond a feature film's cues.
const MAX_BYTES: u64 = 8 * 1024 * 1024;

/// A subtitle path the webview or an agent gave: absolute, `.srt` or `.vtt`.
fn subtitle_path(raw: &str) -> AppResult<PathBuf> {
    file_path(raw, "srt").or_else(|_| file_path(raw, "vtt"))
}

/// The text of an `.srt` or `.vtt` file at an absolute path, at most 8 MB, UTF-8.
#[tauri::command]
pub async fn subtitle_read_text(path: String) -> Result<String, AppError> {
    read_text(&path, &subtitle_path(&path)?, MAX_BYTES, "subtitles").await
}

/// Writes an `.srt` or `.vtt` file at an absolute path (at most 8 MB), replacing what is there.
#[tauri::command]
pub async fn subtitle_write_text(path: String, contents: String) -> Result<(), AppError> {
    if contents.len() as u64 > MAX_BYTES {
        return Err(AppError::InvalidInput(
            "Subtitles larger than 8 MB".to_string(),
        ));
    }
    tokio::fs::write(subtitle_path(&path)?, contents).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn takes_only_absolute_srt_and_vtt_paths() {
        let root = if cfg!(windows) { "C:\\s" } else { "/s" };
        assert!(subtitle_path(&format!("{root}/a.srt")).is_ok());
        assert!(subtitle_path(&format!("{root}/a.VTT")).is_ok());
        assert!(subtitle_path(&format!("{root}/a.txt")).is_err());
        assert!(subtitle_path("a.srt").is_err());
    }
}
