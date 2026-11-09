//! A whole mix measured without playing it. The mix is the graph a Mix export runs
//! ([`crate::export::recipe::measure_arguments`], the same builder), its master output taken
//! through [`MEASURE`] to `-f null`; stems are never measured. The job is an export's
//! ([`crate::export::job::Job::measure`], run by [`super::analyses`]): the same cancel, the same
//! complaint when FFmpeg fails.
//!
//! What FFmpeg prints is heard line by line ([`Listening`]): the `ebur128` summary gives the
//! figures, each frame's peaks give the problems and the progress.
//!
//! - **Integrated** loudness (LUFS) is `None` when nothing is above `ebur128`'s absolute gate
//!   (−70 LUFS), a silent mix included: there is nothing to measure, never −inf as a number.
//! - **Range** is the loudness range (LU), 0 when there is nothing to measure.
//! - **True peak** (dBTP) is `None` for digital silence.
//! - A **peak** problem is a stretch of 100 ms frames whose true peak (each frame's peak at four
//!   times the mix's rate, as BS.1770 defines it) is over the peak limit. Adjacent frames over it
//!   merge into one stretch; its level is the highest frame's.
//! - A **clipped** problem is a stretch of frames with a sample at or over 0 dBFS, which a file of
//!   whole numbers cuts off. Measured in 32-bit float, so it is seen before it is cut. A clipped
//!   stretch is over any peak limit at or under 0 dBTP too, so it is also within a peak problem.

use serde::Serialize;

/// What is measured on the mix's master output: frames of 100 ms (`asetnsamples`, at the mix's
/// 48 kHz), so problems are placed to a tenth of a second; `ebur128` for the summary (its
/// `metadata=1` also turns its per-frame log down to verbose, so only the summary is printed);
/// each frame's sample peak (`astats`, reset every frame) printed by `ametadata@sample`; then the
/// same at 192 kHz, four times the rate, printed by `ametadata@true`. `ebur128`'s own per-frame
/// true peaks only ever grow, so they can't place a stretch.
pub(crate) const MEASURE: &str = concat!(
    "asetnsamples=n=4800:p=0,",
    "ebur128=peak=true:metadata=1,",
    "astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=Peak_level,",
    "ametadata@sample=mode=print:key=lavfi.astats.Overall.Peak_level,",
    "aresample=192000,",
    "astats=metadata=1:reset=1:measure_perchannel=none:measure_overall=Peak_level,",
    "ametadata@true=mode=print:key=lavfi.astats.Overall.Peak_level",
);

/// `ebur128` reports this when nothing passed its absolute gate.
const GATE_LUFS: f64 = -70.0;
/// A sample at or over this (dBFS) is cut off in a file of whole numbers.
const FULL_SCALE_DB: f64 = 0.0;

/// What kind of trouble a stretch is.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ProblemKind {
    /// True peak over the peak limit.
    Peak,
    /// A sample at or over 0 dBFS.
    Clipped,
}

/// A stretch of the mix in trouble. Times are microseconds from the mix's start.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct Problem {
    pub at: u64,
    pub duration: u64,
    pub kind: ProblemKind,
    /// The highest peak in it: dBTP for a peak, dBFS for a clip.
    pub level: f64,
}

/// The figures of a whole mix. See the module's notes for what each means.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Analysis {
    pub integrated: Option<f64>,
    pub range: f64,
    pub true_peak: Option<f64>,
    pub problems: Vec<Problem>,
}

/// Frames of one printer, merged into problem stretches as they come.
struct Stretches {
    kind: ProblemKind,
    /// The time of the frame whose value comes next.
    frame: Option<u64>,
    /// Where the stretch under way started, and its highest level.
    open: Option<(u64, f64)>,
    found: Vec<Problem>,
}

impl Stretches {
    fn new(kind: ProblemKind) -> Self {
        Self {
            kind,
            frame: None,
            open: None,
            found: Vec::new(),
        }
    }

    /// The frame at `at` measured `level`; `over` says whether that is trouble.
    fn measured(&mut self, at: u64, level: f64, over: bool) {
        match (&mut self.open, over) {
            (Some((_, highest)), true) => *highest = highest.max(level),
            (None, true) => self.open = Some((at, level)),
            (Some(_), false) => self.close(at),
            (None, false) => {}
        }
    }

    /// Ends the stretch under way at `end`.
    fn close(&mut self, end: u64) {
        if let Some((at, level)) = self.open.take() {
            self.found.push(Problem {
                at,
                duration: end.saturating_sub(at),
                kind: self.kind,
                level,
            });
        }
    }
}

/// What an analysis has heard so far, from FFmpeg's lines one at a time.
pub(crate) struct Listening {
    duration: u64,
    /// dBTP over which a frame's true peak is a problem.
    peak_limit: f64,
    clipped: Stretches,
    peaks: Stretches,
    /// Hundredths of the mix measured, as last reported.
    reported: u32,
    in_summary: bool,
    integrated: Option<f64>,
    range: Option<f64>,
    true_peak: Option<f64>,
}

/// A number FFmpeg printed as the first word of `text` (`-inf` included).
fn number(text: &str) -> Option<f64> {
    text.split_whitespace().next()?.parse().ok()
}

impl Listening {
    /// Listens to a mix `duration` (microseconds) long against `peak_limit` (dBTP).
    pub(crate) fn new(duration: u64, peak_limit: f64) -> Self {
        Self {
            duration,
            peak_limit,
            clipped: Stretches::new(ProblemKind::Clipped),
            peaks: Stretches::new(ProblemKind::Peak),
            reported: 0,
            in_summary: false,
            integrated: None,
            range: None,
            true_peak: None,
        }
    }

    /// Takes one line FFmpeg printed. Returns how much of the mix is measured, 0 to 1, each time
    /// that moves by a hundredth.
    pub(crate) fn hear(&mut self, line: &str) -> Option<f32> {
        if let Some(said) = line.strip_prefix("[ametadata@sample @ ") {
            let progress = self.frame_line(said, true);
            return progress;
        }
        if let Some(said) = line.strip_prefix("[ametadata@true @ ") {
            self.frame_line(said, false);
            return None;
        }
        if line.starts_with("[Parsed_ebur128") && line.ends_with("Summary:") {
            self.in_summary = true;
            return None;
        }
        if self.in_summary {
            let line = line.trim();
            if let Some(value) = line.strip_prefix("I:") {
                self.integrated = number(value);
            } else if let Some(value) = line.strip_prefix("LRA:") {
                self.range = number(value);
            } else if let Some(value) = line.strip_prefix("Peak:") {
                self.true_peak = number(value);
            }
        }
        None
    }

    /// A line of a frame printer (`said` is past its name): the frame's time, or its peak.
    fn frame_line(&mut self, said: &str, sample: bool) -> Option<f32> {
        let said = said.split_once("] ")?.1;
        let (peak_limit, stretches) = if sample {
            (FULL_SCALE_DB, &mut self.clipped)
        } else {
            (self.peak_limit, &mut self.peaks)
        };
        if let Some(value) = said.strip_prefix("lavfi.astats.Overall.Peak_level=") {
            let at = stretches.frame.take()?;
            let level = number(value)?;
            // A clip is at or over full scale; a peak is over its limit.
            let over = if sample {
                level >= peak_limit
            } else {
                level > peak_limit
            };
            stretches.measured(at, level, over);
            return None;
        }
        let seconds = number(said.split("pts_time:").nth(1)?)?;
        let at = (seconds.max(0.0) * 1_000_000.0).round() as u64;
        stretches.frame = Some(at);
        if !sample || self.duration == 0 {
            return None;
        }
        let hundredths = (at.min(self.duration) * 100 / self.duration) as u32;
        (hundredths > self.reported).then(|| {
            self.reported = hundredths;
            hundredths as f32 / 100.0
        })
    }

    /// The figures, once FFmpeg is done. Fails when it printed no summary.
    pub(crate) fn result(&mut self) -> Result<Analysis, String> {
        if !self.in_summary {
            return Err("FFmpeg measured nothing".to_owned());
        }
        self.clipped.close(self.duration);
        self.peaks.close(self.duration);
        let mut problems: Vec<Problem> = self.peaks.found.drain(..).collect();
        problems.append(&mut self.clipped.found);
        problems.sort_by_key(|problem| (problem.at, problem.kind == ProblemKind::Peak));
        let integrated = self.integrated.filter(|lufs| *lufs > GATE_LUFS);
        Ok(Analysis {
            integrated,
            range: integrated.and(self.range).unwrap_or(0.0),
            true_peak: self.true_peak.filter(|db| db.is_finite()),
            problems,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Everything FFmpeg printed measuring `output` through [`MEASURE`], against `peak_limit`.
    fn analyse(output: &str, duration: u64, peak_limit: f64) -> Analysis {
        let mut heard = Listening::new(duration, peak_limit);
        for line in output.lines() {
            heard.hear(line);
        }
        heard.result().unwrap()
    }

    // Captured from FFmpeg 9.0.2: 2 s of a 997 Hz sine at -20 dBFS, at -0.45 dBFS from 0.5 s to
    // 0.8 s and at +2.28 dBFS (over full scale) from 1.2 s to 1.4 s.
    const PEAKS: &str = include_str!("fixtures/peaks.txt");
    // Captured from FFmpeg 9.0.2: 1 s of digital silence.
    const SILENT: &str = include_str!("fixtures/silent.txt");

    #[test]
    fn the_summary_gives_the_figures() {
        let analysis = analyse(PEAKS, 2_000_000, -1.0);
        assert_eq!(analysis.integrated, Some(-2.5));
        assert_eq!(analysis.range, 0.0);
        assert_eq!(analysis.true_peak, Some(2.9));
    }

    #[test]
    fn a_silent_mix_has_nothing_to_measure() {
        let analysis = analyse(SILENT, 1_000_000, -1.0);
        assert_eq!(analysis.integrated, None);
        assert_eq!(analysis.true_peak, None);
        assert_eq!(analysis.range, 0.0);
        assert!(analysis.problems.is_empty());
        // Not -inf, nor a null the frontend would read as a number.
        let json = serde_json::to_value(&analysis).unwrap();
        assert!(json["integrated"].is_null() && json["truePeak"].is_null());
    }

    #[test]
    fn frames_over_the_limit_merge_into_stretches() {
        let analysis = analyse(PEAKS, 2_000_000, -1.0);
        let stretches: Vec<(ProblemKind, u64, u64)> = analysis
            .problems
            .iter()
            .map(|p| (p.kind, p.at, p.duration))
            .collect();
        // True peaks are read at 192 kHz, a third of a millisecond ahead of the samples.
        assert_eq!(
            stretches,
            [
                (ProblemKind::Peak, 499_667, 300_000),
                (ProblemKind::Peak, 1_199_667, 200_000),
                (ProblemKind::Clipped, 1_200_000, 200_000),
            ]
        );
        let levels: Vec<f64> = analysis.problems.iter().map(|p| p.level).collect();
        assert_eq!(levels, [-0.445472, 2.926755, 2.278867]);
    }

    #[test]
    fn a_stretch_still_over_at_the_end_runs_to_it() {
        let mut heard = Listening::new(300_000, -1.0);
        for line in [
            "[ametadata@true @ 0x1] frame:0    pts:0       pts_time:0",
            "[ametadata@true @ 0x1] lavfi.astats.Overall.Peak_level=-3.0",
            "[ametadata@true @ 0x1] frame:1    pts:19136   pts_time:0.1",
            "[ametadata@true @ 0x1] lavfi.astats.Overall.Peak_level=-0.5",
            "[ametadata@true @ 0x1] frame:2    pts:38336   pts_time:0.2",
            "[ametadata@true @ 0x1] lavfi.astats.Overall.Peak_level=-0.2",
            "[Parsed_ebur128_2 @ 0x2] Summary:",
        ] {
            heard.hear(line);
        }
        let problems = heard.result().unwrap().problems;
        assert_eq!(
            problems,
            [Problem {
                at: 100_000,
                duration: 200_000,
                kind: ProblemKind::Peak,
                level: -0.2
            }]
        );
    }
}
