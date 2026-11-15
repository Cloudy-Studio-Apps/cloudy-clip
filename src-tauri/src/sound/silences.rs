//! The silent stretches of a part of a file's sound, found by FFmpeg's `silencedetect`. It is an
//! export job ([`Job::measure`]: the same way FFmpeg is run, stopped and complained about as the
//! other analyses here); the stretches are read from the lines it prints. Decoding the sound is
//! all it costs. A scan is begun, then finished or cancelled by its job id (as an analysis is), and
//! reports 0 to 1 from `-progress`; the scans running are kept in [`Silences`].

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex as StdMutex};

use tauri::ipc::Channel;

use super::measures::{Measures, part_args, progress_listener};
use crate::error::{AppError, AppResult};
use crate::export::job::Job;
use crate::export::recipe::Recipe;
use crate::media::proxy::{ffprobe, find_tools};
use crate::media::server::random_token;

/// What `silencedetect` has said so far: the stretches it closed, and the one it opened.
#[derive(Default)]
pub struct Heard {
    open: Option<f64>,
    closed: Vec<(f64, f64)>,
}

/// A scan under way: what it has heard, and the part of the file it was asked for
/// (microseconds).
#[derive(Clone)]
pub struct Scan {
    heard: Arc<StdMutex<Heard>>,
    from: u64,
    to: u64,
}

/// The scans running now, by job id.
pub type Silences = Measures<Scan>;

impl Heard {
    /// Takes one line FFmpeg printed (seconds into the stretch it was asked for).
    fn hear(&mut self, line: &str) {
        let value = |key: &str| {
            let rest = line.split(key).nth(1)?;
            rest.split_whitespace().next()?.parse::<f64>().ok()
        };
        if let Some(start) = value("silence_start:") {
            self.open = Some(start.max(0.0));
        } else if let Some(end) = value("silence_end:")
            && let Some(start) = self.open.take()
        {
            self.closed.push((start, end));
        }
    }
}

/// Microseconds of a number of seconds.
fn micros(seconds: f64) -> u64 {
    (seconds * 1_000_000.0).round().max(0.0) as u64
}

/// Starts looking for the silent stretches of `from..to` (microseconds) of the file at `path`:
/// quieter than `threshold_db` for at least `min_ms`. Reports 0 to 1 to `on_progress`. Returns the
/// job's id, for [`finish`] and [`cancel`]; `None` when the file has no sound (nothing to scan).
pub async fn begin(
    path: &Path,
    from: u64,
    to: u64,
    threshold_db: f64,
    min_ms: f64,
    on_progress: Channel<f32>,
    silences: &Silences,
) -> AppResult<Option<String>> {
    if to <= from {
        return Err(AppError::InvalidInput("The stretch is empty".into()));
    }
    if !threshold_db.is_finite() || !(-90.0..=0.0).contains(&threshold_db) {
        return Err(AppError::InvalidInput(
            "The threshold is not between -90 and 0 dB".into(),
        ));
    }
    if !min_ms.is_finite() || min_ms <= 0.0 {
        return Err(AppError::InvalidInput(
            "The shortest silence must be above 0".into(),
        ));
    }
    let tools = find_tools().ok_or_else(|| AppError::Unavailable("FFmpeg was not found".into()))?;
    let probe = ffprobe(&tools, path, false)
        .await
        .map_err(AppError::Unavailable)?;
    if probe.audio_channels.is_none() {
        return Ok(None);
    }
    let filter = format!(
        "silencedetect=noise={threshold_db}dB:d={:.6}",
        min_ms / 1000.0
    );
    // `silencedetect` reads the frames' own times, so a sound stream that starts after the file
    // does is already in file time (unlike beats, which counts samples).
    let args = part_args(path, from, to, filter);
    let heard = Arc::new(StdMutex::new(Heard::default()));
    let listener = heard.clone();
    let listen = progress_listener(to - from, on_progress, move |line| {
        if let Ok(mut heard) = listener.lock() {
            heard.hear(line);
        }
    });
    let job = Job::measure(
        &tools,
        Recipe { args, script: None },
        PathBuf::new(), // no filter graph file: the recipe has none
        listen,
    )
    .map_err(AppError::Unavailable)?;
    let id = random_token()?;
    silences.add(&id, Arc::new(job), Scan { heard, from, to });
    Ok(Some(id))
}

/// Waits for the scan `id` to end and returns its stretches, in microseconds of the file, in
/// order. A silence still open where the scan ends there. Fails with "Cancelled" when it was.
pub async fn finish(id: &str, silences: &Silences) -> AppResult<Vec<(u64, u64)>> {
    let (job, running) = silences
        .get(id)
        .ok_or_else(|| AppError::NotFound("That scan is not running".into()))?;
    let outcome = job.measured().await;
    silences.take(id);
    outcome.map_err(AppError::Unavailable)?;
    let heard = running
        .heard
        .lock()
        .map_err(|_| AppError::Unavailable("The silence scan was lost".into()))?;
    let length = (running.to - running.from) as f64 / 1_000_000.0;
    let mut stretches: Vec<(u64, u64)> = heard
        .closed
        .iter()
        .copied()
        .chain(heard.open.map(|start| (start, length)))
        .map(|(a, b)| {
            (
                running.from + micros(a),
                running.from + micros(b.min(length)),
            )
        })
        .filter(|(a, b)| b > a)
        .collect();
    stretches.sort_unstable();
    Ok(stretches)
}

/// Stops the scan `id`. One that already ended is left alone.
pub async fn cancel(id: &str, silences: &Silences) {
    silences.cancel(id).await;
}
