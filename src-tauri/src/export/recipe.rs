//! FFmpeg settings of an export: built from a structured spec, never from arguments the webview
//! wrote. Frames arrive as raw RGBA on stdin; sound is mixed here from the original files.

use std::ffi::OsString;
use std::path::{Path, PathBuf};

use serde::Deserialize;

use super::mixeffects::MixEffect;
use super::mixgraph;
use super::soundfilters::{STEP_LEAD, effects, gain_envelope_filter, pan_envelope_filter};

/// Sample rate of the mixed sound.
pub(super) const SAMPLE_RATE: u32 = 48_000;

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

/// A value at a moment of a segment. All times are microseconds from the segment's start.
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct EnvelopePoint {
    pub at: u64,
    pub value: f64,
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
    /// The top-level track it sounds through: an index into `ExportSpec::mix.tracks`.
    #[serde(default)]
    pub track: usize,
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
    /// Linear level over the segment, a keyed volume. Replaces `gain` when it has points.
    #[serde(default)]
    pub gain_envelope: Vec<EnvelopePoint>,
    /// Pan over the segment, a keyed pan. Replaces `pan` when it has points.
    #[serde(default)]
    pub pan_envelope: Vec<EnvelopePoint>,
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
    /// A ramped clip's sound, as stretches of one tempo each, in file order. Replaces `speed`.
    #[serde(default)]
    pub tempo_steps: Vec<TempoStep>,
}

/// A stretch of a ramped segment played at one tempo. All times are microseconds.
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct TempoStep {
    /// Where it starts in the file.
    pub from: u64,
    /// Its length in the export.
    pub duration: u64,
    /// How fast it plays: its part of the file over `duration`.
    pub speed: f64,
}

fn one() -> f64 {
    1.0
}

fn yes() -> bool {
    true
}

/// The shape of an equalizer band.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum EqKind {
    Bell,
    LowShelf,
    HighShelf,
    LowCut,
    HighCut,
}

/// One band of a clip's equalizer that changes the sound.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
pub struct EqFilter {
    pub kind: EqKind,
    pub hz: f64,
    pub db: f64,
    pub q: f64,
}

/// How a track mixes its clips: its effects, then a pan and a level, on their sum.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct TrackMixSpec {
    /// Linear level.
    #[serde(default = "one")]
    pub gain: f64,
    /// -1 (left) to 1 (right).
    #[serde(default)]
    pub pan: f64,
    /// The effects before the pan and the level, in order.
    #[serde(default)]
    pub effects: Vec<MixEffect>,
}

impl TrackMixSpec {
    /// Leaves the sound as it is.
    pub const DEFAULT: TrackMixSpec = TrackMixSpec {
        gain: 1.0,
        pan: 0.0,
        effects: Vec::new(),
    };
}

/// The level of everything together, then its effects.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct MasterMixSpec {
    /// Linear level.
    #[serde(default = "one")]
    pub gain: f64,
    /// The effects after the level, in order. A duck here is ignored: the document refuses one.
    #[serde(default)]
    pub effects: Vec<MixEffect>,
}

/// How the tracks mix: each track's effects, pan and level, then the master's level and effects.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct SoundMix {
    pub tracks: Vec<TrackMixSpec>,
    pub master: MasterMixSpec,
}

impl SoundMix {
    /// `tracks` tracks that leave the sound as it is, under a master that does the same.
    pub fn default_for(tracks: usize) -> Self {
        SoundMix {
            tracks: vec![TrackMixSpec::DEFAULT; tracks],
            master: MasterMixSpec {
                gain: 1.0,
                effects: Vec::new(),
            },
        }
    }
}

impl Default for SoundMix {
    fn default() -> Self {
        SoundMix::default_for(0)
    }
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
    /// How the tracks the sound comes from mix.
    #[serde(default)]
    pub mix: SoundMix,
}

/// Seconds as FFmpeg reads them.
pub(super) fn seconds(micros: u64) -> String {
    format!("{:.6}", micros as f64 / 1_000_000.0)
}

/// How much of the file a segment plays. A ramp reads on past its last step by what that step
/// reads ahead (`STEP_LEAD`), so it never runs short.
fn source_length(segment: &SoundSegment) -> u64 {
    match segment.tempo_steps.last() {
        Some(last) => {
            let end = last.from + (last.duration as f64 * last.speed).round() as u64;
            let lead = (STEP_LEAD as f64 * last.speed).round() as u64;
            end.saturating_sub(segment.from) + lead
        }
        None => (segment.duration as f64 * segment.speed).round() as u64,
    }
}

/// Each segment's chain from its input to `[s<i>]`, the filters of its own settings in the
/// preview's order; `mixgraph` joins them.
fn segment_chains(sound: &[SoundSegment], first_input: usize) -> Vec<String> {
    sound
        .iter()
        .enumerate()
        .map(|(i, segment)| {
            let input = first_input + i;
            let layout = if segment.mono {
                "pan=stereo|c0=c0|c1=c0"
            } else {
                "aformat=channel_layouts=stereo"
            };
            let mut chain =
                format!("[{input}:a]aresample={SAMPLE_RATE},aformat=sample_fmts=fltp,{layout}");
            chain.push_str(&effects(i, segment));
            if !segment.gain_envelope.is_empty() {
                chain.push_str(&gain_envelope_filter(&segment.gain_envelope));
            } else if segment.gain != 1.0 {
                chain.push_str(&format!(",volume={:.6}", segment.gain));
            }
            if !segment.pan_envelope.is_empty() {
                chain.push_str(&pan_envelope_filter(i, &segment.pan_envelope));
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
            chain
        })
        .collect()
}

/// The mixed sound as a filter graph, whose output is `[mixed]`.
fn sound_graph(sound: &[SoundSegment], first_input: usize, mix: &SoundMix, total: u64) -> String {
    mixgraph::sound_graph(&segment_chains(sound, first_input), sound, mix, total)
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

/// Longest filter graph given to FFmpeg as an argument. Windows allows about 32 KB for the whole
/// command line, so a longer graph goes in a file.
const INLINE_GRAPH_LIMIT: usize = 8_000;

/// The file a long filter graph of the export writing to `partial` goes in.
pub fn script_of(partial: &Path) -> PathBuf {
    let mut name = partial.as_os_str().to_owned();
    name.push(".filter");
    PathBuf::from(name)
}

/// How this FFmpeg takes a filter graph from a file: `-/filter_complex <file>` from 7.0, where
/// `-filter_complex_script` went away in 8.0; older ones know only the latter.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScriptOption {
    Slash,
    Legacy,
}

impl ScriptOption {
    /// From the first line of `ffmpeg -version` (`ffmpeg version n9.0.2 ...`, `6.1.1-3ubuntu`,
    /// `N-12345-gabc` for a build from git, which is recent). Anything unreadable counts as new.
    pub fn from_version_line(line: &str) -> Self {
        let version = line.split_whitespace().nth(2).unwrap_or_default();
        let digits: String = version
            .trim_start_matches(['n', 'N'])
            .chars()
            .take_while(char::is_ascii_digit)
            .collect();
        match digits.parse::<u32>() {
            Ok(major) if major < 7 && !version.starts_with("N-") => ScriptOption::Legacy,
            _ => ScriptOption::Slash,
        }
    }

    fn flag(self) -> &'static str {
        match self {
            ScriptOption::Slash => "-/filter_complex",
            ScriptOption::Legacy => "-filter_complex_script",
        }
    }
}

/// The arguments of an export, and the filter graph that goes in a file when it is too long.
pub struct Recipe {
    pub args: Vec<OsString>,
    /// The graph to write to `script_of(partial)`; the arguments name that file.
    pub script: Option<String>,
}

/// Every FFmpeg argument of an export that writes to `partial`.
pub fn arguments(
    spec: &ExportSpec,
    partial: &Path,
    hardware: Option<&str>,
    script_option: ScriptOption,
) -> Recipe {
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
        graph.push(sound_graph(
            sound,
            usize::from(picture),
            &spec.mix,
            spec.duration,
        ));
    }
    let graph = graph.join(";");
    let script = (graph.len() > INLINE_GRAPH_LIMIT).then(|| graph.clone());
    match &script {
        Some(_) => {
            let file = script_of(partial);
            push(&[script_option.flag(), &file.to_string_lossy()]);
        }
        None => push(&["-filter_complex", &graph]),
    }
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
    Recipe { args, script }
}

/// A segment at the defaults, for the tests of this folder.
#[cfg(test)]
pub(super) fn segment() -> SoundSegment {
    SoundSegment {
        path: "/a.wav".into(),
        at: 0,
        from: 0,
        duration: 1_000_000,
        track: 0,
        fade_in: 0,
        fade_out: 0,
        mono: false,
        gain: 1.0,
        pan: 0.0,
        gain_envelope: Vec::new(),
        pan_envelope: Vec::new(),
        eq: Vec::new(),
        pitch: 0.0,
        speed: 1.0,
        keep_pitch: true,
        reversed: false,
        tempo_steps: Vec::new(),
    }
}

#[cfg(test)]
mod sound_tests {
    use super::*;
    use crate::export::soundfilters::{STEP_CROSSFADE, samples};

    /// The graph of segments under a mix that leaves them as they are.
    fn sound_graph(sound: &[SoundSegment], first_input: usize, total: u64) -> String {
        super::sound_graph(sound, first_input, &SoundMix::default_for(1), total)
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

    fn keyed() -> SoundSegment {
        let point = |at, value| EnvelopePoint { at, value };
        SoundSegment {
            gain_envelope: vec![point(0, 1.0), point(1_000_000, 0.25)],
            pan_envelope: vec![point(0, -1.0), point(1_000_000, 1.0)],
            ..segment()
        }
    }

    #[test]
    fn gain_envelope_becomes_a_frame_expression() {
        let chain = sound_graph(&[keyed()], 1, 2_000_000);
        assert!(chain.contains("volume=eval=frame:volume='"), "{chain}");
        assert!(chain.contains("if(lt(t,1),1+-0.75*(t-0),0.25)"), "{chain}");
        assert!(!chain.contains(",volume=1"), "{chain}");
    }

    #[test]
    fn pan_envelope_splits_mixes_and_joins_per_segment() {
        let chain = sound_graph(&[keyed(), keyed()], 1, 2_000_000);
        assert!(
            chain.contains("channelsplit=channel_layout=stereo[pl0][pr0]"),
            "{chain}"
        );
        assert!(
            chain.contains("channelsplit=channel_layout=stereo[pl1][pr1]"),
            "{chain}"
        );
        assert!(
            chain.contains("join=inputs=2:channel_layout=stereo[pan1]"),
            "{chain}"
        );
        assert!(!chain.contains("pan=stereo"), "{chain}");
    }

    #[test]
    fn a_still_pan_stays_in_the_effects_without_an_envelope() {
        let still = SoundSegment {
            pan: 0.5,
            ..segment()
        };
        assert!(sound_graph(&[still], 0, 1_000_000).contains(",pan=stereo|"));
    }

    fn busy(n: u64) -> Vec<EnvelopePoint> {
        (0..256)
            .map(|i| EnvelopePoint {
                at: i * n,
                value: ((i as f64) * 0.37).sin(),
            })
            .collect()
    }

    fn worst_case(clips: usize) -> ExportSpec {
        let segment = SoundSegment {
            duration: 25_500_000,
            gain_envelope: busy(100_000)
                .into_iter()
                .map(|p| EnvelopePoint {
                    value: 0.5 + p.value / 3.0,
                    ..p
                })
                .collect(),
            pan_envelope: busy(100_000),
            ..segment()
        };
        ExportSpec {
            output: "/o.mp3".into(),
            format: Format::Mp3,
            width: 0,
            height: 0,
            fps: 30.0,
            duration: 25_500_000,
            crf: 20,
            audio_kbps: 128,
            effort: Effort::Fast,
            hardware: false,
            sound: vec![segment; clips],
            mix: SoundMix::default_for(1),
        }
    }

    #[test]
    fn a_long_graph_goes_in_a_file_and_a_short_one_stays_inline() {
        let partial = Path::new("/o.partial.mp3");
        let long = arguments(&worst_case(3), partial, None, ScriptOption::Slash);
        let graph = long.script.expect("a long graph is written to a file");
        assert!(graph.len() > INLINE_GRAPH_LIMIT);
        // FFmpeg's expression parser stops at 100 levels of nesting.
        let mut depth = 0;
        let mut deepest = 0;
        for c in graph.chars() {
            match c {
                '(' => {
                    depth += 1;
                    deepest = deepest.max(depth);
                }
                ')' => depth -= 1,
                _ => {}
            }
        }
        assert!(deepest < 50, "{deepest}");
        let args: Vec<_> = long
            .args
            .iter()
            .map(|a| a.to_string_lossy().into_owned())
            .collect();
        assert!(!args.iter().any(|a| a == "-filter_complex"));
        let at = args.iter().position(|a| a == "-/filter_complex").unwrap();
        assert_eq!(args[at + 1], "/o.partial.mp3.filter");
        assert!(args.iter().all(|a| a.len() < 1_000));
        let legacy = arguments(&worst_case(3), partial, None, ScriptOption::Legacy);
        assert!(legacy.args.iter().any(|a| a == "-filter_complex_script"));

        let one = ExportSpec {
            sound: vec![segment()],
            ..worst_case(0)
        };
        let short = arguments(&one, partial, None, ScriptOption::Slash);
        assert!(short.script.is_none());
        assert!(short.args.iter().any(|a| a == "-filter_complex"));
    }

    /// 2 s of a ramp from 1x to 4x, in 250 ms steps that follow each other in the file.
    fn ramped_segment() -> SoundSegment {
        let mut from = 1_000_000;
        let tempo_steps = (0..8)
            .map(|i| {
                let speed = 1.0 + f64::from(i) * 3.0 / 7.0;
                let step = TempoStep {
                    from,
                    duration: 250_000,
                    speed,
                };
                from += (250_000.0 * speed).round() as u64;
                step
            })
            .collect();
        SoundSegment {
            from: 1_000_000,
            duration: 2_000_000,
            tempo_steps,
            ..segment()
        }
    }

    #[test]
    fn tempo_steps_trim_and_crossfade() {
        let chain = sound_graph(&[ramped_segment()], 1, 2_000_000);
        assert!(chain.contains("atrim="));
        assert!(chain.contains("acrossfade="));
        assert!(!chain.contains("concat="));
    }

    #[test]
    fn crossfaded_steps_keep_the_segment_length() {
        let chain = sound_graph(&[ramped_segment()], 1, 2_000_000);
        let lengths: u64 = chain
            .split("whole_len=")
            .skip(1)
            .map(|rest| rest.split(',').next().unwrap().parse::<u64>().unwrap())
            .sum();
        let joins = chain.matches("acrossfade=").count() as u64;
        assert_eq!(joins, 7);
        assert_eq!(lengths - joins * samples(STEP_CROSSFADE as f64), 96_000);
    }

    #[test]
    fn a_ramped_input_reads_every_step() {
        let ramped = ramped_segment();
        let last = ramped.tempo_steps.last().unwrap();
        let end = last.from + (last.duration as f64 * last.speed).round() as u64;
        let lead = (STEP_LEAD as f64 * last.speed).round() as u64;
        assert_eq!(source_length(&ramped), end - ramped.from + lead);
    }

    #[test]
    fn ffmpeg_versions_pick_how_a_graph_file_is_read() {
        let pick = ScriptOption::from_version_line;
        assert_eq!(pick("ffmpeg version n9.0.2 Copyright"), ScriptOption::Slash);
        assert_eq!(pick("ffmpeg version 7.1 Copyright"), ScriptOption::Slash);
        assert_eq!(
            pick("ffmpeg version 6.1.1-3ubuntu5 Copyright"),
            ScriptOption::Legacy
        );
        assert_eq!(pick("ffmpeg version 4.4.2 Copyright"), ScriptOption::Legacy);
        assert_eq!(
            pick("ffmpeg version N-118000-gabc Copyright"),
            ScriptOption::Slash
        );
        assert_eq!(pick(""), ScriptOption::Slash);
    }
}
