# Cloudy Clip

An open-source video editor that stays simple, in the spirit of CapCut. It focuses on short-form video and also handles long edits. Agents are first-class: a built-in MCP server lets any agent edit the same live timeline you see, and its changes go into your undo history.

Built with Tauri v2 (Rust) and React, TypeScript, and Tailwind CSS.

## What v1 does

- Import video and audio files (Import button, or drop files on the window); pro formats get automatic editing proxies
- Multi-track timeline: add, move, trim, split, delete, mute/hide tracks, snapping, zoom, undo/redo
- Live preview with layered video tracks and 9:16, 16:9, and 1:1 formats
- A built-in MCP server exposing every one of those actions to agents

## Develop

Requirements: Node 20+, pnpm, Rust (stable), and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS. On Linux, install the GStreamer libav plugin (`gst-libav`) for H.264 playback. Install **FFmpeg** (`ffmpeg` and `ffprobe` on `PATH`, or set `CLOUDY_CLIP_FFMPEG_DIR`) to edit pro formats such as ProRes, APV, or 10-bit HEVC; Cloudy Clip makes lightweight editing proxies of them automatically.

```sh
pnpm install
pnpm tauri dev
```

Checks:

```sh
pnpm lint && pnpm test && pnpm build
cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test
```

## Connect an agent

With the app running:

```sh
claude mcp add --transport http cloudy-clip http://127.0.0.1:7420/mcp
```

Then ask, for example: "import ~/Videos/clip.mp4, put it on the timeline and split it at 3 seconds." Tools include `project_get_state`, `media_import`, `timeline_add_clip`, `timeline_split`, `preview_capture_frame`, and `history_undo`. The server only listens on `127.0.0.1`. Set `CLOUDY_CLIP_MCP_PORT` to change the port.

## Architecture

See [docs/architecture.md](docs/architecture.md). Each module documents its commands and tools in its own `README.md` under `src/modules/`.

## Keyboard shortcuts

| Key                   | Action                                                        |
| --------------------- | ------------------------------------------------------------- |
| Space                 | Play / pause                                                  |
| S                     | Split at playhead (selected clips, or all under the playhead) |
| Delete / Backspace    | Delete selected clips                                         |
| Ctrl+Z / Ctrl+Shift+Z | Undo / redo                                                   |
| Home                  | Go to start                                                   |
| Ctrl + wheel          | Zoom the timeline                                             |

## License

Copyright © 2026 DarkRedgm.

Cloudy Clip is free software, licensed under the [GNU Affero General Public License v3.0](LICENSE). You may use, study, change and share it. If you distribute a modified version, or run one as a service others use over a network, you must publish its source under the same license.

### Third-party content

- Emoji stickers: [Fluent Emoji](https://github.com/microsoft/fluentui-emoji), © Microsoft Corporation, licensed under the [MIT License](src/modules/sticker/packs/fluent/LICENSE).
- The [Inter](https://rsms.me/inter/) typeface by Rasmus Andersson and [JetBrains Mono](https://www.jetbrains.com/lp/mono/), licensed under the [SIL Open Font License 1.1](https://openfontlicense.org).
- Icons from [Lucide](https://lucide.dev) (ISC).
- Other dependencies keep their own licenses, listed in `package.json` and `src-tauri/Cargo.toml`.
