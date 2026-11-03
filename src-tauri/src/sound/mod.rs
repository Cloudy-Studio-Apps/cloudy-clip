//! Sound module: what the Sound page asks of FFmpeg. Noise reduction is rendered to a file, a
//! derived file of the media module ([`crate::media::derived`]), and the noise floor is measured.

pub mod commands;
mod denoise;
