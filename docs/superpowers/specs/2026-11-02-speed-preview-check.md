# Playback speed on WebKitGTK: what the check found

Checked on 2 Nov 2026 with webkit2gtk-4.1 2.54.2, the build the app links, in a separate scratch window.
The file was 640x360 at 30 fps with a 440 Hz sine, H.264/AAC with one stream of each, served with Range
and `Access-Control-Allow-Origin: *` from another origin, as `src-tauri/src/media/server.rs` does. Levels
were read from an `AnalyserNode` after a muted gain, so nothing played aloud.

| Rate  | Picture callbacks per second | Tone at `preservesPitch` true and false |
| ----- | ---------------------------- | --------------------------------------- |
| 0.1x  | 3 (exact)                    | 441 Hz, 441 Hz                          |
| 0.25x | 7.5 (exact)                  | 441 Hz, 441 Hz                          |
| 0.5x  | 15 (exact)                   | 441 Hz, 441 Hz                          |
| 1.5x  | 45 (exact)                   | 441 Hz, 441 Hz                          |
| 2x    | 60 (exact)                   | 441 Hz, 441 Hz                          |
| 4x    | 62 (the display's limit)     | 441 Hz, 441 Hz                          |
| 10x   | 35 to 62                     | 441 Hz, 441 Hz                          |

**The element always keeps the pitch.** `preservesPitch` reads back `false` but changes nothing: GStreamer
corrects the tempo either way. So pitch correction on needs no work.

**Pitch correction off goes through the worklet.** With `preservesPitch` left true and the pitch worklet set
to the rate, the tone landed where a plain speed-up puts it:

| Rate  | Expected | Measured |
| ----- | -------- | -------- |
| 0.1x  | 44 Hz    | 43 Hz    |
| 0.25x | 110 Hz   | 108 Hz   |
| 0.5x  | 221 Hz   | 221 Hz   |
| 2x    | 882 Hz   | 877 Hz   |
| 4x    | 1764 Hz  | 1760 Hz  |
| 8x    | 3528 Hz  | 3521 Hz  |

The 10x run reached the end of the 40-second file before it was read, so it isn't a measurement.

`play()`'s promise didn't settle in most runs, and in the first one playback only started after a few
seconds. `syncSlot` never awaits it, so that's harmless, but the first play after load needs that time.

10x gave one run that fell behind (35 callbacks a second), so very high speeds may drop frames in preview.
Export draws frame by frame, so it isn't affected.

Not run: a real proxy, Windows (WebView2), and listening by ear.
