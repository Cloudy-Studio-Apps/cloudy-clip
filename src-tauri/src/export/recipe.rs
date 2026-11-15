//! FFmpeg settings of an export: built from a structured spec, never from arguments the webview
//! wrote. Frames arrive as raw RGBA on stdin; sound is mixed here from the original files.

use std::ffi::OsString;
use std::path::{Path, PathBuf};

use super::mixgraph;
use super::soundfilters::{STEP_LEAD, effects, gain_envelope_filter, pan_envelope_filter};
use super::spec::{
    Effort, ExportSpec, Format, SAMPLE_RATE, SoundMix, SoundOnlySpec, SoundSegment, StemSpec,
};

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

/// The inputs of `sound`, each the stretch of its file a segment plays. A segment from the file's
/// start has no `-ss`: FFmpeg seeking to 0 in a file with encoder priming (AAC in MP4) drops the
/// first frame of sound.
fn sound_inputs(sound: &[SoundSegment]) -> Vec<String> {
    sound
        .iter()
        .flat_map(|segment| {
            let mut args = Vec::new();
            if segment.from > 0 {
                args.extend(["-ss".to_owned(), seconds(segment.from)]);
            }
            args.extend([
                "-t".to_owned(),
                seconds(source_length(segment)),
                "-i".to_owned(),
                segment.path.clone(),
            ]);
            args
        })
        .collect()
}

/// `values` as the `&str`s `push` takes.
fn strs(values: &[String]) -> Vec<&str> {
    values.iter().map(String::as_str).collect()
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
            // `first_pts=0`: a decoder whose first sample comes late (or early) is padded (or
            // cut) to start at the segment's start, or the mix and stems would run short.
            let mut chain = format!(
                "[{input}:a]aresample={SAMPLE_RATE}:first_pts=0,aformat=sample_fmts=fltp,{layout}"
            );
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

/// The mixed sound as a filter graph, whose output is `[mixed]`, and `[stem<i>]` for each of
/// `stems`.
fn sound_graph(
    sound: &[SoundSegment],
    first_input: usize,
    mix: &SoundMix,
    total: u64,
    stems: &[StemSpec],
) -> String {
    let stems: Vec<Option<usize>> = stems.iter().map(|stem| stem.bus).collect();
    mixgraph::sound_graph(
        &segment_chains(sound, first_input),
        sound,
        mix,
        total,
        &stems,
    )
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
        Format::Wav if spec.bit_depth == Some(24) => strings(&["-c:a", "pcm_s24le"]),
        Format::Wav => strings(&["-c:a", "pcm_s16le"]),
        Format::Flac if spec.bit_depth == Some(24) => strings(&[
            "-c:a",
            "flac",
            "-sample_fmt",
            "s32",
            "-bits_per_raw_sample",
            "24",
        ]),
        Format::Flac => strings(&["-c:a", "flac", "-sample_fmt", "s16"]),
        Format::Aac => strings(&["-c:a", "aac", "-b:a", &kbps]),
        Format::Opus => strings(&["-c:a", "libopus", "-b:a", &kbps]),
    };
    if spec.format.has_picture() && spec.format != Format::Gif {
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

/// The arguments that give FFmpeg `graph`: inline, or in `file` when it is long, with the graph
/// to write there.
fn graph_arguments(
    graph: String,
    file: &Path,
    script_option: ScriptOption,
) -> (Vec<String>, Option<String>) {
    if graph.len() > INLINE_GRAPH_LIMIT {
        let flag = script_option.flag().to_owned();
        (vec![flag, file.to_string_lossy().into_owned()], Some(graph))
    } else {
        (vec!["-filter_complex".to_owned(), graph], None)
    }
}

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
    push(&strs(&sound_inputs(sound)));

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
            &spec.stems,
        ));
    }
    // A 16-bit file is dithered where the mix is cut down to it: the CLI's own conversion can't
    // be told to, and a stream fed from a graph takes no `-af`.
    let dither = spec.dithers();
    let out_label = |label: &str| {
        if dither {
            format!("[{label}16]")
        } else {
            format!("[{label}]")
        }
    };
    if dither && !sound.is_empty() {
        let rate = spec.output_rate();
        let mut labels = vec!["mixed".to_owned()];
        labels.extend((0..spec.stems.len()).map(|i| format!("stem{i}")));
        for label in labels {
            graph.push(format!(
                "[{label}]aresample={rate}:osf=s16:dither_method=triangular[{label}16]"
            ));
        }
    }
    let (graph, script) = graph_arguments(graph.join(";"), &script_of(partial), script_option);
    push(&strs(&graph));
    if picture {
        push(&["-map", "[picture]"]);
    }
    let rate = spec.output_rate().to_string();
    if !sound.is_empty() {
        push(&["-map", &out_label("mixed"), "-ar", &rate]);
    }
    let output = output_args(spec, hardware);
    let output: Vec<&str> = output.iter().map(String::as_str).collect();
    push(&output);
    push(&["-t", &seconds(spec.duration)]);
    args.push(partial.as_os_str().to_owned());
    // Each stem is an output of its own, with the mix's encoder settings.
    for (i, stem) in spec.stems.iter().enumerate() {
        let mut push = |values: &[&str]| args.extend(values.iter().map(OsString::from));
        push(&["-map", &out_label(&format!("stem{i}")), "-ar", &rate]);
        push(&output);
        push(&["-t", &seconds(spec.duration)]);
        args.push(partial_of(Path::new(&stem.output)).into_os_string());
    }
    Recipe { args, script }
}

/// Every FFmpeg argument of measuring `spec`'s mix: the graph a Mix export runs (no stems, nor the
/// rate and dither of its file), its master output `[mixed]` through `measure` into `[measured]`,
/// written nowhere (`-f null`). The mix stays in 32-bit float, so a sample over full scale is
/// measured before a file would cut it off. FFmpeg says what it measured at the `info` level. A
/// long graph goes in `script`, as an export's does. `spec` has sound.
pub fn measure_arguments(
    spec: &SoundOnlySpec,
    measure: &str,
    script: &Path,
    script_option: ScriptOption,
) -> Recipe {
    let mut args: Vec<String> = ["-hide_banner", "-nostats", "-loglevel", "info"]
        .map(str::to_owned)
        .into();
    args.extend(sound_inputs(&spec.sound));
    let graph = format!(
        "{};[mixed]{measure}[measured]",
        sound_graph(&spec.sound, 0, &spec.mix, spec.duration, &[])
    );
    let (graph, script) = graph_arguments(graph, script, script_option);
    args.extend(graph);
    let end = seconds(spec.duration);
    args.extend(
        [
            "-map",
            "[measured]",
            "-c:a",
            "pcm_f32le",
            "-t",
            &end,
            "-f",
            "null",
            "-",
        ]
        .map(str::to_owned),
    );
    Recipe {
        args: args.into_iter().map(OsString::from).collect(),
        script,
    }
}

/// `clip.mp4` next to itself as `clip.partial.mp4`: what FFmpeg writes, renamed once complete.
pub fn partial_of(output: &Path) -> PathBuf {
    let extension = output.extension().and_then(|e| e.to_str()).unwrap_or("mp4");
    output.with_extension(format!("partial.{extension}"))
}

/// A segment at the defaults, for the tests of this folder.
#[cfg(test)]
#[path = "recipe_tests.rs"]
mod sound_tests;
