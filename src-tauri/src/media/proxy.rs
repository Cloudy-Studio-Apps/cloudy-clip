//! Proxy media: light H.264/AAC copies of files the webview cannot decode well.
//!
//! Pro and camera formats (ProRes, APV, DNxHR, 10-bit or 4:2:2 HEVC, very high bitrates,
//! 24-bit PCM, ...) either do not decode in the webview at all or decode too slowly to edit.
//! On import, each file is inspected with `ffprobe`; if it is not webview-friendly, a proxy is
//! made with `ffmpeg` in the background and the media server streams it instead of the
//! original. The original stays registered for export.
//!
//! - Uses the FFmpeg installed on the system (`PATH`, common install dirs, or
//!   `CLOUDY_CLIP_FFMPEG_DIR`). Without it, files are played directly.
//! - One encode at a time, so the machine stays responsive.
//! - Proxies are cached by path + size + modification time; re-importing is instant.
//! - Written to a temporary file and renamed when complete, so a crash never leaves a broken
//!   proxy behind. Encoders are killed when the app exits.
//! - Progress is reported to the webview through [`PROXY_EVENT`].
//! - A proxy is too small to export from, so a file that has one gets a *master* on its first
//!   export: the same safe recipe at full size, cached beside the proxies.

use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant, UNIX_EPOCH};

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::Semaphore;

use super::image;
use super::registry::{MediaKind, MediaRegistry, always_converted};

/// Event carrying [`ProxyEvent`] payloads.
pub const PROXY_EVENT: &str = "media://proxy";

/// Proxies never exceed this on their long side.
const PROXY_LONG_SIDE: u32 = 1280;
/// Above this bitrate (bits/s) even friendly codecs get a proxy.
const MAX_DIRECT_BITRATE: u64 = 60_000_000;
/// Above this long side (px) even friendly codecs get a proxy.
const MAX_DIRECT_LONG_SIDE: u64 = 3840;
const PROGRESS_INTERVAL: Duration = Duration::from_millis(250);

/// Where a media item is in the proxy pipeline.
#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ProxyState {
    /// Inspecting the file.
    Analyzing,
    /// Waiting for another encode to finish.
    Queued,
    Encoding,
    /// The proxy is being served.
    Ready,
    /// No proxy needed (or FFmpeg is missing); the original is served.
    Skipped,
    /// The proxy could not be made; the original is served.
    Error,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyEvent {
    pub media_id: String,
    pub state: ProxyState,
    /// 0..1 while encoding.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress: Option<f32>,
    /// Why a proxy is (or is not) made, or what went wrong. Shown to users and agents.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// Whether the file has a sound stream, once `ffprobe` has read it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub has_audio: Option<bool>,
    /// What a composition needs from a video, as soon as `ffprobe` has read it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub meta: Option<ProbeMeta>,
}

/// A picture's size (as shown, after rotation), frame rate and length.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct ProbeMeta {
    pub width: u64,
    pub height: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fps: Option<f64>,
    /// Microseconds.
    pub duration: u64,
    /// How many frames an animated image has; only animated images send it.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frames: Option<u64>,
}

#[derive(Debug, Clone)]
pub(crate) struct Tools {
    pub(crate) ffmpeg: PathBuf,
    pub(crate) ffprobe: PathBuf,
}

/// Runs proxy jobs. One per app.
pub struct ProxyJobs {
    cache_dir: PathBuf,
    encoder: Arc<Semaphore>,
}

impl ProxyJobs {
    pub(super) fn cache_dir(&self) -> &Path {
        &self.cache_dir
    }

    /// One encode at a time, for every kind of job.
    pub(super) fn encoder(&self) -> &Semaphore {
        &self.encoder
    }

    pub fn new(cache_dir: PathBuf) -> Self {
        Self {
            cache_dir,
            encoder: Arc::new(Semaphore::new(1)),
        }
    }

    /// Starts the pipeline for a newly registered file. Never blocks; reports via events.
    pub fn start(
        &self,
        app: AppHandle,
        registry: Arc<MediaRegistry>,
        id: String,
        generation: u64,
        path: PathBuf,
        kind: MediaKind,
    ) {
        let cache_dir = self.cache_dir.clone();
        let encoder = self.encoder.clone();
        tauri::async_runtime::spawn(async move {
            let emit = |state,
                        progress,
                        message: Option<String>,
                        has_audio: Option<bool>,
                        meta: Option<ProbeMeta>| {
                // The file was replaced: the id's state belongs to its new job now.
                if !registry.is_current(&id, generation) {
                    return;
                }
                let _ = app.emit(
                    PROXY_EVENT,
                    ProxyEvent {
                        media_id: id.clone(),
                        state,
                        progress,
                        message,
                        has_audio,
                        meta,
                    },
                );
            };
            let report = |state, progress, message| emit(state, progress, message, None, None);
            report(ProxyState::Analyzing, None, None);

            let Some(tools) = find_tools() else {
                report(
                    ProxyState::Skipped,
                    None,
                    Some("FFmpeg was not found, so some formats won't play and GIFs won't move. Install FFmpeg to edit them.".into()),
                );
                return;
            };

            if kind == MediaKind::Image {
                let job = image::ImageJob {
                    tools: &tools,
                    cache_dir: &cache_dir,
                    encoder: &encoder,
                    registry: &registry,
                    id: &id,
                    generation,
                    path: &path,
                };
                image::prepare(job, emit).await;
                return;
            }

            let probe = match ffprobe(&tools, &path, false).await {
                Ok(probe) => probe,
                Err(message) => {
                    report(ProxyState::Error, None, Some(message));
                    return;
                }
            };
            // From here on every event says whether the file has sound.
            let has_audio = Some(probe.audio_codec.is_some());
            let meta = probe.meta();
            let report = |state, progress, message| emit(state, progress, message, has_audio, meta);
            let Some(reason) = container_reason(&path).or_else(|| proxy_reason(&probe, kind))
            else {
                report(ProxyState::Skipped, None, None);
                return;
            };

            let extension = if kind == MediaKind::Audio {
                "m4a"
            } else {
                "mp4"
            };
            let target = match cache_path(&cache_dir, &path, extension).await {
                Ok(target) => target,
                Err(message) => {
                    report(ProxyState::Error, None, Some(message));
                    return;
                }
            };
            if tokio::fs::try_exists(&target).await.unwrap_or(false) {
                registry.set_proxy(&id, generation, target);
                report(ProxyState::Ready, Some(1.0), Some(reason));
                return;
            }

            report(ProxyState::Queued, Some(0.0), Some(reason.clone()));
            let Ok(_permit) = encoder.acquire().await else {
                report(ProxyState::Error, None, Some("Encoder unavailable".into()));
                return;
            };
            report(ProxyState::Encoding, Some(0.0), Some(reason.clone()));

            let on_progress = |p: f32| report(ProxyState::Encoding, Some(p), None);
            match encode(&tools, &path, &target, kind, probe.duration_us, on_progress).await {
                Ok(()) => {
                    registry.set_proxy(&id, generation, target);
                    report(ProxyState::Ready, Some(1.0), Some(reason));
                }
                Err(message) => report(ProxyState::Error, None, Some(message)),
            }
        });
    }
}

impl ProxyJobs {
    /// Makes sure a file with a proxy has a master. Returns whether it has one; a file without a
    /// proxy needs none, because the original is what plays.
    pub async fn prepare_master(
        &self,
        registry: &MediaRegistry,
        id: &str,
        on_progress: impl Fn(f32),
    ) -> Result<bool, String> {
        let Some((source, generation)) = registry.proxied_original(id) else {
            return Ok(false);
        };
        let tools = find_tools().ok_or("FFmpeg was not found")?;
        let target = cache_path(&self.cache_dir, &source, "master.mp4").await?;
        if !tokio::fs::try_exists(&target).await.unwrap_or(false) {
            let _permit = self
                .encoder
                .acquire()
                .await
                .map_err(|_| "Encoder unavailable".to_owned())?;
            // Another export may have made it while this one waited.
            if !tokio::fs::try_exists(&target).await.unwrap_or(false) {
                let duration = ffprobe(&tools, &source, false).await?.duration_us;
                encode_master(&tools, &source, &target, duration, on_progress).await?;
            }
        }
        registry.set_master(id, generation, target);
        Ok(true)
    }
}

/// What `ffprobe` says about a file.
#[derive(Debug, Default)]
pub(crate) struct Probe {
    pub(super) video_codec: Option<String>,
    pix_fmt: Option<String>,
    width: u64,
    height: u64,
    pub(super) audio_codec: Option<String>,
    /// Channels of the first sound stream.
    pub(crate) audio_channels: Option<u64>,
    /// How long after the file's start its first sound stream starts, in microseconds.
    pub(crate) audio_delay_us: u64,
    bit_rate: u64,
    pub(crate) duration_us: Option<u64>,
    pub(super) fps: Option<f64>,
    /// Frames ffprobe counted, when asked to.
    pub(super) frames: Option<u64>,
    /// Degrees the player turns the picture.
    rotation: i64,
}

impl Probe {
    /// Size of the picture as shown, after rotation.
    pub(super) fn shown_size(&self) -> (u64, u64) {
        if self.rotation.rem_euclid(180) == 90 {
            (self.height, self.width)
        } else {
            (self.width, self.height)
        }
    }

    /// What a composition needs from a video; `None` for a file without a picture or a length.
    fn meta(&self) -> Option<ProbeMeta> {
        if self.video_codec.is_none() || self.width == 0 || self.height == 0 {
            return None;
        }
        let (width, height) = self.shown_size();
        Some(ProbeMeta {
            width,
            height,
            fps: self.fps,
            duration: self.duration_us?,
            frames: None,
        })
    }
}

/// Finds `ffmpeg`/`ffprobe` once per run.
pub(crate) fn find_tools() -> Option<Tools> {
    static TOOLS: OnceLock<Option<Tools>> = OnceLock::new();
    TOOLS
        .get_or_init(|| {
            let exe = |name: &str| {
                if cfg!(windows) {
                    format!("{name}.exe")
                } else {
                    name.to_owned()
                }
            };
            let mut dirs: Vec<PathBuf> = Vec::new();
            if let Ok(dir) = std::env::var("CLOUDY_CLIP_FFMPEG_DIR") {
                dirs.push(dir.into());
            }
            if let Some(path) = std::env::var_os("PATH") {
                dirs.extend(std::env::split_paths(&path));
            }
            // GUI apps on macOS do not inherit the shell PATH.
            dirs.extend(["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"].map(PathBuf::from));

            let find = |name: &str| {
                dirs.iter()
                    .map(|dir| dir.join(exe(name)))
                    .find(|candidate| candidate.is_file())
            };
            Some(Tools {
                ffmpeg: find("ffmpeg")?,
                ffprobe: find("ffprobe")?,
            })
        })
        .clone()
}

pub(crate) fn command(program: &Path) -> Command {
    let mut command = Command::new(program);
    command.stdin(Stdio::null()).kill_on_drop(true);
    #[cfg(windows)]
    {
        // Do not flash a console window.
        command.creation_flags(0x0800_0000);
    }
    command
}

/// Reads what a file holds. `count_frames` decodes all of it, so it's for images only: animated
/// ones report no length, and the frame count is what tells them from stills.
pub(crate) async fn ffprobe(
    tools: &Tools,
    path: &Path,
    count_frames: bool,
) -> Result<Probe, String> {
    let output = command(&tools.ffprobe)
        .args([
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_streams",
            "-show_format",
        ])
        .args(count_frames.then_some("-count_frames"))
        .arg(path)
        .output()
        .await
        .map_err(|e| format!("Could not run ffprobe: {e}"))?;
    if !output.status.success() {
        return Err("This file is not a readable media file".into());
    }
    let json: Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Unexpected ffprobe output: {e}"))?;
    Ok(parse_probe(&json))
}

/// Reads ffprobe's `"30000/1001"`. `"0/0"` means it doesn't know.
fn parse_rate(rate: &str) -> Option<f64> {
    let (num, den) = rate.split_once('/')?;
    let (num, den) = (num.parse::<f64>().ok()?, den.parse::<f64>().ok()?);
    (num > 0.0 && den > 0.0).then_some(num / den)
}

/// The rotation a stream asks for: the display matrix, or the older `rotate` tag.
fn rotation_of(stream: &Value) -> i64 {
    stream["side_data_list"]
        .as_array()
        .into_iter()
        .flatten()
        .find_map(|data| data["rotation"].as_i64())
        .or_else(|| stream["tags"]["rotate"].as_str()?.parse().ok())
        .unwrap_or(0)
}

fn parse_probe(json: &Value) -> Probe {
    let number = |v: &Value| -> Option<u64> {
        v.as_str()
            .and_then(|s| s.parse::<f64>().ok())
            .or_else(|| v.as_f64())
            .map(|f| f as u64)
    };
    let mut probe = Probe::default();
    for stream in json["streams"].as_array().into_iter().flatten() {
        let codec = stream["codec_name"].as_str().map(str::to_owned);
        match stream["codec_type"].as_str() {
            // Cover art in audio files is a "video" stream with attached_pic; ignore it.
            Some("video") if stream["disposition"]["attached_pic"].as_u64() != Some(1) => {
                if probe.video_codec.is_none() {
                    probe.video_codec = codec;
                    probe.pix_fmt = stream["pix_fmt"].as_str().map(str::to_owned);
                    probe.width = stream["width"].as_u64().unwrap_or(0);
                    probe.height = stream["height"].as_u64().unwrap_or(0);
                    probe.fps = ["avg_frame_rate", "r_frame_rate"]
                        .iter()
                        .find_map(|key| stream[*key].as_str().and_then(parse_rate));
                    probe.rotation = rotation_of(stream);
                    probe.frames = number(&stream["nb_read_frames"]);
                }
            }
            Some("audio") if probe.audio_codec.is_none() => {
                probe.audio_codec = codec;
                probe.audio_channels = stream["channels"].as_u64();
                probe.audio_delay_us = seconds(&stream["start_time"])
                    .zip(seconds(&json["format"]["start_time"]))
                    .map_or(0, |(sound, file)| {
                        ((sound - file).max(0.0) * 1e6).round() as u64
                    });
            }
            _ => {}
        }
    }
    probe.bit_rate = number(&json["format"]["bit_rate"]).unwrap_or(0);
    probe.duration_us = seconds(&json["format"]["duration"]).map(|s| (s * 1_000_000.0) as u64);
    probe
}

/// ffprobe's `"12.345678"` seconds.
fn seconds(value: &Value) -> Option<f64> {
    value
        .as_str()?
        .parse::<f64>()
        .ok()
        .filter(|s| s.is_finite())
}

/// Why a file gets a proxy whatever is inside it, or `None` if its container isn't the reason.
fn container_reason(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_string_lossy().to_ascii_uppercase();
    always_converted(path).then(|| format!("{extension} files are converted for editing"))
}

/// Returns why a proxy is needed, or `None` if the webview can play the file well as is.
fn proxy_reason(probe: &Probe, kind: MediaKind) -> Option<String> {
    let audio_ok = |codec: &Option<String>| match codec.as_deref() {
        None => true,
        Some(c) => matches!(c, "aac" | "mp3" | "opus" | "vorbis" | "flac" | "pcm_s16le"),
    };

    if kind == MediaKind::Audio || probe.video_codec.is_none() {
        return (!audio_ok(&probe.audio_codec)).then(|| {
            format!(
                "Optimizing {} audio for playback",
                probe.audio_codec.as_deref().unwrap_or("this")
            )
        });
    }

    let codec = probe.video_codec.as_deref().unwrap_or("unknown");
    let pix_fmt = probe.pix_fmt.as_deref().unwrap_or("unknown");
    let friendly_codec = matches!(codec, "h264" | "vp8" | "vp9");
    let friendly_pixels = matches!(pix_fmt, "yuv420p" | "yuvj420p");

    if !friendly_codec {
        Some(format!(
            "{} is a pro/camera format; making an editing proxy",
            pretty(codec)
        ))
    } else if !friendly_pixels {
        Some(format!(
            "{pix_fmt} video is heavy to decode; making an editing proxy"
        ))
    } else if probe.bit_rate > MAX_DIRECT_BITRATE {
        Some(format!(
            "{} Mbps is too heavy to edit smoothly; making an editing proxy",
            probe.bit_rate / 1_000_000
        ))
    } else if probe.width.max(probe.height) > MAX_DIRECT_LONG_SIDE {
        Some("Resolution above 4K; making an editing proxy".into())
    } else if !audio_ok(&probe.audio_codec) {
        Some(format!(
            "{} audio is not supported for playback; making an editing proxy",
            probe.audio_codec.as_deref().unwrap_or("This")
        ))
    } else {
        None
    }
}

fn pretty(codec: &str) -> String {
    match codec {
        "prores" => "ProRes".into(),
        "apv" => "APV".into(),
        "hevc" => "HEVC".into(),
        "dnxhd" => "DNxHD/HR".into(),
        "av1" => "AV1".into(),
        other => other.to_uppercase(),
    }
}

/// Bump when the proxy recipe changes, so proxies made by an older recipe are not reused.
const PROXY_RECIPE: u32 = 2;

/// Stable cache name for a source file version (FNV-1a over recipe, path, size, mtime).
pub(super) async fn cache_path(
    cache_dir: &Path,
    path: &Path,
    extension: &str,
) -> Result<PathBuf, String> {
    let stem = cache_stem(path).await?;
    tokio::fs::create_dir_all(cache_dir)
        .await
        .map_err(|e| format!("Could not create the proxy folder: {e}"))?;
    Ok(cache_dir.join(format!("{stem}.{extension}")))
}

/// The part of [`cache_path`]'s name that stands for a source file version: every file cached
/// for it starts with this and a dot.
pub(super) async fn cache_stem(path: &Path) -> Result<String, String> {
    let meta = tokio::fs::metadata(path)
        .await
        .map_err(|e| format!("Could not read the file: {e}"))?;
    let modified = meta
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |d| d.as_secs());
    let key = format!(
        "{PROXY_RECIPE}|{}|{}|{}",
        path.display(),
        meta.len(),
        modified
    );
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in key.bytes() {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    Ok(format!("{hash:016x}"))
}

async fn encode(
    tools: &Tools,
    source: &Path,
    target: &Path,
    kind: MediaKind,
    duration_us: Option<u64>,
    on_progress: impl Fn(f32),
) -> Result<(), String> {
    let partial = target.with_extension(format!(
        "partial.{}",
        target.extension().and_then(|e| e.to_str()).unwrap_or("mp4")
    ));

    let mut cmd = command(&tools.ffmpeg);
    cmd.args(["-hide_banner", "-nostats", "-loglevel", "error", "-y", "-i"])
        .arg(source)
        // One picture and one sound stream, video first, no metadata. Camera/pro files carry
        // timecode (`tmcd`) and data tracks; copied into a proxy they stop WebKitGTK from
        // showing frames.
        .args(["-map_metadata", "-1", "-map_chapters", "-1", "-dn", "-sn"]);
    if kind == MediaKind::Video {
        let scale = format!(
            "scale=w='min({PROXY_LONG_SIDE},iw)':h='min({PROXY_LONG_SIDE},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2"
        );
        cmd.args(["-map", "0:v:0", "-vf", &scale])
            .args(["-c:v", "libx264", "-preset", "veryfast", "-crf", "21"])
            .args(["-pix_fmt", "yuv420p", "-profile:v", "high"])
            // Short GOP: every half second is a keyframe, so scrubbing and seeking stay fast.
            .args(["-g", "15", "-keyint_min", "15", "-sc_threshold", "0"])
            .args(["-write_tmcd", "0"]);
    } else {
        cmd.arg("-vn");
    }
    cmd.args(["-map", "0:a:0?", "-c:a", "aac", "-b:a", "192k", "-ac", "2"]);
    cmd.args(["-movflags", "+faststart", "-f", "mp4"])
        .arg(&partial);

    if let Err(detail) = run_encoder(cmd, duration_us, on_progress).await {
        let _ = tokio::fs::remove_file(&partial).await;
        return Err(format!("Could not make a proxy: {detail}"));
    }
    tokio::fs::rename(&partial, target)
        .await
        .map_err(|e| format!("Could not save the proxy: {e}"))
}

/// A full-size copy the webview can decode: like a proxy (one picture stream, no timecode, a
/// keyframe every half second so seeks stay quick), near lossless and with no sound.
async fn encode_master(
    tools: &Tools,
    source: &Path,
    target: &Path,
    duration_us: Option<u64>,
    on_progress: impl Fn(f32),
) -> Result<(), String> {
    let partial = target.with_extension("partial.mp4");
    let mut cmd = command(&tools.ffmpeg);
    cmd.args(["-hide_banner", "-nostats", "-loglevel", "error", "-y", "-i"])
        .arg(source)
        .args([
            "-map_metadata",
            "-1",
            "-map_chapters",
            "-1",
            "-dn",
            "-sn",
            "-an",
        ])
        .args(["-map", "0:v:0", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2"])
        .args(["-c:v", "libx264", "-preset", "veryfast", "-crf", "14"])
        .args(["-pix_fmt", "yuv420p", "-profile:v", "high"])
        .args(["-g", "15", "-keyint_min", "15", "-sc_threshold", "0"])
        .args(["-write_tmcd", "0", "-movflags", "+faststart", "-f", "mp4"])
        .arg(&partial);
    if let Err(detail) = run_encoder(cmd, duration_us, on_progress).await {
        let _ = tokio::fs::remove_file(&partial).await;
        return Err(format!("Could not prepare this file for export: {detail}"));
    }
    tokio::fs::rename(&partial, target)
        .await
        .map_err(|e| format!("Could not save the export copy: {e}"))
}

/// Runs an `ffmpeg` command to the end, reporting progress against `duration_us`. The error is
/// what FFmpeg said.
pub(super) async fn run_encoder(
    mut cmd: Command,
    duration_us: Option<u64>,
    on_progress: impl Fn(f32),
) -> Result<(), String> {
    cmd.args(["-progress", "pipe:1"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Could not start ffmpeg: {e}"))?;

    if let (Some(stdout), Some(total)) = (child.stdout.take(), duration_us.filter(|d| *d > 0)) {
        let mut lines = BufReader::new(stdout).lines();
        let mut last = Instant::now();
        while let Ok(Some(line)) = lines.next_line().await {
            let Some(value) = line.strip_prefix("out_time_us=") else {
                continue;
            };
            if last.elapsed() < PROGRESS_INTERVAL {
                continue;
            }
            if let Ok(done) = value.trim().parse::<u64>() {
                last = Instant::now();
                on_progress((done as f32 / total as f32).clamp(0.0, 0.99));
            }
        }
    }

    let output = child
        .wait_with_output()
        .await
        .map_err(|e| format!("ffmpeg failed: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.lines().last().unwrap_or("unknown error").to_owned());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn picture_size_follows_the_rotation_of_a_phone_video() {
        let probe = parse_probe(&json!({
            "streams": [{
                "codec_type": "video",
                "codec_name": "h264",
                "width": 1920,
                "height": 1080,
                "avg_frame_rate": "30/1",
                "side_data_list": [{ "rotation": -90 }],
            }],
            "format": { "duration": "2.5" },
        }));
        let meta = probe.meta().unwrap();
        assert_eq!((meta.width, meta.height), (1080, 1920));
        assert_eq!(meta.fps, Some(30.0));
        assert_eq!(parse_rate("0/0"), None);
        assert_eq!(meta.duration, 2_500_000);
    }
    use serde_json::json;

    fn probe(json: Value) -> Probe {
        parse_probe(&json)
    }

    #[test]
    fn a_friendly_codec_in_an_avi_still_gets_a_proxy() {
        assert!(
            container_reason(Path::new("/a/b.avi"))
                .unwrap()
                .contains("AVI")
        );
        assert!(container_reason(Path::new("/a/b.mov")).is_none());
    }

    #[test]
    fn proxy_event_serializes_has_audio() {
        let event = |has_audio| ProxyEvent {
            media_id: "m".into(),
            meta: None,
            state: ProxyState::Skipped,
            progress: None,
            message: None,
            has_audio,
        };
        assert_eq!(
            serde_json::to_value(event(Some(false))).ok(),
            Some(json!({"mediaId": "m", "state": "skipped", "hasAudio": false}))
        );
        assert_eq!(
            serde_json::to_value(event(None)).ok(),
            Some(json!({"mediaId": "m", "state": "skipped"}))
        );
    }

    #[test]
    fn web_friendly_video_needs_no_proxy() {
        let p = probe(json!({
            "streams": [
                {"codec_type": "video", "codec_name": "h264", "pix_fmt": "yuv420p", "width": 1920, "height": 1080},
                {"codec_type": "audio", "codec_name": "aac"}
            ],
            "format": {"bit_rate": "8000000", "duration": "10.0"}
        }));
        assert_eq!(p.duration_us, Some(10_000_000));
        assert!(proxy_reason(&p, MediaKind::Video).is_none());
    }

    #[test]
    fn pro_formats_need_a_proxy() {
        let prores = probe(json!({
            "streams": [
                {"codec_type": "video", "codec_name": "prores", "pix_fmt": "yuv422p10le", "width": 1080, "height": 1920},
                {"codec_type": "audio", "codec_name": "pcm_s24le"}
            ],
            "format": {"bit_rate": "137000000", "duration": "58.3"}
        }));
        assert!(
            proxy_reason(&prores, MediaKind::Video)
                .unwrap()
                .contains("ProRes")
        );

        let ten_bit = probe(json!({
            "streams": [{"codec_type": "video", "codec_name": "h264", "pix_fmt": "yuv420p10le", "width": 1920, "height": 1080}],
            "format": {"bit_rate": "1000000"}
        }));
        assert!(proxy_reason(&ten_bit, MediaKind::Video).is_some());

        let heavy = probe(json!({
            "streams": [{"codec_type": "video", "codec_name": "h264", "pix_fmt": "yuv420p", "width": 1920, "height": 1080}],
            "format": {"bit_rate": "90000000"}
        }));
        assert!(proxy_reason(&heavy, MediaKind::Video).is_some());
    }

    #[test]
    fn audio_rules() {
        let wav24 = probe(
            json!({"streams": [{"codec_type": "audio", "codec_name": "pcm_s24le"}], "format": {}}),
        );
        assert!(proxy_reason(&wav24, MediaKind::Audio).is_some());
        let mp3_with_cover = probe(json!({
            "streams": [
                {"codec_type": "audio", "codec_name": "mp3"},
                {"codec_type": "video", "codec_name": "mjpeg", "disposition": {"attached_pic": 1}}
            ],
            "format": {}
        }));
        assert!(proxy_reason(&mp3_with_cover, MediaKind::Audio).is_none());
    }
}
