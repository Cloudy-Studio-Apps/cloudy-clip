//! FFmpeg settings of an export: built from a structured spec, never from arguments the webview
//! wrote. Frames arrive as raw RGBA on stdin; sound is mixed here from the original files.

use std::ffi::OsString;
use std::path::{Path, PathBuf};

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

/// Timeline time each tempo step reads ahead of its end. `atempo` gives a few milliseconds more
/// or less than its input over its tempo, so each step reads ahead and is cut to its exact length:
/// the steps stay in step with the picture, with no silence between them.
const STEP_LEAD: u64 = 100_000;

/// Samples of the mixed sound in `micros`.
fn samples(micros: f64) -> u64 {
    (micros * f64::from(SAMPLE_RATE) / 1_000_000.0).round() as u64
}

/// How a step changes speed: `atempo`, or `asetrate` when the pitch moves with it.
fn speed_filter(speed: f64, keep_pitch: bool) -> String {
    if keep_pitch {
        tempo_steps(speed)
    } else {
        let rate = f64::from(SAMPLE_RATE) * speed;
        format!(",asetrate={rate:.3},aresample={SAMPLE_RATE}")
    }
}

/// Timeline time two neighbouring tempo steps overlap: each step but the last plays on this much
/// past its end, and the next one fades in over it from its own start, so no boundary jumps, the
/// steps stay on the picture and the segment keeps its length. Measured on tones against 8 and
/// 10 ms: the shortest overlap dips least where the two sides meet out of phase.
const STEP_CROSSFADE: u64 = 5_000;

/// A ramped segment's tempo steps: the input is split, each step trims its own part of the file,
/// changes its speed and is cut to its length (plus the crossfade, but the last), and the steps
/// are crossfaded in order. `n` keeps the labels of one segment apart from the others'.
fn tempo_steps_filter(n: usize, segment: &SoundSegment) -> String {
    let steps = &segment.tempo_steps;
    let count = steps.len();
    let crossfade = samples(STEP_CROSSFADE as f64);
    let mut text = format!(",asplit={count}");
    for k in 0..count {
        text.push_str(&format!("[step{n}_{k}]"));
    }
    text.push(';');
    let mut elapsed = 0u64;
    for (k, step) in steps.iter().enumerate() {
        let into_file = step.from.saturating_sub(segment.from) as f64;
        let read = (step.duration + STEP_LEAD) as f64 * step.speed;
        let first = samples(into_file);
        let last = samples(into_file + read);
        let own = samples((elapsed + step.duration) as f64) - samples(elapsed as f64);
        let length = if k + 1 < count { own + crossfade } else { own };
        elapsed += step.duration;
        text.push_str(&format!(
            "[step{n}_{k}]atrim=start_sample={first}:end_sample={last},asetpts=PTS-STARTPTS{},apad=whole_len={length},atrim=end_sample={length}[tempo{n}_{k}];",
            speed_filter(step.speed, segment.keep_pitch)
        ));
    }
    // One pair at a time: `acrossfade` takes more than two inputs only from FFmpeg 7.1. Both
    // sides hold nearly the same sound, so the gains add up to 1 (`hsin`), not their powers
    // (`qsin` swells by up to 3 dB where they meet in phase).
    let mut joined = format!("tempo{n}_0");
    for k in 1..count {
        text.push_str(&format!(
            "[{joined}][tempo{n}_{k}]acrossfade=ns={crossfade}:c1=hsin:c2=hsin[join{n}_{k}];"
        ));
        joined = format!("join{n}_{k}");
    }
    text.push_str(&format!("[{joined}]anull"));
    text
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

/// How a pan mixes the two channels as `StereoPannerNode` does it for stereo sound, so export
/// sounds like the preview: `(ll, rl, lr, rr)`, where the left output is `ll*L + rl*R` and the
/// right one `lr*L + rr*R`.
fn pan_gains(pan: f64) -> (f64, f64, f64, f64) {
    use std::f64::consts::FRAC_PI_2;
    if pan <= 0.0 {
        let angle = (pan + 1.0) * FRAC_PI_2;
        (1.0, angle.cos().abs(), 0.0, angle.sin())
    } else {
        let angle = pan * FRAC_PI_2;
        (angle.cos().abs(), 0.0, angle.sin(), 1.0)
    }
}

/// A still pan.
fn pan_filter(pan: f64) -> String {
    let (ll, rl, lr, rr) = pan_gains(pan);
    if pan <= 0.0 {
        format!(",pan=stereo|c0=c0+{rl:.6}*c1|c1={rr:.6}*c1")
    } else {
        format!(",pan=stereo|c0={ll:.6}*c0|c1=c1+{lr:.6}*c0")
    }
}

/// A number for an expression, short because an envelope has up to 256 of them.
fn compact(value: f64) -> String {
    let text = format!("{value:.5}");
    text.trim_end_matches('0').trim_end_matches('.').to_owned()
}

/// A value that follows the points along straight lines, as an expression of `t` (seconds into
/// the segment). Before the first point and after the last it holds.
fn envelope_expr(points: &[(f64, f64)]) -> String {
    // A point on the line between its neighbours adds nothing; this collapses constant stretches.
    let mut kept: Vec<(f64, f64)> = Vec::with_capacity(points.len());
    for (i, &point) in points.iter().enumerate() {
        if let (Some(&a), Some(&b)) = (kept.last(), points.get(i + 1))
            && b.0 > a.0
            && (point.1 - (a.1 + (b.1 - a.1) * (point.0 - a.0) / (b.0 - a.0))).abs() < 1e-5
        {
            continue;
        }
        kept.push(point);
    }
    let Some(first) = kept.first().copied() else {
        return "1".to_owned();
    };
    if kept.iter().all(|p| (p.1 - first.1).abs() < 1e-5) {
        return compact(first.1);
    }
    // One straight stretch each, from its start; the last one holds the final value.
    let mut stretches: Vec<(f64, f64, f64)> = Vec::new();
    for pair in kept.windows(2) {
        if let [a, b] = pair
            && b.0 > a.0
        {
            stretches.push((a.0, a.1, (b.1 - a.1) / (b.0 - a.0)));
        }
    }
    if let Some(last) = kept.last() {
        stretches.push((last.0, last.1, 0.0));
    }
    stretch_tree(&stretches)
}

/// The stretches as a balanced tree of `if`s: FFmpeg's expression parser refuses to nest deeper
/// than 100 levels, which a chain of 256 would.
fn stretch_tree(stretches: &[(f64, f64, f64)]) -> String {
    if let [(t0, v0, slope)] = stretches {
        if slope.abs() < 1e-5 {
            return compact(*v0);
        }
        return format!("{}+{}*(t-{})", compact(*v0), compact(*slope), compact(*t0));
    }
    let middle = stretches.len() / 2;
    let (before, after) = stretches.split_at(middle);
    let start = after.first().map_or(0.0, |s| s.0);
    format!(
        "if(lt(t,{}),{},{})",
        compact(start),
        stretch_tree(before),
        stretch_tree(after)
    )
}

/// The points as seconds and a value each.
fn timed(points: &[EnvelopePoint], value: impl Fn(f64) -> f64) -> Vec<(f64, f64)> {
    points
        .iter()
        .map(|p| (p.at as f64 / 1_000_000.0, value(p.value)))
        .collect()
}

/// A level that follows an envelope.
fn gain_envelope_filter(points: &[EnvelopePoint]) -> String {
    let expr = envelope_expr(&timed(points, |v| v));
    format!(",volume=eval=frame:volume='{expr}'")
}

/// A pan that follows an envelope. The sound is split in two channels, each goes to both sides
/// with the gain the pan law gives at that moment, and the sides are joined again. `n` keeps the
/// labels of one segment apart from the others'.
fn pan_envelope_filter(n: usize, points: &[EnvelopePoint]) -> String {
    let gain = |pick: fn((f64, f64, f64, f64)) -> f64| {
        envelope_expr(&timed(points, |pan| pick(pan_gains(pan))))
    };
    let (ll, rl) = (gain(|g| g.0), gain(|g| g.1));
    let (lr, rr) = (gain(|g| g.2), gain(|g| g.3));
    let volume = |from: &str, expr: String, to: &str| {
        format!("[{from}{n}]volume=eval=frame:volume='{expr}'[{to}{n}];")
    };
    let mut text = format!(",channelsplit=channel_layout=stereo[pl{n}][pr{n}];");
    text.push_str(&format!("[pl{n}]asplit[pll{n}][plr{n}];"));
    text.push_str(&format!("[pr{n}]asplit[prl{n}][prr{n}];"));
    text.push_str(&volume("pll", ll, "gll"));
    text.push_str(&volume("prl", rl, "grl"));
    text.push_str(&volume("plr", lr, "glr"));
    text.push_str(&volume("prr", rr, "grr"));
    text.push_str(&format!(
        "[gll{n}][grl{n}]amix=inputs=2:normalize=0[ol{n}];"
    ));
    text.push_str(&format!(
        "[glr{n}][grr{n}]amix=inputs=2:normalize=0[or{n}];"
    ));
    text.push_str(&format!(
        "[ol{n}][or{n}]join=inputs=2:channel_layout=stereo[pan{n}];[pan{n}]anull"
    ));
    text
}

/// What a clip's sound settings add, in the preview's order. Empty at the defaults. `n` keeps the
/// labels of one segment apart from the others'.
fn effects(n: usize, segment: &SoundSegment) -> String {
    let mut chain = String::new();
    if segment.reversed {
        chain.push_str(",areverse");
    }
    if !segment.tempo_steps.is_empty() {
        chain.push_str(&tempo_steps_filter(n, segment));
    } else if segment.speed != 1.0 {
        chain.push_str(&speed_filter(segment.speed, segment.keep_pitch));
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
    if segment.pan != 0.0 && segment.pan_envelope.is_empty() {
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
        graph.push(sound_graph(sound, usize::from(picture), spec.duration));
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
        assert_eq!(effects(0, &back), ",areverse,atempo=2.000000");
    }

    #[test]
    fn speed_keeping_pitch_uses_tempo() {
        let fast = SoundSegment {
            speed: 2.0,
            ..segment()
        };
        assert_eq!(effects(0, &fast), ",atempo=2.000000");
    }

    #[test]
    fn speed_past_two_chains_tempo() {
        let fast = SoundSegment {
            speed: 4.0,
            ..segment()
        };
        assert_eq!(effects(0, &fast), ",atempo=2.000000,atempo=2.000000");
    }

    #[test]
    fn speed_without_correction_resamples() {
        let fast = SoundSegment {
            speed: 2.0,
            keep_pitch: false,
            ..segment()
        };
        assert_eq!(effects(0, &fast), ",asetrate=96000.000,aresample=48000");
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
        let left = effects(
            0,
            &SoundSegment {
                pan: -1.0,
                ..segment()
            },
        );
        assert_eq!(left, ",pan=stereo|c0=c0+1.000000*c1|c1=0.000000*c1");
        let right = effects(
            0,
            &SoundSegment {
                pan: 1.0,
                ..segment()
            },
        );
        assert_eq!(right, ",pan=stereo|c0=0.000000*c0|c1=c1+1.000000*c0");
    }

    #[test]
    fn equalizer_filters_by_shape() {
        let chain = effects(
            0,
            &SoundSegment {
                eq: vec![
                    band(EqKind::LowCut, 80.0, 0.0),
                    band(EqKind::LowShelf, 120.0, 3.0),
                    band(EqKind::Bell, 500.0, -2.0),
                    band(EqKind::HighShelf, 8000.0, 1.5),
                    band(EqKind::HighCut, 16000.0, 0.0),
                ],
                ..segment()
            },
        );
        assert_eq!(
            chain,
            ",highpass=f=80.00,bass=g=3.00:f=120.00:t=s:w=1,equalizer=f=500.00:t=q:w=1.00:g=-2.00,treble=g=1.50:f=8000.00:t=s:w=1,lowpass=f=16000.00"
        );
    }

    #[test]
    fn pitch_keeps_the_length() {
        let chain = effects(
            0,
            &SoundSegment {
                pitch: 12.0,
                ..segment()
            },
        );
        assert_eq!(chain, ",asetrate=96000.000,aresample=48000,atempo=0.500000");
        let far = effects(
            0,
            &SoundSegment {
                pitch: 24.0,
                ..segment()
            },
        );
        assert_eq!(
            far,
            ",asetrate=192000.000,aresample=48000,atempo=0.500000,atempo=0.500000"
        );
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

    #[test]
    fn pan_gains_are_the_law_of_pan_filter() {
        let (ll, rl, lr, rr) = pan_gains(0.0);
        assert!((ll - 1.0).abs() < 1e-9 && rl.abs() < 1e-9 && lr == 0.0 && (rr - 1.0).abs() < 1e-9);
        let (ll, rl, lr, rr) = pan_gains(-1.0);
        assert!((ll - 1.0).abs() < 1e-9 && (rl - 1.0).abs() < 1e-9 && lr == 0.0 && rr.abs() < 1e-9);
        let (ll, rl, lr, rr) = pan_gains(1.0);
        assert!(ll.abs() < 1e-9 && rl == 0.0 && (lr - 1.0).abs() < 1e-9 && (rr - 1.0).abs() < 1e-9);
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
        }
    }

    #[test]
    fn a_constant_stretch_costs_no_expression() {
        let still = timed(
            &[
                EnvelopePoint { at: 0, value: 1.0 },
                EnvelopePoint {
                    at: 1_000_000,
                    value: 1.0,
                },
            ],
            |v| v,
        );
        assert_eq!(envelope_expr(&still), "1");
        let hold = envelope_expr(&[(0.0, 1.0), (1.0, 1.0), (2.0, 0.0)]);
        assert_eq!(hold, "if(lt(t,1),1,if(lt(t,2),1+-1*(t-1),0))");
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
