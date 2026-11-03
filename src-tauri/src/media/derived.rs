//! Derived files: copies of a registered file that FFmpeg makes once and the media server then
//! streams, such as a reversed copy. Each kind says what it's made from, what its file is called
//! and how FFmpeg makes it; this file does the rest, the same for every kind:
//!
//! - cached beside the proxies, under the source file's version and the kind's name, so a kind
//!   whose settings or recipe change gets a new file;
//! - written under a temporary name ([`write_whole`]), one encode at a time (the proxies' encoder);
//! - attached to the registration it was made for, so a file replaced meanwhile changes nothing;
//! - progress reported as 0..1;
//! - dropped by family ([`ProxyJobs::drop_derived`]) once the files of a kind that keeps a file per
//!   setting are no longer wanted, with what was made from them.

use std::future::Future;
use std::path::{Path, PathBuf};

use super::proxy::{ProxyJobs, Tools, cache_path, cache_stem, command, find_tools, run_encoder};
use super::registry::MediaRegistry;

/// A kind of derived file, with its settings.
pub(crate) trait DerivedKind {
    /// The name the file is cached and served under, which changes with every setting and recipe
    /// that changes the file, and with nothing else.
    fn name(&self) -> String;

    /// What it's made from, and the registration that belongs to.
    fn source(&self, registry: &MediaRegistry, id: &str) -> Option<(PathBuf, u64)>;

    /// Makes the file at `target` from `source`, reporting 0..1. Nothing is left at `target` when
    /// this fails.
    fn make(
        &self,
        tools: &Tools,
        source: &Path,
        target: &Path,
        on_progress: &(dyn Fn(f32) + Sync),
    ) -> impl Future<Output = Result<(), String>> + Send;
}

/// An `ffmpeg` that only speaks up about errors and overwrites what it writes.
pub(crate) fn quiet(tools: &Tools) -> tokio::process::Command {
    let mut cmd = command(&tools.ffmpeg);
    cmd.args(["-hide_banner", "-nostats", "-loglevel", "error", "-y"]);
    cmd
}

/// Runs `cmd`, an `ffmpeg` whose output is still to be named, into a temporary file beside
/// `target`, and moves that to `target` once it's whole; nothing is left behind when it fails.
/// The error is what FFmpeg said.
pub(crate) async fn write_whole(
    mut cmd: tokio::process::Command,
    target: &Path,
    duration_us: Option<u64>,
    on_progress: &(dyn Fn(f32) + Sync),
) -> Result<(), String> {
    let extension = target.extension().and_then(|e| e.to_str()).unwrap_or("tmp");
    let partial = target.with_extension(format!("partial.{extension}"));
    cmd.arg(&partial);
    if let Err(detail) = run_encoder(cmd, duration_us, on_progress).await {
        let _ = tokio::fs::remove_file(&partial).await;
        return Err(detail);
    }
    tokio::fs::rename(&partial, target)
        .await
        .map_err(|e| format!("Could not save the file: {e}"))
}

impl ProxyJobs {
    /// Makes sure a file has the derived file `kind` and returns its path; asking again for one
    /// that exists returns at once.
    pub(crate) async fn prepare<K: DerivedKind + Sync>(
        &self,
        registry: &MediaRegistry,
        id: &str,
        kind: &K,
        on_progress: &(dyn Fn(f32) + Sync),
    ) -> Result<PathBuf, String> {
        let (source, generation) = kind.source(registry, id).ok_or("Unknown media id")?;
        let tools = find_tools().ok_or("FFmpeg was not found")?;
        let name = kind.name();
        let target = cache_path(self.cache_dir(), &source, &name).await?;
        if !tokio::fs::try_exists(&target).await.unwrap_or(false) {
            let _permit = self
                .encoder()
                .acquire()
                .await
                .map_err(|_| "Encoder unavailable".to_owned())?;
            // Another job may have made it while this one waited.
            if !tokio::fs::try_exists(&target).await.unwrap_or(false) {
                kind.make(&tools, &source, &target, on_progress).await?;
            }
        }
        registry.set_derived(id, generation, &name, target.clone());
        Ok(target)
    }
}

/// The files cached for a source file version: `(name, path)`, its name being what follows the
/// version's stem. Only whole files: those being written and the work folders of a running job
/// are left out.
async fn cached_from(cache_dir: &Path, source: &Path) -> Result<Vec<(String, PathBuf)>, String> {
    let prefix = format!("{}.", cache_stem(source).await?);
    let unreadable = |e: std::io::Error| format!("Could not read the cache: {e}");
    let mut entries = match tokio::fs::read_dir(cache_dir).await {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(unreadable(e)),
    };
    let mut files = Vec::new();
    while let Some(entry) = entries.next_entry().await.map_err(unreadable)? {
        let file_name = entry.file_name();
        let Some(name) = file_name.to_str().and_then(|n| n.strip_prefix(&prefix)) else {
            continue;
        };
        let whole = entry.file_type().await.is_ok_and(|kind| kind.is_file());
        if whole && !name.contains(".partial.") {
            files.push((name.to_owned(), entry.path()));
        }
    }
    Ok(files)
}

impl ProxyJobs {
    /// Deletes the derived files of `id`'s original whose names start with `family` and aren't in
    /// `keep`, and the derived files made from each of those (a reversed copy) that aren't in
    /// `keep` either. Only files of the cache, under derived names, are touched; one that can't be
    /// deleted (open elsewhere) stays. The names dropped are no longer served.
    pub(crate) async fn drop_derived(
        &self,
        registry: &MediaRegistry,
        id: &str,
        family: &str,
        keep: &[String],
    ) -> Result<(), String> {
        let (source, _) = registry.original_of(id).ok_or("Unknown media id")?;
        let kept = |name: &str| keep.iter().any(|k| k == name);
        let mut dropped = Vec::new();
        for (name, path) in cached_from(self.cache_dir(), &source).await? {
            if !name.starts_with(family) {
                continue;
            }
            // What was made from this file is named after its version: read it before it goes.
            for (inner, inner_path) in cached_from(self.cache_dir(), &path).await? {
                if !kept(&inner) && tokio::fs::remove_file(&inner_path).await.is_ok() {
                    dropped.push(inner);
                }
            }
            if !kept(&name) && tokio::fs::remove_file(&path).await.is_ok() {
                dropped.push(name);
            }
        }
        for name in dropped {
            registry.forget_derived(id, &name);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dropping_a_family_deletes_only_its_unwanted_cached_files() {
        let root = std::env::temp_dir().join(format!("cloudy-derived-{}", std::process::id()));
        let (media, cache) = (root.join("media"), root.join("cache"));
        std::fs::create_dir_all(&media).unwrap();
        std::fs::create_dir_all(&cache).unwrap();
        let source = media.join("talk.wav");
        std::fs::write(&source, b"user media").unwrap();
        let registry = MediaRegistry::default();
        registry.register("m1", &source, 10).unwrap();
        let jobs = ProxyJobs::new(cache.clone());

        tauri::async_runtime::block_on(async {
            let stem = cache_stem(&source).await.unwrap();
            let cached = |name: &str| cache.join(format!("{stem}.{name}"));
            for name in [
                "denoised.3.kept.flac",
                "denoised.2.old.wav",
                "denoised.3.writing.partial.flac",
                "reversed.mp4",
            ] {
                std::fs::write(cached(name), b"x").unwrap();
            }
            let old_stem = cache_stem(&cached("denoised.2.old.wav")).await.unwrap();
            let old_reversed = cache.join(format!("{old_stem}.reversed.denoised.2.old.wav.mp4"));
            std::fs::write(&old_reversed, b"x").unwrap();

            let keep = ["denoised.3.kept.flac".to_owned()];
            jobs.drop_derived(&registry, "m1", "denoised.", &keep)
                .await
                .unwrap();

            let left = |name: &str| cached(name).exists();
            let outcome = (
                left("denoised.3.kept.flac"),
                left("denoised.2.old.wav"),
                old_reversed.exists(),
                left("denoised.3.writing.partial.flac"),
                left("reversed.mp4"),
                source.exists(),
            );
            std::fs::remove_dir_all(&root).unwrap();
            assert_eq!(outcome, (true, false, false, true, true, true));
        });
    }
}
