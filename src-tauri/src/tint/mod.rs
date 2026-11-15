//! Tint module: reading `.cube` LUT files. Parsing them and everything else lives in TypeScript.

use tokio::io::AsyncReadExt;

use crate::error::{AppError, AppResult};
use crate::workspace::file_path;

/// The largest LUT file read: a 65-point cube is about 7 MB of text.
const MAX_BYTES: u64 = 8 * 1024 * 1024;

/// A LUT path the webview or an agent gave: absolute, `.cube`.
fn lut_path(raw: &str) -> AppResult<std::path::PathBuf> {
    file_path(raw, "cube")
}

/// Refuses a file over `MAX_BYTES` before reading it.
fn check_size(raw: &str, bytes: u64) -> AppResult<()> {
    if bytes > MAX_BYTES {
        return Err(AppError::InvalidInput(format!(
            "{raw} is larger than 8 MB, too large for a LUT"
        )));
    }
    Ok(())
}

/// The text of a `.cube` file at an absolute path, at most 8 MB, UTF-8. The file is opened once and
/// read through a cap, so one that grows after the size check is still refused.
#[tauri::command]
pub async fn tint_read_lut(path: String) -> Result<String, AppError> {
    let file = lut_path(&path)?;
    let opened = match tokio::fs::File::open(&file).await {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err(AppError::NotFound(format!("File not found: {path}")));
        }
        result => result?,
    };
    let meta = opened.metadata().await?;
    if !meta.is_file() {
        return Err(AppError::InvalidInput(format!("Not a file: {path}")));
    }
    check_size(&path, meta.len())?;
    let mut bytes = Vec::with_capacity(meta.len() as usize);
    opened.take(MAX_BYTES + 1).read_to_end(&mut bytes).await?;
    check_size(&path, bytes.len() as u64)?;
    String::from_utf8(bytes)
        .map_err(|_| AppError::InvalidInput(format!("{path} is not a text file (UTF-8)")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn takes_only_absolute_cube_paths() {
        let absolute = if cfg!(windows) {
            "C:\\luts\\look.cube"
        } else {
            "/luts/look.cube"
        };
        assert!(lut_path(absolute).is_ok());
        assert!(lut_path(&absolute.replace(".cube", ".CUBE")).is_ok());
        assert!(lut_path("luts/look.cube").is_err());
        assert!(lut_path(&absolute.replace(".cube", ".txt")).is_err());
        assert!(lut_path(&absolute.replace(".cube", "")).is_err());
    }

    #[test]
    fn refuses_files_over_8_mb() {
        assert!(check_size("a.cube", MAX_BYTES).is_ok());
        assert!(check_size("a.cube", MAX_BYTES + 1).is_err());
    }
}
