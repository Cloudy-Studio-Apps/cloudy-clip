//! The analyses running now: each an export job ([`Job::measure`]) measuring a whole mix
//! ([`super::analyze`]) and what it has heard. They have their own registry, so an export command
//! can't reach one.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex as StdMutex};

use tauri::ipc::Channel;

use super::analyze::{Analysis, Listening, MEASURE};
use crate::error::{AppError, AppResult};
use crate::export::PartialNotes;
use crate::export::job::{Job, find_mono, script_option};
use crate::export::recipe::{measure_arguments, script_of};
use crate::export::spec::SoundOnlySpec;
use crate::media::proxy::find_tools;
use crate::media::server::random_token;

/// An analysis under way: its FFmpeg and what it has heard.
#[derive(Clone)]
struct Running {
    job: Arc<Job>,
    heard: Arc<StdMutex<Listening>>,
}

/// Analyses running now, by job id. One ends when its `finish` takes it, also after a cancel
/// (which only stops the job, so `finish` can say "Cancelled").
#[derive(Default)]
pub struct Analyses(StdMutex<HashMap<String, Running>>);

impl Analyses {
    fn add(&self, id: String, running: Running) {
        if let Ok(mut all) = self.0.lock() {
            all.insert(id, running);
        }
    }

    fn get(&self, id: &str) -> Option<Running> {
        self.0.lock().ok()?.get(id).cloned()
    }

    fn take(&self, id: &str) -> Option<Running> {
        self.0.lock().ok()?.remove(id)
    }
}

/// Where an analysis's long filter graph goes (`script_of` this), noted like an export's partial
/// files so a crash leaves nothing behind.
fn scratch_of(notes: &PartialNotes, id: &str) -> PathBuf {
    let folder = notes.folder();
    folder
        .parent()
        .unwrap_or(folder)
        .join(format!("analysis-{id}"))
}

/// Starts measuring `spec`'s mix against `peak_limit` (dBTP), reporting 0 to 1 to `on_progress`.
/// Returns the job's id.
pub async fn begin(
    mut spec: SoundOnlySpec,
    peak_limit: f64,
    on_progress: Channel<f32>,
    notes: &PartialNotes,
    analyses: &Analyses,
) -> AppResult<String> {
    if spec.sound.is_empty() || spec.duration == 0 {
        return Err(AppError::InvalidInput(
            "The mix has no sound to measure".into(),
        ));
    }
    spec.mix.master.check().map_err(AppError::InvalidInput)?;
    if !peak_limit.is_finite() {
        return Err(AppError::InvalidInput(
            "The peak limit is not a number".into(),
        ));
    }
    let tools = find_tools().ok_or_else(|| AppError::Unavailable("FFmpeg was not found".into()))?;
    find_mono(&tools, &mut spec.sound).await;
    let id = random_token()?;
    let scratch = scratch_of(notes, &id);
    let script = script_of(&scratch);
    let option = script_option(&tools.ffmpeg).await;
    let recipe = measure_arguments(&spec, MEASURE, &script, option);

    let heard = Arc::new(StdMutex::new(Listening::new(spec.duration, peak_limit)));
    let listener = heard.clone();
    let listen = move |line: &str| {
        let progress = listener.lock().ok().and_then(|mut l| l.hear(line));
        if let Some(progress) = progress {
            let _ = on_progress.send(progress);
        }
    };
    tokio::fs::create_dir_all(notes.folder()).await?;
    tokio::fs::write(notes.folder().join(&id), scratch.display().to_string()).await?;
    let job = match Job::measure(&tools, recipe, script, listen) {
        Ok(job) => job,
        Err(e) => {
            let _ = tokio::fs::remove_file(notes.folder().join(&id)).await;
            return Err(AppError::Unavailable(e));
        }
    };
    analyses.add(
        id.clone(),
        Running {
            job: Arc::new(job),
            heard,
        },
    );
    Ok(id)
}

/// Waits for the analysis `id` to end and returns its figures.
pub async fn finish(id: &str, notes: &PartialNotes, analyses: &Analyses) -> AppResult<Analysis> {
    let running = analyses
        .get(id)
        .ok_or_else(|| AppError::NotFound("That analysis is not running".into()))?;
    let outcome = running.job.measured().await;
    analyses.take(id);
    let _ = tokio::fs::remove_file(notes.folder().join(id)).await;
    outcome.map_err(AppError::Unavailable)?;
    let mut heard = running
        .heard
        .lock()
        .map_err(|_| AppError::Unavailable("The analysis was lost".into()))?;
    heard.result().map_err(AppError::Unavailable)
}

/// Stops the analysis `id`. One that already ended is left alone.
pub async fn cancel(id: &str, notes: &PartialNotes, analyses: &Analyses) {
    if let Some(running) = analyses.get(id) {
        running.job.cancel().await;
    }
    let _ = tokio::fs::remove_file(notes.folder().join(id)).await;
}
