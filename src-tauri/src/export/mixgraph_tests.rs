use super::*;
use crate::export::mixeffects::{CompressorSpec, DuckSpec, LimiterSpec, MixEffect};
use crate::export::spec::{
    BusMixSpec, EnvelopePoint, MasterCorrection, MasterMixSpec, segment as plain,
};

fn segment(track: usize) -> SoundSegment {
    SoundSegment { track, ..plain() }
}

/// The graph of a mix with no stems.
fn sound_graph(chains: &[String], segments: &[SoundSegment], mix: &SoundMix, total: u64) -> String {
    super::sound_graph(chains, segments, mix, total, &[])
}

/// The chain of a segment that has no filters of its own.
fn chain(i: usize) -> String {
    format!("[{i}:a]anull,adelay=0:all=1[s{i}];")
}

fn mix_of(tracks: &[TrackMixSpec], master: f64) -> SoundMix {
    SoundMix {
        tracks: tracks.to_vec(),
        buses: Vec::new(),
        master: MasterMixSpec {
            gain: master,
            ..MasterMixSpec::DEFAULT
        },
    }
}

fn with_effects(effects: Vec<MixEffect>) -> TrackMixSpec {
    TrackMixSpec {
        effects,
        ..TrackMixSpec::DEFAULT
    }
}

fn duck(listens_to: Vec<usize>) -> MixEffect {
    MixEffect::Duck(DuckSpec {
        listens_to,
        listens_to_buses: Vec::new(),
        depth_db: -12.0,
        attack_ms: 20.0,
        release_ms: 300.0,
    })
}

/// Every label is written once and read once; the inputs and `[mixed]` aside.
fn assert_wired(graph: &str) {
    let mut counts = std::collections::HashMap::<&str, usize>::new();
    for part in graph.split('[').skip(1) {
        let label = part.split(']').next().unwrap_or_default();
        *counts.entry(label).or_default() += 1;
    }
    for (label, count) in counts {
        if label.contains(':') || label == "mixed" {
            continue;
        }
        assert_eq!(count, 2, "[{label}] in {graph}");
    }
}

#[test]
fn a_default_mix_adds_no_volume_or_pan() {
    let graph = sound_graph(
        &[chain(0), chain(1)],
        &[segment(0), segment(1)],
        &SoundMix::default_for(2),
        1_000_000,
    );
    assert!(!graph.contains("volume="), "{graph}");
    assert!(!graph.contains("pan="), "{graph}");
    assert_eq!(graph.matches("amix=").count(), 1, "{graph}");
}

#[test]
fn a_track_volume_applies_once_after_its_clips_mix() {
    let louder = TrackMixSpec {
        gain: 0.5,
        ..TrackMixSpec::DEFAULT
    };
    let graph = sound_graph(
        &[chain(0), chain(1)],
        &[segment(0), segment(0)],
        &mix_of(&[louder], 1.0),
        1_000_000,
    );
    assert_eq!(graph.matches("volume=0.500000").count(), 1, "{graph}");
    assert!(
        graph.find("[s0][s1]amix=inputs=2").unwrap() < graph.find("volume=0.500000").unwrap(),
        "{graph}"
    );
    assert!(graph.contains("[t0]amix=inputs=1"), "{graph}");
}

#[test]
fn a_volume_line_follows_its_envelope_after_the_clips_mix_instead_of_the_fader() {
    let point = |at, value| EnvelopePoint { at, value };
    let line = TrackMixSpec {
        gain: 0.5,
        gain_envelope: vec![point(0, 1.0), point(1_000_000, 0.25)],
        ..TrackMixSpec::DEFAULT
    };
    let graph = sound_graph(
        &[chain(0), chain(1)],
        &[segment(0), segment(0)],
        &mix_of(&[line], 1.0),
        1_000_000,
    );
    let envelope = graph.find("aeval='val(ch)*(").unwrap();
    assert!(
        graph.find("[s0][s1]amix=inputs=2").unwrap() < envelope,
        "{graph}"
    );
    assert!(graph.contains("1+-0.75*(t-0)"), "{graph}");
    assert!(!graph.contains("volume=0.500000"), "{graph}");
    assert_wired(&graph);
}

#[test]
fn only_a_track_that_changes_the_sound_gets_a_bus() {
    let quiet = TrackMixSpec {
        gain: 0.25,
        ..TrackMixSpec::DEFAULT
    };
    let graph = sound_graph(
        &[chain(0), chain(1)],
        &[segment(0), segment(1)],
        &mix_of(&[TrackMixSpec::DEFAULT, quiet], 1.0),
        1_000_000,
    );
    assert!(graph.contains("[s1]anull,volume=0.250000[t1];"), "{graph}");
    assert!(graph.contains("[s0][t1]amix=inputs=2"), "{graph}");
}

#[test]
fn master_volume_and_pan_come_last() {
    let mut mix = mix_of(&[TrackMixSpec::DEFAULT], 2.0);
    mix.master.pan = 0.5;
    let graph = sound_graph(&[chain(0)], &[segment(0)], &mix, 1_000_000);
    let volume = graph.find("volume=2.000000").unwrap();
    let pan = graph.find("pan=stereo").unwrap();
    assert!(graph.find("amix=").unwrap() < volume, "{graph}");
    assert!(volume < pan && pan < graph.find("apad").unwrap(), "{graph}");
}

#[test]
fn an_empty_chain_adds_nothing() {
    let graph = sound_graph(
        &[chain(0)],
        &[segment(0)],
        &mix_of(&[with_effects(Vec::new())], 1.0),
        1_000_000,
    );
    assert_eq!(
        graph,
        "[0:a]anull,adelay=0:all=1[s0];[s0]amix=inputs=1:normalize=0:dropout_transition=0,apad=whole_dur=1.000000,atrim=0:1.000000[mixed]"
    );
}

#[test]
fn a_compressor_is_acompressor_with_its_values_before_pan_and_volume() {
    let compressor = MixEffect::Compressor {
        params: CompressorSpec {
            threshold_db: -18.0,
            ratio: 4.0,
            attack_ms: 20.0,
            release_ms: 250.0,
            knee_db: 9.0,
            makeup_db: 3.5,
        },
    };
    let spec = TrackMixSpec {
        gain: 0.5,
        pan: 0.5,
        effects: vec![compressor],
        ..TrackMixSpec::DEFAULT
    };
    let graph = sound_graph(&[chain(0)], &[segment(0)], &mix_of(&[spec], 1.0), 1_000_000);
    let filter = "acompressor=threshold=-18dB:ratio=4:attack=20:release=250:knee=9dB:makeup=3.5dB:detection=peak";
    assert!(graph.contains(filter), "{graph}");
    let at = graph.find(filter).unwrap();
    assert!(at < graph.find("pan=stereo").unwrap(), "{graph}");
    assert!(at < graph.find("volume=0.500000").unwrap(), "{graph}");
    assert_wired(&graph);
}

#[test]
fn a_duck_splits_the_listened_track_after_its_fader_and_keys_sidechaincompress() {
    let speech = TrackMixSpec {
        gain: 0.5,
        ..TrackMixSpec::DEFAULT
    };
    let graph = sound_graph(
        &[chain(0), chain(1)],
        &[segment(0), segment(1)],
        &mix_of(&[speech, with_effects(vec![duck(vec![0])])], 1.0),
        1_000_000,
    );
    let fader = graph.find("volume=0.500000").unwrap();
    let split = graph.find("asplit=2").unwrap();
    assert!(fader < split, "{graph}");
    assert!(
        graph.contains(
            "sidechaincompress=threshold=-40dB:ratio=20:attack=20:release=300:detection=peak:mix="
        ),
        "{graph}"
    );
    // Track 0 is built before the track it keys, and both reach the master once.
    assert!(split < graph.find("sidechaincompress").unwrap(), "{graph}");
    assert!(graph.contains("[t0][t1]amix=inputs=2"), "{graph}");
    assert_wired(&graph);
}

#[test]
fn a_duck_mixes_its_keys_and_ignores_tracks_without_sound() {
    let graph = sound_graph(
        &[chain(0), chain(1), chain(2)],
        &[segment(0), segment(1), segment(2)],
        &mix_of(
            &[
                with_effects(vec![duck(vec![1, 2, 3])]),
                TrackMixSpec::DEFAULT,
                TrackMixSpec::DEFAULT,
                TrackMixSpec::DEFAULT,
            ],
            1.0,
        ),
        1_000_000,
    );
    assert!(
        graph.contains("amix=inputs=2:normalize=0:dropout_transition=0,apad"),
        "{graph}"
    );
    assert_eq!(graph.matches("sidechaincompress").count(), 1, "{graph}");
    assert_wired(&graph);
}

#[test]
fn a_duck_whose_tracks_are_silent_does_nothing() {
    let graph = sound_graph(
        &[chain(0)],
        &[segment(0)],
        &mix_of(
            &[with_effects(vec![duck(vec![1])]), TrackMixSpec::DEFAULT],
            1.0,
        ),
        1_000_000,
    );
    assert!(!graph.contains("sidechaincompress"), "{graph}");
    assert!(!graph.contains("asplit"), "{graph}");
    assert_wired(&graph);
    // A ducked track with no sound keys nothing and splits nothing either.
    let empty = sound_graph(
        &[chain(0)],
        &[segment(0)],
        &mix_of(
            &[TrackMixSpec::DEFAULT, with_effects(vec![duck(vec![0])])],
            1.0,
        ),
        1_000_000,
    );
    assert!(!empty.contains("asplit"), "{empty}");
    assert_wired(&empty);
}

#[test]
fn ducks_in_a_row_build_the_listened_track_first() {
    // 2 listens to 1, which listens to 0: 0, then 1, then 2.
    let graph = sound_graph(
        &[chain(0), chain(1), chain(2)],
        &[segment(0), segment(1), segment(2)],
        &mix_of(
            &[
                TrackMixSpec::DEFAULT,
                with_effects(vec![duck(vec![0])]),
                with_effects(vec![duck(vec![1])]),
            ],
            1.0,
        ),
        1_000_000,
    );
    assert_eq!(graph.matches("sidechaincompress").count(), 2, "{graph}");
    assert!(
        graph.find("[t0]").unwrap() < graph.find("[t1]").unwrap(),
        "{graph}"
    );
    assert_wired(&graph);
}

#[test]
fn a_limiter_on_master_is_the_last_filter_before_apad() {
    let mut mix = mix_of(&[TrackMixSpec::DEFAULT], 2.0);
    mix.master.effects = vec![MixEffect::Limiter(LimiterSpec {
        ceiling_db: -1.0,
        release_ms: 50.0,
    })];
    let graph = sound_graph(&[chain(0)], &[segment(0)], &mix, 1_000_000);
    assert!(
        graph.contains(
            "alimiter=limit=-1dB:attack=5:release=50:level=disabled,pan=stereo|c0=c0|c1=c1,apad=whole_dur=1.000000,atrim"
        ),
        "{graph}"
    );
    assert!(graph.find("volume=2.000000").unwrap() < graph.find("alimiter").unwrap());
    assert_wired(&graph);
}

fn sent_to(bus: usize) -> TrackMixSpec {
    TrackMixSpec {
        bus: Some(bus),
        ..TrackMixSpec::DEFAULT
    }
}

fn group(gain: f64, muted: bool) -> BusMixSpec {
    BusMixSpec {
        gain,
        muted,
        effects: Vec::new(),
    }
}

#[test]
fn tracks_of_a_group_mix_into_one_chain_with_its_volume_before_the_master() {
    let mut mix = mix_of(&[sent_to(0), sent_to(0), TrackMixSpec::DEFAULT], 1.0);
    mix.buses = vec![group(0.5, false)];
    let graph = sound_graph(
        &[chain(0), chain(1), chain(2)],
        &[segment(0), segment(1), segment(2)],
        &mix,
        1_000_000,
    );
    assert!(
        graph.contains(
            "[s0][s1]amix=inputs=2:normalize=0:dropout_transition=0,volume=0.500000[g0];"
        ),
        "{graph}"
    );
    assert!(graph.contains("[s2][g0]amix=inputs=2"), "{graph}");
    assert!(graph.find("[g0];").unwrap() < graph.find("[mixed]").unwrap());
    assert_wired(&graph);
}

#[test]
fn a_group_applies_its_effects_after_its_tracks_own_levels() {
    let quiet = TrackMixSpec {
        gain: 0.25,
        bus: Some(0),
        ..TrackMixSpec::DEFAULT
    };
    let mut mix = mix_of(&[quiet], 1.0);
    mix.buses = vec![BusMixSpec {
        effects: vec![MixEffect::Limiter(LimiterSpec {
            ceiling_db: -1.0,
            release_ms: 50.0,
        })],
        ..group(2.0, false)
    }];
    let graph = sound_graph(&[chain(0)], &[segment(0)], &mix, 1_000_000);
    let track = graph.find("volume=0.250000[t0]").unwrap();
    let limiter = graph.find("alimiter").unwrap();
    let level = graph.find("volume=2.000000[g0]").unwrap();
    assert!(track < limiter && limiter < level, "{graph}");
    assert!(graph.contains("[g0]amix=inputs=1"), "{graph}");
    assert_wired(&graph);
}

#[test]
fn a_muted_group_adds_no_input() {
    let mut mix = mix_of(&[sent_to(0), TrackMixSpec::DEFAULT], 1.0);
    mix.buses = vec![group(1.0, true)];
    let graph = sound_graph(
        &[chain(0), chain(1)],
        &[segment(0), segment(1)],
        &mix,
        1_000_000,
    );
    assert!(
        !graph.contains("[g0]") && !graph.contains("[s0]"),
        "{graph}"
    );
    assert!(graph.contains("[s1]amix=inputs=1:"), "{graph}");
    assert_wired(&graph);
}

#[test]
fn a_track_of_a_muted_group_keys_nothing() {
    // As a muted track: the preview mutes its fader, so its key is silent.
    let mut mix = mix_of(&[sent_to(0), with_effects(vec![duck(vec![0])])], 1.0);
    mix.buses = vec![group(1.0, true)];
    let graph = sound_graph(
        &[chain(0), chain(1)],
        &[segment(0), segment(1)],
        &mix,
        1_000_000,
    );
    assert!(!graph.contains("sidechaincompress"), "{graph}");
    assert!(
        !graph.contains("[g0]") && !graph.contains("[s0]"),
        "{graph}"
    );
    assert!(graph.contains("[t1]amix=inputs=1:"), "{graph}");
    assert_wired(&graph);
}

#[test]
fn a_duck_listening_to_a_group_keys_after_the_group_fader() {
    let listening = with_effects(vec![MixEffect::Duck(DuckSpec {
        listens_to: Vec::new(),
        listens_to_buses: vec![0],
        depth_db: -12.0,
        attack_ms: 20.0,
        release_ms: 300.0,
    })]);
    let mut mix = mix_of(&[sent_to(0), listening], 1.0);
    mix.buses = vec![group(0.5, false)];
    let graph = sound_graph(
        &[chain(0), chain(1)],
        &[segment(0), segment(1)],
        &mix,
        1_000_000,
    );
    let fader = graph.find("volume=0.500000").unwrap();
    let split = graph.find("asplit=2[g0]").unwrap();
    assert!(fader < split, "{graph}");
    assert!(split < graph.find("sidechaincompress").unwrap(), "{graph}");
    assert!(
        graph.contains("[g0][t1]amix=inputs=2") || graph.contains("[t1][g0]amix=inputs=2"),
        "{graph}"
    );
    assert_wired(&graph);
}

#[test]
fn a_correction_raises_the_master_and_adds_its_limiter_last() {
    let mut mix = mix_of(&[TrackMixSpec::DEFAULT], 2.0);
    mix.master.correction = Some(MasterCorrection {
        gain_db: 20.0 * 2f64.log10(),
        limiter: Some(LimiterSpec {
            ceiling_db: -1.5,
            release_ms: 50.0,
        }),
    });
    let graph = sound_graph(&[chain(0)], &[segment(0)], &mix, 1_000_000);
    assert!(graph.contains("volume=4.000000"), "{graph}");
    assert!(
        graph.contains(
            "alimiter=limit=-1.5dB:attack=5:release=50:level=disabled,pan=stereo|c0=c0|c1=c1,apad=whole_dur"
        ),
        "{graph}"
    );
    assert_wired(&graph);
}

#[test]
fn a_stem_never_gets_the_correction() {
    let mut mix = mix_of(&[TrackMixSpec::DEFAULT], 1.0);
    mix.master.correction = Some(MasterCorrection {
        gain_db: 20.0 * 2f64.log10(),
        limiter: Some(LimiterSpec {
            ceiling_db: -1.0,
            release_ms: 50.0,
        }),
    });
    let graph = super::sound_graph(&[chain(0)], &[segment(0)], &mix, 1_000_000, &[None]);
    // The stem is split off before the master: its own chain ends in [stem0] with neither the
    // correction's level nor its limiter, which only the master's chain into [mixed] has.
    let stem = graph
        .split(';')
        .find(|part| part.ends_with("[stem0]"))
        .unwrap();
    assert!(
        !stem.contains("volume") && !stem.contains("alimiter"),
        "{graph}"
    );
    let mixed = graph
        .split(';')
        .find(|part| part.ends_with("[mixed]"))
        .unwrap();
    assert!(
        mixed.contains("volume=2.000000") && mixed.contains("alimiter"),
        "{graph}"
    );
}

#[test]
fn a_correction_is_refused_out_of_range_or_with_a_second_limiter() {
    let limiter = LimiterSpec {
        ceiling_db: -1.0,
        release_ms: 50.0,
    };
    let with = |gain_db: f64, effects: Vec<MixEffect>| MasterMixSpec {
        effects,
        correction: Some(MasterCorrection {
            gain_db,
            limiter: Some(limiter),
        }),
        ..MasterMixSpec::DEFAULT
    };
    assert!(with(6.0, Vec::new()).check().is_ok());
    assert!(with(f64::NAN, Vec::new()).check().is_err());
    assert!(with(100.0, Vec::new()).check().is_err());
    assert!(
        with(6.0, vec![MixEffect::Limiter(limiter)])
            .check()
            .is_err()
    );
}
