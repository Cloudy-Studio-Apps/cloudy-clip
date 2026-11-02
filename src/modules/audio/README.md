# audio

How a clip sounds: volume, pan, fades, equalizer and pitch, in preview and in export. The value is `Clip.sound` in `project`, since core modules read it; this module owns the commands, tools and the inspector's Audio tab.

- **Tier:** feature
- **Requires:** `project`
- **Contributes:** commands and tools below
- **Points it owns:** —
- **API:** none
- **Invariants:** a value equal to the default is never stored, so an untouched clip has no `sound` and plays exactly as it did. Linked clips: the sound clip takes the change.

| Command            | MCP tool            | Notes                                         |
| ------------------ | ------------------- | --------------------------------------------- |
| `audio.setSound`   | `audio_set_sound`   | Fades stay within the clip. `audio.no_sound`  |
| `audio.resetSound` | `audio_reset_sound` | All of it, or one `section`. `audio.no_sound` |
