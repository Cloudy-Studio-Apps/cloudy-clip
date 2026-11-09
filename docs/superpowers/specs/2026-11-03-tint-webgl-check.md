# Tint: the WebGL2 check (stage 0)

What the preview's GPU runner (`src/modules/preview/gpu/`) can count on, measured in the real app before
the grade is built on it. Spec: [2026-11-03-tint-page-design.md](2026-11-03-tint-page-design.md)
("Rendering", "Keeping it right").

## Decisions

- **Target format: `RGBA16F`** (half-float), when `EXT_color_buffer_float` is there; `RGBA8` with dithering
  otherwise. Linux has it. Windows is pending (below); if WebView2 lacks it, the runner falls back by
  itself (`floatTargets` false), so nothing else changes.
- **Levels apply to GPU uploads.** On WebKitGTK, `texImage2D` from a `<video>` holds exactly what the 2D
  canvas holds, squeeze included (black 16, white 234 on the test file). So the levels pass (Task 2) runs
  on every video upload wherever `measureVideoLevels` finds a squeeze, exactly as the spec says.
- **Upload is the cost, not passes.** Twelve passes cost about what one does; uploading the picture and
  drawing the result back onto a 2D canvas is nearly all of the time (numbers below). Task 2 and the
  engine should upload each layer once and run every filter of that layer in one `run`.
- **A playing video moves on mid-task.** Inside a `requestVideoFrameCallback`, two draws of the same
  `<video>` a few ms apart got different frames 7 times out of 12. The GPU upload always matched one of
  the two 2D draws exactly, so the upload itself is right; but nothing may draw a playing video twice
  and expect the same frame (draw once, upload once, reuse).

## Linux (WebKitGTK)

WebKitGTK 2.54.2, GStreamer 1.28.8, NVIDIA GeForce RTX 4060 (nvidia-utils 620.70.06, Mesa 26.2.6),
niri on Wayland, `pnpm tauri dev` (debug build). Measured 2026-11-09.

| Check                                   | Result                                                                                                                                                                                                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebGL2                                  | yes (`WebGL 2.0`; the webview masks the renderer as "Apple GPU"). Max texture 32768, max 3D texture 16384.                                                                                                                                                                                        |
| `EXT_color_buffer_float`                | yes (also `EXT_color_buffer_half_float`). The runner's targets came up `RGBA16F` and complete.                                                                                                                                                                                                    |
| `OES_texture_float_linear`              | yes                                                                                                                                                                                                                                                                                               |
| 3D textures                             | yes: a 33³ identity LUT, `RGBA8` and `RGBA16F`, no GL error; sampled at (0.25, 0.5, 0.75) it gives (62, 128, 193) and (62, 127, 193), which is right (texel centers: 0.25 → 7.75 / 32 = 0.242).                                                                                                   |
| Runner on a known picture               | identity exact; exposure ×2 exact (64, 96, 3 → 128, 192, 6); a 12-pass chain of ×0.25 then ×4 gives the source back exactly (in 8-bit targets the 3 would come back as 4).                                                                                                                        |
| `texImage2D` from a `<video>`           | non-black. Paused (3 seeks): a 4×4 region equals the 2D canvas draw exactly. Playing (12 frames, 1080p H.264): the upload equals the 2D draw before or after it exactly every time (see "moves on mid-task" above).                                                                               |
| Video levels on the upload              | squeezed like the 2D canvas: black 16 / 16, mid-gray 124.3 / 124.3, white 234.3 / 234.3 (canvas / GPU), on a black, gray, white H.264 clip in TV range.                                                                                                                                           |
| Hidden renderer (`createRenderer` path) | passes, see below. 22 runs over 69 s: each frame from `frameAt` went through the runner (identity then ×0.5) and back, max error 0.5 of a step, 0 pixels off by more than 1; a seeked `<video>` uploaded in the same loop matched its 2D draw exactly every time. `document.hidden` stayed false. |

The whole check ran with the app's window on a niri workspace that wasn't shown. The owner was working
meanwhile and moved between workspaces; a log of the active workspace every 0.5 s during the last 22 s run
saw the app's workspace shown once out of 45 samples. `requestAnimationFrame` kept running at 52 to 58 a
second there, so niri didn't stop frames for that window the way the capture check saw; a clean 45 s run
with the window certainly hidden is still worth doing (pending, below).

**Time per frame** (ms, median of 20 after 3 warm-ups; p90 in brackets; WebKit's clock has 1 ms steps).
Each frame uploads the source, runs the passes (one identity, then exposures), draws the result on a 2D
canvas of the same size and reads one pixel to wait for it.

| Source              | 2D draw only | 1 pass  | 5 passes | 12 passes | upload only (1×1 output) | 12 passes, 1-pixel draw-back |
| ------------------- | ------------ | ------- | -------- | --------- | ------------------------ | ---------------------------- |
| canvas 1920×1080    | 0–1 (1–3)    | 9 (11)  | 9 (10)   | 9 (10)    | 7 (8)                    | 10 (11)                      |
| canvas 3840×2160    | 0 (1)        | 33 (34) | 33 (39)  | 34 (37)   | 26 (28)                  | 38 (41)                      |
| `<video>` 1920×1080 | 7 (8)        | 17 (18) | 17 (18)  | 16 (18)   | 13 (15)                  | 17 (18)                      |

(two runs; they agreed within 3 ms.) So at 1080p a graded video layer costs about 10 ms more than an
ungraded one, whatever the number of corrections, which fits 30 fps and is tight at 60. 4K costs about
35 ms per layer, under 30 fps: the spec's cap of live grading to the preview canvas size matters (export
renders full size, where speed matters less).

## Levels on the GPU (Task 2)

The levels pass replaced the CPU table (`LevelCorrection`) and now runs on every video layer of the live
preview, captures and renderers. Checked on Linux, same machine, 2026-11-09:

- **Untouched is unchanged.** A 10 s 1280×720 30 fps test clip (`testsrc2`, H.264, BT.709 TV range), one
  composition, no edits, exported as ProRes from the commit before (9e9cf1f) and after: all 300 decoded
  frames are identical (`framemd5`). The first version of the shader didn't round; then 0 of 300 frames
  matched after encoding, though before encoding every value was within 1 of the table (0.3% of values
  off by one at levels 16/235, 11% at 15/236; the encoder spreads a difference of one). The shader now
  rounds the source to an 8-bit step and the result to one, as the table did.
- **Frame by frame against the table** (a temporary dev tool, removed): `createRenderer` with the GPU
  pass against the same frame without correction put through the old table, all 300 frames, levels
  16/235 and 15/236: byte for byte equal.
- **Captures read black 0.** `preview_capture_frame` of a black | gray | white clip (TV range) reads
  (16, 16, 16), (123, 125, 125), (233, 235, 235) before and (0, 0, 0), (125, 127, 127), (253, 255, 255)
  after. The live preview draws through the same engine code and the same measured levels.

**Live playback cost** (Task 2 review). The live preview now runs the levels pass on every video
layer, which it never did before, so its cost was measured while playing: the user's clock played 5 s
from the start, twice per case, and the time of each `engine.render` was summed (temporary
instrumentation, removed). The preview canvas was 208×117 (the test window's panel). "Renders/s" is
frames drawn per second of wall time (rAF runs at about 55 here).

| Case                | Uncorrected (as before Task 2) | Levels, full size (first version) | Levels, pass capped only | Levels, capped and drawn small first (kept) |
| ------------------- | ------------------------------ | --------------------------------- | ------------------------ | ------------------------------------------- |
| 4K H.264, one layer | 51–56 renders/s, 13 ms each    | 17 renders/s, 52 ms each          | 17–20 renders/s          | 38–43 renders/s, 19–23 ms each              |
| three 1080p layers  | 45–48 renders/s, 16–17 ms each | 17–18 renders/s, 48–53 ms each    | 21–22 renders/s          | 23–38 renders/s, 23–39 ms each              |

Capping only the pass hardly helps: uploading the full-size frame is the cost (45 ms of the 52 at 4K).
So the live engine (`capPasses`) draws the frame onto a 2D canvas at the size it lands at
(`engine.shrink.ts`), uploads that and runs the pass there. Of what is left, most is that small 2D
draw being forced to finish before the upload (17 ms a frame at 4K, 8 ms per 1080p layer), against
no measurable cost when the frame is drawn straight onto the preview. Captures and renderers run at
full size; an export of the 10 s test project still matches the one from before Task 2 in all 300
frames, and a capture still reads black 0.

## Basics and primary wheels: parity (Task 7)

The CPU reference (`tint/logic/color/correct.ts`, `evaluate.ts`) against the shader
(`tint/render/correct.glsl.ts` through `gradePasses`, the `tint.grade` picture filter and a
`createRenderer` frame), Linux only, same machine as above, 2026-11-09.

- **Method:** a 16×16 PNG of 256 fixed colors (16 grays, ramps of the six primaries and secondaries,
  32 skin-like tones, the rest seeded random) as the only clip of a 16×16 composition. A temporary
  dev-only MCP tool (removed before the commit) drew the frame without a grade, then once per value
  set with a one-correction grade, each through its own `createRenderer` (full size, the export
  path), and compared each channel with `round(clamp(correctPixel(source / 255)) × 255)`. Values:
  exposure, contrast, pivot, highlights, shadows, whites, blacks, temperature, tint, vibrance,
  saturation, hue and rolloff uniform over their whole range, lift / gamma / gain / offset `x`, `y`,
  `m` uniform in −1…1, protect skin on or off at random. The PNG decodes exactly (0, 17, 34… read
  back unchanged).
- **One correction, 60 value sets** (seeds 7, 11, 12345; 46 080 channel values): **max difference 1
  step**, 0 values off by more than 1. Seed 7: 436 of 15 360 values off by 1, seed 11: 382, seed
  12345: 451 (2.5 to 3 %). The ones off by one lean one way (reference above the GPU), as a float
  written to an 8-bit target rounds a hair differently near the half step.
- **Chains, 20 sets** (seed 3): three corrections at half range, the middle one at opacity 0.3…1,
  half-float targets between them, against `evaluatePixel`: **max 1 step**, 0 above, 838 of 15 360
  off by 1 (5.5 %).
- **Windows:** pending, with the rest of the Windows check.

## Stage 2

### Curves: parity (Task 14)

The curve step of `tint/logic/color/curves.apply.ts` (through `correctPixel`) against the shader
(`tint/render/correct.glsl.ts` with the baked `RGBA16F` curve texture of `render/textures.ts`), 2026-11-09.

- **Method:** a temporary dev page (removed before the commit) on the web build (`pnpm vite --port 1540`),
  in headless Chromium 1243 with SwiftShader WebGL2 (`--headless=new --use-gl=angle --use-angle=swiftshader
--enable-unsafe-swiftshader`), driven over CDP. It called `gradePasses` (one correction) through
  `createGpuRunner` directly on a 16 × 16 canvas of the same 256 fixed colors as Task 7 (half-float
  targets), drew the result back on a 2D canvas and compared each channel with
  `round(clamp(correctPixel(source / 255)) × 255)`. Each value set is random curves (seeded), checked
  with `validateGrade`: every fourth set the custom curves only, every fourth the hue and brightness
  curves only, the rest both; custom curves of 2 to 5 points moved up to ±0.3 off the diagonal per
  point, hue curves of 3 to 6 points (ends sharing y). "Extra" sets add saturation 0.5–1.5, contrast
  0.7–1.3 and exposure ±0.5 around the curves.
- **Results** (20 sets each, 15 360 channel values per row; "changed" is how many differ from the
  source, so the curves really applied):

| Seed | Hue curve y | Extra | Max | Off by 1 | Over 1 | Changed |
| ---- | ----------- | ----- | --- | -------- | ------ | ------- |
| 14   | 0.1…0.9     | no    | 1   | 34       | 0      | 14 691  |
| 15   | 0.1…0.9     | no    | 1   | 24       | 0      | 14 581  |
| 16   | 0.1…0.9     | yes   | 1   | 19       | 0      | 14 771  |
| 21   | 0…1         | no    | 1   | 26       | 0      | 14 736  |
| 22   | 0…1         | yes   | 1   | 25       | 0      | 14 698  |
| 23   | 0…1         | no    | 1   | 13       | 0      | 14 441  |

- **What it took:** with the table kept at full float on the CPU, the full-range hue curves gave a few
  values off by 2 (3 of 30 720): the GPU's half-float storage, made visible by a steep hue curve. The
  table is now rounded to half-floats when sampled, so both sides read the same numbers; off-by-ones
  fell from about 3 % to about 0.2 %. A first run also showed that a texture's `version` must change
  with its content across filters (the runner keeps textures by key): it is a hash of the points.
- **Untouched corrections** add no curve work: curves at their defaults get no texture and the
  shader skips the step (`u_curveOn` 0), so Task 7's numbers stand.
- **Linux desktop (WebKitGTK) and Windows:** not run for the curves; same method as Task 7 if wanted.

### Color mix and the warper: parity (Task 15)

Color mix (folded into the hue rows of the curve texture) and the warper (`tint/logic/color/warper.ts`,
its `RGBA16F` 180 × 32 table) against the shader, 2026-11-09.

- **Method:** the same as the curves (temporary dev page on the web build, `pnpm vite --port 1540`,
  headless Chromium 1243 with SwiftShader WebGL2, CDP; removed before the commit), but the reference
  is `evaluatePixel` over the whole grade, so chains of corrections are checked too. Each set, checked
  with `validateGrade`: Color mix on 1 to 4 random families (hue, sat, lum anywhere in −100…100,
  range 0…100) and a warper of 1 to 5 random points (dh ±90°, ds ±0.6, smoothing 0…100, up to 3
  pinned), every fourth set Color mix only and every fourth the warper only; every other set adds
  random curves (as in Task 14). "Chain" rows put a second correction after the first (random Color
  mix and warper, or curves only every third set). "Wide" hue curves have y in 0…1.
- **Results** (20 sets each, 15 360 channel values per row):

| Seed | Chain | Hue curve y | Max | Off by 1 | Over 1 | Changed |
| ---- | ----- | ----------- | --- | -------- | ------ | ------- |
| 31   | no    | 0.1…0.9     | 1   | 54       | 0      | 12 904  |
| 32   | no    | 0.1…0.9     | 1   | 48       | 0      | 12 872  |
| 34   | no    | 0…1         | 1   | 35       | 0      | 12 191  |
| 36   | no    | 0.1…0.9     | 1   | 31       | 0      | 11 741  |
| 33   | yes   | 0.1…0.9     | 1   | 333      | 0      | 14 106  |
| 35   | yes   | 0…1         | 1   | 370      | 0      | 13 894  |

- **Notes:** the warp table is rounded to half-floats when sampled (signed, `half`), as the curve
  table is, so both sides read the same offsets. Chains have more off-by-ones (about 2 %) because the
  GPU keeps the picture between passes in half-floats and the reference in full floats; none is off
  by 2. A correction whose Color mix and warper are at their defaults bakes nothing and the shader
  skips both (`u_curveOn`, `u_warpOn` 0), so earlier numbers stand.
- **Linux desktop (WebKitGTK) and Windows:** not run; same method as Task 7 if wanted.

## Windows (WebView2)

**Pending: owner check.** Also pending: the clean hidden run on Linux (window on another workspace for the
full 45 s, nobody switching to it).

To run it: the tool lives in the commit before this one, so run the app in dev from there, import the two clips
and open a composition with the video, then call each part.

```sh
git switch -c gpu-check a82f480
pnpm tauri dev
# test files (any FFmpeg):
ffmpeg -f lavfi -i color=black:s=64x64:r=30:d=1 -f lavfi -i color=0x808080:s=64x64:r=30:d=1 -f lavfi -i color=white:s=64x64:r=30:d=1 -filter_complex "hstack=inputs=3,format=yuv420p" -color_range tv -c:v libx264 -crf 1 levels3.mp4
ffmpeg -f lavfi -i testsrc2=s=1920x1080:r=30:d=6 -vf format=yuv420p -c:v libx264 -crf 18 clip1080.mp4
```

Then, with an MCP client on `http://127.0.0.1:7420/mcp` (`media_import` both files,
`composition_create_from_media` with the video), call `preview_gpu_check` with `part` set to `caps`,
`levels` (`levelsMediaId`), `video` and `timing` (`videoMediaId`), and `hidden` (`videoMediaId`,
`seconds: 22`, twice in a row with the window minimized or behind another). Each call returns the JSON
(and logs it, with a toast). Afterwards switch back and delete the `gpu-check` branch.

If WebView2 fails WebGL2, the video upload or the hidden render, write it here: the plan goes on, and that
platform gets `TintUnavailable` (Task 9) and `tint.unavailable` exports (Task 3).
