//! Export module: FFmpeg processes that turn frames and sound into a finished file.
//!
//! Frames are drawn by the webview, so they match the preview, and arrive at [`frames`]. Sound is
//! mixed by FFmpeg from the original files ([`recipe`], its spec in [`spec`]). The system FFmpeg is used, as for proxies.

pub mod commands;
pub mod encoders;
mod frames;
pub mod job;
mod mixeffects;
mod mixgraph;
pub mod recipe;
pub(crate) mod soundfilters;
pub mod spec;

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};

use tauri::{App, Manager};

use job::Job;

/// Exports running now, by id.
#[derive(Default)]
pub struct Jobs {
    running: RwLock<HashMap<String, Arc<Job>>>,
}

impl Jobs {
    pub(super) fn get(&self, id: &str) -> Option<Arc<Job>> {
        self.running.read().ok()?.get(id).cloned()
    }

    pub(super) fn add(&self, id: String, job: Arc<Job>) {
        if let Ok(mut running) = self.running.write() {
            running.insert(id, job);
        }
    }

    pub(super) fn take(&self, id: &str) -> Option<Arc<Job>> {
        self.running.write().ok()?.remove(id)
    }

    /// Stops every export and removes what each wrote, as the app quits.
    async fn cancel_all(&self) {
        let all: Vec<Arc<Job>> = self
            .running
            .write()
            .map(|mut running| running.drain().map(|(_, job)| job).collect())
            .unwrap_or_default();
        for job in all {
            job.cancel().await;
        }
    }
}

/// Base URL of the frame route once it is listening.
#[derive(Default)]
pub struct FrameUrl(RwLock<Option<String>>);

/// Folder of notes saying which partial files are in progress.
pub struct PartialNotes(PathBuf);

impl PartialNotes {
    /// The folder of the notes; a note is a file named after its job.
    pub(crate) fn folder(&self) -> &Path {
        &self.0
    }
}

/// Removes partial files a crash or a quit left behind. Each export leaves a note while it runs:
/// its partial files, one a line, the first the one its filter graph file is named after.
fn sweep_partials(notes: &Path) {
    let Ok(entries) = std::fs::read_dir(notes) else {
        return;
    };
    for entry in entries.flatten() {
        if let Ok(note) = std::fs::read_to_string(entry.path()) {
            if let Some(first) = note.lines().next() {
                let _ = std::fs::remove_file(recipe::script_of(Path::new(first)));
            }
            for partial in note.lines() {
                let _ = std::fs::remove_file(partial);
            }
        }
        let _ = std::fs::remove_file(entry.path());
    }
}

/// Creates the job list and starts the frame route.
pub fn setup(app: &mut App) {
    let jobs = Arc::new(Jobs::default());
    app.manage(jobs.clone());
    app.manage(FrameUrl::default());

    let notes = app
        .path()
        .app_cache_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("cloudy-clip"))
        .join("exports");
    sweep_partials(&notes);
    app.manage(PartialNotes(notes));

    let handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        match frames::start(jobs).await {
            Ok(url) => {
                if let Ok(mut slot) = handle.state::<FrameUrl>().0.write() {
                    *slot = Some(url);
                }
            }
            Err(e) => eprintln!("[export] could not start the frame route: {e}"),
        }
    });
}

/// Stops every export and sound measurement FFmpeg is running and removes what they wrote. Runs
/// as the app quits, before the process ends (nothing is dropped then, so `kill_on_drop` can't).
pub async fn stop(app: &tauri::AppHandle) {
    if let Some(jobs) = app.try_state::<Arc<Jobs>>() {
        jobs.cancel_all().await;
    }
    if let Some(notes) = app.try_state::<PartialNotes>() {
        sweep_partials(&notes.0);
    }
}
