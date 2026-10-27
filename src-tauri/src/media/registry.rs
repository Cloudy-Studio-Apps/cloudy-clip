//! Allowlist of files the webview may stream.
//!
//! The media server only serves files registered here, by id. The webview never sends
//! raw paths to the server, so it cannot be used to read arbitrary files.
//!
//! Each entry may also have a *proxy*: a light H.264 copy made for files the webview cannot
//! decode well. Once a proxy exists, it is what the server streams; the original is kept for
//! export.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::RwLock;
use std::sync::atomic::{AtomicU64, Ordering};

use serde::Serialize;

use crate::error::{AppError, AppResult};

/// Kind of media, derived from the file extension.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MediaKind {
    Video,
    Audio,
}

/// A file accepted into the registry.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisteredMedia {
    pub id: String,
    pub path: String,
    pub name: String,
    pub kind: MediaKind,
    pub size: u64,
}

struct Entry {
    original: PathBuf,
    proxy: Option<PathBuf>,
}

#[derive(Default)]
pub struct MediaRegistry {
    entries: RwLock<HashMap<String, Entry>>,
    next_id: AtomicU64,
}

impl MediaRegistry {
    /// Validates a path and adds it. Registering the same path twice returns a new id; the
    /// frontend decides whether that is a duplicate.
    pub fn register(&self, path: &Path, size: u64) -> AppResult<RegisteredMedia> {
        let kind = kind_of(path).ok_or_else(|| {
            AppError::InvalidInput(format!("Unsupported file type: {}", path.display()))
        })?;
        let id = format!("m{}", self.next_id.fetch_add(1, Ordering::Relaxed) + 1);
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.display().to_string());

        self.entries
            .write()
            .map_err(|_| AppError::Unavailable("Media registry is poisoned".into()))?
            .insert(
                id.clone(),
                Entry {
                    original: path.to_path_buf(),
                    proxy: None,
                },
            );

        Ok(RegisteredMedia {
            id,
            path: path.display().to_string(),
            name,
            kind,
            size,
        })
    }

    /// The file to stream for an id: its proxy if one is ready, otherwise the original.
    pub fn playback_path_of(&self, id: &str) -> Option<PathBuf> {
        let entries = self.entries.read().ok()?;
        let entry = entries.get(id)?;
        Some(
            entry
                .proxy
                .clone()
                .unwrap_or_else(|| entry.original.clone()),
        )
    }

    /// Attaches a finished proxy to an id.
    pub fn set_proxy(&self, id: &str, proxy: PathBuf) {
        if let Ok(mut entries) = self.entries.write()
            && let Some(entry) = entries.get_mut(id)
        {
            entry.proxy = Some(proxy);
        }
    }
}

fn extension(path: &Path) -> Option<String> {
    path.extension()
        .map(|e| e.to_string_lossy().to_ascii_lowercase())
}

/// Maps an extension to a media kind. `None` means the file is not accepted.
pub fn kind_of(path: &Path) -> Option<MediaKind> {
    match extension(path)?.as_str() {
        "mp4" | "m4v" | "mov" | "webm" | "mkv" => Some(MediaKind::Video),
        "mp3" | "wav" | "m4a" | "aac" | "ogg" | "oga" | "flac" | "opus" => Some(MediaKind::Audio),
        _ => None,
    }
}

/// MIME type for the `Content-Type` header.
pub fn mime_of(path: &Path) -> &'static str {
    match extension(path).as_deref() {
        Some("mp4" | "m4v") => "video/mp4",
        Some("mov") => "video/quicktime",
        Some("webm") => "video/webm",
        Some("mkv") => "video/x-matroska",
        Some("mp3") => "audio/mpeg",
        Some("wav") => "audio/wav",
        Some("m4a" | "aac") => "audio/mp4",
        Some("ogg" | "oga") => "audio/ogg",
        Some("flac") => "audio/flac",
        Some("opus") => "audio/opus",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unknown_extensions() {
        let registry = MediaRegistry::default();
        assert!(registry.register(Path::new("/tmp/a.txt"), 1).is_err());
    }

    #[test]
    fn registers_and_resolves() {
        let registry = MediaRegistry::default();
        let media = registry.register(Path::new("/tmp/Clip.MP4"), 10).unwrap();
        assert_eq!(media.kind, MediaKind::Video);
        assert_eq!(media.name, "Clip.MP4");
        assert_eq!(
            registry.playback_path_of(&media.id),
            Some(PathBuf::from("/tmp/Clip.MP4"))
        );
        assert_eq!(registry.playback_path_of("nope"), None);
        registry.set_proxy(&media.id, PathBuf::from("/cache/p.mp4"));
        assert_eq!(
            registry.playback_path_of(&media.id),
            Some(PathBuf::from("/cache/p.mp4"))
        );
    }
}
