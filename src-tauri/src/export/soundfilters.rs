//! The FFmpeg filters of one clip's sound: tempo, pitch, equalizer, pan and keyed volume and pan.
//! Each builds a piece of a segment's chain; `recipe` assembles the segments and `mixgraph` mixes
//! them.

use super::recipe::{EnvelopePoint, EqFilter, EqKind, SAMPLE_RATE, SoundSegment};

/// Timeline time each tempo step reads ahead of its end. `atempo` gives a few milliseconds more
/// or less than its input over its tempo, so each step reads ahead and is cut to its exact length:
/// the steps stay in step with the picture, with no silence between them.
pub(super) const STEP_LEAD: u64 = 100_000;

/// Samples of the mixed sound in `micros`.
pub(super) fn samples(micros: f64) -> u64 {
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
pub(super) const STEP_CROSSFADE: u64 = 5_000;

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
pub(super) fn pan_filter(pan: f64) -> String {
    let (ll, rl, lr, rr) = pan_gains(pan);
    if pan <= 0.0 {
        format!(",pan=stereo|c0=c0+{rl:.6}*c1|c1={rr:.6}*c1")
    } else {
        format!(",pan=stereo|c0={ll:.6}*c0|c1=c1+{lr:.6}*c0")
    }
}

/// A number for an expression, short because an envelope may have hundreds of them.
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
/// than 100 levels, which a chain of hundreds would.
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
pub(super) fn gain_envelope_filter(points: &[EnvelopePoint]) -> String {
    let expr = envelope_expr(&timed(points, |v| v));
    format!(",volume=eval=frame:volume='{expr}'")
}

/// A pan that follows an envelope. The sound is split in two channels, each goes to both sides
/// with the gain the pan law gives at that moment, and the sides are joined again. `n` keeps the
/// labels of one segment apart from the others'.
pub(super) fn pan_envelope_filter(n: usize, points: &[EnvelopePoint]) -> String {
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
pub(super) fn effects(n: usize, segment: &SoundSegment) -> String {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::export::recipe::segment;

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

    #[test]
    fn pan_gains_are_the_law_of_pan_filter() {
        let (ll, rl, lr, rr) = pan_gains(0.0);
        assert!((ll - 1.0).abs() < 1e-9 && rl.abs() < 1e-9 && lr == 0.0 && (rr - 1.0).abs() < 1e-9);
        let (ll, rl, lr, rr) = pan_gains(-1.0);
        assert!((ll - 1.0).abs() < 1e-9 && (rl - 1.0).abs() < 1e-9 && lr == 0.0 && rr.abs() < 1e-9);
        let (ll, rl, lr, rr) = pan_gains(1.0);
        assert!(ll.abs() < 1e-9 && rl == 0.0 && (lr - 1.0).abs() < 1e-9 && (rr - 1.0).abs() < 1e-9);
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
}
