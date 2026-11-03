# The mix: what the check found

Checked on 3 Nov 2026 on Linux with FFmpeg n9.0.2. The export half ran by machine; the half that needs
ears, the running window or Windows is a procedure for the owner, below.

## Checked automatically: the export

The path was the real one. A scratch Vitest test built projects and ran the real `mixdown()` (`src/modules/export`),
which gave the `ExportSpec` JSON. A scratch crate included the real `recipe.rs`, `mixgraph.rs` and `soundfilters.rs`
by `#[path]` and ran `arguments()` on it. FFmpeg ran those arguments with the output swapped for 32-bit float WAV
(so the encoder doesn't colour the numbers), and `ebur128` and `astats` measured the file. Nothing scratch was committed.
The sources were 48 kHz stereo sines (440, 660 and 880 Hz, 8 s files of which each export plays the first 6 s; -18.75 LUFS as the one-track case).

| Check                                                                                                     | Result                                                                                |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| One track, base                                                                                           | -18.75 LUFS                                                                           |
| That track at -6 dB                                                                                       | -24.75 LUFS: -6.00 LU                                                                 |
| Master at -6 dB (one track)                                                                               | -24.75 LUFS: -6.00 LU                                                                 |
| Three tracks, base                                                                                        | -13.78 LUFS                                                                           |
| Three tracks, each at -6 dB                                                                               | -19.78 LUFS: -6.00 LU                                                                 |
| Three tracks, master at -6 dB                                                                             | -19.78 LUFS: -6.00 LU                                                                 |
| Pan -1 on a centred stereo tone                                                                           | Right channel peak and RMS `-inf`; left peak -12.04 dB (base -18.06 dB)               |
| Pan +1                                                                                                    | Left `-inf`; right -12.04 dB                                                          |
| Placed composition, inner track at -6 dB (one clip)                                                       | -24.75 LUFS against -18.75 placed with no inner mix: -6.00 LU                         |
| Default mix against the old flat graph (`fa560cd^`), one and three tracks                                 | Same loudness, true peak and LRA; the decoded samples have the same MD5 in both cases |
| Three tracks with faders -3, -6 (pan 0.5) and +2, a placed composition whose inner track is -4, master -2 | -16.44 LUFS, true peak -13.0 dBFS                                                     |
| The same project in a graph written by hand (volume, `pan`, `amix`, master)                               | -16.44 LUFS; the two files differ by at most -90.3 dB                                 |
| The same project as a real MP3 (`Format::Mp3`, the whole `arguments()` output)                            | -16.4 LUFS                                                                            |

How the numbers read:

- Every level step measured -6.00 LU (the integrated values differ by exactly 6.00 to the two decimals read), well inside the 0.5 LU that `docs/superpowers/specs/2026-11-02-sound-page-design.md` allows.
- A pan of -1 puts the sum of both sides on the left: `StereoPannerNode`'s law for stereo sound, so a centred source
  is 6 dB louder on that side (base -18.06 dB, panned -12.04 dB). The export matches the preview's law on purpose
  (`pan_gains`); it is not a bug.
- A placed composition folds its inner tracks into the clip (`soundInPlacement`): the -4 dB inner track of the combined
  project reached the Rust side as `gain: 0.631` on a segment of the outer track 3. That gain applies to the clip inside its own chain, before the outer track's bus sums it and applies the track's +2 dB fader, so the clip ends at -4 dB + 2 dB = -2 dB (the hand-written reference graph used -2 dB for it).
- A default mix adds no `volume` and no `pan`, so its graph is the old one: one `amix` of every clip. That is why the
  samples are identical, not just close.
- Not exported, by design: solo, Mono, Dim and the speaker volume (they live in the Sound page's view and never reach the document).

Commands, in the scratch folder (`$S` is the session scratchpad):

```sh
ffmpeg -f lavfi -i "sine=frequency=440:duration=8:sample_rate=48000" -af "pan=stereo|c0=c0|c1=c0" $S/tones/t440.wav   # also 660, 880
cargo build --offline            # in $S/mixcheck: bins `new` (this tree) and `old` (recipe.rs of fa560cd^)
$S/mixcheck/target/debug/new $S/specs/<case>.json out.wav   # prints the FFmpeg arguments as JSON
ffmpeg -i out.wav -af "ebur128=metadata=1:peak=true,ametadata=mode=print:file=-" -f null -    # last lavfi.r128.I
ffmpeg -i out.wav -af "astats=measure_perchannel=Peak_level+RMS_level:measure_overall=none" -f null -   # pan
```

## Still to check by hand, in `pnpm tauri dev`

This was not run, because it needs ears and the owner's window. Use a scratch project, not one that matters, and tick
each line. Any "no" is a finding to write down with what was seen.

1. **An untouched project sounds as before** (the biggest risk: every audio element now goes through Web Audio).
   Open a project made before the mix, with a video that has sound, a music track and a placed composition. Play it
   on Edit: sound present, no click at start or stop, picture and sound in step after a seek and after a drag of the
   playhead. Try a sped-up clip, a pitched clip and a clip with a fade. Compare by ear with the last release if you have it.
2. **Faders, pan, solo, Mono, Dim, speaker, Mix A/B** on the Sound page, playing.
   - Drag a fader down: the level follows the drag with no zipper noise; release; Ctrl+Z restores it in one step.
   - Pan hard left: sound only in the left earphone; double-click the handle for centre.
   - On a strip, press the "Solo track" button (it reads "Stop soloing" while on): the other tracks go quiet and the meters of
     the others drop to nothing. Leave the Sound page and come back: solo is off. Press the "Mute track" button ("Unmute track" while on):
     that track goes silent with no click. (S and M on the keyboard are Split and Marker, not these.)
   - Mono: both ears the same. Dim: 20 dB lower. The speaker knob changes the level; it stays after leaving the page.
   - Mix A/B: set a fader in A, switch to B (a copy of A the first time), set another, switch back: each keeps its own; one undo step per switch.
3. **Meters move and stop.** Play: the strips and the master meter move with the sound, in the `--on` colour up to -6 dBFS,
   the `--foreground` colour from -6 to -1 dBFS, and the `--mark` colour above -1 dBFS; pause: they empty. A muted or soloed-out track shows nothing.
4. **Live loudness against the export.** On a project with a few tracks, faders and a pan, press Reset in Loudness,
   play from 0:00 to the end without pausing, and note the integrated value (or call `sound_get_levels` from an agent
   at the end). Export the same range as MP4 (Export page, the "Export" row, "What part to export" set to "Whole timeline", which is the composition's full length) and run:
   `ffmpeg -i out.mp4 -af ebur128 -f null - 2>&1 | grep -A8 Summary`. Expected: the two integrated values within 0.5 LU.
   (The preview counts from the last Reset. Solo changes the reading, since it silences the other tracks before the loudness tap, and the export ignores it, so leave it off. Mono, Dim and the speaker volume are fed by the master beside the loudness tap, not after it, so they don't change the reading.)
5. **Edit and Sound mid-play.** Press play on Edit, switch to Sound and back several times while it plays: no gap or
   click in the sound, the loudness reading keeps counting (it doesn't restart), and the Edit viewer has its frames
   back each time (not black or frozen).
6. **Fade handles** drag on the Edit timeline and on the Sound timeline: the fade follows the pointer, the sound's
   fade changes when played, and release is one undo step on each.
7. **Delete on the Sound page.** Select a video clip's sound on the Sound timeline and press Delete: the sound goes,
   the picture stays on Edit. Ctrl+Z brings the sound back.
8. **Windows (WebView2).** On a Windows build or the dev app: the same project plays through the graph (sound present,
   no silence from a `MediaElementSource` on the loopback server), meters move, and the loudness worklet loads (the
   Loudness tab shows numbers a few seconds into play, not a dash for good). The pitch worklet (a clip with a pitch
   shift) plays. If the worklet doesn't load, write the console message; the app should say so once and go on without
   loudness (`loudness()` stays null). Also export once and measure it with the command of step 4.

Not run here: a proxy file through the graph (same server and path), listening by ear, and any Windows build.
