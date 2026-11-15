//! The silent stretches of a part of a file's sound, found by FFmpeg's `silencedetect`. It is an
//! export job ([`Job::measure`]: the same way FFmpeg is run, stopped and complained about as the
//! other analyses here); the stretches are read from the lines it prints. Decoding the sound is
//! all it costs, so there is no progress to report.

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex as StdMutex};

use crate::error::{AppError, AppResult};
use crate::export::job::Job;
use crate::export::recipe::Recipe;
use crate::media::proxy::find_tools;

/// What `silencedetect` has said so far: the stretches it closed, and the one it opened.
#[derive(Default)]
struct Heard {
    open: Option<f64>,
    closed: Vec<(f64, f64)>,
}

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

/// The silent stretches of `from..to` (microseconds) of the file at `path`: quieter than
/// `threshold_db` for at least `min_ms`, in microseconds of the file, in order. A silence still
/// open where `to` is ends there.
pub async fn find(
    path: &Path,
    from: u64,
    to: u64,
    threshold_db: f64,
    min_ms: f64,
) -> AppResult<Vec<(u64, u64)>> {
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
    let seconds = |micros: u64| format!("{:.6}", micros as f64 / 1_000_000.0);
    let filter = format!(
        "silencedetect=noise={threshold_db}dB:d={:.6}",
        min_ms / 1000.0
    );
    let args = ["-hide_banner", "-nostats", "-loglevel", "info", "-ss"]
        .into_iter()
        .map(Into::into)
        .chain([seconds(from).into(), "-t".into(), seconds(to - from).into()])
        .chain(["-i".into(), path.as_os_str().to_owned()])
        .chain(
            ["-vn", "-map", "0:a:0", "-af"]
                .into_iter()
                .map(Into::into),
        )
        .chain([filter.into()])
        .chain(["-f", "null", "-"].into_iter().map(Into::into))
        .collect();
    let heard = Arc::new(StdMutex::new(Heard::default()));
    let listener = heard.clone();
    let listen = move |line: &str| {
        if let Ok(mut heard) = listener.lock() {
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
    job.measured().await.map_err(AppError::Unavailable)?;
    let heard = heard
        .lock()
        .map_err(|_| AppError::Unavailable("The silence search was lost".into()))?;
    let length = (to - from) as f64 / 1_000_000.0;
    let mut stretches: Vec<(u64, u64)> = heard
        .closed
        .iter()
        .copied()
        .chain(heard.open.map(|start| (start, length)))
        .map(|(a, b)| (from + micros(a), from + micros(b.min(length))))
        .filter(|(a, b)| b > a)
        .collect();
    stretches.sort_unstable();
    Ok(stretches)
}
