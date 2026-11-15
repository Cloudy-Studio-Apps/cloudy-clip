//! Sound module: what the Sound page asks of FFmpeg itself, and recording. Noise reduction is
//! rendered by the media module (a derived file, [`crate::media::denoise`]); here its floor is
//! measured. A file's beats are found for snapping ([`beats`]), its silent stretches for cutting ([`silences`]), a clip's loudness for matching ([`loudness`]). A recording is written as a WAV ([`record`]) from the microphone, which the app's own
//! pages may open ([`microphone`]). A whole mix is measured without playing it ([`analyze`]). The jobs
//! measuring share one registry and FFmpeg's arguments ([`measures`]).

mod analyses;
mod analyze;
mod beats;
pub mod commands;
mod floor;
mod loudness;
mod measures;
mod microphone;
mod record;
mod silences;
mod stretches;

use tauri::{App, Manager};

pub use microphone::permission_request;

/// Keeps the recordings being written and the analyses running.
pub fn setup(app: &mut App) {
    app.manage(record::Takes::default());
    app.manage(analyses::Analyses::default());
    app.manage(beats::Beats::default());
    app.manage(silences::Silences::default());
    app.manage(loudness::Loudness::default());
}

/// Stops the analyses, scans and beat finds FFmpeg is running, as the app quits.
pub async fn stop(app: &tauri::AppHandle) {
    if let Some(analyses) = app.try_state::<analyses::Analyses>() {
        analyses.cancel_all().await;
    }
    if let Some(beats) = app.try_state::<beats::Beats>() {
        beats.cancel_all().await;
    }
    if let Some(silences) = app.try_state::<silences::Silences>() {
        silences.cancel_all().await;
    }
    if let Some(loudness) = app.try_state::<loudness::Loudness>() {
        loudness.cancel_all().await;
    }
}
