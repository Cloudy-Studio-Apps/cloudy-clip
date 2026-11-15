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

### Every Stage 2 field together: parity (Task 16)

Everything a correction has after Stage 2, at once, against the shader, 2026-11-09: curves, Color mix,
the warper, the log and zone wheels, rolloff, protect skin, skin pull, the RGB mixer and Creative (split
toning, faded film, vignette), on top of the Basics and primary wheels of Task 7.

- **Method:** as Task 15 (temporary dev page on the web build, `pnpm vite --port 1540`, headless
  Chromium 1243 with SwiftShader WebGL2, CDP; removed before the commit), reference `evaluatePixel`
  over the whole grade. Each set, checked with `validateGrade`, turns each part on with odds of about
  60 %, so most sets hold most of them: random curves (as Task 14), Color mix and a warper (as Task
  15), log wheels (three random wheels, `lowRange` and `highRange` anywhere in 0…1, so also crossed),
  zone wheels (each zone moved with odds 0.6, `at` anywhere), rolloff 0…100, protect skin, skin pull
  0…100, saturation 0.3…1.8 with vibrance and hue, a mixer (each cell kept or moved, keep brightness
  and monochrome random) and Creative (both tints, balance, fade, a vignette with every number random).
  Pixels are read where they sit (`PixelAt` = the pixel's middle, `v` 1 at the top, as `v_uv`), on a
  16 × 16 canvas (aspect 1), 32 × 8 (aspect 4) or 8 × 32 (aspect 0.25), so the vignette's shape is
  checked off square too.
- **Results** (20 sets each, 15 360 channel values per row):

| Seed | Chain | Canvas  | Max | Off by 1 | Over 1 | Changed |
| ---- | ----- | ------- | --- | -------- | ------ | ------- |
| 41   | no    | 16 × 16 | 1   | 43       | 0      | 14 908  |
| 42   | no    | 32 × 8  | 1   | 38       | 0      | 14 802  |
| 45   | no    | 16 × 16 | 1   | 33       | 0      | 14 875  |
| 46   | no    | 8 × 32  | 1   | 32       | 0      | 15 019  |
| 47   | no    | 16 × 16 | 1   | 18       | 0      | 14 849  |
| 51   | no    | 8 × 32  | 1   | 31       | 0      | 14 894  |
| 52   | no    | 16 × 16 | 1   | 39       | 0      | 14 810  |
| 43   | yes   | 16 × 16 | 1   | 326      | 0      | 15 038  |
| 44   | yes   | 32 × 8  | 1   | 320      | 0      | 15 018  |
| 49   | yes   | 16 × 16 | 1   | 357      | 0      | 14 982  |
| 50   | yes   | 32 × 8  | 1   | 340      | 0      | 15 075  |
| 48   | yes   | 8 × 32  | 4   | 314      | 3      | 14 995  |

Seeds 45 and 47 have wide hue curves (y 0…1).

- **Seed 48:** one pixel (3 channels) of one set is off by up to 4. The second correction there has a
  very steep custom Y curve (slope about 11 near 0.93), and the GPU keeps the first correction's
  picture in a half-float target. Running the reference with that picture rounded to half-floats
  between the two corrections gives exactly what the GPU drew (192, 169, 84), and the whole seed then
  passes (max 1, 76 off by 1). It is the half-float target between passes, not the Stage 2 math: every
  single correction is within one step. With that half-float model, seeds 43 and 44 pass too (93 and
  64 off by 1), while 49 and 50 show one value off by 2 each (round-to-nearest on the CPU against the
  GPU's own conversion); with full floats those two pass.
- **Untouched is unchanged:** every new step is skipped at its defaults (`u_logOn`, `u_zonesOn`,
  `u_skinPull`, `u_mixerOn`, `u_splitOn`, `u_fade`, `u_vignette.x` all 0), so the numbers above stand.
- **Linux desktop (WebKitGTK) and Windows:** not run; same method as Task 7 if wanted.

## Stage 3

### Limits by color and brightness: parity (Task 17)

A correction limited by color, by brightness or both (with clean up and invert) against the shader,
2026-11-10. On the GPU the key pass writes the raw key, the limited correction reads it as a second
input and cleans up, inverts and mixes by key × opacity; on the CPU `evaluatePixel` does the same per
pixel with `keyOf`.

- **Method:** as Task 16 (temporary dev page on the web build, `pnpm vite --port 1540`, headless
  Chromium 1243 with SwiftShader WebGL2, half-float targets, CDP; removed before the commit), 256
  colors on a 16 × 16 canvas, reference `evaluatePixel`. Each set, checked with `validateGrade`, is
  one correction (exposure ±1.5, saturation 0…2, hue ±120, temperature ±80, opacity 0.5…1) with a
  limit: by color, by brightness, or both, in turn. Color: a random hue window (wrapping when its
  start is past its end), saturation and brightness windows (each the whole range with odds 0.3),
  softness 0…100 (0 with odds 0.25: hard edges); brightness: a random range, softness as color; clean
  up 0…100 with odds 0.5, invert with odds 0.5; refine softness 0 (the blur is spatial, so the
  per-pixel reference can't have it). "Keyed" counts pixels where the limit changed the result.
- **Results** (20 sets each, 15 360 channel values per row):

| Seed | Max | Off by 1 | Over 1 | Changed | Keyed pixels |
| ---- | --- | -------- | ------ | ------- | ------------ |
| 171  | 1   | 1        | 0      | 8 309   | 2 591        |
| 172  | 1   | 4        | 0      | 7 733   | 2 740        |
| 173  | 1   | 7        | 0      | 8 392   | 2 507        |
| 174  | 1   | 2        | 0      | 7 308   | 2 928        |
| 175  | 1   | 7        | 0      | 7 885   | 2 689        |

- **Pass:** every single limited correction is within one 8-bit step.
- **Show:** the Show pass (the key as white on black) against `keyOf` × 255, 20 sets of seed 301:
  max 1.
- **Chains** (not part of the rule): two limited corrections in a row (seeds 181–183) stay within 1.
  A curves correction, then the limited one, then two plain ones (seeds 201, 202, also the runner's
  unit fix: a feedback loop would drop whole draws) reach 5 and 2 on three values in all: the limited
  correction reads its key from the half-float picture between passes, and a narrow soft edge (soft
  5 to 7, 0.0125 to 0.0175 of luma) with clean up turns that rounding into a few steps. Modelling the
  half-float rounding on the CPU gives the GPU's value exactly (set 14 of seed 201: 72, as drawn).
- **Refine softness** (the blur) has no per-pixel reference; it was run (seeds 191, 192) to check the
  passes draw, not compared.
- **Linux desktop (WebKitGTK) and Windows:** not run; same method as Task 7 if wanted.

## Windows (WebView2)

**Pending: owner check.** The `preview_gpu_check` tool of the first stage was removed from the code, so
the old `git switch -c gpu-check a82f480` recipe is no longer the way. The Windows check now runs the
finished Tint page from the `tint` branch (or master once it is merged) and judges it with the tools
that stay in the app.

```sh
git switch tint        # or master after the merge
pnpm install
pnpm tauri dev
# a test file (any FFmpeg):
ffmpeg -f lavfi -i testsrc2=s=1280x720:r=30:d=2 -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" -c:v libx264 -crf 12 -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv src709.mp4
```

1. **The page opens.** Open the Tint page with a clip on the timeline. If it shows the "unavailable"
   panel, WebView2 has no WebGL2 (or no float targets): write that here, and stop; that platform keeps
   `TintUnavailable` and `tint.unavailable` exports, as planned.
2. **Parity.** With an MCP client on `http://127.0.0.1:7420/mcp`: `media_import` the file,
   `composition_create_from_media`, then `tint_add_correction` and `tint_set_correction` on the clip
   (for example exposure 0.4, contrast 1.25, saturation 0.8, temperature 0.3, vibrance 0.3; then a
   second correction at opacity 0.7 with lift, gamma and gain wheels, hue 15, highlights -0.3,
   shadows 0.2). Call `tint_scopes` with `at` 500000, 1000000 and 1500000 and the open composition's
   id. Compare each channel's `mean` with the CPU reference: decode the file with
   `ffmpeg -i src709.mp4 -vf "select=eq(n\,30),scale=in_range=tv:out_range=pc:in_color_matrix=bt709" -frames:v 1 -f rawvideo -pix_fmt rgb24 f30.rgb`
   and run `evaluatePixel` (`tint/logic/color/evaluate.ts`) over its pixels with `videoRange` false,
   then `scopeStats` (`tint/logic/scopes.ts`). On Linux the means agree within 1.0 (below).
3. **Untouched export.** `export_enqueue` (`format: "prores"`, `hardware: false`, `compositionId`) the
   ungraded clip, then `export_start`. Compare the file's frames with the source in the YUV domain:
   `ffmpeg -i out.mov -i src709.mp4 -filter_complex "[0:v]format=yuv444p10le[a];[1:v]format=yuv444p10le[b];[a][b]psnr" -f null -`.
   On Linux Y is 49.7 dB, U 41.4, V 38.6; Windows should land in the same range.
4. **Graded export.** The same with the grade on; the first frame's mean should match `tint_scopes`.
5. **Hidden run** (Linux only, still pending): with the window on another workspace, run step 2 for
   45 s from a script that calls `tint_scopes` every second; every call must still be graded.

If WebView2 fails WebGL2, the upload or the export, write it here: the plan goes on, and that platform
gets `TintUnavailable` and `tint.unavailable` exports.

## Final check (Task 30), Linux (WebKitGTK), 2026-11-15

The finished app (`pnpm tauri dev` on test ports 1520 and 7520, one run) driven over MCP, on the same
machine as above. A 1280x720, 2 s, 30 fps `testsrc2` file tagged Rec.709 limited range.

- **Untouched export:** an ungraded clip exported as ProRes (`export_enqueue`, `format: "prores"`) and
  compared with the source decoded without the app. YUV domain, all 60 frames: **Y 49.7 dB, U 41.4,
  V 38.6** (what the 8-bit canvas round trip costs). In RGB the average is 29.6 dB (chroma upsampling of testsrc2's hard edges differs between the canvas and swscale). The
  same file without a Rec.709 tag measured lower against FFmpeg's default matrix, which is the
  reference's matrix choice, not the export. **Not compared with a build of master** (a second Rust
  build was too heavy for this machine); the levels path is unchanged by the grade code, since an
  ungraded clip adds no pass.
- **Parity on WebKitGTK:** `tint_scopes` (the capture path, GPU) against `evaluatePixel` over the
  ffmpeg decode, three corrections (basics, contrast, temperature, vibrance, saturation; a second at
  opacity 0.7 with lift, gamma, gain, hue, highlights, shadows; a third with pivot, whites, blacks,
  tint, rolloff), at 0.5, 1 and 1.5 s. Channel means (GPU / CPU): R 146.5 / 145.5, 146.2 / 145.3,
  147.1 / 146.1; G 135.8 / 135.7, 135.9 / 135.9, 135.4 / 135.3; B 153.1 / 152.7, 152.5 / 152.0,
  153.1 / 152.6. Largest difference 1.0 on a mean; minimum and maximum match to 1 step (R min 11 / 10).
  Ungraded, the app's decode already reads 1.9, 0.2 and 2.5 higher than FFmpeg's, so the grade adds
  nothing the decoder doesn't. A heavy exposure of -2 gave max 125 of 255 (about a quarter) as it should.
  Per-pixel comparison was not done (the scopes tool gives statistics, not pixels).
- **Graded export:** a -3 exposure export came out dark (Y average 193 of 1023, against 509 plain).
- A `tint_scopes` call without `compositionId` measures the caller's open composition, which stays
  the first one after `composition_create_from_media` makes another; pass the id.

### Groups and shared keys: parity (Task 18)

Side-by-side, stacked and per-channel groups and a shared key against the shader, 2026-11-10. On
the GPU a group is one pass reading the picture its branches start from (`u_in0`) and each branch
(`render/joins.glsl.ts`; stacked groups call `preview`'s `BLEND_GLSL`), a per-channel branch starts
with a pass taking its channel as gray, and a shared key reads the key pass of the correction that
picks, made once; on the CPU `evaluatePixel` walks the same graph (`logic/walk.ts`) with
`logic/color/joins.ts` and `logic/color/blend.ts`.

- **Method:** as Task 17 (temporary dev page on the web build, `pnpm vite --port 1540`, headless
  Chromium 1243 with SwiftShader WebGL2, half-float targets, CDP; removed before the commit), the
  same 256 colors, reference `evaluatePixel`, 20 sets per row, each checked with `validateGrade`.
  Every correction is random (exposure ±1.2, saturation 0…2, hue ±90, temperature ±60, opacity
  0.5…1). Side by side: a correction, then 2 or 3 branches of one correction each, group opacity
  0.3…1. Stacked: a correction, then 2 branches, the top one with the row's blend and the lower one
  normal or the same blend, opacity 0.3…1. Per channel: a correction, a split, each channel a
  correction or (odds 0.25) empty. Shared key: a limited correction (a random color window,
  brightness with odds 0.5, invert with odds 0.5; on with odds 0.7), a plain one, then one using its
  pick (`from`, inverted again with odds 0.5).
- **Results** (15 360 channel values per row):

| Seed | Grade                | Max | Off by 1 | Over 1 | Changed |
| ---- | -------------------- | --- | -------- | ------ | ------- |
| 401  | side by side         | 1   | 394      | 0      | 14 762  |
| 402  | side by side         | 1   | 376      | 0      | 14 643  |
| 411  | stacked, Normal      | 1   | 318      | 0      | 14 561  |
| 412  | stacked, Multiply    | 1   | 297      | 0      | 14 693  |
| 413  | stacked, Screen      | 1   | 245      | 0      | 14 964  |
| 414  | stacked, Soft Light  | 1   | 300      | 0      | 14 654  |
| 415  | stacked, Overlay     | 1   | 358      | 0      | 14 665  |
| 416  | stacked, Difference  | 1   | 347      | 0      | 14 924  |
| 417  | stacked, Color       | 1   | 302      | 0      | 14 842  |
| 418  | stacked, Color Dodge | 1   | 271      | 0      | 14 683  |
| 419  | stacked, Luminosity  | 1   | 299      | 0      | 14 693  |
| 420  | stacked, Add         | 1   | 189      | 0      | 14 881  |
| 421  | per channel          | 1   | 311      | 0      | 14 462  |
| 422  | per channel          | 1   | 297      | 0      | 14 576  |
| 431  | shared key           | 1   | 320      | 0      | 14 713  |
| 432  | shared key           | 1   | 321      | 0      | 14 637  |

- **Pass:** every row is within one 8-bit step. The shared key rows drew 74 and 72 passes for 20
  sets: the key pass once per set, not once per correction using it.
- **Unchanged without groups:** for 300 random chains (0 to 4 corrections, on or off, opacity 0 or
  0.5, limits with and without refine softness, curves, with and without Show) the new
  `gradePasses` gave the same passes, as JSON, as the one before this task (a temporary test,
  deleted).
- **Linux desktop (WebKitGTK) and Windows:** not run; same method as Task 7 if wanted.

## Stage 4

### Key joins: parity (Task 19)

Key joins in each combine mode, and corrections taking their key from one, against the shader,
2026-11-15. On the GPU a key join is one pass (`render/joins.glsl.ts` `keyJoinPass`) reading each
entry's key pass, finishing each by its own clean up and invert and combining them; the correction
using it reads that pass as its key. On the CPU `evaluatePixel` walks the same graph with
`logic/color/joins.ts` `keyJoinValue`: the first key as it is, then add `k + x − k·x`, subtract
`k·(1 − x)`, intersect `k·x`.

- **Method:** as Task 18 (temporary dev page on the web build, `pnpm vite --port 1540`, headless
  Chromium 1243 with SwiftShader WebGL2, half-float targets, CDP; removed before the commit), 256
  colors on a 16 × 16 canvas (16 grays, six primary and secondary ramps, 32 skin-like tones, the rest
  seeded random), reference `evaluatePixel`, 20 sets per row, each checked with `validateGrade`.
  Every correction is random (exposure ±1.2, saturation 0…2, hue ±90, temperature ±60, opacity
  0.5…1). A pick is a random color window or a brightness range (softness 0…100), clean up 0…60 with
  odds 0.5, invert with odds 0.5, refine softness 0. One mode: two limited corrections from the
  source put side by side (opacity 0.3…1), a key join of their keys (`add`, then the row's mode),
  and a correction after the group using it (`from`, inverted again with odds 0.5). Mixed: three
  limited corrections side by side, a key join `k2` of two of them, a key join of a correction, `k2`
  and the third (random modes), and two corrections after the group both using it. "Keyed" counts
  pixels the key changed (against the same grade with those limits removed, on the CPU).
- **Results** (15 360 channel values per row):

| Seed | Grade                      | Max | Off by 1 | Over 1 | Changed | Keyed pixels | Key join passes |
| ---- | -------------------------- | --- | -------- | ------ | ------- | ------------ | --------------- |
| 511  | add                        | 1   | 298      | 0      | 12 731  | 2 464        | 20              |
| 512  | add                        | 1   | 288      | 0      | 11 708  | 2 242        | 20              |
| 513  | subtract                   | 1   | 262      | 0      | 11 525  | 3 459        | 20              |
| 514  | subtract                   | 1   | 299      | 0      | 12 989  | 2 351        | 20              |
| 515  | intersect                  | 1   | 290      | 0      | 12 916  | 2 971        | 20              |
| 516  | intersect                  | 1   | 297      | 0      | 12 507  | 2 829        | 20              |
| 517  | mixed, nested, two readers | 1   | 430      | 0      | 13 448  | 4 224        | 40              |
| 518  | mixed, nested, two readers | 1   | 394      | 0      | 13 717  | 4 769        | 40              |

- **Pass:** every row is within one 8-bit step. Each key join is drawn once per set (20, and 40 with
  the nested one), however many corrections read it: the runner's `lastReaders` keeps its target
  until the last reader.
- **Chains** (not part of the rule): the same grades with the limited corrections in a row instead of
  side by side (seeds 501, 503, 505, 507) reach 2, 1, 2 and 3 on 2, 0, 4 and 6 values: the later keys
  are read from the half-float picture between passes, the case Task 17's chains describe.
- **Linux desktop (WebKitGTK) and Windows:** not run; same method as Task 7 if wanted.

## Stage 5

### Camera color spaces: parity (Task 21)

Each camera color space to Rec.709 against the shader, 2026-11-15. On the GPU a grade whose `input`
is a camera space starts with one pass (`render/spaces.glsl.ts` `inputPass`, `tint.input.<space>`)
that every node reads as the source; on the CPU `evaluatePixel` runs `logic/color/spaces.ts`
`toRec709` on the source first. Curve, gamut matrix to Rec.709, the Rec.709 transfer, one clamp at
the end.

- **Method:** as Task 19 (temporary dev page on the web build, `pnpm vite --port 1540`, headless
  Chromium 1243 with SwiftShader WebGL2, half-float targets, CDP; removed before the commit), 256
  colors on a 16 × 16 canvas, 20 sets per row: the first set the fixed colors of Task 7 (grays,
  ramps, skin-like tones, seeded random), the other 19 seeded random colors, so each curve is read
  over its whole range. Reference `evaluatePixel`, each grade checked with `validateGrade`. "Alone" is
  the conversion with no node (`out` the source); "graded" adds two corrections in a row after it
  (exposure ±1.2, saturation 0…2, hue ±90, temperature ±60, contrast 0.6…1.5, opacity 0.5…1).
- **Rec.709 adds no pass:** a one-correction grade gives 1 pass with and without `input: "rec709"`,
  and `{ input: "rec709", nodes: {} }` gives none.
- **Results** (15 360 channel values per row):

| Space     | Alone: max | Off by 1 | Over 1 | Graded: max | Off by 1 | Over 1 | Passes (alone, graded) |
| --------- | ---------- | -------- | ------ | ----------- | -------- | ------ | ---------------------- |
| sRGB      | 0          | 0        | 0      | 1           | 361      | 0      | 20, 60                 |
| S-Log3    | 0          | 0        | 0      | 1           | 298      | 0      | 20, 60                 |
| Apple Log | 0          | 0        | 0      | 1           | 266      | 0      | 20, 60                 |
| C-Log2    | 1          | 1        | 0      | 1           | 278      | 0      | 20, 60                 |
| C-Log3    | 0          | 0        | 0      | 1           | 215      | 0      | 20, 60                 |
| V-Log     | 0          | 0        | 0      | 1           | 206      | 0      | 20, 60                 |
| F-Log     | 1          | 1        | 0      | 1           | 255      | 0      | 20, 60                 |

- **Pass:** every row is within one 8-bit step.
- **Linux desktop (WebKitGTK) and Windows:** not run; same method as Task 7 if wanted.

### Camera color spaces after fix round 1 (Task 21)

The conversion now keeps light over 1 (only the low end clamps), sRGB matches display light
(`eotf(v)^(1/2.4)`), and a camera curve reads code values only from a video-range file
(`codeValue`); a full-range file or an image is read as it is. Same method and sets as above, one
row per space and range. "Bright" counts pixels whose CPU result has a channel over 1 (kept).
"From in range" counts misses over 1 step on pixels whose converted source stayed within 0…1.

| Space, range     | Alone: max | Over 1 | Graded: max | Off by 1 | Over 1 | From in range | Bright (alone) |
| ---------------- | ---------- | ------ | ----------- | -------- | ------ | ------------- | -------------- |
| sRGB             | 0          | 0      | 1           | 422      | 0      | 0             | 0              |
| S-Log3, video    | 0          | 0      | 4           | 239      | 2      | 0             | 4 007          |
| Apple Log, video | 0          | 0      | 1           | 264      | 0      | 0             | 3 263          |
| C-Log2, video    | 1          | 0      | 1           | 214      | 0      | 0             | 4 176          |
| C-Log3, video    | 0          | 0      | 1           | 195      | 0      | 0             | 4 236          |
| V-Log, video     | 0          | 0      | 1           | 270      | 0      | 0             | 4 027          |
| F-Log, video     | 1          | 0      | 1           | 275      | 0      | 0             | 3 144          |
| S-Log3, full     | 0          | 0      | 1           | 211      | 0      | 0             | 4 182          |
| Apple Log, full  | 0          | 0      | 1           | 262      | 0      | 0             | 3 576          |
| C-Log2, full     | 0          | 0      | 2           | 171      | 2      | 0             | 4 264          |
| C-Log3, full     | 0          | 0      | 3           | 264      | 11     | 0             | 4 296          |
| V-Log, full      | 0          | 0      | 2           | 199      | 1      | 0             | 4 140          |
| F-Log, full      | 1          | 0      | 1           | 274      | 0      | 0             | 3 553          |

- **Alone:** every space and range is within one 8-bit step.
- **Graded:** 16 of 384 000 values miss by 2 to 4 steps, all on pixels converted far over white
  (1.8 to 8 after the conversion, saturated) and then pushed hard (contrast up to 1.5, saturation up
  to 2, hue turns) back into range. The picture between passes is half-float (about 1/2000
  relative), so a channel of 4 to 14 carries an error of a few thousandths, which those grades
  bring down into the visible range. With highlights clamped (before this fix) the same rows were
  within 1. No miss comes from a pixel whose conversion stayed within 0…1.

### LUT files: parity (Task 22)

A correction's LUT against the shader, 2026-11-15. On the GPU the LUT is a step at the end of the
correction's program (`tint.correct.lut3d` / `.lut1d`, and the `.keyed` ones), after Creative and
before the opacity and key mix: the color mapped from `DOMAIN_MIN`…`DOMAIN_MAX` onto 0…1 and
clamped, read at the texel centers `(t · (N − 1) + 0.5) / N` of a half-float `sampler3D` (3D) or a
one-row `sampler2D` (1D, per channel), mixed toward by strength. On the CPU `evaluatePixel` runs
`logic/cube.ts` `applyCube` (trilinear between the eight nearest entries at `t · (N − 1)`, linear
between two per channel for 1D).

- **Method:** as Task 21 (temporary dev page, `pnpm vite --port 1540`, headless Chromium 1243 with
  SwiftShader WebGL2, half-float targets, CDP; removed before the commit), 256 colors × 20 sets per
  row, the first set Task 7's fixed colors, the rest seeded random. The `.cube` files are made in the
  page (a look with crossed channels, power curves and a sine wobble, so the interpolation shows)
  and read with `parseCube`. "Alone" is one correction holding only the LUT; "graded" is two random
  corrections (exposure ±1.2, saturation 0…2, hue ±90, temperature ±60, contrast 0.6…1.5, opacity
  0.5…1), the LUT on the second, so light over 1 reaches the LUT's clamp ("over 1 in" counts the
  pixels with a channel over 1 going into that correction).
- **Identity skip:** at strength 0 the passes are the same as with no LUT (`tint.correct`, no
  texture).
- **Results** (15 360 channel values per row):

| LUT                            | Alone: max | Off by 1 | Over 1 | Graded: max | Off by 1 | Over 1 | Over 1 in |
| ------------------------------ | ---------- | -------- | ------ | ----------- | -------- | ------ | --------- |
| 3D 17                          | 1          | 208      | 0      | 1           | 327      | 0      | 932       |
| 3D 33                          | 1          | 205      | 0      | 1           | 309      | 0      | 1 106     |
| 3D 65                          | 1          | 211      | 0      | 1           | 291      | 0      | 1 075     |
| 1D 1024                        | 1          | 220      | 0      | 1           | 325      | 0      | 1 211     |
| 1D 17                          | 1          | 304      | 0      | 1           | 308      | 0      | 899       |
| 3D 33, domain −0.1…1.2/1.1/1.4 | 1          | 198      | 0      | 1           | 318      | 0      | 1 428     |
| 3D 33, strength 0.5            | 1          | 112      | 0      | 1           | 283      | 0      | 1 443     |
| 1D 1024, strength 0.5          | 1          | 136      | 0      | 1           | 281      | 0      | 1 560     |

- **Pass:** every row is within one 8-bit step.
- **Linux desktop (WebKitGTK) and Windows:** not run.

## Stage 6

### Shot group and whole-timeline grades: parity (Task 25)

The three levels chained, 2026-11-15. A clip's picture runs its own grade then its shot group's in one
run (`tint.grade`: the two lists of passes put together by `chainPasses`); the picture lands on the
composition's 8-bit canvas; the whole-timeline grade (`tint.timeline`, a frame filter) then runs over
that frame. The CPU side is `evaluatePixel` of the clip grade, then of the group grade, rounded to 8 bits
(the composed canvas), then of the timeline grade.

- **Method:** as Task 21 (temporary dev page, `pnpm vite --port 1540`, headless Chromium 1243 with
  SwiftShader WebGL2, half-float targets, CDP; removed before the commit), going through the real
  filters (`createTintFilters` with stub live values, view, media and LUTs; `target` `"export"`). 256
  colors × 20 sets, the first set Task 7's fixed colors, the rest seeded random; each set draws three
  new grades of two corrections each (exposure ±0.8, saturation 0.3…1.6, hue ±60, temperature ±40,
  contrast 0.7…1.3, a vignette ±60, opacity 0.5…1). "In range" means every value of the clip, group
  and timeline results is within 0…1.
- **Identity skips:** clip and group grades give 4 passes, the clip grade alone 2 (no group grade adds
  none); a composition with no grade isn't filtered (`applies` false), and neither is a clip with no
  grade and no group.
- **Results** (15 360 channel values):

| Stage                                                      | Max in range |
| ---------------------------------------------------------- | ------------ |
| Clip grade then group grade, one run, against the CPU      | 1            |
| Timeline grade on the 8-bit frame the GPU composed         | 1            |
| All three end to end (CPU rounding its own composed frame) | 2            |

- End to end, 650 values are off by one and 22 by more (10 of them in range, at most 2). Every one
  comes from a one-step difference in the composed 8-bit frame that the timeline grade then stretches
  (contrast up to 1.3, saturation up to 1.6); with the frame the GPU actually composed as its input,
  the timeline grade is within one step everywhere in range. The app's own pickers read the composed
  frame the same way (`pickColor` at the timeline level reads a capture), so they agree with what is
  drawn.
- **Pass:** each level is within one 8-bit step.
- **Linux desktop (WebKitGTK) and Windows:** not run.
