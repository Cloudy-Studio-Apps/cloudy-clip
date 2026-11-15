# Changelog

All notable changes to Cloudy Clip are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

Leer en [español](CHANGELOG.es.md).

## [Unreleased]

### Added

**Volume lines and automation (Sound page)**

- A volume line over every audio clip, made from its volume keyframes: drag a point, double-click to add one, Delete to remove the selected one. It follows speed changes, ramps and splits.
- A volume line per track that stays put when clips move or split. It plays in the preview and is written into the export, also inside placed compositions.
- Draw volume: draw a track's or a clip's line with the pen. Strokes are smoothed to within 0.5 dB and only change the stretch you drew over.
- Fader automation with Read, Touch and Latch on every strip. A fader move while playing is recorded into the line as a trim; one playback is one undo step, loops don't stack and skipped stretches are left alone.
- Pointer tools on the transport: Select, Cut (a blade: click a clip to cut it there, Shift cuts every track), Fade, Draw volume and Scrub.

**Groups, audio formats and stems**

- Group tracks (for example "Dialogue" or "Music & FX") with their own strip, fader, mute and effects. Tracks are sent to a group from the Sends to picker, which can also make a new group. Mix A and B share the same groups; only their settings switch.
- A muted group is silent and no longer ducks other tracks.
- Sound-only exports in WAV, FLAC, AAC and Opus, at 44.1 or 48 kHz; WAV and FLAC in 16 or 24 bit, with dither at 16 bit.
- Stems: one file per group, plus "Other" and the full "Mix", from one FFmpeg run. They add up to the mix before Master.
- Master gets Pan, Mute, Read/Touch/Latch and its own volume line on the Sound timeline.

**Delivery**

- Delivery standards: Spotify, Apple Podcasts, EBU R128 and ATSC A/85 (with their sources), YouTube and TikTok (common practice, no official figure) and Custom.
- Analyze whole mix: integrated loudness, loudness range and true peak of exactly what gets exported, plus a list of problem spots that are also marked on the ruler. Clicking a problem moves the playhead there. It runs in the background, can be cancelled and shows when it's out of date.
- Match target: one undo step through Master's new Trim (−24 to +24 dB), adding a limiter if needed. Exports can match on their own copy without changing the project.
- Spectrum and stereo phase meters in the Loudness tab, and the target line in "Loudness over time".

**Quick tools**

- Find beats: beats found from the sound, shown as ticks on the timeline and used for snapping. Tempo changes are followed.
- Strip silence: removes quiet stretches after a preview of the cuts. On the Sound page it cuts sound only and leaves gaps; on the Edit page (clip menu) it cuts picture and sound and closes the gaps.
- Match level: brings the selected clips to the same loudness, measured as heard, keeping the shape of their volume keyframes.

**Other**

- The compressor shows its live gain reduction in the Channel tab.
- The limiter now holds true peaks (the peaks between samples) under its ceiling, in the preview and the export alike.
- Agents can do everything above through new MCP tools, including cancelling their own scans and reading stored measurements.

### Changed

- Exported volume envelopes (clip keyframes, fades, track lines) change smoothly sample by sample instead of in steps of up to 85 ms.
- The loudness meter reads true peaks the way FFmpeg's measurement does.
- Agent tools that wait on a long job answer within about 25 seconds and report progress; asking again joins the same job.
- Volume-line tools take a `target` (a track or `"master"`) instead of `trackId`.

### Fixed

- FFmpeg jobs no longer keep running after the app quits, and their half-written files are removed. Leftovers from a crash are cleaned up at the next launch.
- The Sound page no longer grows wider than the window, so the mixer and the small preview are always visible.

## [0.0.1] - 2026-11-09

The parts of this release that belong to the Sound page.

### Added

- The Sound page: the audio-only timeline, a mixer with one strip per audio track and Master pinned at its edge, a small preview, and the Clip, Channel, Loudness and Deliver tabs.
- Track volume, pan, mute and solo; Mix A/B; Mono, Dim and the speaker volume.
- Loudness metering (BS.1770) and a loudness history graph.
- Effects on tracks and Master: EQ, compressor, gate, de-esser, limiter, ducking and noise reduction. The preview matches the export sample for sample. Presets, built-in and your own.
- Loop and audio scrub on the Sound page.
- Voice recording onto a track (Linux), saved as WAV next to the project. Record works without arming by making a new Voice track.
- Markers on the Sound page, in their own row under the ruler.

### Fixed

- The app no longer freezes when a video's player is muted while not on screen (a WebKitGTK crash).
