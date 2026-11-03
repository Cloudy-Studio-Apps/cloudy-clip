//! Derived files: copies of a registered file that FFmpeg makes once and the media server then
//! streams, such as a reversed copy. Each kind says what it's made from, what its file is called
//! and how FFmpeg makes it; this file does the rest, the same for every kind:
//!
//! - cached beside the proxies, under the source file's version and the kind's name, so a kind
//!   whose settings or recipe change gets a new file;
//! - written under a temporary name by the kind, one encode at a time (the proxies' encoder);
//! - attached to the registration it was made for, so a file replaced meanwhile changes nothing;
//! - progress reported as 0..1.

use std::future::Future;
use std::path::{Path, PathBuf};

use super::proxy::{ProxyJobs, Tools, cache_path, command, find_tools};
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
