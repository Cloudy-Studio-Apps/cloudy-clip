//! Subtitle module: reading and writing `.srt` / `.vtt` files. Parsing and writing their cues
//! lives in TypeScript.

use std::path::PathBuf;

use crate::error::{AppError, AppResult};
use crate::workspace::{file_path, read_bytes};

/// The largest subtitle file read or written: far beyond a feature film's cues.
const MAX_BYTES: u64 = 8 * 1024 * 1024;

/// A subtitle path the webview or an agent gave: absolute, `.srt` or `.vtt`.
fn subtitle_path(raw: &str) -> AppResult<PathBuf> {
    file_path(raw, "srt").or_else(|_| file_path(raw, "vtt"))
}

/// What Windows-1252 puts at 0x80-0x9F (curly quotes, dashes, the euro); its five unused bytes
/// stay the Latin-1 control characters.
const CP1252_HIGH: [char; 32] = [
    '\u{20AC}', '\u{81}', '\u{201A}', '\u{192}', '\u{201E}', '\u{2026}', '\u{2020}', '\u{2021}',
    '\u{2C6}', '\u{2030}', '\u{160}', '\u{2039}', '\u{152}', '\u{8D}', '\u{17D}', '\u{8F}',
    '\u{90}', '\u{2018}', '\u{2019}', '\u{201C}', '\u{201D}', '\u{2022}', '\u{2013}', '\u{2014}',
    '\u{2DC}', '\u{2122}', '\u{161}', '\u{203A}', '\u{153}', '\u{9D}', '\u{17E}', '\u{178}',
];

/// Subtitle bytes as text: UTF-8, else Windows-1252 (a superset of Latin-1), what older `.srt`
/// files in Spanish and other western languages are saved in. Every byte maps to a character.
fn decode(bytes: Vec<u8>) -> String {
    String::from_utf8(bytes).unwrap_or_else(|error| {
        error
            .into_bytes()
            .into_iter()
            .map(|b| match b {
                0x80..=0x9F => CP1252_HIGH[usize::from(b - 0x80)],
                _ => char::from(b),
            })
            .collect()
    })
}

/// The text of an `.srt` or `.vtt` file at an absolute path, at most 8 MB: UTF-8, or Windows-1252
/// when it isn't valid UTF-8.
#[tauri::command]
pub async fn subtitle_read_text(path: String) -> Result<String, AppError> {
    let bytes = read_bytes(&path, &subtitle_path(&path)?, MAX_BYTES, "subtitles").await?;
    Ok(decode(bytes))
}

/// Writes an `.srt` or `.vtt` file at an absolute path (at most 8 MB), replacing what is there.
#[tauri::command]
pub async fn subtitle_write_text(path: String, contents: String) -> Result<(), AppError> {
    if contents.len() as u64 > MAX_BYTES {
        return Err(AppError::InvalidInput(
            "Subtitles larger than 8 MB".to_string(),
        ));
    }
    tokio::fs::write(subtitle_path(&path)?, contents).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn takes_only_absolute_srt_and_vtt_paths() {
        let root = if cfg!(windows) { "C:\\s" } else { "/s" };
        assert!(subtitle_path(&format!("{root}/a.srt")).is_ok());
        assert!(subtitle_path(&format!("{root}/a.VTT")).is_ok());
        assert!(subtitle_path(&format!("{root}/a.txt")).is_err());
        assert!(subtitle_path("a.srt").is_err());
    }

    #[test]
    fn reads_utf8_and_falls_back_to_windows_1252() {
        assert_eq!(decode("canción".as_bytes().to_vec()), "canción");
        assert_eq!(
            decode(b"canci\xf3n \x93hola\x94".to_vec()),
            "canción \u{201C}hola\u{201D}"
        );
    }
}
