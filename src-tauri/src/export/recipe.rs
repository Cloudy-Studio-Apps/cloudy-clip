//! FFmpeg settings of an export: built from a structured spec, never from arguments the webview
//! wrote. Frames arrive as raw RGBA on stdin; sound is mixed here from the original files.

use std::ffi::OsString;
use std::path::Path;

use serde::Deserialize;

/// Sample rate of the mixed sound.
const SAMPLE_RATE: u32 = 48_000;

/// What the file holds and how it is compressed.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Format {
    H264,
    H265,
    Webm,
    Prores,
    Gif,
    Mp3,
}

impl Format {
    /// Whether frames are sent. A sound-only export has none.
    pub fn has_picture(self) -> bool {
        self != Format::Mp3
    }

    fn has_sound(self) -> bool {
        self != Format::Gif
    }
}

/// How long the encoder works on each frame.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Effort {
    Fast,
    Balanced,
    Small,
}

/// One stretch of a file's sound on the export's clock. All times are microseconds.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundSegment {
    pub path: String,
    /// Where it starts in the export.
    pub at: u64,
    /// Where it starts in the file.
    pub from: u64,
    pub duration: u64,
    pub fade_in: u64,
    pub fade_out: u64,
}

/// One export, as the frontend describes it.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSpec {
    pub output: String,
    pub format: Format,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    /// Length of the export, microseconds.
    pub duration: u64,
    /// Constant-quality value of the format's encoder: lower is sharper.
    pub crf: u32,
    /// Sound bitrate, kbit/s.
    pub audio_kbps: u32,
    pub effort: Effort,
    pub hardware: bool,
    pub sound: Vec<SoundSegment>,
}

/// Seconds as FFmpeg reads them.
fn seconds(micros: u64) -> String {
    format!("{:.6}", micros as f64 / 1_000_000.0)
}

/// The mixed sound as a filter graph, whose output is `[mixed]`.
fn sound_graph(sound: &[SoundSegment], first_input: usize, total: u64) -> String {
    let mut graph = String::new();
    let mut labels = String::new();
    for (i, segment) in sound.iter().enumerate() {
        let input = first_input + i;
        let mut chain = format!(
            "[{input}:a]aresample={SAMPLE_RATE},aformat=sample_fmts=fltp:channel_layouts=stereo"
        );
        // `qsin` is the equal-power curve the preview's crossfade uses.
        if segment.fade_in > 0 {
            let length = seconds(segment.fade_in);
            chain.push_str(&format!(",afade=t=in:st=0:d={length}:curve=qsin"));
        }
        if segment.fade_out > 0 {
            let start = seconds(segment.duration.saturating_sub(segment.fade_out));
            let length = seconds(segment.fade_out);
            chain.push_str(&format!(",afade=t=out:st={start}:d={length}:curve=qsin"));
        }
        let delay = segment.at.div_ceil(1000);
        chain.push_str(&format!(",adelay={delay}:all=1[s{i}];"));
        graph.push_str(&chain);
        labels.push_str(&format!("[s{i}]"));
    }
    let inputs = sound.len();
    let end = seconds(total);
    graph.push_str(&format!(
        "{labels}amix=inputs={inputs}:normalize=0:dropout_transition=0,apad=whole_dur={end},atrim=0:{end}[mixed]"
    ));
    graph
}

/// The picture filter: even size, BT.709 limited range, or a palette for GIF.
fn picture_graph(format: Format, pixels: &str) -> String {
    const EVEN: &str = "crop=trunc(iw/2)*2:trunc(ih/2)*2";
    const COLOR: &str = "scale=out_color_matrix=bt709:out_range=tv:flags=bicubic+accurate_rnd";
    match format {
        Format::Gif => "[0:v]split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a[picture]".to_owned(),
        Format::Prores => format!("[0:v]{EVEN},{COLOR},format=yuv422p10le[picture]"),
        _ => format!("[0:v]{EVEN},{COLOR},format={pixels}[picture]"),
    }
}

/// Encoder settings for H.264 and H.265, in software or on a graphics card.
fn video_codec(spec: &ExportSpec, hardware: Option<&str>) -> Vec<String> {
    let strings = |args: &[&str]| args.iter().map(|a| (*a).to_owned()).collect::<Vec<_>>();
    let crf = spec.crf.to_string();
    if let Some(encoder) = hardware {
        let mut args = strings(&["-c:v", encoder]);
        let family = encoder.rsplit('_').next().unwrap_or_default();
        args.extend(strings(&match family {
            "nvenc" => vec!["-rc", "vbr", "-cq", crf.as_str(), "-b:v", "0"],
            "qsv" => vec!["-global_quality", crf.as_str()],
            "amf" => vec!["-rc", "cqp", "-qp_i", crf.as_str(), "-qp_p", crf.as_str()],
            _ => vec!["-b:v", "0", "-q:v", "65"],
        }));
        return args;
    }
    let preset = match spec.effort {
        Effort::Fast => "veryfast",
        Effort::Balanced => "medium",
        Effort::Small => "slow",
    };
    let codec = if spec.format == Format::H265 {
        "libx265"
    } else {
        "libx264"
    };
    strings(&["-c:v", codec, "-preset", preset, "-crf", crf.as_str()])
}

/// The output side of the format: encoders and container.
fn output_args(spec: &ExportSpec, hardware: Option<&str>) -> Vec<String> {
    let strings = |args: &[&str]| args.iter().map(|a| (*a).to_owned()).collect::<Vec<_>>();
    let kbps = format!("{}k", spec.audio_kbps);
    let crf = spec.crf.to_string();
    let mut args = match spec.format {
        Format::H264 => {
            let mut args = video_codec(spec, hardware);
            args.extend(strings(&["-c:a", "aac", "-b:a", &kbps]));
            args
        }
        Format::H265 => {
            let mut args = video_codec(spec, hardware);
            // Apple players only open H.265 tagged this way.
            args.extend(strings(&["-tag:v", "hvc1", "-c:a", "aac", "-b:a", &kbps]));
            args
        }
        Format::Webm => {
            let speed = match spec.effort {
                Effort::Fast => "6",
                Effort::Balanced => "4",
                Effort::Small => "2",
            };
            strings(&[
                "-c:v",
                "libvpx-vp9",
                "-crf",
                &crf,
                "-b:v",
                "0",
                "-row-mt",
                "1",
                "-cpu-used",
                speed,
                "-c:a",
                "libopus",
                "-b:a",
                &kbps,
            ])
        }
        Format::Prores => strings(&["-c:v", "prores_ks", "-profile:v", "3", "-c:a", "pcm_s16le"]),
        Format::Gif => strings(&["-loop", "0"]),
        Format::Mp3 => strings(&["-c:a", "libmp3lame", "-b:a", &kbps]),
    };
    if !matches!(spec.format, Format::Gif | Format::Mp3) {
        args.extend(strings(&[
            "-colorspace",
            "bt709",
            "-color_primaries",
            "bt709",
            "-color_trc",
            "bt709",
            "-color_range",
            "tv",
        ]));
    }
    if matches!(spec.format, Format::H264 | Format::H265) {
        args.extend(strings(&["-movflags", "+faststart"]));
    }
    args
}

/// Every FFmpeg argument of an export that writes to `partial`.
pub fn arguments(spec: &ExportSpec, partial: &Path, hardware: Option<&str>) -> Vec<OsString> {
    let mut args: Vec<OsString> = Vec::new();
    let mut push = |values: &[&str]| args.extend(values.iter().map(OsString::from));
    push(&["-hide_banner", "-nostats", "-loglevel", "error", "-y"]);

    let picture = spec.format.has_picture();
    if picture {
        let size = format!("{}x{}", spec.width, spec.height);
        let rate = spec.fps.to_string();
        push(&["-f", "rawvideo", "-pix_fmt", "rgba", "-s", &size]);
        push(&["-framerate", &rate, "-i", "pipe:0"]);
    }
    let sound: &[SoundSegment] = if spec.format.has_sound() {
        &spec.sound
    } else {
        &[]
    };
    for segment in sound {
        push(&["-ss", &seconds(segment.from)]);
        push(&["-t", &seconds(segment.duration), "-i", &segment.path]);
    }

    let mut graph = Vec::new();
    if picture {
        let pixels = if hardware.is_some() {
            "nv12"
        } else {
            "yuv420p"
        };
        graph.push(picture_graph(spec.format, pixels));
    }
    if !sound.is_empty() {
        graph.push(sound_graph(sound, usize::from(picture), spec.duration));
    }
    push(&["-filter_complex", &graph.join(";")]);
    if picture {
        push(&["-map", "[picture]"]);
    }
    if !sound.is_empty() {
        push(&["-map", "[mixed]", "-ar", "48000"]);
    }
    let output = output_args(spec, hardware);
    push(&output.iter().map(String::as_str).collect::<Vec<_>>());
    push(&["-t", &seconds(spec.duration)]);
    args.push(partial.as_os_str().to_owned());
    args
}
