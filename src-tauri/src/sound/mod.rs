//! Sound module: what the Sound page asks of FFmpeg itself. Noise reduction is rendered by the media
//! module (a derived file, [`crate::media::denoise`]); here its floor is measured.

pub mod commands;
mod floor;
