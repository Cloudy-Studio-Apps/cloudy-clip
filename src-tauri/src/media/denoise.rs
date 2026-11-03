//! Noise reduction (`afftdn`), rendered to a FLAC of a file's sound: too heavy to run live, so the
//! preview plays the file and export mixes from it. A derived file ([`super::derived`]); the
//! commands are in [`super::commands`].

use std::future::Future;
use std::path::{Path, PathBuf};

use super::derived::{DerivedKind, quiet, write_whole};
use super::proxy::{Tools, ffprobe};
use super::registry::MediaRegistry;

/// Bump when the rendering changes, so files made the old way are made again.
const DENOISE_RECIPE: u32 = 3;

/// What `afftdn` accepts for its reduction (`nr`), in dB. An amount of 0 is never rendered.
pub(crate) const AFFTDN_NR: (f64, f64) = (0.01, 97.0);
/// What `afftdn` accepts for its noise floor (`nf`), in dBFS.
pub(crate) const AFFTDN_NF: (f64, f64) = (-80.0, -20.0);

/// A file's sound with its noise taken away.
pub(crate) struct Denoised {
    /// How much noise is taken away, in dB (within [`AFFTDN_NR`]).
    pub(crate) amount_db: f64,
    /// The noise floor to remove, in dBFS (within [`AFFTDN_NF`]).
    pub(crate) floor_db: f64,
}

impl Denoised {
    /// How every rendering's name starts, whatever its recipe and settings.
    pub(crate) const FAMILY: &str = "denoised.";
}

/// The cache name of a rendering: its recipe and settings.
fn name_of(recipe: u32, amount_db: f64, floor_db: f64) -> String {
    format!(
        "{}{recipe}.nr{amount_db}.nf{floor_db}.flac",
        Denoised::FAMILY
    )
}

/// What FFmpeg does to the sound, after its input: the first sound stream, as lossless FLAC at 24
/// bits (the most FLAC keeps of `afftdn`'s float samples), about half a WAV's size. `delay_us` is
/// how long after the file's start its sound starts: FFmpeg reading the sound alone starts it at
/// 0, so that much silence goes first and the file lines up with the original's picture.
fn render_args(amount_db: f64, floor_db: f64, delay_us: u64) -> Vec<String> {
    let delay = (delay_us > 0).then(|| format!("adelay={:.3}:all=1,", delay_us as f64 / 1000.0));
    let filter = format!(
        "{}afftdn=nr={amount_db}:nf={floor_db}",
        delay.unwrap_or_default()
    );
    [
        "-map_metadata",
        "-1",
        "-vn",
        "-dn",
        "-sn",
        "-map",
        "0:a:0",
        "-af",
    ]
    .into_iter()
    .map(str::to_owned)
    .chain([filter])
    .chain(["-c:a", "flac", "-sample_fmt", "s32", "-f", "flac"].map(str::to_owned))
    .collect()
}

impl DerivedKind for Denoised {
    fn name(&self) -> String {
        name_of(DENOISE_RECIPE, self.amount_db, self.floor_db)
    }

    /// The original: proxies and masters are for pictures.
    fn source(&self, registry: &MediaRegistry, id: &str) -> Option<(PathBuf, u64)> {
        registry.original_of(id)
    }

    fn make(
        &self,
        tools: &Tools,
        source: &Path,
        target: &Path,
        on_progress: &(dyn Fn(f32) + Sync),
    ) -> impl Future<Output = Result<(), String>> + Send {
        let (amount_db, floor_db) = (self.amount_db, self.floor_db);
        async move {
            let probe = ffprobe(tools, source, false).await?;
            let mut cmd = quiet(tools);
            cmd.arg("-i")
                .arg(source)
                .args(render_args(amount_db, floor_db, probe.audio_delay_us));
            write_whole(cmd, target, probe.duration_us, on_progress)
                .await
                .map_err(|detail| format!("Could not reduce the noise of this file: {detail}"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn denoised(amount_db: f64, floor_db: f64) -> Denoised {
        Denoised {
            amount_db,
            floor_db,
        }
    }

    #[test]
    fn the_cache_name_changes_with_the_settings_and_the_recipe_only() {
        let name = denoised(12.0, -50.0).name();
        assert_eq!(name, denoised(12.0, -50.0).name());
        assert_ne!(name, denoised(12.5, -50.0).name());
        assert_ne!(name, denoised(12.0, -49.0).name());
        assert_ne!(name, name_of(DENOISE_RECIPE + 1, 12.0, -50.0));
        assert_eq!(name, name_of(DENOISE_RECIPE, 12.0, -50.0));
    }
}
