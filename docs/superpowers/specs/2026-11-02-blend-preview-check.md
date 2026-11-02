# Blend modes on WebKitGTK: what the check found

Checked on 2 Nov 2026 in the real app (`pnpm tauri dev`, Linux, WebKitGTK), driven over MCP on its own port.
Pictures came from `preview_capture_frame` and one export. Video was an H.264 test file.

| Check                                                   | Result                                                  |
| ------------------------------------------------------- | ------------------------------------------------------- |
| 13 separable modes, solid over solid, against the math  | Every channel exact, except Soft Light off by 1 of 255  |
| Hue, Saturation, Color, Luminosity                      | Distinct, sensible results; no formula compared         |
| All 17 modes over video                                 | Video never black; each mode different                  |
| Text with box, outline and shadow at 50%                | Fades as one picture, no darker overlaps                |
| Undo of a Composite change                              | The picture comes back, `clip.composite` is gone        |
| Two Multiply clips under a cross dissolve               | Same pixels at every sampled time before, inside, after |
| Screen of `#404040` over black and white video, capture | 64 and 255                                              |
| The same frame in an H.264 export                       | 64 and 255                                              |

The spec expected Screen and Add over video to look hazy on Linux. Neither a capture nor an export shows it
with this file. Both read true black and true white.

Not run: the live preview window, playback smoothness under a blend, Windows (WebView2), and a pair of clips
with different modes on a backdrop that tells Multiply from Normal.
