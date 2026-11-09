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
