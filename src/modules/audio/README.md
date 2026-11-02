# audio

How a clip sounds: volume, pan, fades, equalizer and pitch, in preview and in export. The value is `Clip.sound` in `project`, since core modules read it; this module owns the commands, tools and the inspector's Audio tab.

- **Tier:** feature
- **Requires:** `project`, `inspector`, `preview`, `timeline` (the clip menu)
- **Contributes:** Reset sound in a clip's menu (`audio.menu.ts`); `inspectorSections` on tab `audio`: Volume, Pan, Fades, Pitch, Equalizer. The inspector's own Sound section (track, mute) stays below them.
- **Points it owns:** —
- **API:** none
- **Files:**
  - `audio.commands.ts`: the commands below. `logic/eq.ts`: `eqResponse`, the curve the graph draws, from the formulas `BiquadFilterNode` uses.
  - `ui/`: `AudioSections`, `EqSection`, `EqGraph` with `eq.gesture.ts`, `EqBandRow`, `SoundRow`, `sound.edit.hook.ts` (drag steps go to the preview through `previewProps`, the release is one `audio.setSound`).
  - Sound itself: `preview/engine/engine.audiograph.ts` (pitch, six biquads, pan, level, per element) and `export/logic/mixdown.ts` with `src-tauri/src/export/recipe.rs` (the same chain as FFmpeg filters, in the same order).
- **Invariants:** a value equal to the default is never stored, so an untouched clip has no `sound` and plays exactly as it did. Linked clips: the sound clip takes the change.

| Command            | MCP tool            | Notes                                         |
| ------------------ | ------------------- | --------------------------------------------- |
| `audio.setSound`   | `audio_set_sound`   | Fades stay within the clip. `audio.no_sound`  |
| `audio.resetSound` | `audio_reset_sound` | All of it, or one `section`. `audio.no_sound` |

A clip at its defaults has no `sound`, never enters Web Audio and adds no filter to an export. An element takes one `MediaElementSource`, ever, so once attached it stays attached and is driven at unity. A placed composition takes volume and fades on top of its clips; Pan, Pitch and Equalizer are per file and don't show for it.

**Not yet:** speed change. It needs its own plan, because `Clip` assumes no speed changes and speed reaches placement, trim, split, the engine and export, for picture as well as sound. Pitch costs about 125 ms through the worklet on WebKitGTK, which pitched sound runs ahead of the clock to cover. Windows (WebView2) hasn't been checked. See `docs/superpowers/specs/2026-11-02-audio-preview-check.md`.
