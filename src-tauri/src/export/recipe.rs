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
    /// One channel, played on both sides at full level as the preview does.
    #[serde(default)]
    pub mono: bool,
    /// Linear level, the clip's volume.
    #[serde(default = "one")]
    pub gain: f64,
    /// -1 (left) to 1 (right).
    #[serde(default)]
    pub pan: f64,
    #[serde(default)]
    pub eq: Vec<EqFilter>,
    /// Shift in semitones, keeping the length.
    #[serde(default)]
    pub pitch: f64,
    /// How fast it plays. `duration` is its length in the export, this many times that of the file.
    #[serde(default = "one")]
    pub speed: f64,
    /// Keeps voices at their pitch at another speed.
    #[serde(default = "yes")]
    pub keep_pitch: bool,
    /// Plays its part of the file backwards.
    #[serde(default)]
    pub reversed: bool,
}

fn one() -> f64 {
    1.0
}

fn yes() -> bool {
    true
}

/// The shape of an equalizer band.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EqKind {
    Bell,
    LowShelf,
    HighShelf,
    LowCut,
    HighCut,
}

/// One band of a clip's equalizer that changes the sound.
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct EqFilter {
    pub kind: EqKind,
    pub hz: f64,
    pub db: f64,
    pub q: f64,
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

/// How much of the file a segment plays.
fn source_length(segment: &SoundSegment) -> u64 {
    (segment.duration as f64 * segment.speed).round() as u64
}

/// `atempo` steps that make up a factor, each within its 0.5 to 2 range.
fn tempo_steps(mut factor: f64) -> String {
    let mut steps = String::new();
    while factor < 0.5 {
        steps.push_str(",atempo=0.500000");
        factor /= 0.5;
    }
    while factor > 2.0 {
        steps.push_str(",atempo=2.000000");
        factor /= 2.0;
    }
    steps.push_str(&format!(",atempo={factor:.6}"));
    steps
}

/// A pan as `StereoPannerNode` does it for stereo sound, so export sounds like the preview.
fn pan_filter(pan: f64) -> String {
    use std::f64::consts::FRAC_PI_2;
    if pan <= 0.0 {
        let angle = (pan + 1.0) * FRAC_PI_2;
        let (send, keep) = (angle.cos().abs(), angle.sin());
        format!(",pan=stereo|c0=c0+{send:.6}*c1|c1={keep:.6}*c1")
    } else {
        let angle = pan * FRAC_PI_2;
        let (keep, send) = (angle.cos().abs(), angle.sin());
        format!(",pan=stereo|c0={keep:.6}*c0|c1=c1+{send:.6}*c0")
    }
}

/// What a clip's sound settings add, in the preview's order. Empty at the defaults.
fn effects(segment: &SoundSegment) -> String {
    let mut chain = String::new();
    if segment.reversed {
        chain.push_str(",areverse");
    }
    if segment.speed != 1.0 {
        chain.push_str(&if segment.keep_pitch {
            tempo_steps(segment.speed)
        } else {
            let rate = f64::from(SAMPLE_RATE) * segment.speed;
            format!(",asetrate={rate:.3},aresample={SAMPLE_RATE}")
        });
    }
    if segment.pitch != 0.0 {
        let ratio = 2f64.powf(segment.pitch / 12.0);
        let rate = f64::from(SAMPLE_RATE) * ratio;
        chain.push_str(&format!(",asetrate={rate:.3},aresample={SAMPLE_RATE}"));
        chain.push_str(&tempo_steps(1.0 / ratio));
    }
    for EqFilter { kind, hz, db, q } in &segment.eq {
        chain.push_str(&match kind {
            EqKind::Bell => format!(",equalizer=f={hz:.2}:t=q:w={q:.2}:g={db:.2}"),
            EqKind::LowShelf => format!(",bass=g={db:.2}:f={hz:.2}:t=s:w=1"),
            EqKind::HighShelf => format!(",treble=g={db:.2}:f={hz:.2}:t=s:w=1"),
            EqKind::LowCut => format!(",highpass=f={hz:.2}"),
            EqKind::HighCut => format!(",lowpass=f={hz:.2}"),
        });
    }
    if segment.pan != 0.0 {
        chain.push_str(&pan_filter(segment.pan));
    }
    chain
}

/// The mixed sound as a filter graph, whose output is `[mixed]`.
fn sound_graph(sound: &[SoundSegment], first_input: usize, total: u64) -> String {
    let mut graph = String::new();
    let mut labels = String::new();
    for (i, segment) in sound.iter().enumerate() {
        let input = first_input + i;
        let layout = if segment.mono {
            "pan=stereo|c0=c0|c1=c0"
        } else {
            "aformat=channel_layouts=stereo"
        };
        let mut chain =
            format!("[{input}:a]aresample={SAMPLE_RATE},aformat=sample_fmts=fltp,{layout}");
        chain.push_str(&effects(segment));
        if segment.gain != 1.0 {
            chain.push_str(&format!(",volume={:.6}", segment.gain));
        }
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
        push(&["-t", &seconds(source_length(segment)), "-i", &segment.path]);
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

#[cfg(test)]
mod sound_tests {
    use super::*;

    fn segment() -> SoundSegment {
        SoundSegment {
            path: "/a.wav".into(),
            at: 0,
            from: 0,
            duration: 1_000_000,
            fade_in: 0,
            fade_out: 0,
            mono: false,
            gain: 1.0,
            pan: 0.0,
            eq: Vec::new(),
            pitch: 0.0,
            speed: 1.0,
            keep_pitch: true,
            reversed: false,
        }
    }

    fn band(kind: EqKind, hz: f64, db: f64) -> EqFilter {
        EqFilter {
            kind,
            hz,
            db,
            q: 1.0,
        }
    }

    #[test]
    fn a_reversed_segment_starts_with_areverse() {
        let back = SoundSegment {
            reversed: true,
            speed: 2.0,
            ..segment()
        };
        assert_eq!(effects(&back), ",areverse,atempo=2.000000");
    }

    #[test]
    fn speed_keeping_pitch_uses_tempo() {
        let fast = SoundSegment {
            speed: 2.0,
            ..segment()
        };
        assert_eq!(effects(&fast), ",atempo=2.000000");
    }

    #[test]
    fn speed_past_two_chains_tempo() {
        let fast = SoundSegment {
            speed: 4.0,
            ..segment()
        };
        assert_eq!(effects(&fast), ",atempo=2.000000,atempo=2.000000");
    }

    #[test]
    fn speed_without_correction_resamples() {
        let fast = SoundSegment {
            speed: 2.0,
            keep_pitch: false,
            ..segment()
        };
        assert_eq!(effects(&fast), ",asetrate=96000.000,aresample=48000");
    }

    #[test]
    fn input_reads_duration_times_speed() {
        let fast = SoundSegment {
            duration: 4_000_000,
            speed: 2.0,
            ..segment()
        };
        assert_eq!(source_length(&fast), 8_000_000);
    }

    #[test]
    fn fades_stay_after_the_tempo_step() {
        let fast = SoundSegment {
            speed: 2.0,
            fade_in: 500_000,
            ..segment()
        };
        let graph = sound_graph(&[fast], 0, 1_000_000);
        assert!(graph.find("atempo").unwrap() < graph.find("afade").unwrap());
    }

    #[test]
    fn a_default_segment_adds_no_filter() {
        assert_eq!(
            sound_graph(&[segment()], 0, 1_000_000),
            "[0:a]aresample=48000,aformat=sample_fmts=fltp,aformat=channel_layouts=stereo,adelay=0:all=1[s0];[s0]amix=inputs=1:normalize=0:dropout_transition=0,apad=whole_dur=1.000000,atrim=0:1.000000[mixed]"
        );
    }

    #[test]
    fn gain_adds_volume() {
        let graph = sound_graph(
            &[SoundSegment {
                gain: 0.5,
                ..segment()
            }],
            0,
            1_000_000,
        );
        assert!(graph.contains(",volume=0.500000,"), "{graph}");
    }

    #[test]
    fn pan_matches_the_preview_at_hard_left_and_right() {
        let left = effects(&SoundSegment {
            pan: -1.0,
            ..segment()
        });
        assert_eq!(left, ",pan=stereo|c0=c0+1.000000*c1|c1=0.000000*c1");
        let right = effects(&SoundSegment {
            pan: 1.0,
            ..segment()
        });
        assert_eq!(right, ",pan=stereo|c0=0.000000*c0|c1=c1+1.000000*c0");
    }

    #[test]
    fn equalizer_filters_by_shape() {
        let chain = effects(&SoundSegment {
            eq: vec![
                band(EqKind::LowCut, 80.0, 0.0),
                band(EqKind::LowShelf, 120.0, 3.0),
                band(EqKind::Bell, 500.0, -2.0),
                band(EqKind::HighShelf, 8000.0, 1.5),
                band(EqKind::HighCut, 16000.0, 0.0),
            ],
            ..segment()
        });
        assert_eq!(
            chain,
            ",highpass=f=80.00,bass=g=3.00:f=120.00:t=s:w=1,equalizer=f=500.00:t=q:w=1.00:g=-2.00,treble=g=1.50:f=8000.00:t=s:w=1,lowpass=f=16000.00"
        );
    }

    #[test]
    fn pitch_keeps_the_length() {
        let chain = effects(&SoundSegment {
            pitch: 12.0,
            ..segment()
        });
        assert_eq!(chain, ",asetrate=96000.000,aresample=48000,atempo=0.500000");
        let far = effects(&SoundSegment {
            pitch: 24.0,
            ..segment()
        });
        assert_eq!(
            far,
            ",asetrate=192000.000,aresample=48000,atempo=0.500000,atempo=0.500000"
        );
    }
}
