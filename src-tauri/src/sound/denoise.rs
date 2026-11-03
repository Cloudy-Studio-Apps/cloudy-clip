//! Noise reduction (`afftdn`), rendered to a WAV of a file's sound: too heavy to run live, so the
//! preview plays the file and export mixes from it. Also the measure of a stretch's noise floor
//! (`astats`) that sets it.

use std::future::Future;
use std::path::{Path, PathBuf};

use crate::media::MediaRegistry;
use crate::media::derived::{DerivedKind, quiet, write_whole};
use crate::media::proxy::{Tools, ffprobe};

/// Bump when the rendering changes, so files made the old way are made again.
pub(crate) const DENOISE_RECIPE: u32 = 2;

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

/// The cache name of a rendering: its recipe and settings.
fn name_of(recipe: u32, amount_db: f64, floor_db: f64) -> String {
    format!("denoised.{recipe}.nr{amount_db}.nf{floor_db}.wav")
}

/// What FFmpeg does to the sound, after its input: the first sound stream, as 32-bit float samples
/// (nothing of a 24-bit or float source is lost), in RF64 once past WAV's 4 GB.
fn render_args(amount_db: f64, floor_db: f64) -> Vec<String> {
    let filter = format!("afftdn=nr={amount_db}:nf={floor_db}");
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
    .chain(["-c:a", "pcm_f32le", "-rf64", "auto", "-f", "wav"].map(str::to_owned))
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
        let args = render_args(self.amount_db, self.floor_db);
        async move {
            let duration = ffprobe(tools, source, false).await?.duration_us;
            let mut cmd = quiet(tools);
            cmd.arg("-i").arg(source).args(args);
            write_whole(cmd, target, duration, on_progress)
                .await
                .map_err(|detail| format!("Could not reduce the noise of this file: {detail}"))
        }
    }
}

/// The stretch `from..to` (microseconds) of a file whose noise floor is measured, before its input.
pub(crate) fn stretch_args(from: u64, to: u64) -> [String; 4] {
    let seconds = |micros: u64| format!("{:.6}", micros as f64 / 1_000_000.0);
    [
        "-ss".into(),
        seconds(from),
        "-t".into(),
        seconds(to.saturating_sub(from)),
    ]
}

/// What FFmpeg does to measure, after the input: the overall statistics of the first sound stream.
pub(crate) const MEASURE_ARGS: [&str; 8] = [
    "-vn",
    "-map",
    "0:a:0",
    "-af",
    "astats=measure_perchannel=none",
    "-f",
    "null",
    "-",
];

/// The overall noise floor `astats` printed, in dB; `None` when it printed none or `-inf`.
pub(crate) fn parse_floor(stderr: &str) -> Option<f64> {
    stderr
        .lines()
        .filter_map(|line| line.split("Noise floor dB:").nth(1))
        .next_back()
        .and_then(|value| value.trim().parse::<f64>().ok())
        .filter(|db| db.is_finite())
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
