//! The integrated loudness of a part of a file's sound as the clip's own volume lets it be heard,
//! for Match level. The same reading of FFmpeg's `ebur128` summary as a whole-mix analysis
//! ([`super::analyze::Listening`]), over `from..to` of the file's first sound stream, through the
//! clip's gain (`volume`) or keyed gain (the export's own `gain_envelope_filter`, `at` counted from
//! `from`), before its effects, fades, track, group and master. It is an
//! export job ([`Job::measure`]), begun, then finished or cancelled by its id, with progress from
//! `-progress`; the ones running are kept in [`Loudness`].

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex as StdMutex};

use tauri::ipc::Channel;

use super::analyze::Listening;
use super::measures::{Measures, part_args, progress_listener};
use crate::error::{AppError, AppResult};
use crate::export::job::Job;
use crate::export::recipe::Recipe;
use crate::export::soundfilters::gain_envelope_filter;
use crate::export::spec::EnvelopePoint;
use crate::media::proxy::{ffprobe, find_tools};
use crate::media::server::random_token;

/// The measurements running now, by job id, each with what it has heard.
pub type Loudness = Measures<Arc<StdMutex<Listening>>>;

/// Starts measuring `from..to` (microseconds) of the file at `path`. Reports 0 to 1 to
/// `on_progress`. Returns the job's id, for [`finish`] and [`cancel`]; `None` when the file has
/// no sound.
pub async fn begin(
    path: &Path,
    from: u64,
    to: u64,
    gain: f64,
    gain_envelope: &[EnvelopePoint],
    on_progress: Channel<f32>,
    loudness: &Loudness,
) -> AppResult<Option<String>> {
    if to <= from {
        return Err(AppError::InvalidInput("The stretch is empty".into()));
    }
    let tools = find_tools().ok_or_else(|| AppError::Unavailable("FFmpeg was not found".into()))?;
    let probe = ffprobe(&tools, path, false)
        .await
        .map_err(AppError::Unavailable)?;
    if probe.audio_channels.is_none() {
        return Ok(None);
    }
    if !gain.is_finite() || gain < 0.0 {
        return Err(AppError::InvalidInput("The gain is not a level".into()));
    }
    if gain_envelope
        .iter()
        .any(|p| !p.value.is_finite() || p.value < 0.0)
    {
        return Err(AppError::InvalidInput(
            "The gain envelope has a point that is not a level".into(),
        ));
    }
    let level = if !gain_envelope.is_empty() {
        gain_envelope_filter(gain_envelope)
    } else {
        format!(",volume={gain:.6}")
    };
    // `metadata=1` keeps its per-frame log out of the way; the summary is what is read. The
    // envelope runs on the frames' own times, so a late sound stream needs no shift.
    let filter = format!("aformat=sample_fmts=fltp{level},ebur128=peak=true:metadata=1");
    let heard = Arc::new(StdMutex::new(Listening::new(to - from, 0.0)));
    let listener = heard.clone();
    let listen = progress_listener(to - from, on_progress, move |line| {
        if let Ok(mut heard) = listener.lock() {
            heard.hear(line);
        }
    });
    let args = part_args(path, from, to, filter);
    let job = Job::measure(
        &tools,
        Recipe { args, script: None },
        PathBuf::new(), // no filter graph file: the recipe has none
        listen,
    )
    .map_err(AppError::Unavailable)?;
    let id = random_token()?;
    loudness.add(&id, Arc::new(job), heard);
    Ok(Some(id))
}

/// Waits for the measurement `id` to end and returns the integrated loudness (LUFS), `None` when
/// nothing is above the gate (silence). Fails with "Cancelled" when it was.
pub async fn finish(id: &str, loudness: &Loudness) -> AppResult<Option<f64>> {
    let (job, heard) = loudness
        .get(id)
        .ok_or_else(|| AppError::NotFound("That measurement is not running".into()))?;
    let outcome = job.measured().await;
    loudness.take(id);
    outcome.map_err(AppError::Unavailable)?;
    let mut heard = heard
        .lock()
        .map_err(|_| AppError::Unavailable("The measurement was lost".into()))?;
    Ok(heard.result().map_err(AppError::Unavailable)?.integrated)
}

/// Stops the measurement `id`. One that already ended is left alone.
pub async fn cancel(id: &str, loudness: &Loudness) {
    loudness.cancel(id).await;
}
