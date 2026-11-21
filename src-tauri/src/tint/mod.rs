//! Tint module: reading `.cube` LUT files. Parsing them and everything else lives in TypeScript.

use crate::error::{AppError, AppResult};
use crate::workspace::{file_path, read_text};

/// The largest LUT file read: a 65-point cube is about 7 MB of text.
const MAX_BYTES: u64 = 8 * 1024 * 1024;

/// A LUT path the webview or an agent gave: absolute, `.cube`.
fn lut_path(raw: &str) -> AppResult<std::path::PathBuf> {
    file_path(raw, "cube")
}

/// The text of a `.cube` file at an absolute path, at most 8 MB, UTF-8. The file is opened once and
/// read through a cap, so one that grows after the size check is still refused.
#[tauri::command]
pub async fn tint_read_lut(path: String) -> Result<String, AppError> {
    read_text(&path, &lut_path(&path)?, MAX_BYTES, "a LUT").await
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
}
