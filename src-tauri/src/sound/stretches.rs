//! Frames of one printer merged into problem stretches, as they come.

use super::analyze::{Problem, ProblemKind};

/// Frames of one printer, merged into problem stretches as they come.
pub(super) struct Stretches {
    kind: ProblemKind,
    /// The time of the frame whose value comes next.
    pub(super) frame: Option<u64>,
    /// Where the stretch under way started, and its highest level.
    open: Option<(u64, f64)>,
    pub(super) found: Vec<Problem>,
}

impl Stretches {
    pub(super) fn new(kind: ProblemKind) -> Self {
        Self {
            kind,
            frame: None,
            open: None,
            found: Vec::new(),
        }
    }

    /// The frame at `at` measured `level`; `over` says whether that is trouble.
    pub(super) fn measured(&mut self, at: u64, level: f64, over: bool) {
        match (&mut self.open, over) {
            (Some((_, highest)), true) => *highest = highest.max(level),
            (None, true) => self.open = Some((at, level)),
            (Some(_), false) => self.close(at),
            (None, false) => {}
        }
    }

    /// Ends the stretch under way at `end`.
    pub(super) fn close(&mut self, end: u64) {
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
