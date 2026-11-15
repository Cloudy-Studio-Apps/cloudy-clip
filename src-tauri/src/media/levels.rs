//! Levels clips: black and white video for measuring how the webview draws video levels.

use std::sync::Arc;

use tauri::State;

use super::proxy::{ProxyJobs, command, find_tools};
use super::registry::MediaRegistry;
use super::stopper::ENCODERS;
use crate::error::{AppError, AppResult};

/// The filter that draws video black (left) and white (right) stating `tags`
/// (`range/matrix/primaries/transfer`, ffprobe's names, as `ProbeMeta::color_tags`), or `None`
/// when they aren't four plain names. A tag that is `unknown` stays unstated, as in the file.
fn levels_filter(tags: &str) -> Option<String> {
    let parts: Vec<&str> = tags.split('/').collect();
    let plain = |part: &&str| {
        !part.is_empty()
            && part
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' || b == b'_')
    };
    if parts.len() != 4 || !parts.iter().all(plain) {
        return None;
    }
    let (black, white) = if parts[0] == "pc" {
        (0, 255)
    } else {
        (16, 235)
    };
    let mut filter = format!(
        "nullsrc=s=128x64:r=30:d=0.5,format=yuv420p,geq=lum='if(lt(X,W/2),{black},{white})':cb=128:cr=128"
    );
    // Set on the frames: FFmpeg's `-colorspace` output options lose to what the frames carry.
    let set: Vec<String> = ["range", "colorspace", "color_primaries", "color_trc"]
        .iter()
        .zip(&parts)
        .filter(|(_, value)| **value != "unknown")
        .map(|(key, value)| format!("{key}={value}"))
        .collect();
    if !set.is_empty() {
        filter.push_str(",setparams=");
        filter.push_str(&set.join(":"));
    }
    Some(filter)
}

/// A tiny clip of video black and white stating the color tags `tags` (`ProbeMeta.colorTags`),
/// for measuring how the webview draws video with those tags: WebKitGTK expands the range of
/// some kinds and not others. Registered like media, so it reaches a media element the same way.
/// Made once per kind, in the app's cache folder. Returns its media id.
#[tauri::command]
pub async fn media_levels_clip(
    tags: String,
    jobs: State<'_, ProxyJobs>,
    registry: State<'_, Arc<MediaRegistry>>,
) -> AppResult<String> {
    let filter = levels_filter(&tags)
        .ok_or_else(|| AppError::Unavailable(format!("Unexpected color tags: {tags}")))?;
    let key = tags.replace('/', "_");
    let tools =
        find_tools().ok_or_else(|| AppError::Unavailable("FFmpeg was not found".to_owned()))?;
    let folder = jobs.cache_dir().parent().unwrap_or(jobs.cache_dir());
    tokio::fs::create_dir_all(folder).await?;
    let clip = folder.join(format!("levels-{key}.mp4"));
    if !tokio::fs::try_exists(&clip).await.unwrap_or(false) {
        // Counted like every encoder, so quitting stops it; written aside and renamed when done,
        // because an existing clip is reused as it is and a half-written one would spoil every measure.
        let Some(_running) = ENCODERS.enter() else {
            return Err(AppError::Unavailable("Cancelled".into()));
        };
        let partial = folder.join(format!("levels-{key}.partial.mp4"));
        let mut child = command(&tools.ffmpeg)
            .args(["-hide_banner", "-loglevel", "error", "-y"])
            .args(["-f", "lavfi", "-i", &filter])
            .args(["-c:v", "libx264", "-crf", "1", "-movflags", "+faststart"])
            .arg(&partial)
            .spawn()?;
        let status = tokio::select! {
            status = child.wait() => status?,
            () = ENCODERS.stopping() => {
                let _ = child.kill().await;
                return Err(AppError::Unavailable("Cancelled".into()));
            }
        };
        if !status.success() {
            return Err(AppError::Unavailable(format!(
                "Could not make the levels clip for {tags}"
            )));
        }
        tokio::fs::rename(&partial, &clip).await?;
    }
    let size = tokio::fs::metadata(&clip).await?.len();
    let id = format!("media-levels-{key}");
    registry.register(&id, &clip, size)?;
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::levels_filter;

    /// The tags come from the webview and go into an FFmpeg filter graph.
    #[test]
    fn levels_filter_states_only_known_tags_and_refuses_odd_ones() {
        let partial = levels_filter("tv/bt709/unknown/unknown").unwrap();
        assert!(partial.contains(",16,235)"));
        assert!(partial.ends_with(",setparams=range=tv:colorspace=bt709"));
        let untagged = levels_filter("unknown/unknown/unknown/unknown").unwrap();
        assert!(!untagged.contains("setparams"));
        let full = levels_filter("pc/bt470bg/bt470bg/bt470bg").unwrap();
        assert!(full.contains(",0,255)") && full.contains("color_trc=bt470bg"));
        assert!(levels_filter("tv/bt709/unknown").is_none());
        assert!(levels_filter("tv/bt709:x=1/unknown/unknown").is_none());
        assert!(levels_filter("tv/bt709//unknown").is_none());
    }
}
