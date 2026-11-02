//! What the FFmpeg on this machine can write. The system binary varies, so nothing is assumed.

use std::process::Stdio;

use serde::Serialize;
use tokio::sync::OnceCell;

use crate::media::proxy::{Tools, command, find_tools};

/// Tried in this order. VAAPI is left out: it needs a device and its own filter chain.
const CARD_FAMILIES: [&str; 4] = ["nvenc", "qsv", "amf", "videotoolbox"];

/// Formats the frontend offers, by the encoders each needs.
const FORMATS: [(&str, &[&str]); 6] = [
    ("h264", &["libx264", "aac"]),
    ("h265", &["libx265", "aac"]),
    ("webm", &["libvpx-vp9", "libopus"]),
    ("prores", &["prores_ks"]),
    ("gif", &["gif"]),
    ("mp3", &["libmp3lame"]),
];

/// What can be exported here.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    /// Whether FFmpeg was found at all.
    pub ffmpeg: bool,
    /// Format ids this FFmpeg can write.
    pub formats: Vec<String>,
    /// Encoder on the graphics card for H.264, if one works.
    pub h264_card: Option<String>,
    /// Encoder on the graphics card for H.265, if one works.
    pub h265_card: Option<String>,
}

/// The second column of `ffmpeg -encoders`.
fn listed(output: &str) -> Vec<&str> {
    output
        .lines()
        .skip_while(|line| !line.trim_start().starts_with("---"))
        .skip(1)
        .filter_map(|line| line.split_whitespace().nth(1))
        .collect()
}

/// Whether an encoder really works: a card's encoder is listed even without the card.
async fn works(tools: &Tools, encoder: &str) -> bool {
    let mut cmd = command(&tools.ffmpeg);
    cmd.args(["-hide_banner", "-loglevel", "quiet", "-f", "lavfi"])
        .args(["-i", "color=black:s=256x256:d=0.1", "-frames:v", "1"])
        .args(["-pix_fmt", "nv12", "-c:v", encoder, "-f", "null", "-"])
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    cmd.status().await.is_ok_and(|status| status.success())
}

async fn card_encoder(tools: &Tools, names: &[&str], codec: &str) -> Option<String> {
    for family in CARD_FAMILIES {
        let encoder = format!("{codec}_{family}");
        if names.contains(&encoder.as_str()) && works(tools, &encoder).await {
            return Some(encoder);
        }
    }
    None
}

async fn detect() -> Capabilities {
    let none = Capabilities {
        ffmpeg: false,
        formats: Vec::new(),
        h264_card: None,
        h265_card: None,
    };
    let Some(tools) = find_tools() else {
        return none;
    };
    let output = command(&tools.ffmpeg)
        .args(["-hide_banner", "-encoders"])
        .output()
        .await;
    let Ok(output) = output else {
        return none;
    };
    let text = String::from_utf8_lossy(&output.stdout);
    let names = listed(&text);
    Capabilities {
        ffmpeg: true,
        formats: FORMATS
            .iter()
            .filter(|(_, needed)| needed.iter().all(|name| names.contains(name)))
            .map(|(id, _)| (*id).to_owned())
            .collect(),
        h264_card: card_encoder(&tools, &names, "h264").await,
        h265_card: card_encoder(&tools, &names, "hevc").await,
    }
}

/// What can be exported here, found once per run.
pub async fn capabilities() -> &'static Capabilities {
    static FOUND: OnceCell<Capabilities> = OnceCell::const_new();
    FOUND.get_or_init(detect).await
}
