//! The silent stretches of a part of a file's sound, found by FFmpeg's `silencedetect`. It is an
//! export job ([`Job::measure`]: the same way FFmpeg is run, stopped and complained about as the
//! other analyses here); the stretches are read from the lines it prints. Decoding the sound is
//! all it costs. A scan is begun, then finished or cancelled by its job id (as an analysis is), and
//! reports 0 to 1 from `-progress`; the scans running are kept in [`Silences`].

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex as StdMutex};

use tauri::ipc::Channel;

use crate::error::{AppError, AppResult};
use crate::export::job::Job;
use crate::export::recipe::Recipe;
use crate::media::proxy::{ffprobe, find_tools};
use crate::media::server::random_token;

/// What `silencedetect` has said so far: the stretches it closed, and the one it opened.
#[derive(Default)]
struct Heard {
    open: Option<f64>,
    closed: Vec<(f64, f64)>,
}

/// A scan under way: its FFmpeg, what it has heard, and the length it was asked for (seconds).
#[derive(Clone)]
struct Running {
    job: Arc<Job>,
    heard: Arc<StdMutex<Heard>>,
    from: u64,
    to: u64,
}

/// The scans running now, by job id. One ends when its `finish` takes it, also after a cancel
/// (which only stops the job, so `finish` can say "Cancelled").
#[derive(Default)]
pub struct Silences(StdMutex<HashMap<String, Running>>);

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
    let seconds = |micros: u64| format!("{:.6}", micros as f64 / 1_000_000.0);
    let filter = format!(
        "silencedetect=noise={threshold_db}dB:d={:.6}",
        min_ms / 1000.0
    );
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
    .chain([filter.into()])
    .chain(["-f", "null", "-"].into_iter().map(Into::into))
    .collect();
    let heard = Arc::new(StdMutex::new(Heard::default()));
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
    if let Ok(mut all) = silences.0.lock() {
        all.insert(
            id.clone(),
            Running {
                job: Arc::new(job),
                heard,
                from,
                to,
            },
        );
    }
    Ok(Some(id))
}

/// Waits for the scan `id` to end and returns its stretches, in microseconds of the file, in
/// order. A silence still open where the scan ends there. Fails with "Cancelled" when it was.
pub async fn finish(id: &str, silences: &Silences) -> AppResult<Vec<(u64, u64)>> {
    let running = silences
        .0
        .lock()
        .ok()
        .and_then(|all| all.get(id).cloned())
        .ok_or_else(|| AppError::NotFound("That scan is not running".into()))?;
    let outcome = running.job.measured().await;
    if let Ok(mut all) = silences.0.lock() {
        all.remove(id);
    }
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
    let job = silences
        .0
        .lock()
        .ok()
        .and_then(|all| all.get(id).map(|r| r.job.clone()));
    if let Some(job) = job {
        job.cancel().await;
    }
}
