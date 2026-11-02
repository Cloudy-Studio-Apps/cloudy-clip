# Web Audio on WebKitGTK: what the check found

Checked on 2 Nov 2026 with webkit2gtk-4.1 2.54.2, the build the app links, in a separate scratch window.
The page and the media had different origins, and the media server sent `Access-Control-Allow-Origin: *`
with Range support, as `src-tauri/src/media/server.rs` does. The tone was a 440 Hz sine in an MP4 and an MP3.
Levels were read from `AnalyserNode`s after a muted gain, so nothing played aloud.

| Check                                                    | Result                                                 |
| -------------------------------------------------------- | ------------------------------------------------------ |
| `MediaElementSource` from `<video>` and `<audio>`        | Passes real samples (not silent, not tainted)          |
| `StereoPannerNode` at -1                                 | Right channel exactly 0                                |
| `BiquadFilterNode`, high-pass at 8 kHz                   | 440 Hz falls from 0.06 to 0.00015                      |
| `AudioWorklet` with `@soundtouchjs/audio-worklet`, +3 st | Peak moves to 522 Hz (expected 523)                    |
| Worklet latency                                          | About 125 ms (205 ms to first sound, 80 ms without it) |

`AudioContext.resume()` on an idle context never settles. Call it without waiting, and start the element:
the context runs as soon as media plays.

A mono source through `StereoPannerNode` loses 3 dB at centre, so the chain upmixes to stereo first.

Worklet latency is over the plan's 100 ms. It's constant, so a pitched clip's element runs 125 ms ahead of
the clock instead of leaving Task 6 out.

Not run: a proxy file (same server and same path through the graph), Windows (WebView2), and listening by ear.
