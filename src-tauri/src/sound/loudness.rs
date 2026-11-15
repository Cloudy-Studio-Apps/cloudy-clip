//! The integrated loudness of a part of a file's sound as the clip's own volume lets it be heard,
//! for Match level. The same reading of FFmpeg's `ebur128` summary as a whole-mix analysis
//! ([`super::analyze::Listening`]), over `from..to` of the file's first sound stream, through the
//! clip's gain (`volume`) or keyed gain (the export's own `gain_envelope_filter`, `at` counted from
//! `from`), before its effects, fades, track, group and master. It is an
//! export job ([`Job::measure`]), begun, then finished or cancelled by its id, with progress from
//! `-progress`; the ones running are kept in [`Loudness`].

use std::collections::HashMap;
use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex as StdMutex};

use tauri::ipc::Channel;

use super::analyze::Listening;
use crate::error::{AppError, AppResult};
use crate::export::job::Job;
use crate::export::recipe::Recipe;
use crate::export::soundfilters::gain_envelope_filter;
use crate::export::spec::EnvelopePoint;
use crate::media::proxy::{ffprobe, find_tools};
use crate::media::server::random_token;

/// A measurement under way: its FFmpeg and what it has heard.
#[derive(Clone)]
struct Running {
    job: Arc<Job>,
    heard: Arc<StdMutex<Listening>>,
}

/// The measurements running now, by job id. One ends when its `finish` takes it, also after a
/// cancel (which only stops the job, so `finish` can say "Cancelled").
#[derive(Default)]
pub struct Loudness(StdMutex<HashMap<String, Running>>);

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
    let level = if !gain_envelope.is_empty() {
        gain_envelope_filter(gain_envelope)
    } else {
        format!(",volume={gain:.6}")
    };
    let seconds = |micros: u64| format!("{:.6}", micros as f64 / 1_000_000.0);
    let filter = format!("aformat=sample_fmts=fltp{level},ebur128=peak=true:metadata=1");
    let args = [
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "info",
        "-progress",
        "pipe:2",
        "-ss",
    ]
    .into_iter()
    .map(Into::into)
    .chain([seconds(from).into(), "-t".into(), seconds(to - from).into()])
    .chain(["-i".into(), path.as_os_str().to_owned()])
    .chain(["-vn", "-map", "0:a:0", "-af"].into_iter().map(Into::into))
    // `metadata=1` keeps its per-frame log out of the way; the summary is what is read.
    .chain([OsString::from(filter)])
    .chain(["-f", "null", "-"].into_iter().map(Into::into))
    .collect();
    let heard = Arc::new(StdMutex::new(Listening::new(to - from, 0.0)));
    let listener = heard.clone();
    let length = (to - from) as f32;
    let listen = move |line: &str| {
        if let Some(Ok(done)) = line.strip_prefix("out_time_us=").map(str::parse::<u64>) {
            let _ = on_progress.send((done as f32 / length).clamp(0.0, 1.0));
        } else if let Ok(mut heard) = listener.lock() {
            heard.hear(line);
        }
    };
    let job = Job::measure(
        &tools,
        Recipe { args, script: None },
        PathBuf::new(), // no filter graph file: the recipe has none
        listen,
    )
    .map_err(AppError::Unavailable)?;
    let id = random_token()?;
    if let Ok(mut all) = loudness.0.lock() {
        all.insert(
            id.clone(),
            Running {
                job: Arc::new(job),
                heard,
            },
        );
    }
    Ok(Some(id))
}

/// Waits for the measurement `id` to end and returns the integrated loudness (LUFS), `None` when
/// nothing is above the gate (silence). Fails with "Cancelled" when it was.
pub async fn finish(id: &str, loudness: &Loudness) -> AppResult<Option<f64>> {
    let running = loudness
        .0
        .lock()
        .ok()
        .and_then(|all| all.get(id).cloned())
        .ok_or_else(|| AppError::NotFound("That measurement is not running".into()))?;
    let outcome = running.job.measured().await;
    if let Ok(mut all) = loudness.0.lock() {
        all.remove(id);
    }
    outcome.map_err(AppError::Unavailable)?;
    let mut heard = running
        .heard
        .lock()
        .map_err(|_| AppError::Unavailable("The measurement was lost".into()))?;
    Ok(heard.result().map_err(AppError::Unavailable)?.integrated)
}

/// Stops the measurement `id`. One that already ended is left alone.
pub async fn cancel(id: &str, loudness: &Loudness) {
    let job = loudness
        .0
        .lock()
        .ok()
        .and_then(|all| all.get(id).map(|r| r.job.clone()));
    if let Some(job) = job {
        job.cancel().await;
    }
}
