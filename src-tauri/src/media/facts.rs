//! What a file says about itself, for the Media page: codecs, audio format, timecode and date.

use std::path::Path;
use std::sync::Arc;
use std::time::UNIX_EPOCH;

use serde::Serialize;
use serde_json::Value;
use tauri::State;

use super::proxy::{command, find_tools};
use super::registry::MediaRegistry;
use crate::error::AppError;

/// Every field is missing when it can't be told, so no ffprobe still gives an answer.
#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileFacts {
    #[serde(skip_serializing_if = "Option::is_none")]
    video_codec: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    audio_codec: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sample_rate: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    channels: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sample_format: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    timecode: Option<String>,
    /// Milliseconds since the epoch.
    #[serde(skip_serializing_if = "Option::is_none")]
    created_at: Option<u64>,
}

fn text(value: &Value, key: &str) -> Option<String> {
    value.get(key)?.as_str().map(str::to_owned)
}

fn timecode_of(value: &Value) -> Option<String> {
    text(value.get("tags")?, "timecode")
}

/// Reads ffprobe's JSON (`-show_streams -show_format`).
fn parse_facts(json: &str) -> FileFacts {
    let Ok(root) = serde_json::from_str::<Value>(json) else {
        return FileFacts::default();
    };
    let streams = root.get("streams").and_then(Value::as_array);
    let streams = streams.map(Vec::as_slice).unwrap_or_default();
    let of_type = |kind: &str| {
        streams
            .iter()
            .find(|stream| stream.get("codec_type").and_then(Value::as_str) == Some(kind))
    };
    let video = of_type("video");
    let audio = of_type("audio");
    FileFacts {
        video_codec: video.and_then(|stream| text(stream, "codec_name")),
        audio_codec: audio.and_then(|stream| text(stream, "codec_name")),
        sample_rate: audio
            .and_then(|stream| text(stream, "sample_rate"))
            .and_then(|rate| rate.parse().ok()),
        channels: audio
            .and_then(|stream| stream.get("channels")?.as_u64())
            .and_then(|channels| channels.try_into().ok()),
        sample_format: audio.and_then(|stream| text(stream, "sample_fmt")),
        timecode: streams
            .iter()
            .find_map(timecode_of)
            .or_else(|| root.get("format").and_then(timecode_of)),
        created_at: None,
    }
}

async fn created_at(path: &Path) -> Option<u64> {
    let meta = tokio::fs::metadata(path).await.ok()?;
    let time = meta.created().or_else(|_| meta.modified()).ok()?;
    let since = time.duration_since(UNIX_EPOCH).ok()?;
    since.as_millis().try_into().ok()
}

async fn probed(path: &Path) -> FileFacts {
    let Some(tools) = find_tools() else {
        return FileFacts::default();
    };
    let output = command(&tools.ffprobe)
        .args([
            "-v",
            "error",
            "-of",
            "json",
            "-show_streams",
            "-show_format",
        ])
        .arg(path)
        .output()
        .await;
    match output {
        Ok(output) if output.status.success() => {
            parse_facts(&String::from_utf8_lossy(&output.stdout))
        }
        _ => FileFacts::default(),
    }
}

/// Reads the facts of a registered file, from the original and never from its proxy.
#[tauri::command]
pub async fn media_file_facts(
    id: String,
    registry: State<'_, Arc<MediaRegistry>>,
) -> Result<FileFacts, AppError> {
    let path = registry
        .proxied_original(&id)
        .map(|(path, _)| path)
        .or_else(|| registry.playback_path_of(&id))
        .ok_or_else(|| AppError::NotFound(format!("No media with id \"{id}\"")))?;
    let mut facts = probed(&path).await;
    facts.created_at = created_at(&path).await;
    Ok(facts)
}

#[cfg(test)]
mod tests {
    use super::*;

    const JSON: &str = r#"{
      "streams": [
        { "codec_type": "video", "codec_name": "h264", "tags": { "timecode": "01:00:00:00" } },
        { "codec_type": "audio", "codec_name": "aac", "sample_rate": "48000", "channels": 2,
          "sample_fmt": "fltp" }
      ],
      "format": {}
    }"#;

    #[test]
    fn parses_streams_and_timecode() {
        let facts = parse_facts(JSON);
        assert_eq!(facts.video_codec.as_deref(), Some("h264"));
        assert_eq!(facts.sample_rate, Some(48000));
        assert_eq!(facts.timecode.as_deref(), Some("01:00:00:00"));
    }
}
