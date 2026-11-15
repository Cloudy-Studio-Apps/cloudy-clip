//! The tree the sound is mixed in, as the preview's buses are: a track's clips are summed, the
//! track's effects, pan and level (its volume line, when it has one) apply to that sum; the tracks
//! sent to a group are summed and the group's effects and level apply to that, built by the same
//! `Bus` as a track; the tracks sent to the master and the groups are summed, and the master's
//! level (its volume line, when it has one) and pan, then its effects, apply to the result. A
//! muted group adds nothing. A duck's key is the sum of the tracks and groups it listens to after
//! their levels, split off them (`asplit`); those are built first.

use std::collections::{BTreeMap, BTreeSet};

use super::mixeffects::{MixEffect, duck_filter, effect_filter};
use super::recipe::seconds;
use super::soundfilters::{gain_envelope_filter, pan_filter, samples};
use super::spec::{SAMPLE_RATE, SoundMix, SoundSegment, TrackMixSpec};

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
    // The master's level (its line, when it has one), then its pan, as a track bus's; a
    // correction is folded in, after the stems are split off.
    let spec = mix.master.corrected();
    let mut master = String::new();
    if !spec.gain_envelope.is_empty() {
        master.push_str(&gain_envelope_filter(&spec.gain_envelope));
    } else if spec.gain != 1.0 {
        master.push_str(&format!(",volume={:.6}", spec.gain));
    }
    if spec.pan != 0.0 {
        master.push_str(&pan_filter(spec.pan));
    }
    let effects: String = spec.effects.iter().map(effect_filter).collect();
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
#[path = "mixgraph_tests.rs"]
mod tests;
