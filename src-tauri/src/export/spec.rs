//! The spec of an export as the frontend describes it: formats, sound segments, the mix and the
//! stems, with the checks that refuse a request FFmpeg could not honour.

use serde::Deserialize;

use super::mixeffects::MixEffect;

/// Rate the sound is mixed at, whatever the file's rate: the mix is resampled to
/// `ExportSpec::sample_rate` on the way out.
pub(super) const SAMPLE_RATE: u32 = 48_000;

/// What the file holds and how it is compressed.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Format {
    H264,
    H265,
    Webm,
    Prores,
    Gif,
    Mp3,
    Wav,
    Flac,
    Aac,
    Opus,
}

impl Format {
    /// Whether frames are sent. A sound-only export has none.
    pub fn has_picture(self) -> bool {
        !matches!(
            self,
            Format::Mp3 | Format::Wav | Format::Flac | Format::Aac | Format::Opus
        )
    }

    pub(super) fn has_sound(self) -> bool {
        self != Format::Gif
    }
}

/// How long the encoder works on each frame.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Effort {
    Fast,
    Balanced,
    Small,
}

/// A value at a moment of a segment (or of the export, for a track's line). All times are
/// microseconds from its start.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
pub struct EnvelopePoint {
    pub at: u64,
    pub value: f64,
}

/// One stretch of a file's sound on the export's clock. All times are microseconds.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundSegment {
    pub path: String,
    /// Where it starts in the export.
    pub at: u64,
    /// Where it starts in the file.
    pub from: u64,
    pub duration: u64,
    /// The top-level track it sounds through: an index into `ExportSpec::mix.tracks`.
    #[serde(default)]
    pub track: usize,
    pub fade_in: u64,
    pub fade_out: u64,
    /// One channel, played on both sides at full level as the preview does.
    #[serde(default)]
    pub mono: bool,
    /// Linear level, the clip's volume.
    #[serde(default = "one")]
    pub gain: f64,
    /// -1 (left) to 1 (right).
    #[serde(default)]
    pub pan: f64,
    /// Linear level over the segment, a keyed volume. Replaces `gain` when it has points.
    #[serde(default)]
    pub gain_envelope: Vec<EnvelopePoint>,
    /// Pan over the segment, a keyed pan. Replaces `pan` when it has points.
    #[serde(default)]
    pub pan_envelope: Vec<EnvelopePoint>,
    #[serde(default)]
    pub eq: Vec<EqFilter>,
    /// Shift in semitones, keeping the length.
    #[serde(default)]
    pub pitch: f64,
    /// How fast it plays. `duration` is its length in the export, this many times that of the file.
    #[serde(default = "one")]
    pub speed: f64,
    /// Keeps voices at their pitch at another speed.
    #[serde(default = "yes")]
    pub keep_pitch: bool,
    /// Plays its part of the file backwards.
    #[serde(default)]
    pub reversed: bool,
    /// A ramped clip's sound, as stretches of one tempo each, in file order. Replaces `speed`.
    #[serde(default)]
    pub tempo_steps: Vec<TempoStep>,
}

/// A stretch of a ramped segment played at one tempo. All times are microseconds.
#[derive(Debug, Clone, Copy, Deserialize)]
pub struct TempoStep {
    /// Where it starts in the file.
    pub from: u64,
    /// Its length in the export.
    pub duration: u64,
    /// How fast it plays: its part of the file over `duration`.
    pub speed: f64,
}

fn one() -> f64 {
    1.0
}

fn yes() -> bool {
    true
}

/// The shape of an equalizer band.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum EqKind {
    Bell,
    LowShelf,
    HighShelf,
    LowCut,
    HighCut,
}

/// One band of a clip's equalizer that changes the sound.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq)]
pub struct EqFilter {
    pub kind: EqKind,
    pub hz: f64,
    pub db: f64,
    pub q: f64,
}

/// How a track mixes its clips: its effects, then a pan and a level, on their sum.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct TrackMixSpec {
    /// Linear level.
    #[serde(default = "one")]
    pub gain: f64,
    /// -1 (left) to 1 (right).
    #[serde(default)]
    pub pan: f64,
    /// The effects before the pan and the level, in order.
    #[serde(default)]
    pub effects: Vec<MixEffect>,
    /// Linear level over the export, the track's volume line with the fader on top; `at` counts
    /// from the export's start. Replaces `gain` when it has points.
    #[serde(default, rename = "gainEnvelope")]
    pub gain_envelope: Vec<EnvelopePoint>,
    /// The group it sends to, an index into `SoundMix::buses`; none (or one not there) is the master.
    #[serde(default)]
    pub bus: Option<usize>,
}

impl TrackMixSpec {
    /// Leaves the sound as it is.
    pub const DEFAULT: TrackMixSpec = TrackMixSpec {
        gain: 1.0,
        pan: 0.0,
        effects: Vec::new(),
        gain_envelope: Vec::new(),
        bus: None,
    };

    /// Whether its bus leaves the sum of its clips as it is (where it sends aside).
    pub fn is_plain(&self) -> bool {
        self.gain == 1.0
            && self.pan == 0.0
            && self.effects.is_empty()
            && self.gain_envelope.is_empty()
    }
}

/// A group track: the tracks sent to it summed, then its effects and level, into the master.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct BusMixSpec {
    /// Linear level.
    #[serde(default = "one")]
    pub gain: f64,
    /// A muted group adds nothing to the master and keys no duck.
    #[serde(default)]
    pub muted: bool,
    /// The effects before the level, in order.
    #[serde(default)]
    pub effects: Vec<MixEffect>,
}

/// The level of everything together (0 when the master is muted), its pan, then its effects.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct MasterMixSpec {
    /// Linear level.
    #[serde(default = "one")]
    pub gain: f64,
    /// Linear level over the export, the master's volume line with its fader on top, as a
    /// track's. Replaces `gain` when it has points.
    #[serde(default, rename = "gainEnvelope")]
    pub gain_envelope: Vec<EnvelopePoint>,
    /// -1 (left) to 1 (right): a balance of the stereo mix, with a track pan's law.
    #[serde(default)]
    pub pan: f64,
    /// The effects after the level and the pan, in order. A duck here is ignored: the document
    /// refuses one.
    #[serde(default)]
    pub effects: Vec<MixEffect>,
}

impl MasterMixSpec {
    /// Leaves the sound as it is.
    pub const DEFAULT: MasterMixSpec = MasterMixSpec {
        gain: 1.0,
        gain_envelope: Vec::new(),
        pan: 0.0,
        effects: Vec::new(),
    };
}

/// How the tracks mix: each track's effects, pan and level, then the groups' effects and level,
/// then the master's level, pan and effects.
#[derive(Debug, Clone, Deserialize, PartialEq)]
pub struct SoundMix {
    pub tracks: Vec<TrackMixSpec>,
    /// The groups, between the tracks sent to them and the master.
    #[serde(default)]
    pub buses: Vec<BusMixSpec>,
    pub master: MasterMixSpec,
}

impl SoundMix {
    /// `tracks` tracks that leave the sound as it is, under a master that does the same.
    pub fn default_for(tracks: usize) -> Self {
        SoundMix {
            tracks: vec![TrackMixSpec::DEFAULT; tracks],
            buses: Vec::new(),
            master: MasterMixSpec::DEFAULT,
        }
    }
}

impl Default for SoundMix {
    fn default() -> Self {
        SoundMix::default_for(0)
    }
}

/// One export, as the frontend describes it.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSpec {
    pub output: String,
    pub format: Format,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    /// Length of the export, microseconds.
    pub duration: u64,
    /// Constant-quality value of the format's encoder: lower is sharper.
    pub crf: u32,
    /// Sound bitrate, kbit/s.
    pub audio_kbps: u32,
    /// Sample rate of a sound-only file: 44100 or 48000. A format with a picture is at 48000, and
    /// Opus always is.
    #[serde(default = "default_rate")]
    pub sample_rate: u32,
    /// Bits per sample of WAV and FLAC: 16 (the default) or 24.
    #[serde(default)]
    pub bit_depth: Option<u32>,
    pub effort: Effort,
    pub hardware: bool,
    pub sound: Vec<SoundSegment>,
    /// How the tracks the sound comes from mix.
    #[serde(default)]
    pub mix: SoundMix,
    /// Files written besides `output`, the mix, by the same FFmpeg: a sound-only export only.
    #[serde(default)]
    pub stems: Vec<StemSpec>,
}

/// The sound of an export without a file: what an analysis measures, the mix of `sound` under
/// `mix` for `duration` microseconds (`recipe::measure_arguments`).
#[derive(Debug, Clone, Deserialize)]
pub struct SoundOnlySpec {
    pub duration: u64,
    pub sound: Vec<SoundSegment>,
    #[serde(default)]
    pub mix: SoundMix,
}

/// A stem: what one group, or every track sent straight to the master (`bus` none, "Other"),
/// adds to the mix, taken before the master's level and effects.
#[derive(Debug, Clone, Deserialize)]
pub struct StemSpec {
    pub output: String,
    /// The group, an index into `SoundMix::buses`; none is the tracks sent to the master.
    #[serde(default)]
    pub bus: Option<usize>,
}

fn default_rate() -> u32 {
    SAMPLE_RATE
}

impl ExportSpec {
    /// Refuses a rate or a depth the formats don't take, and stems of a format with a picture,
    /// of a group that isn't there, or twice the same, and stems of no sound.
    pub fn check(&self) -> Result<(), String> {
        if !self.stems.is_empty() && self.format.has_picture() {
            return Err("Stems are sound only: choose MP3, WAV, FLAC, AAC or Opus.".to_owned());
        }
        if !self.stems.is_empty() && self.sound.is_empty() {
            return Err("Stems need sound to split.".to_owned());
        }
        for (i, stem) in self.stems.iter().enumerate() {
            if stem.bus.is_some_and(|bus| bus >= self.mix.buses.len()) {
                return Err("A stem names a group the mix doesn't have.".to_owned());
            }
            if self.stems[..i].iter().any(|other| other.bus == stem.bus) {
                return Err("A stem is asked for twice.".to_owned());
            }
        }
        if !matches!(self.sample_rate, 44_100 | 48_000) {
            return Err(format!(
                "A sample rate of {} Hz can't be exported: use 44100 or 48000.",
                self.sample_rate
            ));
        }
        match self.bit_depth {
            None => Ok(()),
            Some(16 | 24) if matches!(self.format, Format::Wav | Format::Flac) => Ok(()),
            Some(depth) => Err(format!(
                "A bit depth of {depth} isn't available for this format: WAV and FLAC take 16 or 24."
            )),
        }
    }

    /// Whether the mix is cut down to 16 bits, and so dithered: WAV and FLAC unless 24-bit.
    pub(super) fn dithers(&self) -> bool {
        matches!(self.format, Format::Wav | Format::Flac) && self.bit_depth != Some(24)
    }

    /// Rate of the file's sound.
    pub(super) fn output_rate(&self) -> u32 {
        match self.format {
            Format::Opus => 48_000,
            format if format.has_picture() => SAMPLE_RATE,
            _ => self.sample_rate,
        }
    }
}

#[cfg(test)]
pub(super) fn segment() -> SoundSegment {
    SoundSegment {
        path: "/a.wav".into(),
        at: 0,
        from: 0,
        duration: 1_000_000,
        track: 0,
        fade_in: 0,
        fade_out: 0,
        mono: false,
        gain: 1.0,
        pan: 0.0,
        gain_envelope: Vec::new(),
        pan_envelope: Vec::new(),
        eq: Vec::new(),
        pitch: 0.0,
        speed: 1.0,
        keep_pitch: true,
        reversed: false,
        tempo_steps: Vec::new(),
    }
}
