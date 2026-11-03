# Microphone on WebKitGTK: what the check found

Checked on 3 Nov 2026 with webkit2gtk-4.1 2.54.2, the build the app links, in a separate scratch
window: a throwaway Tauri app pinned to the app's `Cargo.lock` (tauri 2.12.5, tauri-runtime-wry 2.12.3,
wry 0.57.1, webkit2gtk-rs 2.0.2), loading its page from `tauri://localhost` as a built app does, and
again from `http://localhost` as `pnpm tauri dev` does. The microphone was the machine's real one
through PipeWire 1.6.10. Samples were measured in an `AudioWorklet` as RMS and dropped; the worklet's
output went through a muted gain, so nothing played aloud and nothing was saved.

## Linux (WebKitGTK)

| Check                                                    | Result                                                                                     |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `navigator.mediaDevices.getUserMedia` exists             | Yes, on `tauri://localhost` and `http://localhost` (both secure contexts)                  |
| `getUserMedia({ audio: true })`, no handler (app today)  | Fails at once: `NotAllowedError`. No prompt is shown                                       |
| Same, with `on_permission_request` allowing `Microphone` | Resolves in about 20 ms. No prompt is shown                                                |
| A second call on the same page                           | Resolves without asking again (the grant lasts until the page reloads)                     |
| `MediaStreamAudioSourceNode` → `AudioWorkletNode`        | Real samples: mono, a quiet room at -45 to -60 dBFS RMS, 975 blocks of 128 in 3 s          |
| `AudioContext` with the microphone attached              | `running` at once (no gesture needed), 44100 Hz (PipeWire runs at 48000; WebKit resamples) |
| `baseLatency` / `outputLatency`                          | 0.0029 s (one 128-frame block) / 0 (not implemented)                                       |
| Track `getSettings().latency`                            | Not present. Settings are `deviceId`, `echoCancellation`, `sampleRate: 0`, `volume`        |
| Constraints                                              | Only `echoCancellation` is supported; `false` is honoured. The default is `true`           |
| `MediaRecorder`                                          | Exists. See below                                                                          |
| Click-to-sound latency                                   | Not run: it needs the speakers heard by the microphone, and nothing was to play aloud      |

`MediaRecorder.isTypeSupported`, then what a 1.5 s recording really gave:

| Type                     | Supported | Recording                                      |
| ------------------------ | --------- | ---------------------------------------------- |
| `audio/webm;codecs=opus` | true      | `audio/webm; codecs=opus`, about 37 KB         |
| `audio/ogg;codecs=opus`  | true      | Comes out as `audio/mp4; codecs=opus`, not Ogg |
| `audio/mp4`              | true      | `audio/mp4; codecs=mp4a`, **0 bytes**          |
| `audio/wav`              | false     | —                                              |
| no type (the default)    | —         | `audio/mp4; codecs=mp4a`, **0 bytes**          |

The WebKit settings need nothing: `enable-media-stream`, `enable-mediasource` and `enable-webaudio`
are already on in 2.54.2 (wry turns on `enable-webaudio`; the other two are WebKit's defaults now).
`enumerateDevices()` once printed `Unable to open pipewire remote. Error: Timeout was reached` from
the camera side; asking for audio only never touched it.

### Why it fails today

wry connects WebKitGTK's `permission-request` signal only when a permission handler is set
(`wry-0.57.1/src/webkitgtk/mod.rs`, "Permission handler"). Tauri sets one only when the app calls
`on_permission_request` (`tauri-2.12.5/src/manager/webview.rs`). Cloudy Clip doesn't, so the signal
reaches WebKitGTK's own handler, which denies. A handler that answers `PermissionResponse::Default`
does the same: wry's comment says "let WebKitGTK show default prompt", but WebKitGTK has no prompt
and denies. So on Linux the app allows or denies; nothing in between asks the user.

### What the app needs

One handler on the builder in `src-tauri/src/lib.rs`, allowing only the microphone, and only for the
app's own pages. Everything else keeps today's behaviour. This exact code ran in the scratch app:
`tauri://localhost` was allowed, a page from `http://127.0.0.1:1499` got `Default` and was denied.

```rust
use tauri::webview::{PermissionKind, PermissionResponse};
use tauri::{Runtime, Webview};

/// Lets the app's own pages open the microphone (recording on the Sound page). Every other
/// request, and every other page, keeps the webview's default.
pub fn permission_request<R: Runtime>(webview: Webview<R>, kind: PermissionKind) -> PermissionResponse {
    match kind {
        PermissionKind::Microphone if is_app_page(&webview) => PermissionResponse::Allow,
        _ => PermissionResponse::Default,
    }
}

/// The app's own origins: built on Linux/macOS, built on Windows, and the dev server.
fn is_app_page<R: Runtime>(webview: &Webview<R>) -> bool {
    webview.url().is_ok_and(|url| {
        matches!(
            (url.scheme(), url.host_str()),
            ("tauri", Some("localhost"))
                | ("http" | "https", Some("tauri.localhost"))
                | ("http", Some("localhost"))
        )
    })
}
```

```rust
tauri::Builder::default()
    .on_permission_request(permission_request)
    // … plugins, setup, as now
```

`webview.url()` is safe in the handler: it runs on the main thread from the signal and returned at
once. No `with_webview` code, no WebKit setting, no new crate (`tauri::webview` already exports both
types). Where the function lives is Task 4's call; it belongs to whichever Rust folder owns recording.

`tauri.conf.json`: nothing. `csp` is `null`, and `getUserMedia` is not covered by CSP. If a CSP is
set later, the worklet module must be allowed by `script-src` (`'self'` for a file the app serves,
`blob:` if it's built from a Blob URL).

`capabilities/`: nothing. `getUserMedia` is a web API, not a Tauri command, so no permission covers
it. Whatever command Task 4 adds to write the file is listed the way the app's other commands are.

## Recommended capture path for Task 4: AudioWorklet PCM

`MediaStreamAudioSourceNode` → an `AudioWorkletNode` that copies each 128-frame block out as
`Float32Array`, and the file is written as WAV (or handed to FFmpeg) on the Rust side.

- **It works the same on both engines.** `MediaRecorder` doesn't: on WebKitGTK the default and
  `audio/mp4` give 0-byte files, `audio/ogg` silently comes out as MP4, and only WebM/Opus works;
  WebView2 (Chromium) has its own list again (WebM, plus MP4 in recent versions). Each engine
  would need its own branch and checks.
- **Lossless.** `audio/wav` isn't supported anywhere; the only working recorder format is Opus,
  which is lossy, and a recording is source media for editing.
- **Sample-accurate against the clock.** Blocks carry `currentFrame` in the same `AudioContext` that
  plays the timeline, so the take lines up with what was heard; `MediaRecorder` chunks have no time.
- **It's the path the app already uses.** The audio graph and the pitch worklet run on the same
  context; one more worklet node is little new code.
- **Levels for free.** The same worklet gives the input meter.

Notes for Task 4:

- Ask with `{ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }`.
  WebKitGTK only knows `echoCancellation` and turns it on by default (the second call showed
  `true`); Chromium knows all three and turns them on too.
- Write the WAV at `audioContext.sampleRate` (44100 on this machine, not the device's 48000), never
  the track's `sampleRate`, which WebKitGTK reports as 0.
- Stop the track (`track.stop()`) when recording ends, or the system shows the microphone in use.
- Recording on Linux depends on GStreamer's PipeWire/PulseAudio source, which WebKitGTK already pulls in.

## Windows (WebView2): not run here

What the source says: wry 0.57.1 adds a `PermissionRequested` handler on WebView2 only when Tauri
gives it one (`wry-0.57.1/src/webview2/mod.rs`, "Permission handler"). `Microphone` maps from
`COREWEBVIEW2_PERMISSION_KIND_MICROPHONE`; `Allow` sets the state to allow; `Default` leaves the
request alone, so **WebView2 shows its own prompt** (an "Allow / Block" popup at the top of the webview).
So without the handler, Windows asks; with it, it doesn't. The same Rust code above serves both (the
built app's origin on Windows is `http://tauri.localhost`). Windows itself must also let desktop apps
use the microphone (Settings → Privacy & security → Microphone → "Let desktop apps access your
microphone"); if that is off, `getUserMedia` fails with `NotAllowedError` or `NotReadableError`
even when WebView2 allows it.

### The owner's check

On the Windows machine, after Task 4 has landed the handler:

1. Check Settings → Privacy & security → Microphone: "Microphone access" and "Let desktop apps access
   your microphone" are on. Have a microphone plugged in. Mute or turn down the speakers.
2. `pnpm install`, then `pnpm tauri dev`. Wait for the window.
3. Open the dev tools: right-click anywhere in the window → **Inspect** (or `Ctrl+Shift+I`). Go to the
   **Console** tab.
4. Paste this and press Enter. It records nothing: it reads levels for 3 seconds and stops.

   ```js
   (async () => {
     const r = {};
     r.types = Object.fromEntries(
       ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/wav", "audio/mp4"].map((t) => [
         t,
         typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t),
       ]),
     );
     const t0 = performance.now();
     const stream = await navigator.mediaDevices.getUserMedia({
       audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
     });
     r.gumMs = Math.round(performance.now() - t0);
     const track = stream.getAudioTracks()[0];
     r.settings = track.getSettings();
     const ctx = new AudioContext();
     ctx.resume();
     const code = `registerProcessor("m", class extends AudioWorkletProcessor {
       constructor() { super(); this.s = 0; this.n = 0; this.b = 0; }
       process(i, o) { const c = i[0] && i[0][0]; if (c) { for (const v of c) { this.s += v * v; this.n++; } this.b++; }
         if (this.b === 75) { this.port.postMessage(Math.sqrt(this.s / this.n)); this.s = 0; this.n = 0; this.b = 0; }
         return true; } });`;
     await ctx.audioWorklet.addModule(
       URL.createObjectURL(new Blob([code], { type: "text/javascript" })),
     );
     const node = new AudioWorkletNode(ctx, "m");
     const mute = ctx.createGain();
     mute.gain.value = 0;
     ctx.createMediaStreamSource(stream).connect(node).connect(mute).connect(ctx.destination);
     const levels = [];
     node.port.onmessage = (e) => levels.push(+(20 * Math.log10(e.data || 1e-9)).toFixed(1));
     await new Promise((ok) => setTimeout(ok, 3000));
     Object.assign(r, {
       state: ctx.state,
       sampleRate: ctx.sampleRate,
       baseLatency: ctx.baseLatency,
       outputLatency: ctx.outputLatency,
       levelsDb: levels,
     });
     track.stop();
     await ctx.close();
     console.log(JSON.stringify(r, null, 2));
   })().catch((e) => console.log("FAILED", e.name, e.message));
   ```

   Talk or tap the desk during the 3 seconds.

5. Write down: whether a permission prompt appeared (expected: none), and the printed JSON.

It passes when there was no prompt, `levelsDb` has about 15 numbers that are not all the same, and
they rise (towards -30 or higher) while you talk. Then flip the Windows recording constant on. A
`FAILED NotAllowedError` with a prompt you didn't see means the handler isn't wired; without one, it
is the Windows privacy setting. Paste the JSON into this doc under a "Windows" heading either way.

Before Task 4 lands, the same steps work if you answer **Allow** on WebView2's own prompt; that
checks capture, not the handler.

## Not run

Windows (WebView2, the owner's check above), macOS (will need `NSMicrophoneUsageDescription` in the
bundle's `Info.plist`), click-to-sound latency on any platform, and an `AudioContext` asked for
48000 Hz to match the device.
