# Cloudy Clip — editor prototype

A clickable HTML/CSS/JS mock of the editor, used to decide how the app looks and feels before
building it in React. Not product code. Open `index.html` in a browser (no build step).

| File | What it holds |
| --- | --- |
| `index.html` | Layout: top bar, tool rail + media bin, preview, inspector, timeline, dialogs |
| `styles.css` | Cloudy Canvas tokens (ice / seal / blush, Cloudy Dark + Light), all component styles |
| `app.js` | Preview frame fit, aspect switch, theme, play clock, panel resizing, media bin |
| `timeline.js` | Document + one undo history (user and agent), tracks, clips, groups, compositions, tools, agent demo |
| `inspector.js` | Project / clip / multi-select inspector, Resolve-style: icon tabs, sections with switch, keyframe and reset; edits commit on release. Sections tagged Soon aren't in the app yet |
| `preview.js` | Draws the timeline at the playhead; select, move, scale, rotate on the canvas |
| `collab.js` | Collaborator avatars; Claude Code presence, access, pause, follow |
| `dialogs.js` | Export (presets, estimate, progress), shortcuts sheet (`?`), first-run tip |

Things to try: Simple / Pro switch (timeline, bottom right) · drag the panel edges · list view and
folders in Media · Ctrl+G and "Make composition", then double-click it · "Agent demo", then Ctrl+Z ·
click the Claude Code avatar · drag the title in the preview · Export.

`designs/` holds three look options for the mascot-led redesign, each a page you can open on its own
(`a-estacion.html`, `b-mesa-de-luz.html`, `c-squish.html`). Only the tabs work. They share the content
in `designs/shared.js` and the stills in `designs/footage/`, and load their fonts from Google Fonts.
