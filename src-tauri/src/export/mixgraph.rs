//! The tree the sound is mixed in, as the preview's buses are: a track's clips are summed, the
//! track's effects, pan and level apply to that sum, the tracks are summed, and the master's
//! level, then its effects, apply to the result. A duck's key is the sum of the tracks it listens
//! to after their levels, split off them (`asplit`); those tracks are built first.

use std::collections::BTreeMap;

use super::mixeffects::{MixEffect, duck_filter, effect_filter};
use super::recipe::{SoundMix, SoundSegment, TrackMixSpec, seconds};
use super::soundfilters::{pan_filter, samples};

/// Time a chain with effects runs on in silence past the end, as the preview's effects run on
/// after the sound stops: a limiter gives back its lookahead, and a duck never ends before its
/// key has caught up. The master's `atrim` cuts it.
const TAIL: u64 = 100_000;

/// What a track missing from the mix does: nothing.
static UNCHANGED: TrackMixSpec = TrackMixSpec::DEFAULT;

/// The mixed sound as a filter graph, whose output is `[mixed]`. `chains[i]` is the chain of
/// `segments[i]`, whole and ending in `[s<i>];`. A track that leaves its clips as they are and
/// keys no duck adds no filter at all, so a default mix is one `amix` of every clip.
pub(super) fn sound_graph(
    chains: &[String],
    segments: &[SoundSegment],
    mix: &SoundMix,
    total: u64,
) -> String {
    let mut graph = chains.concat();
    let mut by_track: BTreeMap<usize, Vec<String>> = BTreeMap::new();
    for (i, segment) in segments.iter().enumerate() {
        by_track
            .entry(segment.track)
            .or_default()
            .push(format!("[s{i}]"));
    }
    let spec_of = |track: usize| mix.tracks.get(track).unwrap_or(&UNCHANGED);
    let mut keys = duck_keys(&by_track, spec_of);
    let order = listened_first(&by_track, &mut keys);
    let length = samples((total + TAIL) as f64);
    let mut outputs: BTreeMap<usize, Vec<String>> = BTreeMap::new();
    for track in order {
        let Some(labels) = by_track.get(&track) else {
            continue;
        };
        let spec = spec_of(track);
        let heard_by: Vec<usize> = keys
            .iter()
            .filter(|(_, from)| from.contains(&track))
            .map(|(listener, _)| *listener)
            .collect();
        if *spec == TrackMixSpec::DEFAULT && heard_by.is_empty() {
            outputs.insert(track, labels.clone());
            continue;
        }
        let bus = Bus {
            track,
            labels,
            spec,
            keys: keys.get(&track).map_or(&[], Vec::as_slice),
            heard_by: &heard_by,
            length,
        };
        graph.push_str(&bus.text());
        outputs.insert(track, vec![format!("[t{track}]")]);
    }
    let outputs: Vec<String> = outputs.into_values().flatten().collect();
    let end = seconds(total);
    let mut master = String::new();
    if mix.master.gain != 1.0 {
        master.push_str(&format!(",volume={:.6}", mix.master.gain));
    }
    let effects: String = mix.master.effects.iter().map(effect_filter).collect();
    if !effects.is_empty() {
        master.push_str(&format!(",apad=whole_len={length}{effects}"));
    }
    graph.push_str(&format!(
        "{}amix=inputs={}:normalize=0:dropout_transition=0{master},apad=whole_dur={end},atrim=0:{end}[mixed]",
        outputs.concat(),
        outputs.len(),
    ));
    graph
}

/// The tracks each duck listens to, by the track it lowers: only tracks that sound, never its own.
/// A duck with none is left out, as a silent key lowers nothing.
fn duck_keys<'a>(
    tracks: &BTreeMap<usize, Vec<String>>,
    spec_of: impl Fn(usize) -> &'a TrackMixSpec,
) -> BTreeMap<usize, Vec<usize>> {
    let mut keys = BTreeMap::new();
    for &track in tracks.keys() {
        for effect in &spec_of(track).effects {
            let MixEffect::Duck(duck) = effect else {
                continue;
            };
            let mut from: Vec<usize> = duck
                .listens_to
                .iter()
                .copied()
                .filter(|&other| other != track && tracks.contains_key(&other))
                .collect();
            from.sort_unstable();
            from.dedup();
            if !from.is_empty() {
                keys.insert(track, from);
            }
        }
    }
    keys
}

/// The tracks in an order where each comes after those its duck listens to. The document refuses
/// a loop; should one come anyway, its first track loses its key rather than the graph its sense.
fn listened_first(
    tracks: &BTreeMap<usize, Vec<String>>,
    keys: &mut BTreeMap<usize, Vec<usize>>,
) -> Vec<usize> {
    let mut order: Vec<usize> = Vec::with_capacity(tracks.len());
    let mut left: Vec<usize> = tracks.keys().copied().collect();
    while !left.is_empty() {
        let ready = left.iter().position(|track| {
            keys.get(track)
                .is_none_or(|from| from.iter().all(|other| order.contains(other)))
        });
        let at = ready.unwrap_or_else(|| {
            keys.remove(&left[0]);
            0
        });
        order.push(left.remove(at));
    }
    order
}

/// One track's bus, as `[t<track>]`, plus a `[k<track>_<listener>]` for each duck it keys.
struct Bus<'a> {
    track: usize,
    labels: &'a [String],
    spec: &'a TrackMixSpec,
    /// The tracks its own duck listens to.
    keys: &'a [usize],
    /// The tracks whose ducks listen to it.
    heard_by: &'a [usize],
    /// Samples a chain with effects is padded to.
    length: u64,
}

impl Bus<'_> {
    /// The clips summed, then the effects in order, the pan and the level, as the preview's bus.
    fn text(&self) -> String {
        let Bus { track, spec, .. } = *self;
        let mut text = sum(self.labels);
        if !spec.effects.is_empty() {
            text.push_str(&format!(",apad=whole_len={}", self.length));
        }
        for effect in &spec.effects {
            match effect {
                MixEffect::Duck(duck) if !self.keys.is_empty() => {
                    text.push_str(&format!("[main{track}];"));
                    text.push_str(&self.key());
                    text.push_str(&format!("[main{track}][key{track}]{}", duck_filter(duck)));
                }
                other => text.push_str(&effect_filter(other)),
            }
        }
        if spec.pan != 0.0 {
            text.push_str(&pan_filter(spec.pan));
        }
        if spec.gain != 1.0 {
            text.push_str(&format!(",volume={:.6}", spec.gain));
        }
        if self.heard_by.is_empty() {
            text.push_str(&format!("[t{track}];"));
            return text;
        }
        text.push_str(&format!(",asplit={}[t{track}]", self.heard_by.len() + 1));
        for listener in self.heard_by {
            text.push_str(&format!("[k{track}_{listener}]"));
        }
        text.push(';');
        text
    }

    /// The key of this track's duck: the tracks it listens to, summed, as long as the track.
    fn key(&self) -> String {
        let track = self.track;
        let inputs: Vec<String> = self
            .keys
            .iter()
            .map(|from| format!("[k{from}_{track}]"))
            .collect();
        format!(
            "{},apad=whole_len={}[key{track}];",
            sum(&inputs),
            self.length
        )
    }
}

/// Labels summed: one passes as it is.
fn sum(labels: &[String]) -> String {
    match labels {
        [one] => format!("{one}anull"),
        _ => format!(
            "{}amix=inputs={}:normalize=0:dropout_transition=0",
            labels.concat(),
            labels.len()
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::export::mixeffects::{CompressorSpec, DuckSpec, LimiterSpec, MixEffect};
    use crate::export::recipe::{MasterMixSpec, segment as plain};

    fn segment(track: usize) -> SoundSegment {
        SoundSegment { track, ..plain() }
    }

    /// The chain of a segment that has no filters of its own.
    fn chain(i: usize) -> String {
        format!("[{i}:a]anull,adelay=0:all=1[s{i}];")
    }

    fn mix_of(tracks: &[TrackMixSpec], master: f64) -> SoundMix {
        SoundMix {
            tracks: tracks.to_vec(),
            master: MasterMixSpec {
                gain: master,
                effects: Vec::new(),
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
    fn master_volume_comes_last() {
        let graph = sound_graph(
            &[chain(0)],
            &[segment(0)],
            &mix_of(&[TrackMixSpec::DEFAULT], 2.0),
            1_000_000,
        );
        let volume = graph.find("volume=2.000000").unwrap();
        assert!(graph.find("amix=").unwrap() < volume, "{graph}");
        assert!(volume < graph.find("apad").unwrap(), "{graph}");
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
            graph.contains("sidechaincompress=threshold=-40dB:ratio=20:attack=20:release=300:detection=peak:mix="),
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
            graph.contains("alimiter=limit=-1dB:attack=5:release=50:level=disabled,apad=whole_dur=1.000000,atrim"),
            "{graph}"
        );
        assert!(graph.find("volume=2.000000").unwrap() < graph.find("alimiter").unwrap());
        assert_wired(&graph);
    }
}
