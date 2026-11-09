//! The analyses running now: each an export job measuring a whole mix ([`super::analyze`]), its
//! FFmpeg in the export's [`Jobs`] and what it has heard here, under the same id.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex as StdMutex};

use tauri::ipc::Channel;

use super::analyze::{Analysis, Listening, MEASURE};
use crate::error::{AppError, AppResult};
use crate::export::commands::find_mono;
use crate::export::job::{Job, script_option};
use crate::export::recipe::{measure_arguments, script_of};
use crate::export::spec::SoundOnlySpec;
use crate::export::{Jobs, PartialNotes};
use crate::media::proxy::find_tools;
use crate::media::server::random_token;

/// Analyses running now, by job id: what each has heard. Their FFmpeg is in the export's
/// [`Jobs`], under the same id.
#[derive(Default)]
pub struct Analyses(StdMutex<HashMap<String, Arc<StdMutex<Listening>>>>);

impl Analyses {
    fn add(&self, id: String, heard: Arc<StdMutex<Listening>>) {
        if let Ok(mut running) = self.0.lock() {
            running.insert(id, heard);
        }
    }

    fn take(&self, id: &str) -> Option<Arc<StdMutex<Listening>>> {
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
    jobs: &Jobs,
    notes: &PartialNotes,
    analyses: &Analyses,
) -> AppResult<String> {
    if spec.sound.is_empty() || spec.duration == 0 {
        return Err(AppError::InvalidInput(
            "The mix has no sound to measure".into(),
        ));
    }
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
    analyses.add(id.clone(), heard);
    jobs.add(id.clone(), Arc::new(job));
    Ok(id)
}

/// Waits for the analysis `id` to end and returns its figures.
pub async fn finish(
    id: &str,
    jobs: &Jobs,
    notes: &PartialNotes,
    analyses: &Analyses,
) -> AppResult<Analysis> {
    let job = jobs
        .get(id)
        .ok_or_else(|| AppError::NotFound("That analysis is not running".into()))?;
    let outcome = job.measured().await;
    jobs.take(id);
    let heard = analyses.take(id);
    let _ = tokio::fs::remove_file(notes.folder().join(id)).await;
    outcome.map_err(AppError::Unavailable)?;
    let heard = heard.ok_or_else(|| AppError::NotFound("That analysis is not running".into()))?;
    let mut heard = heard
        .lock()
        .map_err(|_| AppError::Unavailable("The analysis was lost".into()))?;
    heard.result().map_err(AppError::Unavailable)
}

/// Stops the analysis `id`. One that already ended is left alone.
pub async fn cancel(id: &str, jobs: &Jobs, notes: &PartialNotes, analyses: &Analyses) {
    if let Some(job) = jobs.take(id) {
        job.cancel().await;
    }
    analyses.take(id);
    let _ = tokio::fs::remove_file(notes.folder().join(id)).await;
}
