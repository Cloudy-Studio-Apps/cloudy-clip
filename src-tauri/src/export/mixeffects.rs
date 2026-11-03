//! The effects of a track's or the master's chain as FFmpeg filters, with the parameters the
//! preview's ports assume, so export matches them sample for sample (checked in
//! docs/superpowers/specs/2026-11-03-sound-dynamics-check.md). Ducking needs a key, so
//! `mixgraph` wires it; every other kind is one piece of a chain here.

use serde::Deserialize;

use super::recipe::EqFilter;
use super::soundfilters::eq_filters;

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

/// `sidechaincompress` keyed by the sum of other tracks after their faders.
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DuckSpec {
    /// Indexes into `SoundMix::tracks`.
    pub listens_to: Vec<usize>,
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
        MixEffect::Limiter(l) => format!(
            ",alimiter=limit={}dB:attack={LIMITER_LOOKAHEAD_MS}:release={}:level=disabled",
            l.ceiling_db, l.release_ms
        ),
        MixEffect::Duck(_) => String::new(),
    }
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
