//! The effects of a track's or the master's chain as FFmpeg filters, with the parameters the
//! preview's ports assume, so export matches them sample for sample (checked in
//! docs/superpowers/specs/2026-11-03-sound-dynamics-check.md). Ducking needs a key, so
//! `mixgraph` wires it; every other kind is one piece of a chain here.

use serde::Deserialize;

use super::soundfilters::eq_filters;
use super::spec::EqFilter;

/// One effect that changes the sound. Off effects and noise reduction never reach the export.
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MixEffect {
    /// The bands of an equalizer that change the sound.
    Eq {
        bands: Vec<EqFilter>,
    },
    Compressor {
        params: CompressorSpec,
    },
    Gate(GateSpec),
    Deesser(DeesserSpec),
    Limiter(LimiterSpec),
    Duck(DuckSpec),
}

/// `acompressor`, in dB and milliseconds.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CompressorSpec {
    pub threshold_db: f64,
    pub ratio: f64,
    pub attack_ms: f64,
    pub release_ms: f64,
    pub knee_db: f64,
    pub makeup_db: f64,
}

/// `agate`, at its default knee and range.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GateSpec {
    pub threshold_db: f64,
    pub ratio: f64,
    pub attack_ms: f64,
    pub release_ms: f64,
}

/// `deesser`: where sibilance sits and how much is taken away (0 to 1).
#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DeesserSpec {
    pub frequency_hz: f64,
    pub amount: f64,
}

/// `alimiter` with a 5 ms lookahead.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LimiterSpec {
    pub ceiling_db: f64,
    pub release_ms: f64,
}

/// `sidechaincompress` keyed by the sum of other tracks and groups after their faders.
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DuckSpec {
    /// Indexes into `SoundMix::tracks`.
    pub listens_to: Vec<usize>,
    /// Indexes into `SoundMix::buses`.
    #[serde(default)]
    pub listens_to_buses: Vec<usize>,
    pub depth_db: f64,
    pub attack_ms: f64,
    pub release_ms: f64,
}

/// Ducking's threshold and ratio, fixed (`DUCK_THRESHOLD_DB`, `DUCK_RATIO` in the preview).
const DUCK_THRESHOLD_DB: f64 = -40.0;
const DUCK_RATIO: f64 = 20.0;

/// FFmpeg `deesser`'s `m`, the port's `DEESSER_MAX`.
const DEESSER_MAX: f64 = 0.5;

/// The limiter's lookahead in ms, the port's `LIMITER_LOOKAHEAD_MS`.
const LIMITER_LOOKAHEAD_MS: f64 = 5.0;

/// The filter of an effect, starting with a comma; empty for a duck, which `mixgraph` wires.
/// Numbers are written in full (`{}` is the shortest text that reads back as the same double).
pub(super) fn effect_filter(effect: &MixEffect) -> String {
    match effect {
        MixEffect::Eq { bands } => eq_filters(bands),
        MixEffect::Compressor { params: c } => format!(
            ",acompressor=threshold={}dB:ratio={}:attack={}:release={}:knee={}dB:makeup={}dB:detection=peak",
            c.threshold_db, c.ratio, c.attack_ms, c.release_ms, c.knee_db, c.makeup_db
        ),
        MixEffect::Gate(g) => format!(
            ",agate=threshold={}dB:ratio={}:attack={}:release={}:detection=peak",
            g.threshold_db, g.ratio, g.attack_ms, g.release_ms
        ),
        MixEffect::Deesser(d) => format!(
            ",deesser=i={}:m={DEESSER_MAX}:f={}",
            d.amount,
            deesser_frequency(d.frequency_hz)
        ),
        MixEffect::Limiter(l) => limiter_filter(l),
        MixEffect::Duck(_) => String::new(),
    }
}

/// Taps per phase of the 4x interpolator, the preview's `TAPS` (`logic/truepeak.ts`).
const TRUE_PEAK_TAPS: usize = 32;

/// The modified Bessel function of the first kind, order 0, as the preview's `besselI0`.
fn bessel_i0(x: f64) -> f64 {
    let mut sum = 1.0;
    let mut term = 1.0;
    for k in 1..=30 {
        let r = x / (2.0 * f64::from(k));
        term *= r * r;
        sum += term;
    }
    sum
}

/// The in-between phase `phase` (1 to 3) of the 4x interpolator, as the preview's `PHASES`:
/// FFmpeg's resampler filter (Kaiser-windowed sinc, beta 9), summing to 1; a tap `k` reads the
/// sample `k` back.
fn true_peak_phase(phase: u32) -> Vec<f64> {
    let half = (TRUE_PEAK_TAPS / 2) as f64;
    let taps: Vec<f64> = (0..TRUE_PEAK_TAPS)
        .map(|k| {
            let d = half - f64::from(phase) / 4.0 - k as f64;
            let w = d / half;
            let x = std::f64::consts::PI * d;
            x.sin() / x * bessel_i0(9.0 * (1.0 - w * w).max(0.0).sqrt())
        })
        .collect();
    let sum: f64 = taps.iter().sum();
    taps.iter().map(|tap| tap / sum).collect()
}

/// `alimiter` listening for true peaks, as the preview's `truePeakLimiterStep`: the two channels
/// become eight (`pan`); `aiir` (direct form, in doubles) delays the first two by half the
/// interpolator and turns the others into its three in-between phases; `alimiter` gives all eight
/// one gain from their largest; the delayed two go on.
fn limiter_filter(l: &LimiterSpec) -> String {
    let mut delay = vec!["0"; TRUE_PEAK_TAPS / 2];
    delay.push("1");
    let delay = delay.join(" ");
    let mut zeros = vec![delay.clone(), delay];
    for phase in 1..=3 {
        let taps: Vec<String> = true_peak_phase(phase).iter().map(f64::to_string).collect();
        let taps = taps.join(" ");
        zeros.push(taps.clone());
        zeros.push(taps);
    }
    // The input is always stereo: recipe.rs makes every segment stereo before any bus.
    format!(
        ",pan=7.1|c0=c0|c1=c1|c2=c0|c3=c1|c4=c0|c5=c1|c6=c0|c7=c1,aiir=z={}:p=1:f=tf:r=d:n=0,\
         alimiter=limit={}dB:attack={LIMITER_LOOKAHEAD_MS}:release={}:level=disabled,\
         pan=stereo|c0=c0|c1=c1",
        zeros.join("|"),
        l.ceiling_db,
        l.release_ms
    )
}

/// `sidechaincompress` for a duck, between its main input and its key.
pub(super) fn duck_filter(duck: &DuckSpec) -> String {
    format!(
        "sidechaincompress=threshold={DUCK_THRESHOLD_DB}dB:ratio={DUCK_RATIO}:attack={}:release={}:detection=peak:mix={}",
        duck.attack_ms,
        duck.release_ms,
        duck_mix(duck.depth_db)
    )
}

/// `mix` that holds a duck to its depth: the output is `in × (gain × mix + 1 − mix)`.
fn duck_mix(depth_db: f64) -> f64 {
    1.0 - 10f64.powf(depth_db / 20.0)
}

/// FFmpeg `deesser`'s `f` for a frequency, the port's `deesserFrequency`.
fn deesser_frequency(hz: f64) -> f64 {
    (1.0 - (-2.0 * std::f64::consts::PI * hz / 22050.0).exp()).sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_limiter_listens_for_true_peaks() {
        let filter = effect_filter(&MixEffect::Limiter(LimiterSpec {
            ceiling_db: -1.0,
            release_ms: 50.0,
        }));
        let (head, rest) = filter.split_once(",aiir=z=").unwrap();
        assert_eq!(
            head,
            ",pan=7.1|c0=c0|c1=c1|c2=c0|c3=c1|c4=c0|c5=c1|c6=c0|c7=c1"
        );
        let (zeros, tail) = rest.split_once(':').unwrap();
        assert_eq!(
            tail,
            "p=1:f=tf:r=d:n=0,alimiter=limit=-1dB:attack=5:release=50:level=disabled,pan=stereo|c0=c0|c1=c1"
        );
        let sets: Vec<Vec<f64>> = zeros
            .split('|')
            .map(|set| set.split(' ').map(|n| n.parse().unwrap()).collect())
            .collect();
        assert_eq!(sets.len(), 8);
        assert_eq!(sets[0].len(), 17);
        assert_eq!(sets[0][16], 1.0);
        assert_eq!(sets[0].iter().sum::<f64>(), 1.0);
        assert_eq!(sets[1], sets[0]);
        // The halfway phase is symmetric, and each phase passes a constant unchanged.
        assert_eq!(sets[4], sets[4].iter().rev().copied().collect::<Vec<_>>());
        for set in &sets[2..] {
            assert_eq!(set.len(), 32);
            assert!((set.iter().sum::<f64>() - 1.0).abs() < 1e-12, "{set:?}");
        }
    }

    #[test]
    fn every_kind_reads_as_the_frontend_writes_it() {
        let json = r#"[
            {"kind":"eq","bands":[{"kind":"bell","hz":500,"db":-2,"q":1}]},
            {"kind":"compressor","params":{"thresholdDb":-18,"ratio":4,"attackMs":20,"releaseMs":250,"kneeDb":9,"makeupDb":0}},
            {"kind":"gate","thresholdDb":-30,"ratio":2,"attackMs":10,"releaseMs":200},
            {"kind":"deesser","frequencyHz":6500,"amount":0.5},
            {"kind":"limiter","ceilingDb":-1,"releaseMs":50},
            {"kind":"duck","listensTo":[0,2],"depthDb":-12,"attackMs":20,"releaseMs":300}
        ]"#;
        let effects: Vec<MixEffect> = serde_json::from_str(json).unwrap();
        assert_eq!(effects.len(), 6);
        assert!(matches!(&effects[5], MixEffect::Duck(d) if d.listens_to == [0, 2]));
    }
}
