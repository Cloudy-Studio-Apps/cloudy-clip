//! Sound module: what the Sound page asks of FFmpeg itself, and recording. Noise reduction is
//! rendered by the media module (a derived file, [`crate::media::denoise`]); here its floor is
//! measured. A recording is written as a WAV ([`record`]) from the microphone, which the app's own
//! pages may open ([`microphone`]). A whole mix is measured without playing it ([`analyze`]).

mod analyses;
mod analyze;
pub mod commands;
mod floor;
mod microphone;
mod record;
mod stretches;

use tauri::{App, Manager};

pub use microphone::permission_request;

/// Keeps the recordings being written and the analyses running.
pub fn setup(app: &mut App) {
    app.manage(record::Takes::default());
    app.manage(analyses::Analyses::default());
}
