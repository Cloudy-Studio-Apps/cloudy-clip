# sound

The Sound page, a tab between Edit and Export, and the mix of a composition: how each audio track and the master sound, with two mixes to switch between. The page is empty for now, so the seal draws itself over "Sound isn't inked yet". The values live in `project` (`Track.mix`, `Composition.mix`), since core modules read them; this module owns the commands and tools.

- **Tier:** feature
- **Requires:** `project`
- **Contributes:** page `sound.page` (`appPages`, icon `AudioLines`)
- **Points it owns:** —
- **API:** none (the commands are exported from `index.ts`: `setTrackMix`, `resetTrackMix`, `setMaster`, `switchMix`)
- **Files:**
  - `sound.mix.commands.ts`: the commands below. Inputs are built from the schemas in `project` (`volumeDbSchema`, `panSchema`).
  - `sound.mcp.ts`: the tools below.
  - `ui/SoundPage.tsx`: the page, a `SketchPage`. Only the open page is mounted, so the drawing replays on each visit.
- **Invariants:** a mix equal to the default is never stored. Only audio tracks have a mix. Switching A and B swaps the live values (every audio track's mix, and the master) with `otherMix`; the first time, B starts as a copy of A, and tracks deleted since are left out. A switch is one undo step.

| Command               | MCP tool                | Notes                                                                                                    |
| --------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `sound.setTrackMix`   | `sound_set_track_mix`   | `volumeDb` (-60 to 12) and `pan` (-1 to 1) of an audio track. `sound.not_audio`, `sound.track_not_found` |
| `sound.resetTrackMix` | `sound_reset_track_mix` | Back to 0 dB and centre. `sound.not_audio`, `sound.track_not_found`                                      |
| `sound.setMaster`     | `sound_set_master`      | `volumeDb` of a composition (default: the actor's open one). `composition.not_found`                     |
| `sound.switchMix`     | `sound_switch_mix`      | To `"a"` or `"b"`; to the active one does nothing. `composition.not_found`                               |

- **Not yet:** anything on the page.
