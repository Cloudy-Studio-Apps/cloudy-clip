//! Project files: reading and writing them anywhere on disk, and the list of recent projects.
//! Which project is open, and everything else about it, lives in TypeScript.

pub mod commands;

use std::path::PathBuf;

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
