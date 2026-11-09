//! The tree the sound is mixed in, as the preview's buses are: a track's clips are summed, the
//! track's effects, pan and level (its volume line, when it has one) apply to that sum; the tracks
//! sent to a group are summed and the group's effects and level apply to that, built by the same
//! `Bus` as a track; the tracks sent to the master and the groups are summed, and the master's
//! level (its volume line, when it has one) and pan, then its effects, apply to the result. A
//! muted group adds nothing. A duck's key is the sum of the tracks and groups it listens to after
//! their levels, split off them (`asplit`); those are built first.

use std::collections::{BTreeMap, BTreeSet};

use super::mixeffects::{MixEffect, duck_filter, effect_filter};
use super::recipe::{SAMPLE_RATE, SoundMix, SoundSegment, TrackMixSpec, seconds};
use super::soundfilters::{gain_envelope_filter, pan_filter, samples};

/// Time a chain with effects runs on in silence past the end, as the preview's effects run on
/// after the sound stops: a limiter gives back its lookahead, and a duck never ends before its
/// key has caught up. The master's `atrim` cuts it.
const TAIL: u64 = 100_000;

/// What a track missing from the mix does: nothing.
static UNCHANGED: TrackMixSpec = TrackMixSpec::DEFAULT;

/// A bus of the tree: a track, or a group. Tracks sort before groups.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Node {
    Track(usize),
    Group(usize),
}

impl Node {
    /// Its output's label, without brackets: `t<n>` or `g<n>`.
    fn label(self) -> String {
        match self {
            Node::Track(i) => format!("t{i}"),
            Node::Group(i) => format!("g{i}"),
        }
    }
}

/// Where a bus's output goes.
#[derive(Debug, Clone, Copy, PartialEq)]
enum Dest {
    Master,
    Group(usize),
}

/// The mix as buses: their specs, where each sends, and which of them sound.
struct Tree<'a> {
    mix: &'a SoundMix,
    /// The groups as track specs (no pan, no line), so one `Bus` builds both.
    groups: Vec<TrackMixSpec>,
    /// The tracks with clips in the range (none of a muted group), and the groups with one of them
    /// sent to it.
    sounding: BTreeSet<Node>,
}

impl<'a> Tree<'a> {
    fn new(mix: &'a SoundMix, tracks: impl Iterator<Item = usize>) -> Self {
        let groups = mix
            .buses
            .iter()
            .map(|bus| TrackMixSpec {
                gain: bus.gain,
                effects: bus.effects.clone(),
                ..TrackMixSpec::DEFAULT
            })
            .collect();
        let mut tree = Tree {
            mix,
            groups,
            sounding: tracks.map(Node::Track).collect(),
        };
        let groups: Vec<Node> = tree
            .sounding
            .iter()
            .filter_map(|&node| match tree.dest(node) {
                Dest::Group(g) => Some(Node::Group(g)),
                _ => None,
            })
            .collect();
        tree.sounding.extend(groups);
        tree
    }

    fn spec(&self, node: Node) -> &TrackMixSpec {
        match node {
            Node::Track(i) => self.mix.tracks.get(i).unwrap_or(&UNCHANGED),
            Node::Group(i) => self.groups.get(i).unwrap_or(&UNCHANGED),
        }
    }

    /// A track goes to its group, or to the master when it has none or one that isn't there; a
    /// group goes to the master.
    fn dest(&self, node: Node) -> Dest {
        let Node::Track(_) = node else {
            return Dest::Master;
        };
        match self.spec(node).bus {
            Some(g) if g < self.mix.buses.len() => Dest::Group(g),
            _ => Dest::Master,
        }
    }

    /// The tracks sent to a group that sound.
    fn members(&self, group: usize) -> Vec<Node> {
        self.sounding
            .iter()
            .copied()
            .filter(|&node| self.dest(node) == Dest::Group(group))
            .collect()
    }

    /// What each bus's duck listens to: only buses that sound, never itself. A duck with none is
    /// left out, as a silent key lowers nothing.
    fn duck_keys(&self) -> BTreeMap<Node, Vec<Node>> {
        let mut keys = BTreeMap::new();
        for &node in &self.sounding {
            for effect in &self.spec(node).effects {
                let MixEffect::Duck(duck) = effect else {
                    continue;
                };
                let listened = duck.listens_to.iter().map(|&i| Node::Track(i));
                let groups = duck.listens_to_buses.iter().map(|&i| Node::Group(i));
                let mut from: Vec<Node> = listened
                    .chain(groups)
                    .filter(|other| *other != node && self.sounding.contains(other))
                    .collect();
                from.sort_unstable();
                from.dedup();
                if !from.is_empty() {
                    keys.insert(node, from);
                }
            }
        }
        keys
    }

    /// The buses in an order where each comes after those it listens to and, for a group, the
    /// tracks sent to it. The document refuses a loop; should one come anyway, the first bus in
    /// it with a key loses its key rather than the graph its sense.
    fn order(&self, keys: &mut BTreeMap<Node, Vec<Node>>) -> Vec<Node> {
        let mut order: Vec<Node> = Vec::with_capacity(self.sounding.len());
        let mut left: Vec<Node> = self.sounding.iter().copied().collect();
        let members: BTreeMap<Node, Vec<Node>> = left
            .iter()
            .filter_map(|&node| match node {
                Node::Group(g) => Some((node, self.members(g))),
                Node::Track(_) => None,
            })
            .collect();
        while !left.is_empty() {
            let done = |others: Option<&Vec<Node>>| {
                others.is_none_or(|others| others.iter().all(|other| order.contains(other)))
            };
            let ready = left
                .iter()
                .position(|node| done(keys.get(node)) && done(members.get(node)));
            if let Some(at) = ready {
                order.push(left.remove(at));
                continue;
            }
            match left.iter().copied().find(|node| keys.contains_key(node)) {
                Some(node) => {
                    keys.remove(&node);
                }
                // Never: a group waits only on tracks, and a track only on keys.
                None => order.append(&mut left),
            }
        }
        order
    }
}

/// Whether a track sends to a muted group: it is silent and keys nothing, as a muted track.
fn in_muted_group(mix: &SoundMix, track: usize) -> bool {
    let bus = mix.tracks.get(track).and_then(|spec| spec.bus);
    bus.and_then(|g| mix.buses.get(g))
        .is_some_and(|group| group.muted)
}

/// The mixed sound as a filter graph, whose output is `[mixed]`. `chains[i]` is the chain of
/// `segments[i]`, whole and ending in `[s<i>];`. A bus that leaves its sum as it is and keys no
/// duck adds no filter at all, so a default mix is one `amix` of every clip. A muted group adds
/// nothing: the clips of its tracks are left out, as `mixdown` leaves out a muted track's (it
/// sends none; any that come are dropped here with their chains, the inputs left unread).
///
/// With `stems`, the graph also ends in `[stem<i>]` for each: what `stems[i]`'s group (or, for
/// none, every track sent straight to the master: "Other") sends to the master, split off before
/// the master's level and effects (`stem_taps`).
pub(super) fn sound_graph(
    chains: &[String],
    segments: &[SoundSegment],
    mix: &SoundMix,
    total: u64,
    stems: &[Option<usize>],
) -> String {
    let mut graph = String::new();
    let mut inputs: BTreeMap<Node, Vec<String>> = BTreeMap::new();
    for (i, segment) in segments.iter().enumerate() {
        if in_muted_group(mix, segment.track) {
            continue;
        }
        graph.push_str(&chains[i]);
        inputs
            .entry(Node::Track(segment.track))
            .or_default()
            .push(format!("[s{i}]"));
    }
    let tracks = inputs.keys().filter_map(|node| match node {
        Node::Track(i) => Some(*i),
        Node::Group(_) => None,
    });
    let tree = Tree::new(mix, tracks);
    let mut keys = tree.duck_keys();
    let order = tree.order(&mut keys);
    let length = samples((total + TAIL) as f64);
    let mut outputs: BTreeMap<Node, Vec<String>> = BTreeMap::new();
    for node in order {
        let labels = inputs.remove(&node).unwrap_or_default();
        let spec = tree.spec(node);
        let dest = tree.dest(node);
        let heard_by: Vec<Node> = keys
            .iter()
            .filter(|(_, from)| from.contains(&node))
            .map(|(listener, _)| *listener)
            .collect();
        let sent = if spec.is_plain() && heard_by.is_empty() {
            labels
        } else {
            let bus = Bus {
                node,
                labels: &labels,
                spec,
                keys: keys.get(&node).map_or(&[], Vec::as_slice),
                heard_by: &heard_by,
                length,
            };
            graph.push_str(&bus.text());
            vec![format!("[{}]", node.label())]
        };
        match dest {
            Dest::Master => outputs.entry(node).or_default().extend(sent),
            Dest::Group(g) => inputs.entry(Node::Group(g)).or_default().extend(sent),
        }
    }
    let end = seconds(total);
    let outputs: Vec<String> = if stems.is_empty() {
        outputs.into_values().flatten().collect()
    } else {
        stem_taps(&mut graph, outputs, stems, &end)
    };
    // The master's level (its line, when it has one), then its pan, as a track bus's.
    let mut master = String::new();
    if !mix.master.gain_envelope.is_empty() {
        master.push_str(&gain_envelope_filter(&mix.master.gain_envelope));
    } else if mix.master.gain != 1.0 {
        master.push_str(&format!(",volume={:.6}", mix.master.gain));
    }
    if mix.master.pan != 0.0 {
        master.push_str(&pan_filter(mix.master.pan));
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

/// Sums what each stem sends to the master and splits it: one copy into the master, the other
/// padded and cut to the export's length as `[stem<i>]`. A group's stem is the group's output, at
/// its level, whatever its values (a default group, whose tracks would go straight to the master,
/// is summed here all the same); Other's is the tracks sent to the master. A stem with nothing
/// sounding (a muted or empty group, every direct track muted) is silence of the same length.
/// Returns the master's inputs: the stems' copies, then whatever no stem takes.
fn stem_taps(
    graph: &mut String,
    outputs: BTreeMap<Node, Vec<String>>,
    stems: &[Option<usize>],
    end: &str,
) -> Vec<String> {
    let mut sent: BTreeMap<Option<usize>, Vec<String>> = BTreeMap::new();
    for (node, labels) in outputs {
        let stem = match node {
            Node::Group(g) => Some(g),
            Node::Track(_) => None,
        };
        sent.entry(stem).or_default().extend(labels);
    }
    let mut master = Vec::new();
    for (i, stem) in stems.iter().enumerate() {
        match sent.remove(stem) {
            Some(labels) => {
                graph.push_str(&format!(
                    "{},asplit=2[ms{i}][ps{i}];[ps{i}]apad=whole_dur={end},atrim=0:{end}[stem{i}];",
                    sum(&labels)
                ));
                master.push(format!("[ms{i}]"));
            }
            None => graph.push_str(&format!(
                "anullsrc=r={SAMPLE_RATE}:cl=stereo,atrim=0:{end}[stem{i}];"
            )),
        }
    }
    master.extend(sent.into_values().flatten());
    master
}

/// One bus, a track's or a group's, as `[t<n>]` / `[g<n>]`, plus a
/// `[k<bus>_<listener>]` for each duck it keys.
struct Bus<'a> {
    node: Node,
    labels: &'a [String],
    spec: &'a TrackMixSpec,
    /// The buses its own duck listens to.
    keys: &'a [Node],
    /// The buses whose ducks listen to it.
    heard_by: &'a [Node],
    /// Samples a chain with effects is padded to.
    length: u64,
}

impl Bus<'_> {
    /// The inputs summed, then the effects in order, the pan and the level, as the preview's bus.
    /// A volume line is the level: `t` after the sum counts from the export's start.
    fn text(&self) -> String {
        let Bus { spec, .. } = *self;
        let name = self.node.label();
        let mut text = sum(self.labels);
        if !spec.effects.is_empty() {
            text.push_str(&format!(",apad=whole_len={}", self.length));
        }
        for effect in &spec.effects {
            match effect {
                MixEffect::Duck(duck) if !self.keys.is_empty() => {
                    text.push_str(&format!("[main{name}];"));
                    text.push_str(&self.key());
                    text.push_str(&format!("[main{name}][key{name}]{}", duck_filter(duck)));
                }
                other => text.push_str(&effect_filter(other)),
            }
        }
        if spec.pan != 0.0 {
            text.push_str(&pan_filter(spec.pan));
        }
        if !spec.gain_envelope.is_empty() {
            text.push_str(&gain_envelope_filter(&spec.gain_envelope));
        } else if spec.gain != 1.0 {
            text.push_str(&format!(",volume={:.6}", spec.gain));
        }
        if self.heard_by.is_empty() {
            text.push_str(&format!("[{name}];"));
            return text;
        }
        text.push_str(&format!(",asplit={}[{name}]", self.heard_by.len() + 1));
        for listener in self.heard_by {
            text.push_str(&format!("[k{name}_{}]", listener.label()));
        }
        text.push(';');
        text
    }

    /// The key of this bus's duck: the buses it listens to, summed, as long as the export.
    fn key(&self) -> String {
        let name = self.node.label();
        let inputs: Vec<String> = self
            .keys
            .iter()
            .map(|from| format!("[k{}_{name}]", from.label()))
            .collect();
        format!(
            "{},apad=whole_len={}[key{name}];",
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
    use crate::export::recipe::{BusMixSpec, EnvelopePoint, MasterMixSpec, segment as plain};

    fn segment(track: usize) -> SoundSegment {
        SoundSegment { track, ..plain() }
    }

    /// The graph of a mix with no stems.
    fn sound_graph(
        chains: &[String],
        segments: &[SoundSegment],
        mix: &SoundMix,
        total: u64,
    ) -> String {
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
}
