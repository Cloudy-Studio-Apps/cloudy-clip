# Release checklist: 0.1.0

What Cloudy Clip needs before it goes to friends for testing and into real work. Written on 2026-10-30 from reading the code; the app was not run and nothing was tested on Windows.

## Recommended order

1. Save, open, autosave and the close warning (items 1–3). Export and everything else depend on a stable document.
2. Missing media handling (item 4).
3. Export (item 5).
4. Images, volume and fades, then copy/paste and the editing shortcuts (items 7–10).
5. Packaging last (item 6), but test an installer on a clean Windows PC and a clean Linux install early. Problems there don't show up on the development machine.

## Must have before anyone tests it

### 1. Save and open projects

Nothing writes the project to disk, and the app has no save dialog permission (`dialog:allow-open` only, with file access limited to `$APPDATA/fonts`).

- [ ] Define a project file format with a format version from day one
- [ ] Add save, save as and open
- [ ] Make sure projects from 0.1.0 can still be opened by later versions

### 2. Autosave and crash recovery

Nothing protects work if the app crashes.

- [ ] Save a recovery copy on a regular interval
- [ ] Offer to restore it on the next launch

### 3. Warning on close

Nothing tracks unsaved changes or stops the window from closing.

- [ ] Track an unsaved-changes state
- [ ] Ask before closing with unsaved changes
- [ ] Show the state in the window title

### 4. Missing media handling

Projects store only file paths, so a moved file or a project opened on another PC breaks. A clip with missing media only shows the label "Missing media".

- [ ] Detect missing files when a project opens
- [ ] Add a "locate file" step
- [ ] Register the paths again with the Rust side on open

### 5. Export

Export is its own project and likely the hardest item here. The preview runs in the webview, while the final video has to match it.

- [ ] Decide how export renders frames
- [ ] Match the preview for text, stickers, transitions and nested compositions

### 6. Installers friends can use

- [ ] Set up CI (none exists) to build Linux and Windows
- [ ] Bundle FFmpeg, or show a setup screen on first launch. Without it ffprobe never runs, so pro formats may not play and the app doesn't get the file's metadata (sound, frame rate, rotation)
- [ ] Show a clear message when `gst-libav` is missing on Linux (needed for H.264 playback)
- [ ] Tell testers to expect the SmartScreen warning on unsigned Windows builds

## Must have for real work

### 7. Image import

`MediaKind` is only `"video" | "audio"`, so PNG and JPG can't be added. This is probably the most obvious gap for short-form video.

- [ ] Support images as media
- [ ] Give image clips a free duration

### 8. Clip volume and fades

A track can only be muted, and a media clip has no properties of its own, so music can't be lowered under a voice. Audio mixing is out of v1 scope, but these two basics should move in.

- [ ] Add clip volume
- [ ] Add fade in and fade out

### 9. Copy, paste and duplicate clips

None of these have a command or a shortcut.

- [ ] Add copy, paste and duplicate as commands with MCP tools
- [ ] Add the shortcuts

### 10. Precise editing

The only shortcuts now are play, split, delete, undo/redo and Home.

- [ ] Frame stepping with the arrow keys
- [ ] Jump between cuts
- [ ] Trim to the playhead (Q/W style)

### 11. Speed changes

The code says "no speed changes in v1". Short-form editors use this a lot, but it touches clip timing, so it can wait for 0.2 if time is tight.

- [ ] Add clip speed

### 12. Fit and fill

Media clips are always fitted inside the frame.

- [ ] Add a one-click "fill frame", which helps a lot when putting 16:9 footage in 9:16

## Should have for testing

### 13. Feedback from testers

Existing logging was not checked.

- [ ] Show the version number in the app
- [ ] Write a log file testers can send
- [ ] Add a "report a problem" link

### 14. Proxy cache cleanup

No code was found that cleans up the proxy cache, so it keeps growing.

- [ ] Add a size limit or a "clear cache" button

### 15. Update path

There's no auto-updater.

- [ ] At minimum, tell testers when a new version is out

### 16. Help and first run

- [ ] Add a shortcuts list in the app
- [ ] Update the root `README.md`, which still describes less than the app does now

## What can wait

Keyframes, effects, AI features, and macOS and Android support aren't needed for 0.1.0.
