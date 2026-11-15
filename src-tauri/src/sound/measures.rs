//! What the sound analyses share: the registry of the jobs running now ([`Measures`]), the
//! arguments that decode a part of a file's first sound stream through a filter ([`part_args`]),
//! and the listener that turns FFmpeg's `-progress` into 0 to 1 ([`progress_listener`]).

use std::collections::HashMap;
use std::ffi::OsString;
use std::path::Path;
use std::sync::{Arc, Mutex as StdMutex};

use tauri::ipc::Channel;

use crate::export::job::Job;

/// A job by its id: reserved before it starts (and cancelled while so), or running with what it
/// has heard.
enum Slot<H> {
    Waiting,
    Cancelled,
    Running(Arc<Job>, H),
}

/// Measuring jobs running now, by id, each with what it has heard (`H`). One ends when its
/// `finish` takes it, also after a cancel (which only stops the job, so `finish` can say
/// "Cancelled").
pub struct Measures<H>(StdMutex<HashMap<String, Slot<H>>>);

impl<H> Default for Measures<H> {
    fn default() -> Self {
        Self(StdMutex::new(HashMap::new()))
    }
}

impl<H: Clone> Measures<H> {
    /// Reserves `id` before its job can start, so a cancel that comes first is kept.
    pub fn reserve(&self, id: &str) {
        if let Ok(mut all) = self.0.lock() {
            all.insert(id.to_owned(), Slot::Waiting);
        }
    }

    /// Keeps the job `id`. `false` when it was cancelled while reserved: the caller stops it.
    pub fn add(&self, id: &str, job: Arc<Job>, heard: H) -> bool {
        let Ok(mut all) = self.0.lock() else {
            return true;
        };
        if matches!(all.get(id), Some(Slot::Cancelled)) {
            all.remove(id);
            return false;
        }
        all.insert(id.to_owned(), Slot::Running(job, heard));
        true
    }

    /// The job `id` and what it has heard, while it runs.
    pub fn get(&self, id: &str) -> Option<(Arc<Job>, H)> {
        match self.0.lock().ok()?.get(id)? {
            Slot::Running(job, heard) => Some((job.clone(), heard.clone())),
            _ => None,
        }
    }

    /// Forgets `id`, running or reserved.
    pub fn take(&self, id: &str) {
        if let Ok(mut all) = self.0.lock() {
            all.remove(id);
        }
    }

    /// Stops the job `id`; one only reserved is marked so it never starts. One that already
    /// ended is left alone.
    pub async fn cancel(&self, id: &str) {
        let job = self
            .0
            .lock()
            .ok()
            .and_then(|mut all| match all.get_mut(id)? {
                Slot::Running(job, _) => Some(job.clone()),
                slot => {
                    *slot = Slot::Cancelled;
                    None
                }
            });
        if let Some(job) = job {
            job.cancel().await;
        }
    }
}

/// FFmpeg's arguments that decode `from..to` (microseconds) of the first sound stream of the file
/// at `path` through `filter` and write nothing, with `-progress` on stderr.
pub fn part_args(path: &Path, from: u64, to: u64, filter: String) -> Vec<OsString> {
    let seconds = |micros: u64| format!("{:.6}", micros as f64 / 1_000_000.0);
    [
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
    .collect()
}

/// A listener for a job over `length` microseconds: `-progress` lines go to `on_progress` as 0 to
/// 1, every other line to `hear`.
pub fn progress_listener(
    length: u64,
    on_progress: Channel<f32>,
    mut hear: impl FnMut(&str) + Send + 'static,
) -> impl FnMut(&str) + Send + 'static {
    let length = length.max(1) as f32;
    move |line: &str| {
        if let Some(Ok(done)) = line.strip_prefix("out_time_us=").map(str::parse::<u64>) {
            let _ = on_progress.send((done as f32 / length).clamp(0.0, 1.0));
        } else {
            hear(line);
        }
    }
}
