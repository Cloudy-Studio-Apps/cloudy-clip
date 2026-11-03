//! The tree the sound is mixed in, as the preview's buses are: a track's clips are summed, the
//! track's level and pan apply to that sum, the tracks are summed, and the master's level applies
//! to the result.

use std::collections::BTreeMap;

use super::recipe::{SoundMix, SoundSegment, TrackMixSpec, seconds};
use super::soundfilters::pan_filter;

/// The mixed sound as a filter graph, whose output is `[mixed]`. `chains[i]` is the chain of
/// `segments[i]`, whole and ending in `[s<i>];`. A track that leaves its clips as they are adds no
/// filter at all, so a default mix is one `amix` of every clip.
pub(super) fn sound_graph(
    chains: &[String],
    segments: &[SoundSegment],
    mix: &SoundMix,
    total: u64,
) -> String {
    let mut graph = chains.concat();
    let mut by_track: BTreeMap<usize, Vec<usize>> = BTreeMap::new();
    for (i, segment) in segments.iter().enumerate() {
        by_track.entry(segment.track).or_default().push(i);
    }
    let mut outputs: Vec<String> = Vec::new();
    for (track, members) in by_track {
        let spec = mix
            .tracks
            .get(track)
            .copied()
            .unwrap_or(TrackMixSpec::DEFAULT);
        let labels: Vec<String> = members.iter().map(|i| format!("[s{i}]")).collect();
        if spec == TrackMixSpec::DEFAULT {
            outputs.extend(labels);
            continue;
        }
        graph.push_str(&track_bus(track, &labels, spec));
        outputs.push(format!("[t{track}]"));
    }
    let end = seconds(total);
    let master = match mix.master.gain {
        gain if gain != 1.0 => format!(",volume={gain:.6}"),
        _ => String::new(),
    };
    graph.push_str(&format!(
        "{}amix=inputs={}:normalize=0:dropout_transition=0{master},apad=whole_dur={end},atrim=0:{end}[mixed]",
        outputs.concat(),
        outputs.len(),
    ));
    graph
}

/// One track's clips summed, then its level and its pan, as `[t<track>]`.
fn track_bus(track: usize, labels: &[String], spec: TrackMixSpec) -> String {
    let sum = match labels {
        [one] => format!("{one}anull"),
        _ => format!(
            "{}amix=inputs={}:normalize=0:dropout_transition=0",
            labels.concat(),
            labels.len()
        ),
    };
    let mut chain = sum;
    if spec.gain != 1.0 {
        chain.push_str(&format!(",volume={:.6}", spec.gain));
    }
    if spec.pan != 0.0 {
        chain.push_str(&pan_filter(spec.pan));
    }
    format!("{chain}[t{track}];")
}

#[cfg(test)]
mod tests {
    use super::*;
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
            master: MasterMixSpec { gain: master },
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
            pan: 0.0,
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
            pan: 0.0,
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
}
