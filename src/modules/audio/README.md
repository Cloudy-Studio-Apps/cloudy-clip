# audio

How a clip sounds: volume, pan, fades, equalizer and pitch, in preview and in export. The value is `Clip.sound` in `project`, since core modules read it; this module owns the commands, tools and the inspector's Audio tab.

- **Tier:** feature
- **Requires:** `project`, `inspector`, `preview`, `timeline` (the clip menu), `keyframe` (volume and pan keys)
- **Contributes:** Reset sound in a clip's menu (`audio.menu.ts`, the action and the entry with `scopes: ["all", "sound"]`, so it shows on a sound-only timeline); `inspectorSections` on tab `audio`: Volume, Pan, Fades, Pitch, Equalizer. The inspector's own Sound section (track, mute) stays below them. `keyTargets`: `audio.keys` (`audio.keys.ts`). A `clipActions` badge `audio.fades` with `scopes: ["all", "sound"]` (`ui/FadeHandles`): on clips of audio tracks, the slope of each fade (the equal-power curve, `logic/fade.ts`) and a handle at the top corner. Dragging it writes the slope with `style` only (`ui/fade.gesture.ts`); the release is one `audio.setSound` with `fadeIn` or `fadeOut`, kept within the clip. A release without movement, or Escape, sends nothing. Handles show on a selected clip and on hover, and stay inside the clip when a fade is its whole length; where the two meet, the fade-out handle keeps the corner and the fade-in handle stops beside it (`handleOffset`, `logic/fade.ts`).
- **Points it owns:** —
- **API:** none
- **Files:**
  - `audio.commands.ts`: the commands below. `logic/eq.ts`: `eqResponse`, the curve the graph draws, from the formulas `BiquadFilterNode` uses.
  - `ui/`: `FadeHandles`, `Fade` with `fade.gesture.ts`, `AudioSections`, `EqSection`, `EqGraph` with `eq.gesture.ts`, `EqBandRow`, `SoundRow`, `sound.edit.hook.ts` (drag steps go to the preview through `previewProps`, the release is one `audio.setSound`).
  - Sound itself: `preview/engine/engine.audiograph.ts` (pitch, six biquads, pan, level, per element, into its track's bus; see `preview/README.md`) and `export/logic/mixdown.ts` with `src-tauri/src/export/recipe.rs` (the same chain as FFmpeg filters, in the same order).
- **Invariants:** a value equal to the default is never stored, so an untouched clip has no `sound` and sounds exactly as it did. Linked clips: the sound clip takes the change.

| Command            | MCP tool            | Notes                                                                           |
| ------------------ | ------------------- | ------------------------------------------------------------------------------- |
| `audio.setSound`   | `audio_set_sound`   | Fades stay within the clip. `audio.no_sound`, `audio.animated`                  |
| `audio.resetSound` | `audio_reset_sound` | All of it, or one `section`; drops the keys of what it resets. `audio.no_sound` |

Keys: `sound.volumeDb` (-60 to 12) and `sound.pan` (-1 to 1) can be keyed on clips of audio tracks (`keyframe_set`, or the diamond at the end of the Volume and Pan rows). Keys sit on the sound clip only, as `Clip.animation`; `soundOf` fills in what an animated clip's partial `sound` lacks, and the engine reads it from the clip `resolveFrame` already animated. While a value has keys, its row shows the value at the playhead, releasing the slider sets a key there (`keyframe.set`), and `audio.setSound` with that value fails with `audio.animated` before writing. A live drag still goes through `previewProps` and wins over the keys. Export turns them into envelopes (`export` module). A composition placed in a track (`compositionRef`) offers no keys, since export mixes it from its inner clips and the two would disagree.

A clip at its defaults has no `sound` and adds no filter to an export. In the preview every sound element goes through Web Audio, defaults or not, so the track buses and meters hear it; a clip at its defaults leaves its chain flat. An element takes one `MediaElementSource`, ever, so once attached it stays attached and is driven at unity. A placed composition takes volume and fades on top of its clips; Pan, Pitch and Equalizer are per file and don't show for it.

Pitch costs about 125 ms through the worklet on WebKitGTK, which pitched sound runs ahead of the clock to cover. Windows (WebView2) hasn't been checked. See `docs/superpowers/specs/2026-11-02-audio-preview-check.md`.
