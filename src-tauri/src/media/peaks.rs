//! Sound peaks of a file, for drawing: FFmpeg decodes the first sound stream to 8 kHz mono and
//! each [`PER_PEAK`] samples become one byte, their loudest sample scaled to 0..255.

use tokio::io::AsyncReadExt;

use super::proxy::{command, find_tools};
use super::stopper::ENCODERS;
use crate::error::{AppError, AppResult};

/// Samples per second the sound is decoded at.
const RATE: usize = 8000;
/// Peaks per second of the file (the TypeScript side's `PEAKS_PER_SECOND`).
const PER_SECOND: usize = 50;
const PER_PEAK: usize = RATE / PER_SECOND;

/// The byte of a peak whose loudest sample is `loudest`.
fn scaled(loudest: u16) -> u8 {
    (u32::from(loudest).min(32767) * 255 / 32767) as u8
}

/// Folds s16le `bytes` into `peaks`; `loudest` and `count` carry a peak still being filled.
fn fold(bytes: &[u8], loudest: &mut u16, count: &mut usize, peaks: &mut Vec<u8>) {
    for pair in bytes.chunks_exact(2) {
        let sample = i16::from_le_bytes([pair[0], pair[1]]);
        *loudest = (*loudest).max(sample.unsigned_abs());
        *count += 1;
        if *count == PER_PEAK {
            peaks.push(scaled(*loudest));
            *loudest = 0;
            *count = 0;
        }
    }
}

/// The sound of the file at `path` (the master, never a proxy) as peaks, [`PER_SECOND`] a second.
/// Empty when it has no sound or FFmpeg can't read it.
#[tauri::command]
pub async fn media_peaks(path: String) -> AppResult<tauri::ipc::Response> {
    let tools =
        find_tools().ok_or_else(|| AppError::Unavailable("FFmpeg was not found".to_owned()))?;
    // Counted like every encoder, so quitting stops it.
    let Some(_running) = ENCODERS.enter() else {
        return Err(AppError::Unavailable("Cancelled".into()));
    };
    let mut child = command(&tools.ffmpeg)
        .args(["-v", "error", "-i", &path])
        .args([
            "-vn",
            "-ac",
            "1",
            "-ar",
            &RATE.to_string(),
            "-f",
            "s16le",
            "pipe:1",
        ])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()?;
    let Some(mut out) = child.stdout.take() else {
        return Err(AppError::Unavailable("FFmpeg gave no output".into()));
    };
    let (mut peaks, mut loudest, mut count) = (Vec::new(), 0u16, 0usize);
    let mut buffer = vec![0u8; 64 * 1024];
    // A read can end mid-sample; the odd byte waits for the next one.
    let mut held = 0;
    loop {
        let n = tokio::select! {
            n = out.read(&mut buffer[held..]) => n?,
            () = ENCODERS.stopping() => return Err(AppError::Unavailable("Cancelled".into())),
        };
        if n == 0 {
            break;
        }
        let end = held + n;
        let whole = end - end % 2;
        fold(&buffer[..whole], &mut loudest, &mut count, &mut peaks);
        buffer.copy_within(whole..end, 0);
        held = end - whole;
    }
    if count > 0 {
        peaks.push(scaled(loudest));
    }
    let ok = child.wait().await?.success();
    Ok(tauri::ipc::Response::new(if ok {
        peaks
    } else {
        Vec::new()
    }))
}
