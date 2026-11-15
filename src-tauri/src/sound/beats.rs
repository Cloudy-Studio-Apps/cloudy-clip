//! The beats of a file's sound, for snapping. FFmpeg decodes the first sound stream to mono
//! 32-bit floats at [`RATE`] into a scratch file, as an export job ([`Job::measure`]: the same
//! progress, cancel and complaint); then, in Rust:
//!
//! 1. **Onsets:** spectral flux, the sum of each bin's rise in log magnitude from one
//!    [`WINDOW`]-sample frame to the next, every [`HOP`] samples (about 5.8 ms).
//! 2. **Tempo:** the autocorrelation of that envelope between [`SLOWEST_BPM`] and [`FASTEST_BPM`],
//!    leaning towards 120 BPM so half and double tempos lose. When the envelope barely repeats at
//!    any tempo ([`PERIODIC`]: speech, a held tone, silence), the file has no beats.
//! 3. **Beats:** the chain of onsets one period apart that scores best (dynamic programming, as
//!    Ellis's beat tracker), so strays off the beat are never picked; a beat where the envelope
//!    has no onset (a break) is dropped.
//!
//! Results are kept per file by path, size and modified time ([`Beats`]), for the app's
//! lifetime: never in the project.

use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::SystemTime;

use tauri::ipc::Channel;

use crate::error::{AppError, AppResult};
use crate::export::PartialNotes;
use crate::export::job::Job;
use crate::export::recipe::Recipe;
use crate::media::proxy::{ffprobe, find_tools};

/// Samples per second the sound is decoded at: enough for kicks, snares and hats.
pub(crate) const RATE: u32 = 11025;
/// Samples in one spectrum (46 ms).
const WINDOW: usize = 512;
/// Samples from one spectrum to the next (5.8 ms): how finely a beat is placed.
const HOP: usize = 64;
/// Where in its frame an onset's flux peaks, in samples: a click entering the Hann window rises
/// fastest three quarters of the way in, so the frame starts that much before it.
const ONSET_AT: usize = WINDOW * 3 / 4;
const SLOWEST_BPM: f32 = 60.0;
const FASTEST_BPM: f32 = 200.0;
/// The tempo a guess leans towards, and how far (octaves) the lean reaches.
const LIKELY_BPM: f32 = 120.0;
const LEAN_OCTAVES: f32 = 1.0;
/// How strongly the envelope must repeat at its tempo (autocorrelation over its energy).
const PERIODIC: f32 = 0.3;
/// How much a beat chain resists straying from the period (Ellis's tightness).
const TIGHTNESS: f32 = 100.0;
/// A beat needs an onset this strong (in standard deviations of the envelope) within
/// [`NEAR`] frames, or it is a beat in a break and dropped.
const KEEP: f32 = 1.0;
const NEAR: usize = 3;
/// Bytes read from the decoded file at a time.
const CHUNK: usize = 64 * 1024;

/// The flux of each frame of a sound, fed in pieces.
pub(crate) struct Onsets {
    pending: Vec<f32>,
    hann: Vec<f32>,
    previous: Vec<f32>,
    envelope: Vec<f32>,
}

impl Onsets {
    pub(crate) fn new() -> Self {
        let hann = (0..WINDOW)
            .map(|i| 0.5 - 0.5 * (std::f32::consts::TAU * i as f32 / WINDOW as f32).cos())
            .collect();
        Self {
            // Silence before the start, so an onset in the first samples is placed too.
            pending: vec![0.0; WINDOW],
            hann,
            previous: vec![0.0; WINDOW / 2],
            envelope: Vec::new(),
        }
    }

    /// Takes the next samples.
    pub(crate) fn push(&mut self, samples: &[f32]) {
        self.pending.extend_from_slice(samples);
        let mut start = 0;
        let mut re = vec![0.0; WINDOW];
        let mut im = vec![0.0; WINDOW];
        while self.pending.len() - start >= WINDOW {
            for (i, sample) in self.pending[start..start + WINDOW].iter().enumerate() {
                re[i] = sample * self.hann[i];
                im[i] = 0.0;
            }
            fft(&mut re, &mut im);
            let mut flux = 0.0;
            for (bin, previous) in self.previous.iter_mut().enumerate() {
                let magnitude = (10.0 * re[bin].hypot(im[bin])).ln_1p();
                flux += (magnitude - *previous).max(0.0);
                *previous = magnitude;
            }
            self.envelope.push(flux);
            start += HOP;
        }
        self.pending.drain(..start);
    }

    /// The beats heard, in microseconds from the sound's start.
    pub(crate) fn beats(self) -> Vec<u64> {
        beat_frames(&self.envelope)
            .into_iter()
            .map(|frame| {
                let at = (frame * HOP + ONSET_AT).saturating_sub(WINDOW);
                at as u64 * 1_000_000 / u64::from(RATE)
            })
            .collect()
    }
}

/// In-place radix-2 FFT; `re.len()` is a power of two.
fn fft(re: &mut [f32], im: &mut [f32]) {
    let n = re.len();
    let mut j = 0;
    for i in 1..n {
        let mut bit = n >> 1;
        while j & bit != 0 {
            j ^= bit;
            bit >>= 1;
        }
        j |= bit;
        if i < j {
            re.swap(i, j);
            im.swap(i, j);
        }
    }
    let mut len = 2;
    while len <= n {
        let angle = -std::f32::consts::TAU / len as f32;
        for start in (0..n).step_by(len) {
            for k in 0..len / 2 {
                let (sin, cos) = (angle * k as f32).sin_cos();
                let (a, b) = (start + k, start + k + len / 2);
                let tr = re[b] * cos - im[b] * sin;
                let ti = re[b] * sin + im[b] * cos;
                re[b] = re[a] - tr;
                im[b] = im[a] - ti;
                re[a] += tr;
                im[a] += ti;
            }
        }
        len <<= 1;
    }
}

/// The frames of the envelope that are beats; none when it doesn't repeat at a tempo.
fn beat_frames(envelope: &[f32]) -> Vec<usize> {
    let frames_per_second = RATE as f32 / HOP as f32;
    let shortest = (frames_per_second * 60.0 / FASTEST_BPM).floor() as usize;
    let longest = (frames_per_second * 60.0 / SLOWEST_BPM).ceil() as usize;
    let n = envelope.len();
    if n < longest * 3 {
        return Vec::new();
    }
    let mean = envelope.iter().sum::<f32>() / n as f32;
    let centred: Vec<f32> = envelope.iter().map(|v| v - mean).collect();
    let energy = centred.iter().map(|v| v * v).sum::<f32>() / n as f32;
    if energy <= f32::EPSILON {
        return Vec::new();
    }
    let correlation = |lag: usize| {
        let sum: f32 = centred[..n - lag]
            .iter()
            .zip(&centred[lag..])
            .map(|(a, b)| a * b)
            .sum();
        sum / (n - lag) as f32 / energy
    };
    let likely = frames_per_second * 60.0 / LIKELY_BPM;
    let lean = |lag: usize| {
        let octaves = (lag as f32 / likely).log2() / LEAN_OCTAVES;
        (-0.5 * octaves * octaves).exp()
    };
    let Some((period, strength)) = (shortest..=longest)
        .map(|lag| (lag, correlation(lag)))
        .max_by(|a, b| (a.1 * lean(a.0)).total_cmp(&(b.1 * lean(b.0))))
    else {
        return Vec::new();
    };
    if strength < PERIODIC {
        return Vec::new();
    }

    let deviation = energy.sqrt();
    let score: Vec<f32> = envelope.iter().map(|v| v / deviation).collect();
    let mut total = score.clone();
    let mut from = vec![usize::MAX; n];
    let p = period as f32;
    for t in 0..n {
        let earliest = t.saturating_sub(period * 2);
        let latest = t.saturating_sub(period / 2);
        let mut best = (0.0, usize::MAX);
        for (prev, before) in total[earliest..latest].iter().enumerate() {
            let prev = earliest + prev;
            let stray = ((t - prev) as f32 / p).ln();
            let value = before - TIGHTNESS * stray * stray;
            if best.1 == usize::MAX || value > best.0 {
                best = (value, prev);
            }
        }
        if best.1 != usize::MAX && best.0 > 0.0 {
            total[t] += best.0;
            from[t] = best.1;
        }
    }
    let Some(mut at) = (n.saturating_sub(period)..n).max_by(|a, b| total[*a].total_cmp(&total[*b]))
    else {
        return Vec::new();
    };
    let mut beats = Vec::new();
    loop {
        let around = at.saturating_sub(NEAR)..(at + NEAR + 1).min(n);
        if let Some(peak) = around.max_by(|a, b| score[*a].total_cmp(&score[*b]))
            && score[peak] - mean / deviation >= KEEP
        {
            beats.push(peak);
        }
        if from[at] == usize::MAX {
            break;
        }
        at = from[at];
    }
    beats.reverse();
    beats
}

/// A file's beats with the size and modified time they were found at.
type Found = (u64, Option<SystemTime>, Arc<Vec<u64>>);

/// Beats found, by file, and the finds running now by the caller's job id.
#[derive(Default)]
pub struct Beats {
    found: StdMutex<HashMap<PathBuf, Found>>,
    running: StdMutex<HashMap<String, Arc<Job>>>,
}

/// The beats of the file at `path` in microseconds of the file, from the cache when the file
/// hasn't changed; otherwise decoded under `job_id` (for [`cancel`]), reporting 0 to 1 to
/// `on_progress`. Fails with "Cancelled" when it was.
pub async fn find(
    path: &Path,
    job_id: String,
    on_progress: Channel<f32>,
    notes: &PartialNotes,
    beats: &Beats,
) -> AppResult<Vec<u64>> {
    // It names a scratch file.
    if job_id.is_empty()
        || !job_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(AppError::InvalidInput("Not a job id".into()));
    }
    let meta = tokio::fs::metadata(path).await?;
    let version = (meta.len(), meta.modified().ok());
    if let Some(known) = beats.found.lock().ok().and_then(|found| {
        found
            .get(path)
            .filter(|(size, modified, _)| (*size, *modified) == version)
            .map(|(_, _, known)| known.clone())
    }) {
        return Ok(known.to_vec());
    }
    let tools = find_tools().ok_or_else(|| AppError::Unavailable("FFmpeg was not found".into()))?;
    let probe = ffprobe(&tools, path, false)
        .await
        .map_err(AppError::Unavailable)?;
    let duration = probe.duration_us.unwrap_or(0).max(1);

    let folder = notes.folder();
    let scratch = folder
        .parent()
        .unwrap_or(folder)
        .join(format!("beats-{job_id}.f32"));
    tokio::fs::create_dir_all(notes.folder()).await?;
    let note = notes.folder().join(format!("beats-{job_id}"));
    tokio::fs::write(&note, scratch.display().to_string()).await?;
    let found = decode(path, &scratch, &job_id, duration, on_progress, beats).await;
    let _ = tokio::fs::remove_file(&scratch).await;
    let _ = tokio::fs::remove_file(&note).await;
    // A sound stream that starts after the file does is that much later in the file.
    let found: Vec<u64> = found?
        .into_iter()
        .map(|t| t + probe.audio_delay_us)
        .collect();
    if let Ok(mut known) = beats.found.lock() {
        known.insert(
            path.to_owned(),
            (version.0, version.1, Arc::new(found.clone())),
        );
    }
    Ok(found)
}

/// Decodes `path` into `scratch` under `job_id` and finds its beats.
async fn decode(
    path: &Path,
    scratch: &Path,
    job_id: &str,
    duration: u64,
    on_progress: Channel<f32>,
    beats: &Beats,
) -> AppResult<Vec<u64>> {
    let tools = find_tools().ok_or_else(|| AppError::Unavailable("FFmpeg was not found".into()))?;
    let args = [
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-progress",
        "pipe:2",
        "-y",
        "-i",
    ]
    .into_iter()
    .map(Into::into)
    .chain([path.as_os_str().to_owned()])
    .chain(
        [
            "-map",
            "0:a:0",
            "-ac",
            "1",
            "-ar",
            &RATE.to_string(),
            "-f",
            "f32le",
        ]
        .into_iter()
        .map(Into::into),
    )
    .chain([scratch.as_os_str().to_owned()])
    .collect();
    let listen = move |line: &str| {
        if let Some(Ok(done)) = line.strip_prefix("out_time_us=").map(str::parse::<u64>) {
            let _ = on_progress.send((done as f32 / duration as f32).clamp(0.0, 0.99));
        }
    };
    let recipe = Recipe { args, script: None };
    let job = Job::measure(&tools, recipe, scratch.with_extension("graph"), listen)
        .map(Arc::new)
        .map_err(AppError::Unavailable)?;
    if let Ok(mut running) = beats.running.lock() {
        running.insert(job_id.to_owned(), job.clone());
    }
    let outcome = job.measured().await;
    if let Ok(mut running) = beats.running.lock() {
        running.remove(job_id);
    }
    outcome.map_err(AppError::Unavailable)?;
    let scratch = scratch.to_owned();
    tauri::async_runtime::spawn_blocking(move || read_beats(&scratch))
        .await
        .map_err(|e| AppError::Unavailable(format!("Finding beats stopped: {e}")))?
}

/// The beats of a file of mono `f32le` samples at [`RATE`], read a piece at a time.
fn read_beats(file: &Path) -> AppResult<Vec<u64>> {
    let mut reader = std::fs::File::open(file)?;
    let mut onsets = Onsets::new();
    let mut bytes = vec![0u8; CHUNK];
    let mut kept = 0;
    let mut samples = Vec::with_capacity(CHUNK / 4);
    loop {
        let read = reader.read(&mut bytes[kept..])?;
        if read == 0 {
            break;
        }
        let whole = (kept + read) / 4 * 4;
        samples.clear();
        samples.extend(
            bytes[..whole]
                .chunks_exact(4)
                .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]])),
        );
        onsets.push(&samples);
        bytes.copy_within(whole..kept + read, 0);
        kept = kept + read - whole;
    }
    Ok(onsets.beats())
}

/// Stops the find `job_id`. One that already ended is left alone.
pub async fn cancel(job_id: &str, beats: &Beats) {
    let job = beats
        .running
        .lock()
        .ok()
        .and_then(|running| running.get(job_id).cloned());
    if let Some(job) = job {
        job.cancel().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Beats of `seconds` of sound made by `sample(t)`, `t` in seconds.
    fn beats_of(seconds: f32, sample: impl Fn(f32) -> f32) -> Vec<u64> {
        let n = (seconds * RATE as f32) as usize;
        let samples: Vec<f32> = (0..n).map(|i| sample(i as f32 / RATE as f32)).collect();
        let mut onsets = Onsets::new();
        // In uneven pieces, as a file is read.
        for piece in samples.chunks(1000) {
            onsets.push(piece);
        }
        onsets.beats()
    }

    /// Deterministic noise in -1..1.
    fn noise(t: f32) -> f32 {
        let mut x = ((t * RATE as f32) as u32).wrapping_mul(0x9e37_79b1);
        x ^= x >> 15;
        x = x.wrapping_mul(0x2c1b_3c6d);
        x ^= x >> 12;
        x as f32 / u32::MAX as f32 * 2.0 - 1.0
    }

    /// A 5 ms click of decaying noise at each of `times`.
    fn clicks(times: &[f32], t: f32) -> f32 {
        times
            .iter()
            .find(|&&at| t >= at && t < at + 0.005)
            .map_or(0.0, |&at| noise(t) * (-(t - at) * 600.0).exp() * 0.8)
    }

    #[test]
    fn a_click_track_at_120_bpm_beats_every_500_ms() {
        let times: Vec<f32> = (0..24).map(|k| 0.25 + k as f32 * 0.5).collect();
        let beats = beats_of(12.5, |t| clicks(&times, t));
        assert!(beats.len() >= 20, "{beats:?}");
        for beat in &beats {
            let nearest = times
                .iter()
                .map(|at| (*beat as f32 / 1e6 - at).abs())
                .fold(f32::MAX, f32::min);
            assert!(nearest <= 0.010, "beat at {beat} is {nearest} s off");
        }
        for pair in beats.windows(2) {
            let gap = pair[1] - pair[0];
            assert!(gap.abs_diff(500_000) <= 10_000, "{gap} µs apart");
        }
    }

    #[test]
    fn a_sine_has_no_beats() {
        let beats = beats_of(10.0, |t| (std::f32::consts::TAU * 440.0 * t).sin() * 0.5);
        assert!(beats.is_empty(), "{beats:?}");
    }

    #[test]
    fn bursts_at_no_tempo_have_no_beats() {
        // Syllable-like bursts at irregular gaps, as speech: no tempo to follow.
        let gaps = [
            0.31, 0.17, 0.52, 0.23, 0.71, 0.13, 0.44, 0.29, 0.61, 0.19, 0.37, 0.83,
        ];
        let mut times = Vec::new();
        let mut at = 0.2;
        for gap in gaps.iter().cycle().take(40) {
            times.push(at);
            at += gap;
        }
        let beats = beats_of(at + 0.5, |t| {
            times
                .iter()
                .find(|&&start| t >= start && t < start + 0.09)
                .map_or(0.0, |_| noise(t) * 0.4)
        });
        assert!(beats.is_empty(), "{beats:?}");
    }

    #[test]
    fn silence_has_no_beats() {
        assert!(beats_of(5.0, |_| 0.0).is_empty());
    }
}
