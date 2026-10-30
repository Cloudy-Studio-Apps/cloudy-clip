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

use serde::Serialize;

use crate::error::{AppError, AppResult};

/// Kind of media, derived from the file extension.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MediaKind {
    Video,
    Audio,
    Image,
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

/// What a file is, without registering it.
#[derive(Debug, Clone, Serialize)]
pub struct MediaFile {
    pub name: String,
    pub kind: MediaKind,
    pub size: u64,
}

struct Entry {
    original: PathBuf,
    proxy: Option<PathBuf>,
    /// Folder of an animated image's frames, `00000.png` onwards.
    frames: Option<PathBuf>,
}

#[derive(Default)]
pub struct MediaRegistry {
    entries: RwLock<HashMap<String, Entry>>,
}

impl MediaRegistry {
    /// Validates a path and adds it under the frontend's id, which a saved project keeps across
    /// restarts. Registering an id again replaces its entry (and drops its proxy).
    pub fn register(&self, id: &str, path: &Path, size: u64) -> AppResult<RegisteredMedia> {
        let MediaFile { name, kind, size } = describe(path, size)?;

        self.entries
            .write()
            .map_err(|_| AppError::Unavailable("Media registry is poisoned".into()))?
            .insert(
                id.to_owned(),
                Entry {
                    original: path.to_path_buf(),
                    proxy: None,
                    frames: None,
                },
            );

        Ok(RegisteredMedia {
            id: id.to_owned(),
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

    /// Attaches the folder of an animated image's frames to an id.
    pub fn set_frames(&self, id: &str, frames: PathBuf) {
        if let Ok(mut entries) = self.entries.write()
            && let Some(entry) = entries.get_mut(id)
        {
            entry.frames = Some(frames);
        }
    }

    /// The file of frame `n` of an id, if it has frames. It may not exist past the last frame.
    pub fn frame_path_of(&self, id: &str, n: u32) -> Option<PathBuf> {
        let entries = self.entries.read().ok()?;
        let frames = entries.get(id)?.frames.as_ref()?;
        Some(frames.join(format!("{n:05}.png")))
    }
}

/// Validates a path and says what the file is.
pub fn describe(path: &Path, size: u64) -> AppResult<MediaFile> {
    let kind = kind_of(path).ok_or_else(|| {
        AppError::InvalidInput(format!("Unsupported file type: {}", path.display()))
    })?;
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| path.display().to_string());
    Ok(MediaFile { name, kind, size })
}

fn extension(path: &Path) -> Option<String> {
    path.extension()
        .map(|e| e.to_string_lossy().to_ascii_lowercase())
}

/// Maps an extension to a media kind. `None` means the file is not accepted.
pub fn kind_of(path: &Path) -> Option<MediaKind> {
    match extension(path)?.as_str() {
        "mp4" | "m4v" | "mov" | "webm" | "mkv" | "avi" | "wmv" | "asf" | "mpg" | "mpeg" | "m2v"
        | "vob" | "mts" | "m2ts" | "ts" | "mxf" | "flv" | "f4v" | "3gp" | "3g2" | "ogv" | "dv" => {
            Some(MediaKind::Video)
        }
        "mp3" | "wav" | "m4a" | "aac" | "ogg" | "oga" | "flac" | "opus" | "aif" | "aiff"
        | "wma" | "ac3" | "eac3" | "dts" | "caf" | "amr" | "m4b" | "mka" | "ape" | "wv" | "au" => {
            Some(MediaKind::Audio)
        }
        "png" | "jpg" | "jpeg" | "jfif" | "webp" | "bmp" | "svg" | "gif" | "apng" | "avif"
        | "heic" | "heif" | "tif" | "tiff" | "tga" | "dds" | "psd" | "exr" | "hdr" | "dpx"
        | "jxl" => Some(MediaKind::Image),
        _ => None,
    }
}

/// Whether the webview can't load this format at all, whatever codec is inside: an AVI holding
/// H.264 still won't open in a media element, so these always go through FFmpeg.
pub fn always_converted(path: &Path) -> bool {
    matches!(
        extension(path).as_deref(),
        Some(
            "avi"
                | "wmv"
                | "asf"
                | "mpg"
                | "mpeg"
                | "m2v"
                | "vob"
                | "mts"
                | "m2ts"
                | "ts"
                | "mxf"
                | "flv"
                | "f4v"
                | "3gp"
                | "3g2"
                | "ogv"
                | "dv"
                | "aif"
                | "aiff"
                | "wma"
                | "ac3"
                | "eac3"
                | "dts"
                | "caf"
                | "amr"
                | "m4b"
                | "mka"
                | "ape"
                | "wv"
                | "au"
                | "avif"
                | "heic"
                | "heif"
                | "tif"
                | "tiff"
                | "tga"
                | "dds"
                | "psd"
                | "exr"
                | "hdr"
                | "dpx"
                | "jxl"
        )
    )
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
        Some("png") => "image/png",
        Some("jpg" | "jpeg" | "jfif") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        Some("svg") => "image/svg+xml",
        Some("gif") => "image/gif",
        Some("apng") => "image/apng",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_containers_are_media_and_always_converted() {
        assert_eq!(kind_of(Path::new("/a/b.AVI")), Some(MediaKind::Video));
        assert_eq!(kind_of(Path::new("/a/b.aiff")), Some(MediaKind::Audio));
        assert!(always_converted(Path::new("/a/b.mts")));
        assert!(!always_converted(Path::new("/a/b.mp4")));
    }

    #[test]
    fn images_are_media_and_frames_resolve_by_number() {
        assert_eq!(kind_of(Path::new("/a/b.GIF")), Some(MediaKind::Image));
        assert_eq!(kind_of(Path::new("/a/b.heic")), Some(MediaKind::Image));
        assert!(always_converted(Path::new("/a/b.tiff")));
        assert!(!always_converted(Path::new("/a/b.png")));
        let registry = MediaRegistry::default();
        registry.register("m", Path::new("/a/b.gif"), 1).unwrap();
        assert_eq!(registry.frame_path_of("m", 3), None);
        registry.set_frames("m", PathBuf::from("/cache/x.frames"));
        assert_eq!(
            registry.frame_path_of("m", 3),
            Some(PathBuf::from("/cache/x.frames/00003.png"))
        );
    }

    #[test]
    fn rejects_unknown_extensions() {
        let registry = MediaRegistry::default();
        assert!(registry.register("a", Path::new("/tmp/a.txt"), 1).is_err());
    }

    #[test]
    fn registers_and_resolves() {
        let registry = MediaRegistry::default();
        let media = registry
            .register("media_a", Path::new("/tmp/Clip.MP4"), 10)
            .unwrap();
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
