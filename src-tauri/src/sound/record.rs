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
pub const HEADER_LEN: usize = 44;
/// The most sample bytes a WAV's 32-bit sizes can say (about 13 hours at 44.1 kHz).
const MAX_DATA: u32 = u32::MAX - (HEADER_LEN as u32 - 8);

/// The header of a 16-bit mono PCM WAV holding `data_len` bytes of samples at `sample_rate`.
pub fn wav_header(sample_rate: u32, data_len: u32) -> [u8; HEADER_LEN] {
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

impl Takes {
    /// Creates `stem.wav` in `folder` (or `stem 2.wav`, `stem 3.wav`... when taken; never
    /// overwrites), with a header and no samples yet.
    pub async fn begin(
        &self,
        folder: &Path,
        stem: &str,
        sample_rate: u32,
    ) -> AppResult<TakeStarted> {
        let stem = checked_stem(stem)?;
        if !(8_000..=384_000).contains(&sample_rate) {
            return Err(AppError::InvalidInput(format!(
                "Unsupported sample rate: {sample_rate}"
            )));
        }
        tokio::fs::create_dir_all(folder).await?;
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
        if !samples.len().is_multiple_of(usize::from(BLOCK_ALIGN)) {
            return Err(AppError::InvalidInput(
                "A chunk must hold whole samples".into(),
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
        take.file.sync_all().await?;
        if take.data_len == 0 {
            drop(take.file);
            tokio::fs::remove_file(&take.path).await?;
            appended?;
            return Ok(TakeWritten {
                path: None,
                samples: 0,
            });
        }
        appended?;
        Ok(written(&take))
    }
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

#[cfg(test)]
mod tests {
    use super::*;

    fn u32_at(bytes: &[u8], at: usize) -> u32 {
        u32::from_le_bytes(bytes[at..at + 4].try_into().unwrap())
    }

    fn u16_at(bytes: &[u8], at: usize) -> u16 {
        u16::from_le_bytes(bytes[at..at + 2].try_into().unwrap())
    }

    #[test]
    fn the_header_says_how_many_samples_at_what_rate() {
        let header = wav_header(44_100, 1_000 * 2);
        assert_eq!(&header[0..4], b"RIFF");
        assert_eq!(u32_at(&header, 4), 36 + 2_000);
        assert_eq!(&header[8..16], b"WAVEfmt ");
        assert_eq!(u32_at(&header, 16), 16);
        assert_eq!(u16_at(&header, 20), 1);
        assert_eq!(u16_at(&header, 22), 1);
        assert_eq!(u32_at(&header, 24), 44_100);
        assert_eq!(u32_at(&header, 28), 88_200);
        assert_eq!(u16_at(&header, 32), 2);
        assert_eq!(u16_at(&header, 34), 16);
        assert_eq!(&header[36..40], b"data");
        assert_eq!(u32_at(&header, 40), 2_000);
    }
}
