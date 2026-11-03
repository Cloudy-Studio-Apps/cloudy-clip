//! A voice recorded on the Sound page, written as a WAV file. The webview captures the microphone
//! and sends 16-bit mono PCM in chunks; each chunk is appended and the header rewritten after it,
//! so the file on disk is always a whole WAV, even if the app stops mid-take.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

use serde::Serialize;
use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncSeekExt, AsyncWriteExt, SeekFrom};
use tokio::sync::Mutex;

use crate::error::{AppError, AppResult};

/// Mono: a microphone gives one channel.
const CHANNELS: u16 = 1;
const BITS_PER_SAMPLE: u16 = 16;
const BLOCK_ALIGN: u16 = CHANNELS * BITS_PER_SAMPLE / 8;
/// The canonical header: `RIFF`, `fmt ` (PCM) and the `data` chunk's header.
const HEADER_LEN: usize = 44;
/// The most sample bytes a WAV's 32-bit sizes can say (about 13 hours at 44.1 kHz).
const MAX_DATA: u32 = u32::MAX - (HEADER_LEN as u32 - 8);
/// The largest chunk taken at once: the webview sends a quarter of a second (192 KB at 384 kHz).
pub const MAX_CHUNK: usize = 1 << 20;
/// The folder takes go into, inside the project's folder.
const RECORDINGS: &str = "Recordings";

/// The header of a 16-bit mono PCM WAV holding `data_len` bytes of samples at `sample_rate`.
fn wav_header(sample_rate: u32, data_len: u32) -> [u8; HEADER_LEN] {
    let mut header = [0u8; HEADER_LEN];
    let byte_rate = sample_rate * u32::from(BLOCK_ALIGN);
    let mut put = |at: usize, bytes: &[u8]| header[at..at + bytes.len()].copy_from_slice(bytes);
    put(0, b"RIFF");
    put(4, &(data_len + (HEADER_LEN as u32 - 8)).to_le_bytes());
    put(8, b"WAVE");
    put(12, b"fmt ");
    put(16, &16u32.to_le_bytes());
    put(20, &1u16.to_le_bytes()); // PCM
    put(22, &CHANNELS.to_le_bytes());
    put(24, &sample_rate.to_le_bytes());
    put(28, &byte_rate.to_le_bytes());
    put(32, &BLOCK_ALIGN.to_le_bytes());
    put(34, &BITS_PER_SAMPLE.to_le_bytes());
    put(36, b"data");
    put(40, &data_len.to_le_bytes());
    header
}

/// A take being written.
struct Take {
    file: File,
    path: PathBuf,
    sample_rate: u32,
    data_len: u32,
}

/// Where a take was started.
#[derive(Debug, Serialize)]
pub struct TakeStarted {
    pub id: String,
    pub path: String,
}

/// What a write left on disk.
#[derive(Debug, Serialize)]
pub struct TakeWritten {
    /// The file; null once a take with no samples was finished (its file is deleted).
    pub path: Option<String>,
    /// Samples written so far.
    pub samples: u64,
}

/// The takes being written, by id. Managed by Tauri.
#[derive(Default)]
pub struct Takes {
    open: Mutex<HashMap<String, Take>>,
    next: AtomicU64,
}

/// A file name for a take: no folders, nothing hidden, not empty.
fn checked_stem(stem: &str) -> AppResult<&str> {
    let bad = stem.is_empty()
        || stem.len() > 120
        || stem.starts_with('.')
        || stem.contains(['/', '\\', ':', '*', '?', '"', '<', '>', '|']);
    if bad {
        return Err(AppError::InvalidInput(format!("Not a file name: {stem}")));
    }
    Ok(stem)
}

/// `Recordings` in a project's folder, made if needed. The project's folder must exist, or at
/// least its parent (a new project's folder, about to be made); nothing deeper is created.
async fn recordings_in(project_dir: &Path) -> AppResult<PathBuf> {
    let parent_exists = match project_dir.parent() {
        Some(parent) => tokio::fs::try_exists(parent).await?,
        None => false,
    };
    if !project_dir.is_absolute() || !(project_dir.is_dir() || parent_exists) {
        return Err(AppError::InvalidInput(format!(
            "Not a project folder: {}",
            project_dir.display()
        )));
    }
    if !project_dir.is_dir() {
        tokio::fs::create_dir(project_dir).await?;
    }
    let folder = project_dir.join(RECORDINGS);
    if !folder.is_dir() {
        tokio::fs::create_dir(&folder).await?;
    }
    Ok(folder)
}

impl Takes {
    /// Creates `stem.wav` in `Recordings` of the project's folder (or `stem 2.wav`, `stem 3.wav`...
    /// when taken; never overwrites), with a header and no samples yet. A take left open by an
    /// earlier page (reloaded before its last chunk) is closed first: one take at a time.
    pub async fn begin(
        &self,
        project_dir: &Path,
        stem: &str,
        sample_rate: u32,
    ) -> AppResult<TakeStarted> {
        let stem = checked_stem(stem)?;
        if !(8_000..=384_000).contains(&sample_rate) {
            return Err(AppError::InvalidInput(format!(
                "Unsupported sample rate: {sample_rate}"
            )));
        }
        let stale: Vec<Take> = self
            .open
            .lock()
            .await
            .drain()
            .map(|(_, take)| take)
            .collect();
        for take in stale {
            if let Err(error) = close(take).await {
                eprintln!("[sound] could not close an unfinished take: {error}");
            }
        }
        let folder = recordings_in(project_dir).await?;
        for n in 1u32..10_000 {
            let name = match n {
                1 => format!("{stem}.wav"),
                _ => format!("{stem} {n}.wav"),
            };
            let path = folder.join(name);
            let opened = OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)
                .await;
            let mut file = match opened {
                Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
                result => result?,
            };
            file.write_all(&wav_header(sample_rate, 0)).await?;
            file.flush().await?;
            let id = self.next.fetch_add(1, Ordering::Relaxed).to_string();
            let started = TakeStarted {
                id: id.clone(),
                path: path.display().to_string(),
            };
            let take = Take {
                file,
                path,
                sample_rate,
                data_len: 0,
            };
            self.open.lock().await.insert(id, take);
            return Ok(started);
        }
        Err(AppError::Unavailable(
            "No free name for the recording".into(),
        ))
    }

    /// Appends `samples` (16-bit little-endian) to a take and rewrites its header. With `done`,
    /// the take is closed: synced to disk, or deleted when it holds no samples at all.
    pub async fn write(&self, id: &str, samples: &[u8], done: bool) -> AppResult<TakeWritten> {
        if !samples.len().is_multiple_of(usize::from(BLOCK_ALIGN)) || samples.len() > MAX_CHUNK {
            return Err(AppError::InvalidInput(
                "A chunk must hold whole samples, at most 1 MB".into(),
            ));
        }
        let mut open = self.open.lock().await;
        let unknown = || AppError::NotFound("No recording under that id".into());
        if !done {
            let take = open.get_mut(id).ok_or_else(unknown)?;
            append(take, samples).await?;
            return Ok(written(take));
        }
        // The last chunk closes the take even when it can't be written: what is on disk stays.
        let mut take = open.remove(id).ok_or_else(unknown)?;
        drop(open);
        let appended = append(&mut take, samples).await;
        let result = written(&take);
        let closed = close(take).await;
        appended?;
        let empty = closed?;
        Ok(if empty {
            TakeWritten {
                path: None,
                samples: 0,
            }
        } else {
            result
        })
    }
}

/// Closes a take: synced, or deleted when it holds no samples (whether or not the sync worked).
/// Says whether it was empty.
async fn close(take: Take) -> AppResult<bool> {
    let synced = take.file.sync_all().await;
    drop(take.file);
    if take.data_len == 0 {
        tokio::fs::remove_file(&take.path).await?;
    }
    synced?;
    Ok(take.data_len == 0)
}

/// Where a take stands.
fn written(take: &Take) -> TakeWritten {
    TakeWritten {
        path: Some(take.path.display().to_string()),
        samples: u64::from(take.data_len / u32::from(BLOCK_ALIGN)),
    }
}

/// Appends samples, then rewrites the header so the file says how much it holds.
async fn append(take: &mut Take, samples: &[u8]) -> AppResult<()> {
    if samples.is_empty() {
        return Ok(());
    }
    let added = u32::try_from(samples.len()).ok();
    let data_len = added
        .and_then(|added| take.data_len.checked_add(added))
        .filter(|len| *len <= MAX_DATA)
        .ok_or_else(|| {
            AppError::Unavailable("The recording reached the largest size a WAV file holds".into())
        })?;
    take.file
        .seek(SeekFrom::Start(
            HEADER_LEN as u64 + u64::from(take.data_len),
        ))
        .await?;
    take.file.write_all(samples).await?;
    take.data_len = data_len;
    take.file.seek(SeekFrom::Start(0)).await?;
    take.file
        .write_all(&wav_header(take.sample_rate, data_len))
        .await?;
    take.file.flush().await?;
    Ok(())
}
