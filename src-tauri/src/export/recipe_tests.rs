use super::*;
use crate::export::soundfilters::{STEP_CROSSFADE, samples};
use crate::export::spec::*;

/// The graph of segments under a mix that leaves them as they are.
fn sound_graph(sound: &[SoundSegment], first_input: usize, total: u64) -> String {
    super::sound_graph(sound, first_input, &SoundMix::default_for(1), total, &[])
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
fn gain_envelope_becomes_a_sample_expression() {
    let chain = sound_graph(&[keyed()], 1, 2_000_000);
    assert!(chain.contains("aeval='val(ch)*("), "{chain}");
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
        sample_rate: 48_000,
        bit_depth: None,
        effort: Effort::Fast,
        hardware: false,
        sound: vec![segment; clips],
        mix: SoundMix::default_for(1),
        stems: Vec::new(),
    }
}

/// A sound-only export of one plain segment in `format`.
fn audio_export(format: Format, sample_rate: u32, bit_depth: Option<u32>) -> ExportSpec {
    ExportSpec {
        format,
        sample_rate,
        bit_depth,
        sound: vec![segment()],
        ..worst_case(0)
    }
}

fn args_of(spec: &ExportSpec) -> Vec<String> {
    arguments(spec, Path::new("/o.partial.wav"), None, ScriptOption::Slash)
        .args
        .iter()
        .map(|a| a.to_string_lossy().into_owned())
        .collect()
}

/// The value after `flag`.
fn after<'a>(args: &'a [String], flag: &str) -> &'a str {
    let at = args.iter().position(|a| a == flag).expect(flag);
    &args[at + 1]
}

#[test]
fn wav_at_24_bit_44100() {
    let args = args_of(&audio_export(Format::Wav, 44_100, Some(24)));
    assert_eq!(after(&args, "-c:a"), "pcm_s24le");
    assert_eq!(after(&args, "-ar"), "44100");
    assert!(!args.iter().any(|a| a == "-colorspace"));
    let sixteen = args_of(&audio_export(Format::Wav, 48_000, None));
    assert_eq!(after(&sixteen, "-c:a"), "pcm_s16le");
    assert_eq!(after(&sixteen, "-ar"), "48000");
}

#[test]
fn flac_keeps_its_depth() {
    let args = args_of(&audio_export(Format::Flac, 48_000, Some(24)));
    assert_eq!(after(&args, "-c:a"), "flac");
    assert_eq!(after(&args, "-sample_fmt"), "s32");
    assert_eq!(after(&args, "-bits_per_raw_sample"), "24");
    let sixteen = args_of(&audio_export(Format::Flac, 48_000, Some(16)));
    assert_eq!(after(&sixteen, "-sample_fmt"), "s16");
}

#[test]
fn opus_is_always_48_khz() {
    let args = args_of(&audio_export(Format::Opus, 44_100, None));
    assert_eq!(after(&args, "-c:a"), "libopus");
    assert_eq!(after(&args, "-ar"), "48000");
    let aac = args_of(&audio_export(Format::Aac, 44_100, None));
    assert_eq!(after(&aac, "-c:a"), "aac");
    assert_eq!(after(&aac, "-ar"), "44100");
}

#[test]
fn two_groups_and_a_direct_track_give_four_outputs_each_mapped_once() {
    let sent = |bus| TrackMixSpec {
        bus,
        ..TrackMixSpec::DEFAULT
    };
    let group = BusMixSpec {
        gain: 1.0,
        muted: false,
        effects: Vec::new(),
    };
    let spec = ExportSpec {
        output: "/o - Mix.wav".into(),
        sound: (0..3)
            .map(|track| SoundSegment { track, ..segment() })
            .collect(),
        mix: SoundMix {
            tracks: vec![sent(Some(0)), sent(Some(1)), sent(None)],
            buses: vec![group.clone(), group],
            ..SoundMix::default_for(0)
        },
        stems: vec![
            StemSpec {
                output: "/o - Dialogue.wav".into(),
                bus: Some(0),
            },
            StemSpec {
                output: "/o - Music.wav".into(),
                bus: Some(1),
            },
            StemSpec {
                output: "/o - Other.wav".into(),
                bus: None,
            },
        ],
        ..audio_export(Format::Wav, 44_100, Some(24))
    };
    assert!(spec.check().is_ok());
    let args = args_of(&spec);
    let maps: Vec<&str> = args
        .iter()
        .enumerate()
        .filter(|(_, a)| *a == "-map")
        .map(|(i, _)| args[i + 1].as_str())
        .collect();
    assert_eq!(maps, ["[mixed]", "[stem0]", "[stem1]", "[stem2]"]);
    let outputs: Vec<&String> = args.iter().filter(|a| a.contains(".partial.")).collect();
    assert_eq!(
        outputs,
        [
            "/o.partial.wav",
            "/o - Dialogue.partial.wav",
            "/o - Music.partial.wav",
            "/o - Other.partial.wav"
        ]
    );
    // Every output has its own encoder, rate and length.
    assert_eq!(args.iter().filter(|a| *a == "pcm_s24le").count(), 4);
    assert_eq!(args.iter().filter(|a| *a == "44100").count(), 4);
    let graph = after(&args, "-filter_complex");
    for stem in ["[stem0]", "[stem1]", "[stem2]", "[mixed]"] {
        assert_eq!(graph.matches(stem).count(), 1, "{stem} in {graph}");
    }
}

#[test]
fn rates_and_depths_are_checked() {
    assert!(audio_export(Format::Wav, 44_100, Some(24)).check().is_ok());
    assert!(audio_export(Format::Mp3, 44_100, None).check().is_ok());
    assert!(audio_export(Format::Wav, 22_050, None).check().is_err());
    assert!(audio_export(Format::Wav, 48_000, Some(8)).check().is_err());
    assert!(
        audio_export(Format::Flac, 48_000, Some(32))
            .check()
            .is_err()
    );
    assert!(audio_export(Format::Aac, 48_000, Some(24)).check().is_err());
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

#[test]
fn an_hour_long_volume_line_goes_in_a_file() {
    let line: Vec<EnvelopePoint> = (0..3_600u64)
        .map(|i| EnvelopePoint {
            at: i * 1_000_000,
            value: 0.5 + ((i as f64) * 0.37).sin() / 3.0,
        })
        .collect();
    let hour = ExportSpec {
        duration: 3_600_000_000,
        sound: vec![SoundSegment {
            duration: 3_600_000_000,
            ..segment()
        }],
        mix: SoundMix {
            tracks: vec![TrackMixSpec {
                gain_envelope: line,
                ..TrackMixSpec::DEFAULT
            }],
            ..SoundMix::default_for(1)
        },
        ..worst_case(0)
    };
    let recipe = arguments(
        &hour,
        Path::new("/o.partial.mp3"),
        None,
        ScriptOption::Slash,
    );
    let graph = recipe.script.expect("a long line is written to a file");
    assert!(graph.contains("aeval='val(ch)*("));
    assert!(recipe.args.iter().all(|a| a.len() < 1_000));
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
