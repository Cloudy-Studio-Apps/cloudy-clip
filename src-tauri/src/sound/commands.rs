//! Tauri commands of the sound module.

use std::path::PathBuf;
use std::sync::Arc;

use tauri::State;
use tauri::ipc::{Channel, InvokeBody, Request};

use super::analyses::{self, Analyses};
use super::analyze::Analysis;
use super::beats::{self, Beats};
use super::floor::{MEASURE_ARGS, parse_floor, stretch_args};
use super::record::{TakeStarted, TakeWritten, Takes};
use crate::error::{AppError, AppResult};
use crate::export::PartialNotes;
use crate::export::spec::SoundOnlySpec;
use crate::media::MediaRegistry;
use crate::media::denoise::AFFTDN_NF;
use crate::media::proxy::{command, find_tools};

/// The noise floor of `from..to` (microseconds) of a file's sound, in dBFS, within what noise
/// reduction (`afftdn`) accepts: the stretch should hold only the noise.
#[tauri::command]
pub async fn sound_measure_floor(
    id: String,
    from: u64,
    to: u64,
    registry: State<'_, Arc<MediaRegistry>>,
) -> Result<f64, AppError> {
    if to <= from {
        return Err(AppError::InvalidInput("The stretch is empty".into()));
    }
    let (source, _) = registry
        .original_of(&id)
        .ok_or_else(|| AppError::NotFound("Unknown media id".into()))?;
    let tools = find_tools().ok_or_else(|| AppError::Unavailable("FFmpeg was not found".into()))?;
    let output = command(&tools.ffmpeg)
        .args(["-hide_banner", "-nostats"])
        .args(stretch_args(from, to))
        .arg("-i")
        .arg(&source)
        .args(MEASURE_ARGS)
        .output()
        .await?;
    let stderr = String::from_utf8_lossy(&output.stderr);
    if !output.status.success() {
        let reason = stderr.lines().last().unwrap_or("unknown error");
        return Err(AppError::Unavailable(format!(
            "Could not measure the noise: {reason}"
        )));
    }
    // Digital silence has no floor: the lowest one noise reduction takes.
    let floor = parse_floor(&stderr).unwrap_or(AFFTDN_NF.0);
    Ok(floor.round().clamp(AFFTDN_NF.0, AFFTDN_NF.1))
}

/// Starts a recording: a new WAV file `stem.wav` (or `stem 2.wav`...; never overwrites) in
/// `Recordings` of the project's folder `project_dir` (which must exist, or at least its parent).
/// Returns the take's id, for `sound_record_write`, and its path.
#[tauri::command]
pub async fn sound_record_begin(
    project_dir: String,
    stem: String,
    sample_rate: u32,
    takes: State<'_, Takes>,
) -> Result<TakeStarted, AppError> {
    takes
        .begin(&PathBuf::from(project_dir), &stem, sample_rate)
        .await
}

/// Appends a chunk of a recording: the body is raw 16-bit little-endian mono samples, the headers
/// `id` (from `sound_record_begin`) and `done` (`1` on the last chunk, which closes the take;
/// a take with no samples leaves no file).
#[tauri::command]
pub async fn sound_record_write(
    request: Request<'_>,
    takes: State<'_, Takes>,
) -> Result<TakeWritten, AppError> {
    // Raw bytes; IPC's postMessage fallback turns them into a JSON array of numbers.
    let parsed: Vec<u8>;
    let samples: &[u8] = match request.body() {
        InvokeBody::Raw(bytes) => bytes,
        InvokeBody::Json(value) => {
            parsed = serde_json::from_value(value.clone())
                .map_err(|_| AppError::InvalidInput("Samples must be bytes".into()))?;
            &parsed
        }
    };
    let header = |name: &str| request.headers().get(name).and_then(|v| v.to_str().ok());
    let id = header("id").ok_or_else(|| AppError::InvalidInput("No recording id".into()))?;
    let done = header("done") == Some("1");
    takes.write(id, samples, done).await
}

/// Starts measuring a whole mix without playing it: `spec` is the sound of a Mix export (never
/// its stems), `peak_limit` the dBTP over which a stretch is a problem. Reports 0 to 1 to
/// `on_progress`. Returns the job's id, for `sound_analyze_finish` and `sound_analyze_cancel`.
/// A mix with no sound is refused.
#[tauri::command]
pub async fn sound_analyze_begin(
    spec: SoundOnlySpec,
    peak_limit: f64,
    on_progress: Channel<f32>,
    notes: State<'_, PartialNotes>,
    analyses: State<'_, Analyses>,
) -> AppResult<String> {
    analyses::begin(spec, peak_limit, on_progress, &notes, &analyses).await
}

/// Waits for an analysis to end and returns its figures: integrated loudness (LUFS; null when
/// there is nothing to measure), loudness range (LU), true peak (dBTP; null for silence) and the
/// problem stretches. Fails with "Cancelled" when it was.
#[tauri::command]
pub async fn sound_analyze_finish(
    job_id: String,
    notes: State<'_, PartialNotes>,
    analyses: State<'_, Analyses>,
) -> AppResult<Analysis> {
    analyses::finish(&job_id, &notes, &analyses).await
}

/// Stops an analysis. One that already ended is left alone.
#[tauri::command]
pub async fn sound_analyze_cancel(
    job_id: String,
    notes: State<'_, PartialNotes>,
    analyses: State<'_, Analyses>,
) -> AppResult<()> {
    analyses::cancel(&job_id, &notes, &analyses).await;
    Ok(())
}

/// What `sound_beats` found.
#[derive(serde::Serialize)]
pub struct BeatsFound {
    /// Microseconds of the file, in order; none when it has no tempo (speech, a held tone).
    pub beats: Vec<u64>,
}

/// The beats of the file at `path`, from the cache when the file is unchanged (path, size,
/// modified time); otherwise decoded under the caller's `job_id` (for `sound_beats_cancel`),
/// reporting 0 to 1 to `on_progress`. Fails with "Cancelled" when it was.
#[tauri::command]
pub async fn sound_beats(
    path: String,
    job_id: String,
    on_progress: Channel<f32>,
    notes: State<'_, PartialNotes>,
    beats: State<'_, Beats>,
) -> AppResult<BeatsFound> {
    let found = beats::find(&PathBuf::from(path), job_id, on_progress, &notes, &beats).await?;
    Ok(BeatsFound { beats: found })
}

/// Stops a `sound_beats` still decoding. One that already ended is left alone.
#[tauri::command]
pub async fn sound_beats_cancel(job_id: String, beats: State<'_, Beats>) -> AppResult<()> {
    beats::cancel(&job_id, &beats).await;
    Ok(())
}
