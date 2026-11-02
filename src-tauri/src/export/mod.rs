//! Export module: FFmpeg processes that turn frames and sound into a finished file.
//!
//! Frames are drawn by the webview, so they match the preview, and arrive at [`frames`]. Sound is
//! mixed by FFmpeg from the original files ([`recipe`]). The system FFmpeg is used, as for proxies.

pub mod commands;
pub mod encoders;
mod frames;
pub mod job;
pub mod recipe;

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
    fn get(&self, id: &str) -> Option<Arc<Job>> {
        self.running.read().ok()?.get(id).cloned()
    }

    fn add(&self, id: String, job: Arc<Job>) {
        if let Ok(mut running) = self.running.write() {
            running.insert(id, job);
        }
    }

    fn take(&self, id: &str) -> Option<Arc<Job>> {
        self.running.write().ok()?.remove(id)
    }
}

/// Base URL of the frame route once it is listening.
#[derive(Default)]
pub struct FrameUrl(RwLock<Option<String>>);

/// Folder of notes saying which partial files are in progress.
pub struct PartialNotes(PathBuf);

/// Removes partial files a crash or a quit left behind. Each export leaves a note while it runs.
fn sweep_partials(notes: &Path) {
    let Ok(entries) = std::fs::read_dir(notes) else {
        return;
    };
    for entry in entries.flatten() {
        if let Ok(partial) = std::fs::read_to_string(entry.path()) {
            let _ = std::fs::remove_file(recipe::script_of(Path::new(&partial)));
            let _ = std::fs::remove_file(partial);
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
