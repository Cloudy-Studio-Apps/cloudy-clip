//! The noise floor of a stretch of a file's sound, read by `astats`: what noise reduction's floor is
//! set from.

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
