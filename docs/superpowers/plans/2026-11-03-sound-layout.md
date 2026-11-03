# Sound, Layout: The Whole Prototype as UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every element of the Sound prototype (`docs/prototype/designs/sound-page.html`) is on the Sound page, laid out and styled as the prototype draws it. What already works keeps working and moves to its prototype place. What a later stage builds is shown now as a **Coming soon** control: it looks right, does nothing, and says so. The owner's words: "keep everything as layout… don't touch the real logic yet: only folder structure, module structure and UI. Each later stage then does the actual code and process."

**Architecture:** No new module. Rule 10 puts a feature's whole surface in its own folder, and the whole page is `sound`'s (stages 3 to 6 are all `sound` stages). `sound/ui/` is split into one folder per part of the page (transport, mixer, panel, channel, loudness, deliver, lanes, settings, controls, effects, soon), so each later stage lands in a folder that already exists. Unfinished controls go through one sound-level helper (`ui/soon/`) with one catalog of every placeholder, so a later stage finds and removes its own. `timeline` gets small layout extensions it reads itself (a scoped point for track-header controls, an end slot for toolbar tools, and a marks row under the ruler on the sound scope) and a sound-scope look for its header and toolbar. `marker` places its flags in whichever row the timeline says. `preview`, `audio` and `@/ui` each get one small UI change.

**Tech Stack:** TypeScript, React 19, Zustand, Tailwind v4, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-02-sound-page-design.md`. Stage plans: `docs/superpowers/plans/2026-11-03-sound-{1..7}-*.md` (1, 2 and 7 built; 3, 4, 5 and 6 not).

## Global Constraints

- `CLAUDE.md` rules apply. Read the README of every folder you change first (rule 1) and update it in the same task. Done means `pnpm typecheck`, `pnpm lint` and `pnpm test` pass. No Rust is touched.
- Work on the current branch. Commits carry no `Co-Authored-By` line.
- **UI only.** No command, store, engine, export, MCP tool or Rust change. No new command, no new field in the document, no new view state in `sound.store.ts`. The only behaviour allowed is **wiring existing, working commands and APIs into their new places**: Back runs `preview.seek { time: 0 }`, Stop runs `preview.pause`, the header's lettered M runs `timeline.setTrackMuted`, the header's S runs `sound.setSolo`, the header's R calls `sound.arm` (`recorder.arm`), a preset name under Others runs `sound.applyPreset`. Layout APIs (a point, a type field, a row and a hook in `timeline`, a prop on `preview`'s `Timecode` and `PreviewStage`) are allowed: they carry components and positions, not logic.
- **Supersedes** the spec's anti-goal "An unfinished tool is absent, not disabled" and stage 1's "Nothing from later stages appears, not even disabled", by the owner's request of 3 Nov 2026. The spec is amended in Task 10.
- **The UI never lies about the mix.** A placeholder shows the prototype's shape, never the prototype's example numbers or names. Where nothing real exists, it shows `—` or an honest empty line (Ruling 1). Real data the app already has (a clip's gain, the selected strip's name, the track count and length) is shown for real.
- Tokens only (rule 34), sharp shapes (rule 35: the prototype's round play button and record dot stay square, as today), one component per file, types in `.types.ts`, no React state per frame (rule 24).
- **No tests** (rule 3): nothing here is kernel or document integrity.

## Reuse

- `@/ui`: `IconButton` (Back, Play's neighbours, Stop, Record, Loop, the toolbar's icon-only actions), `SegmentedControl` (panel tabs, mixer filter), `Button`, `EmptyState`, `Switch`, `SelectField`, `ToolbarButton`. `StripToggle` moves to the kit as `LetterToggle` because `timeline` now needs it too (rule 33); no copy.
- `preview`: `PlayButton`, `Timecode`, `FieldGuide` (already the Edit stage's corners and centre lines; the bare stage gets it too), the `seek` and `pause` commands.
- `sound`: `TransportTool`, `TransportSeparator`, `PanelCard`, `StripLabel`, `EffectChain`, `Fader`, `Meter`, `LineSlider`; `ArmButton` and the solo command move into the header unchanged.
- `timeline`: `inScope`, `useTimelineScope`, the `Scoped` contract; no second filter.

## Rulings

### Ruling 1: How a control that doesn't work yet looks and behaves

**One helper, sound-level.** `ui/soon/soon.props.ts` exports `soon(id)`, which returns the props every placeholder button, value or row spreads: `aria-disabled="true"`, `title` from the catalog ("Draw volume: coming soon. Draws volume over clips and tracks."), `cursor-default`, and a click handler that only prevents default. It never runs a command, never writes a store, never fakes data. `ui/soon/soon.catalog.ts` is the one list of every placeholder: `{ id, label, what, stage }` (`stage`: `"2-followup"`, 3, 4, 5 or 6). Each later stage removes its entries and the `soon(…)` calls; when the catalog is empty, the folder goes.

- **Why sound-level, not kit:** only `sound` draws placeholders (the header's and toolbar's are `sound` components contributed through points). Rule 33 moves a piece to `@/ui` when a second module needs it; none does.
- **Why not `disabled`:** the kit's disabled look is 35 % opacity, which reads as broken and changes the prototype's look. A placeholder keeps its normal colour, gets no hover highlight, and the tooltip says it's coming. Screen readers hear "dimmed" through `aria-disabled`.
- **Why one catalog:** the plans of stages 2 (a follow-up) to 6 get a step "remove your entries from `soon.catalog.ts`" (Task 10), so no placeholder outlives its feature and none is forgotten.
- **Every placeholder has a stage** (owner's answer 3): no control promises what no plan builds. The ones the stage plans didn't name are added to them in Task 10.

**Placeholder data, case by case:**

| Where                                     | Prototype shows                                                  | This plan shows                                                                  | Why                                                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Deliver › Delivery standard               | YouTube, −14 LUFS, −1 dBTP                                       | Preset `—` ▾, Loudness `—`, Peak limit `—`                                       | No `delivery` in the document; stage 5 must check each figure against the platform first                         |
| Deliver › Problems                        | "2", two problem rows                                            | No count; one line: "Analyze the mix to find peaks over the limit and clipping." | Nothing was analyzed; an invented problem would send the user to fix nothing                                     |
| Deliver › Audio format                    | AAC 320, 48 kHz, Stereo                                          | Codec `—` ▾, Sample rate `—` ▾, Channels `Stereo`                                | The formats are stage 4; Stereo is true (the spec's non-goal: stereo only)                                       |
| Deliver › Stems                           | Dialogue WAV, Music & FX WAV, Full mix, Match target, all ticked | Full mix and Match target on export, unticked                                    | Dialogue and Music & FX are groups this project doesn't have; nothing is chosen yet                              |
| Loudness › Frequency spectrum             | A curve                                                          | The graph box with its grid, no curve                                            | No spectrum is measured (stage 5)                                                                                |
| Loudness › Stereo phase                   | +0.72, Yes                                                       | Correlation `—`, Mono safe `—`                                                   | Stage 5                                                                                                          |
| Channel › Compressor › Reduction          | −4.2 dB                                                          | `—`                                                                              | No live gain-reduction reading exists                                                                            |
| Mixer filter                              | All, Dialogue, Music & FX                                        | All                                                                              | Filters are one per group (stage 4); this project has none                                                       |
| Group strips (Dialogue, Music & FX, BUS)  | Two bus strips                                                   | None                                                                             | No groups exist; a fake strip would look mixable                                                                 |
| Timeline tools › "Automation: Touch"      | Touch                                                            | "Automation —"                                                                   | No automation exists (stage 3)                                                                                   |
| Volume line with diamonds on Music        | A ducking line                                                   | Nothing yet                                                                      | Drawing it needs stage 3's content-time geometry; a read-only line over clips would invite drags that do nothing |
| Beat ticks, red problem marks (marks row) | Ticks, two red marks                                             | Nothing                                                                          | Data only stages 5 and 6 produce; a tick without a beat is a lie                                                 |
| Clip gain badge ("+2.0 dB")               | Badge                                                            | **Real**: the clip's `sound.volumeDb` when it isn't 0 and isn't keyed            | The value exists                                                                                                 |
| "12 tracks, 1:32"                         | Note                                                             | **Real**: audio tracks of the open composition, its length                       | The values exist                                                                                                 |
| "A1 Voice 1" beside the panel tabs        | Label                                                            | **Real**: the marked strip (`view.selected`), or nothing                         | The value exists                                                                                                 |
| Master › Sends to "Output 1-2"            | Text                                                             | `Output 1-2`                                                                     | True: the master is the stereo out, the only one                                                                 |

### Ruling 2: Which module owns which UI

| UI                                                                                                | Module                                               | Why                                                                                                     |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Transport row, mixer, bottom panel and all its tabs, every placeholder                            | `sound`                                              | Rule 10: the Sound page is `sound`'s whole surface, and stages 3 to 6 are `sound` stages                |
| Pen (Draw volume), "Automation —" and "N tracks, length" in the timeline's tools row              | `sound`, through `timelineTools`                     | The timeline owns its toolbar and takes tools through points (rule 13); these are sound's tools         |
| S (solo) and R (arm) on a track header                                                            | `sound`, through a new `timelineTrackControls` point | Solo and arming are `sound`'s; the header is `timeline`'s; a point keeps `timeline` ignorant of `sound` |
| The sound-scope header itself (A-code, name, lettered M, hover remove), icon-only toolbar actions | `timeline`                                           | Its own components and its own `setTrackMuted`; the scope is a timeline concept                         |
| Clip gain badge                                                                                   | `audio`, through `clipActions`                       | `audio` owns `Clip.sound` and already badges clips with fade handles                                    |
| Compact timecode, field guide on the small preview                                                | `preview`                                            | Its own components                                                                                      |
| The marks row under the ruler (sound scope), the loop band in it                                  | `timeline`                                           | Its own layout; `useFlagRow()` tells overlays where flags go, so no module branches on the page         |
| Marker flags in that row                                                                          | `marker`                                             | Its own flags, placed by `useFlagRow()`                                                                 |
| `LetterToggle` (M, S, R, Read)                                                                    | `@/ui`                                               | Two modules use it now (rule 33)                                                                        |

**No new module.** The rules call for one only when functionality has no owner (rule 7). Every element here has one. A "sound-ui" module would split `sound`'s surface in two, against rule 10.

### Ruling 3: Folder structure inside `sound/ui`, done now

The owner asked for the folder structure now, and the later plans already name files (`ui/DeliverTab.tsx`, `ui/BusStrip.tsx`, `ui/BeatTicks.tsx`…), so Task 1 reorganises the existing 54 files by pure moves (no code change but import paths), in its own commit. Each folder has an `index.ts` listing what sibling folders import; `ui/index.ts` stays the list of what `sound.module.ts` contributes (`docs/modules.md`). Inside a folder, relative imports; across folders, `../<folder>` (its `index.ts`). No folder READMEs: the module README's Files list is organised by folder instead (the repo's precedent: `text/ui/controls/`, `inspector/ui/controls/` have none).

| Folder          | Holds                                                                                        | Later stages land here                                                                  |
| --------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `ui/transport/` | The transport row and its tools, Record, Loop, Mix A/B, monitor                              | 3 (pointer tools, automation mode), 6 (quick tools)                                     |
| `ui/controls/`  | Sliders shared by the mixer and the transport (`LineSlider`, `slider.hook`, `fader.gesture`) | 3 (fader offset)                                                                        |
| `ui/mixer/`     | Mixer panel and bar, strips, Master, fader, pan, meters                                      | 3 (Read/Touch/Latch), 4 (`BusStrip`, Sends to, filters, Master's Pan/M/Read)            |
| `ui/effects/`   | Effect chain on strips, `+ Effect`, effect sections, their hooks                             | —                                                                                       |
| `ui/panel/`     | The panel under the timeline: tabs, `PanelCard`, `PanelValue`                                | —                                                                                       |
| `ui/channel/`   | Channel tab, preset card, save form                                                          | —                                                                                       |
| `ui/loudness/`  | Loudness tab, history, spectrum and phase cards                                              | 5 (`SpectrumGraph`, `PhaseMeter`)                                                       |
| `ui/deliver/`   | Deliver tab and its four cards                                                               | 4 (formats, stems), 5 (`ProblemList`, analysis)                                         |
| `ui/lanes/`     | What `sound` puts on the timeline: the recording take, header S/R, toolbar tools             | 3 (`ClipVolumeLine`, `TrackVolumeLine`, the blade), 5 (`ProblemMarks`), 6 (`BeatTicks`) |
| `ui/settings/`  | Settings › Sound presets                                                                     | —                                                                                       |
| `ui/soon/`      | The placeholder helper and catalog (Ruling 1)                                                | shrinks with each stage, then goes                                                      |

### Ruling 4: Existing UI that differs from the prototype, and is fixed here (look only)

| Now                                                                                      | Prototype                                                                                                                     | Fix                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Record is a word with a square dot; Loop is the word "Loop"                              | Icons                                                                                                                         | `IconButton`s: Record (the `RecordDot` in `--mark`), Loop (`Repeat`, `--on` when on). Recording keeps its states as an icon in `--mark` fill plus the `mm:ss` clock; "Starting…"/"Saving…" become the tooltip with the dot pulsing |
| No Back, no Stop                                                                         | Back, Play, Stop                                                                                                              | Back (`SkipBack`) and Stop (`Square`) wired to `preview.seek {0}` and `preview.pause`                                                                                                                                              |
| Order: time, Play, Loop, Record \| Cut, Snap                                             | time, Back, Play, Stop, Record, Loop \| Select, Cut, Fade, Draw volume, Scrub, Snap \| Find beats, Strip silence, Match level | Reordered; Select drawn as the current pointer tool (underlined in `--mark`); Cut becomes the blade tool placeholder (cut at the playhead stays on the toolbar's Split and S)                                                      |
| Timecode "00:24.14 / 01:32.00"                                                           | "0:24.14", the hundredths muted, no length                                                                                    | `Timecode compact`: hundredths in `--subtle-foreground`, no length (the length moves to the timeline's tools row)                                                                                                                  |
| Panel tabs Clip, Channel, Loudness (kit segmented, no label)                             | Channel, Loudness, Deliver, 96 px tabs, "A1 Voice 1" at the right                                                             | Clip, Channel, Loudness, Deliver (Clip kept first, owner's answer 1), 96 px, default Channel, the marked strip's code and name at the right                                                                                        |
| Preset card titled with the strip's name, "Apply a preset…" picker, note, Save, + Effect | Card "Preset": Sound ▾, Others: names, Save as preset (full width)                                                            | Title "Preset"; a "Sound" row holding the picker; "Others" listing the presets as links (each runs `sound.applyPreset`); Save as preset full width; the note goes; `+ Effect` stays (works)                                        |
| Effect sections: switch at the left, fold chevron, remove X                              | Title at left, switch at right, no fold; off cards dimmed to 40 %                                                             | `EffectSection` drawn as a `PanelCard`: title, remove X (on hover), switch at the right; values at 40 % when off; EQ and Compressor `row-span-2`                                                                                   |
| Panel grids 280 px / 240 px columns                                                      | 216 px                                                                                                                        | 216 px for Channel, Loudness and Deliver (Clip keeps the inspector's 280)                                                                                                                                                          |
| Program loudness number at 14 px                                                         | 26 px                                                                                                                         | `text-display` (19 px), the largest the type scale allows besides the wordmark (rule 35)                                                                                                                                           |
| Strip buttons M, S, R                                                                    | Strip: M, S, Read. Header: M, S, R                                                                                            | R moves to the track header; strips get Read (placeholder)                                                                                                                                                                         |
| Master: effects, fader, meters                                                           | + Sends to, Pan, M, Read                                                                                                      | Sends to `Output 1-2`; Pan, M and Read as stage 4 placeholders                                                                                                                                                                     |
| Mixer header: title, count, Expand all                                                   | + All / Dialogue / Music & FX                                                                                                 | The filter row with All only (Ruling 1)                                                                                                                                                                                            |
| Track header (Sound): kind icon, mono name, volume icon, X; width 132                    | A1 code over two rows, name in hand, lettered M S R; width 164                                                                | Sound-scope header: code, name (`font-hand`), `LetterToggle` M, then S and R from the point; X on hover; `SOUND_HEADER_WIDTH` 164                                                                                                  |
| Toolbar (Sound): keyframe switch, Split, Delete, Audio track with words; zoom            | Scissors and pen icons; notes at the right                                                                                    | Icon-only actions on the sound scope; pen placeholder; "Automation —" and "N tracks, length" at the right, before zoom                                                                                                             |
| Small preview: canvas only                                                               | Frame with red corners and centre lines, 22 px inset                                                                          | `PreviewStage bare` draws `FieldGuide` and keeps a 22 px inset                                                                                                                                                                     |
| Markers and loop band on the ruler (Sound page)                                          | A second 20 px row under the ruler: markers, loop, beats, problem marks                                                       | On the sound scope only, the timeline draws a marks row; marker flags and the loop band sit there. Edit unchanged                                                                                                                  |
| No gain on clips                                                                         | Red "+2.0 dB" at the clip's top right                                                                                         | `audio.gainBadge` (Ruling 1)                                                                                                                                                                                                       |

**Differences kept on purpose:** the round play button and round record dot (rule 35 allows no round controls); audio lanes 44 px high, not 60 (the lane height is the timeline's geometry for drops and hit tests, `trackHeight`, shared with Edit); effect values stay sliders (`SoundRow`), not read-only values, since they edit; the noise-reduction card keeps "Measure floor" at the playhead, which works, instead of "Learn from: Selection"; Delete, Audio track, the keyframe switch and zoom stay in the toolbar (they work), icon-only; the exposure-sheet column rules behind the lanes aren't drawn (they're a % of the width and wouldn't follow zoom); "Mark new tools" is a mockup tool, not app UI; the top bar is the shell's (it adds Tint and the history controls, fine).

## Gap table

Status: **=** exists and matches · **≠** exists, differs (how) · **✗** missing. "Waits for": the stage whose logic makes it work; "—" when it works now or shows real data. Paths are under `src/modules/sound/ui/` unless they start with a module name.

### Top bar and transport row

| Element            | Now                                                 | Waits for                                | UI goes in                                                            |
| ------------------ | --------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| Top bar            | = (shell; adds Tint, history; no "Mark new tools")  | —                                        | `src/app/top-bar/` (no change)                                        |
| Timecode           | ≠ shows the length; hundredths not muted            | —                                        | `preview/ui/Timecode.tsx` (`compact`), `transport/SoundTransport.tsx` |
| Back               | ✗                                                   | — (`preview.seek`)                       | `transport/PlaybackButtons.tsx`                                       |
| Play               | = (square, rule 35)                                 | —                                        | `transport/PlaybackButtons.tsx` (`PlayButton`)                        |
| Stop               | ✗                                                   | — (`preview.pause`)                      | `transport/PlaybackButtons.tsx`                                       |
| Record             | ≠ word + dot                                        | —                                        | `transport/RecordButton.tsx`                                          |
| Loop               | ≠ word                                              | —                                        | `transport/LoopToggle.tsx`                                            |
| Select             | ✗                                                   | — (the only pointer tool; shown current) | `transport/PointerTools.tsx`                                          |
| Cut (blade tool)   | ≠ an action: cut at the playhead (moves to Split/S) | 3                                        | `transport/PointerTools.tsx` (soon)                                   |
| Fade               | ✗                                                   | 3 (fade handles work already)            | `transport/PointerTools.tsx` (soon)                                   |
| Draw volume        | ✗                                                   | 3                                        | `transport/PointerTools.tsx` (soon)                                   |
| Scrub              | ✗                                                   | 3 (ruler scrub works already)            | `transport/PointerTools.tsx` (soon)                                   |
| Snap               | =                                                   | —                                        | `transport/PointerTools.tsx`                                          |
| Find beats         | ✗                                                   | 6                                        | `transport/QuickTools.tsx` (soon)                                     |
| Strip silence      | ✗                                                   | 6                                        | `transport/QuickTools.tsx` (soon)                                     |
| Match level        | ✗                                                   | 6                                        | `transport/QuickTools.tsx` (soon)                                     |
| Mix A / Mix B      | =                                                   | —                                        | `transport/MixSwitch.tsx`                                             |
| Mono, Dim, speaker | =                                                   | —                                        | `transport/MonitorControls.tsx`                                       |

### Timeline on this page

| Element                          | Now                            | Waits for           | UI goes in                                                         |
| -------------------------------- | ------------------------------ | ------------------- | ------------------------------------------------------------------ |
| Scissors icon                    | ≠ "Split" with a word          | —                   | `timeline/ui/ToolbarAction.tsx`, `timeline/ui/TimelineToolbar.tsx` |
| Pen icon (Draw volume)           | ✗                              | 3                   | `lanes/DrawVolumeTool.tsx` (soon), `timelineTools`                 |
| Peg bar                          | =                              | —                   | `timeline/ui/PegBar.tsx`                                           |
| "Automation: Touch"              | ✗                              | 3                   | `lanes/AutomationNote.tsx` (soon), `timelineTools` slot `end`      |
| "12 tracks, 1:32"                | ✗                              | —                   | `lanes/SheetNote.tsx`, `timelineTools` slot `end`                  |
| Ruler with times                 | =                              | —                   | `timeline/ui/Ruler.tsx`                                            |
| Marks row under the ruler        | ✗                              | —                   | `timeline/ui/MarksRow.tsx`                                         |
| Marker flags                     | ≠ in the ruler                 | —                   | `marker/ui/MarkerFlag.tsx` (`useFlagRow`)                          |
| Loop region                      | ≠ on the ruler                 | —                   | `timeline/ui/LoopBand.tsx` in `MarksRow` on the sound scope        |
| Beat ticks                       | ✗                              | 6                   | `lanes/BeatTicks.tsx` (stage 6, in the marks row)                  |
| Red problem marks                | ✗                              | 5                   | `lanes/ProblemMarks.tsx` (stage 5, in the marks row)               |
| Header A-code ("A1")             | ✗                              | —                   | `timeline/ui/TrackHeaderSheet.tsx`                                 |
| Header name                      | ≠ mono, muted; kind icon       | —                   | `timeline/ui/TrackHeaderSheet.tsx`                                 |
| Header M                         | ≠ volume icon                  | —                   | `timeline/ui/TrackHeaderSheet.tsx` (`LetterToggle`)                |
| Header S                         | ✗                              | — (`sound.setSolo`) | `lanes/SoloButton.tsx`, `timelineTrackControls`                    |
| Header R                         | ≠ on the strip, not the header | — (`recorder.arm`)  | `lanes/ArmButton.tsx` (moved), `timelineTrackControls`             |
| Header remove (not in prototype) | ≠ always shown                 | —                   | `timeline/ui/TrackHeaderSheet.tsx` (on hover)                      |
| Header width                     | ≠ 132                          | —                   | `timeline/timeline.layout.ts` (164)                                |
| Clip name label                  | =                              | —                   | `timeline/ui/TimelineClip.tsx`                                     |
| Clip waveform                    | = (decorative, as everywhere)  | —                   | `@/ui` `Waveform`                                                  |
| Clip fades                       | = (handles)                    | —                   | `audio/ui/FadeHandles.tsx`                                         |
| Clip gain badge                  | ✗                              | —                   | `audio/ui/GainBadge.tsx`                                           |
| Volume line with diamonds        | ✗ (Ruling 1)                   | 3                   | `lanes/ClipVolumeLine.tsx`, `lanes/TrackVolumeLine.tsx` (stage 3)  |
| Selected track (red edge)        | =                              | —                   | `timeline/ui/TrackHeader.tsx`                                      |
| Playhead                         | =                              | —                   | `timeline/ui/Playhead.tsx`                                         |

### Bottom panel

| Element                                                                       | Now                                             | Waits for               | UI goes in                                                 |
| ----------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------- | ---------------------------------------------------------- |
| Tabs Channel, Loudness, Deliver                                               | ≠ Clip, Channel, Loudness; no Deliver           | —                       | `panel/SoundPanel.tsx`                                     |
| "A1 Voice 1" at the right                                                     | ✗                                               | —                       | `panel/PanelWho.tsx`                                       |
| Channel › Preset: Sound ▾                                                     | ≠ "Apply a preset…", strip name as title        | —                       | `channel/PresetCard.tsx`                                   |
| Channel › Preset: Others                                                      | ✗                                               | — (`sound.applyPreset`) | `channel/PresetOthers.tsx`                                 |
| Channel › Preset: Save as preset                                              | ≠ small, beside + Effect                        | —                       | `channel/PresetCard.tsx`                                   |
| Channel › Equalizer (switch, graph)                                           | ≠ switch left, fold, not tall                   | —                       | `effects/EffectSection.tsx`, `effects/EqEffectSection.tsx` |
| Channel › Compressor (graph, Ratio)                                           | ≠ as EQ                                         | —                       | `effects/CompressorSection.tsx`                            |
| Channel › Compressor › Reduction                                              | ✗                                               | 2 follow-up             | `effects/CompressorSection.tsx` (soon)                     |
| Channel › Noise reduction (Amount)                                            | ≠ card look                                     | —                       | `effects/DenoiseSection.tsx`                               |
| Channel › Noise reduction › Learn from                                        | ≠ "Measure floor" (kept, Ruling 4)              | —                       | `effects/DenoiseSection.tsx`                               |
| Channel › De-esser (Frequency, Amount)                                        | ≠ card look                                     | —                       | `effects/DeesserSection.tsx`                               |
| Channel › Ducking (Listens to, By)                                            | ≠ card look; toggles instead of a picker (kept) | —                       | `effects/DuckSection.tsx`                                  |
| Channel › Noise gate (off, dimmed)                                            | ≠ card look; off not dimmed                     | —                       | `effects/GateSection.tsx`, `effects/EffectSection.tsx`     |
| Loudness › Program loudness (big number, 4 rows)                              | ≠ 14 px number; extra Reset and note (kept)     | —                       | `loudness/LoudnessTab.tsx`, `panel/PanelValue.tsx`         |
| Loudness › Loudness over time                                                 | =                                               | —                       | `loudness/LoudnessHistory.tsx`                             |
| Loudness › Frequency spectrum                                                 | ✗                                               | 5                       | `loudness/SpectrumCard.tsx` (soon)                         |
| Loudness › Stereo phase                                                       | ✗                                               | 5                       | `loudness/PhaseCard.tsx` (soon)                            |
| Deliver › Delivery standard (Preset, Loudness, Peak limit, Analyze whole mix) | ✗                                               | 5                       | `deliver/StandardCard.tsx` (soon)                          |
| Deliver › Problems (count, rows, hint)                                        | ✗                                               | 5                       | `deliver/ProblemsCard.tsx`                                 |
| Deliver › Audio format (Codec, Sample rate, Channels)                         | ✗                                               | 4, 5                    | `deliver/FormatCard.tsx` (soon)                            |
| Deliver › Stems (checks)                                                      | ✗                                               | 4, 5                    | `deliver/StemsCard.tsx`, `deliver/CheckRow.tsx` (soon)     |
| Small preview with corners                                                    | ≠ no corners, no inset                          | —                       | `preview/ui/PreviewStage.tsx`                              |

### Mixer

| Element                                       | Now                 | Waits for  | UI goes in                              |
| --------------------------------------------- | ------------------- | ---------- | --------------------------------------- |
| Title "Mixer"                                 | =                   | —          | `mixer/MixerBar.tsx`                    |
| Filter All / Dialogue / Music & FX            | ✗                   | 4          | `mixer/MixerFilter.tsx` (All only)      |
| Strip count                                   | =                   | —          | `mixer/MixerBar.tsx`                    |
| Expand all / Back to timeline                 | =                   | —          | `mixer/MixerBar.tsx`                    |
| Strip name, A-number                          | =                   | —          | `mixer/MixerStrip.tsx`                  |
| Effects list, + Effect                        | =                   | —          | `effects/EffectChain.tsx`               |
| Sends to                                      | = (text "Master")   | 4 (picker) | `mixer/MixerStrip.tsx`                  |
| Pan                                           | =                   | —          | `mixer/PanSlider.tsx`                   |
| Fader with scale, meters, dB readout          | =                   | —          | `mixer/Fader.tsx`, `mixer/Meter.tsx`    |
| M, S                                          | =                   | —          | `mixer/MixerStrip.tsx` (`LetterToggle`) |
| Read                                          | ✗ (R there instead) | 3          | `mixer/ReadButton.tsx` (soon)           |
| Group strips                                  | ✗                   | 4          | `mixer/BusStrip.tsx` (stage 4)          |
| Master: name, OUT, effects, fader, meters, dB | =                   | —          | `mixer/MasterStrip.tsx`                 |
| Master: Sends to "Output 1-2"                 | ✗                   | —          | `mixer/MasterStrip.tsx`                 |
| Master: Pan                                   | ✗                   | 4          | `mixer/MasterPan.tsx` (soon)            |
| Master: M                                     | ✗                   | 4          | `mixer/MasterStrip.tsx` (soon)          |
| Master: Read                                  | ✗                   | 4          | `mixer/ReadButton.tsx` (soon)           |

## File Tree

`+` new, `~` edited, `-` removed, `>` moved (old path → new folder, imports only). Under `src/modules/sound/ui/` unless stated.

```
CLAUDE.md
  ~ rule 13: the timeline reads timelineTrackControls; rule 33: LetterToggle in the kit list
docs/superpowers/specs/
  ~ 2026-11-02-sound-page-design.md      anti-goal amended (Ruling 1); "The page" lists the four tabs
docs/superpowers/plans/
  + 2026-11-03-sound-layout.md           this plan
  ~ 2026-11-03-sound-2-effects.md        follow-up task: the compressor's live Reduction reading
  ~ 2026-11-03-sound-3-volume-lines.md   paths; + the pointer tools: blade Cut, Fade, Scrub; "remove soon entries" step
  ~ 2026-11-03-sound-4-groups-and-stems.md   paths; + Master's Pan, M and Read; same step
  ~ 2026-11-03-sound-5-delivery.md       paths under ui/deliver, ui/loudness, ui/lanes; same step
  ~ 2026-11-03-sound-6-quick-tools.md    paths under ui/transport, ui/lanes; same step
src/ui/
  + kit/LetterToggle.tsx                 StripToggle, moved and renamed (M, S, R, Read)
  ~ index.ts, README.md
src/modules/timeline/
  ~ timeline.points.ts                   + timelineTrackControls
  ~ timeline.types.ts                    TimelineTrackControl; TimelineTool.slot?: "start" | "end"
  ~ timeline.layout.ts                   SOUND_HEADER_WIDTH 164; MARKS_HEIGHT 20; rowsAbove(scope)
  ~ ui/Ruler.tsx                         the loop band on "all" only
  + ui/MarksRow.tsx                      the sound scope's row under the ruler, with the loop band
  + ui/flag.row.hook.ts                  useFlagRow(): where flags and ticks go in this panel
  ~ index.ts, README.md
  ~ ui/TimelineToolbar.tsx               end slot; ToolbarAction for its own buttons
  + ui/ToolbarAction.tsx                 icon and word on "all", icon only on "sound"
  ~ ui/TrackHeader.tsx                   picks the sheet body on the sound scope
  + ui/TrackHeaderSheet.tsx              code, name, lettered M, point controls, X on hover
  + ui/TrackControls.tsx                 the timelineTrackControls entries in scope
  ~ ui/TimelinePanel.tsx                 passes each lane's position for the code; MarksRow on "sound"
src/modules/marker/
  ~ ui/MarkerFlag.tsx, README.md         flag placed by useFlagRow()
src/modules/preview/
  ~ ui/Timecode.tsx                      compact
  ~ ui/PreviewStage.tsx                  bare: FieldGuide, 22 px inset
  ~ README.md
src/modules/audio/
  + ui/GainBadge.tsx
  ~ ui/index.ts, audio.module.ts, README.md
src/modules/sound/
  ~ sound.module.ts                      contributes header S/R, pen, notes
  ~ sound.types.ts                       SoundPanelTab + "deliver"; SoonId, SoonEntry
  ~ README.md
  ui/
    ~ index.ts                           paths
    ~ SoundPage.tsx                      paths
    transport/
      + index.ts
      > SoundTransport.tsx  ~ (order, PlaybackButtons, PointerTools, QuickTools, compact Timecode)
      > TransportTool.tsx   ~ (current: underline in --mark)
      > TransportSeparator.tsx, MixSwitch.tsx, MonitorControls.tsx, RecordDot.tsx, RecordingClock.tsx
      > RecordButton.tsx    ~ (icon)
      > LoopToggle.tsx      ~ (icon)
      + PlaybackButtons.tsx, PointerTools.tsx, QuickTools.tsx
    controls/
      + index.ts
      > LineSlider.tsx, slider.hook.ts, fader.gesture.ts
    mixer/
      + index.ts
      > MixerPanel.tsx      ~ (MixerBar)
      > MixerStrip.tsx      ~ (Read instead of R, LetterToggle)
      > MasterStrip.tsx     ~ (Sends to, Pan, M, Read)
      > StripLabel.tsx, Fader.tsx, PanSlider.tsx, Meter.tsx, meters.loop.ts, meters.hook.ts, meters.context.ts
      + MixerBar.tsx, MixerFilter.tsx, ReadButton.tsx, MasterPan.tsx
      - StripToggle.tsx     (now @/ui LetterToggle)
    effects/
      + index.ts
      > EffectChain.tsx, AddEffectMenu.tsx, chain.gesture.ts, DenoiseMark.tsx, denoise.hook.ts, effect.edit.hook.ts
      ~ EffectSection.tsx   (card look, switch right, off dimmed)
      ~ CompressorSection.tsx (Reduction row, tall), EqEffectSection.tsx (tall)
      = EffectBody.tsx, EffectRow.tsx, TransferGraph.tsx, DeesserSection.tsx, DenoiseSection.tsx (path of denoise.hook only),
        DuckSection.tsx, GateSection.tsx, LimiterSection.tsx
    panel/
      + index.ts
      > SoundPanel.tsx      ~ (four tabs, 96 px, default Channel, PanelWho)
      > PanelCard.tsx       ~ (dim prop for an off effect)
      + PanelWho.tsx, PanelValue.tsx
    channel/
      + index.ts
      > ChannelTab.tsx      ~ (216 px grid)
      > PresetCard.tsx      ~ (Preset, Sound row, Others, full-width Save)
      > SavePresetForm.tsx
      + PresetOthers.tsx
    loudness/
      + index.ts
      > LoudnessTab.tsx     ~ (text-display, PanelValue rows, 216 px, spectrum and phase cards)
      > LoudnessHistory.tsx, loudness.hook.ts
      + SpectrumCard.tsx, PhaseCard.tsx
    deliver/
      + index.ts, DeliverTab.tsx, StandardCard.tsx, ProblemsCard.tsx, FormatCard.tsx, StemsCard.tsx, CheckRow.tsx
    lanes/
      + index.ts
      > RecordingTake.tsx   ~ (top of the new-track lane from rowsAbove)
      > ArmButton.tsx       ~ (LetterToggle)
      + SoloButton.tsx, DrawVolumeTool.tsx, AutomationNote.tsx, SheetNote.tsx
    settings/
      + index.ts
      > PresetsSection.tsx, PresetRow.tsx
    soon/
      + index.ts, soon.props.ts, soon.catalog.ts
```

---

### Task 1: The folder structure

**Files:** every `>` line of the tree; `ui/index.ts`, `ui/SoundPage.tsx`, `sound.module.ts` (import paths), `sound/README.md`.

- [ ] **Step 1:** `git mv` each file into its folder as the tree says (`StripToggle.tsx` goes to `mixer/` for now; Task 2 removes it). Move nothing else, rename nothing.
- [ ] **Step 2:** Fix the relative imports. Add each folder's `index.ts`, exporting only what another folder imports (for example `effects/index.ts`: `EffectChain`, `AddEffectMenu`; `controls/index.ts`: `LineSlider`; `transport/index.ts`: `SoundTransport`). `ui/index.ts` keeps exporting `SoundPage`, `PresetsSection`, `RecordingTake` from their new paths.
- [ ] **Step 3:** Rewrite the README's **Files** list by folder (one bullet per folder, the same facts), so later stages add to the right bullet.
- [ ] **Step 4:** `pnpm typecheck && pnpm lint && pnpm test`; the app looks and works exactly as before. Commit: `refactor(sound): ui in one folder per part of the page`.

### Task 2: The placeholder helper, the value row and LetterToggle

**Files:** Create `soon/index.ts`, `soon/soon.props.ts`, `soon/soon.catalog.ts`, `panel/PanelValue.tsx`, `src/ui/kit/LetterToggle.tsx`. Modify `sound.types.ts`, `mixer/MixerStrip.tsx`, `lanes/ArmButton.tsx`, `src/ui/index.ts`, `src/ui/README.md`, `CLAUDE.md` (rule 33), `sound/README.md`. Remove `mixer/StripToggle.tsx`.

**Interfaces:**

- `sound.types.ts`: `type SoonId` (the catalog's ids as a union), `interface SoonEntry { id: SoonId; label: string; what: string; stage: "2-followup" | 3 | 4 | 5 | 6 }`.
- `soon(id: SoonId)`: `{ "aria-disabled": true; title: string; className: string; onClick(event): void }`. Title: `"<label>: coming soon. <what>"`. The class removes hover colour changes and sets `cursor-default`.
- `soon.catalog.ts`: one entry per placeholder of the gap table (`transport.cut`, `transport.fade`, `transport.drawVolume`, `transport.scrub`, `transport.findBeats`, `transport.stripSilence`, `transport.matchLevel`, `lanes.drawVolume`, `lanes.automation`, `mixer.filter`, `mixer.read`, `master.pan`, `master.mute`, `master.read`, `compressor.reduction`, `loudness.spectrum`, `loudness.phase`, `deliver.standard`, `deliver.analyze`, `deliver.format`, `deliver.stems`). TSDoc at the top: each stage removes its entries.
- `PanelValue({ label, value?, unit?, pick?, tone?, valueRef?, soon? })`: the prototype's `.prop` row: label left, value in mono with an underline, unit small, `▾` when `pick`, `tone` `"mark"` (changed) or `"on"` (good). `valueRef` lets the Loudness tab write the value through the DOM (rule 24).
- `LetterToggle({ on, label, tone: "mark" | "ink", onToggle, children, ...rest })`: `StripToggle` unchanged but for its name and passing extra button props (so `soon()` can spread onto it).

- [ ] **Step 1:** Move `StripToggle` to `src/ui/kit/LetterToggle.tsx`; export it from `@/ui` with TSDoc; `MixerStrip` and `ArmButton` use it; delete `mixer/StripToggle.tsx`. Add it to the kit list in rule 33 and to `src/ui/README.md`.
- [ ] **Step 2:** Write `soon/` and `PanelValue`. No placeholder is used yet.
- [ ] **Step 3:** README: a **Placeholders** bullet (Ruling 1: what `soon()` does, where the catalog is, that each stage removes its entries). Full checks. Commit: `feat(sound): one way to show what's coming`.

### Task 3: The transport row and the small preview

**Files:** Create `transport/PlaybackButtons.tsx`, `transport/PointerTools.tsx`, `transport/QuickTools.tsx`. Modify `transport/SoundTransport.tsx`, `transport/TransportTool.tsx`, `transport/RecordButton.tsx`, `transport/LoopToggle.tsx`, `src/modules/preview/ui/Timecode.tsx`, `preview/ui/PreviewStage.tsx`, `preview/README.md`, `sound/README.md`.

**Interfaces:** `Timecode({ compact?: boolean })`: compact writes the time as `mm:ss` with `.cc` in a second span in `--subtle-foreground` (both through refs, per frame, rule 24) and no length. `PreviewStage({ bare })`: bare now draws `FieldGuide` over the canvas and keeps a 22 px inset; still no overlays or navigation. `TransportTool` gains `current?: boolean` (the prototype's `.tool.on`: `--foreground`, inset underline in `--mark`), beside `pressed` (`.tool.lit`, `--on`).

- [ ] **Step 1:** `PlaybackButtons`: Back (`IconButton`, `SkipBack`, "Go to start (Home)", `preview.seek { time: 0 }`), `PlayButton`, Stop (`Square`, "Stop", `preview.pause`).
- [ ] **Step 2:** `RecordButton` as an `IconButton`: idle, the `RecordDot` in `--mark`, the existing tooltip; starting and saving, the dot pulsing, the tooltip "Opening the microphone" / "Saving the take", disabled as today; recording, the button filled `--mark` with the dot pulsing, followed by `RecordingClock`; the click is unchanged. `LoopToggle` as an `IconButton` (`Repeat`), `--on` when on, its tooltips and click unchanged.
- [ ] **Step 3:** `PointerTools`: Select (`current`, tooltip "Select: move, trim and fade clips"), Cut (the blade tool: click a clip to cut it there; `soon("transport.cut")`), Fade, Draw volume, Scrub (`soon(…)`), Snap (moved, unchanged). `QuickTools`: Find beats, Strip silence, Match level (`soon(…)`). Today's Cut action (cut at the playhead) leaves the transport and is not lost: it is the toolbar's Split (scissors) and the S key, which send the same `playheadSplit`; the blade's tooltip says so.
- [ ] **Step 4:** `SoundTransport` in the prototype's order: `Timecode compact`, `PlaybackButtons`, Record, Loop, separator, `PointerTools`, separator, `QuickTools`, grow, `MixSwitch`, separator, `MonitorControls`. Keep it under 200 lines. Check the row at 1280 px wide: it clips at the right like the prototype's (`overflow-hidden`), Mix and monitor last to go.
- [ ] **Step 5:** `PreviewStage bare`: `FieldGuide` and the inset. The Edit stage is unchanged.
- [ ] **Step 6:** READMEs (sound: transport bullet; preview: `compact`, bare's guide). Full checks; compare with the prototype at `http://127.0.0.1:18555/sound-page.html`. Commit: `feat(sound): the transport row as the prototype draws it`.

### Task 4: The timeline on the Sound page

**Files:** Create `timeline/ui/ToolbarAction.tsx`, `timeline/ui/TrackHeaderSheet.tsx`, `timeline/ui/TrackControls.tsx`, `sound/ui/lanes/SoloButton.tsx`, `lanes/DrawVolumeTool.tsx`, `lanes/AutomationNote.tsx`, `lanes/SheetNote.tsx`, `audio/ui/GainBadge.tsx`. Modify `timeline/timeline.points.ts`, `timeline.types.ts`, `timeline.layout.ts`, `timeline/index.ts`, `timeline/ui/TimelineToolbar.tsx`, `timeline/ui/TrackHeader.tsx`, `timeline/ui/TimelinePanel.tsx`, `timeline/README.md`, `lanes/ArmButton.tsx`, `lanes/index.ts`, `ui/index.ts`, `sound.module.ts`, `sound/README.md`, `audio/ui/index.ts`, `audio/audio.module.ts`, `audio/README.md`, `CLAUDE.md` (rule 13).

**Interfaces:**

- `timeline`: `interface TimelineTrackControl extends Scoped { id: string; order: number; component: ComponentType<{ track: Track }> }`; `timelineTrackControls = definePoint<TimelineTrackControl>("timeline.trackControls", …)`, exported with TSDoc. `TimelineTool.slot?: "start" | "end"` (unset: start, before Split, as today; end: after the peg bar, before zoom).
- `TrackHeader` on the `"sound"` scope renders `TrackHeaderSheet({ track, code })`: `code` (`A1`…) over two rows in mono, the name in `font-hand`, then a row of `LetterToggle` M (`timeline.setTrackMuted`, `tone="mark"`) and `TrackControls` (the point's entries in scope, by `order`); remove X shown on hover only. `TimelinePanel` passes `code` from the lane's position among the listed lanes, which on the sound scope is the mixer's `A`-number. On `"all"` nothing changes.
- `ToolbarAction({ icon, label, … })`: `ToolbarButton` on `"all"`, `IconButton` with `label` as its tooltip on `"sound"`. Split, Delete and Audio track use it.
- `sound` contributes: `timelineTrackControls` `sound.solo` (`SoloButton`: `LetterToggle` S, `tone="ink"`, `sound.setSolo`, order 10) and `sound.arm` (`ArmButton`, order 20; absent where recording isn't offered, as today), both `scopes: ["sound"]`; `timelineTools` `sound.drawVolume` (pen `IconButton`, `soon`, slot start), `sound.automation` ("Automation —", mono note, `soon`, slot end) and `sound.sheetNote` ("N tracks, m:ss": the open composition's audio tracks and its length with `formatTimecode` trimmed to `m:ss`, slot end), all `scopes: ["sound"]`.
- `audio` contributes `clipActions` `audio.gainBadge`, `scopes: ["sound"]`: `GainBadge` shows `formatDb(volumeDb)` dB at the clip's top right in `--mark` on `--surface` when the clip's `sound.volumeDb` is not 0 and not keyed; nothing otherwise.

- [ ] **Step 1:** The point, the type and the slot in `timeline`; `TrackControls`, `TrackHeaderSheet`, `ToolbarAction`; `SOUND_HEADER_WIDTH` 164. Check Edit looks exactly as before.
- [ ] **Step 2:** `sound`'s contributions. R leaves the strip in Task 6; until then both show it.
- [ ] **Step 3:** `GainBadge`.
- [ ] **Step 4:** READMEs: timeline (the point, `slot`, the sheet header, icon-only actions on the sound scope), sound (lanes bullet), audio (the badge). Rule 13 in `CLAUDE.md` lists `timelineTrackControls`. Full checks. Commit: `feat(sound): the Sound timeline's headers and tools as the prototype draws them`.

### Task 5: The marks row under the ruler

**Files:** Create `timeline/ui/MarksRow.tsx`, `timeline/ui/flag.row.hook.ts`. Modify `timeline/timeline.layout.ts`, `timeline/ui/Ruler.tsx`, `timeline/ui/TimelinePanel.tsx`, `timeline/index.ts`, `timeline/README.md`, `marker/ui/MarkerFlag.tsx`, `marker/README.md`, `sound/ui/lanes/RecordingTake.tsx`, `sound/README.md`.

**Interfaces:** `MARKS_HEIGHT = 20`; `rowsAbove(scope): number` (the ruler, plus the marks row on `"sound"`), exported, the one answer to "where do the lanes start". `useFlagRow(): { top: number; height: number }`, exported: the ruler (`0`, `RULER_HEIGHT`) on `"all"`, the marks row (`RULER_HEIGHT`, `MARKS_HEIGHT`) on `"sound"`. Overlays stay `timelineOverlays` entries; nothing new to contribute, and no module branches on the page.

- [ ] **Step 1:** `MarksRow`: sticky under the ruler (`top: RULER_HEIGHT`), a header-wide corner cell in `--muted` and the strip in `--surface` with a bottom rule in `--border`, drawn by `TimelinePanel` on the sound scope only. `LoopBand` moves into it on `"sound"`; `Ruler` keeps it on `"all"`. The ruler's scrub and the loop's handle drags work in their new row unchanged.
- [ ] **Step 2:** `MarkerFlag` places its sticky flag head with `useFlagRow()` instead of `RULER_HEIGHT`; its line through the lanes is unchanged. On Edit it sits exactly where it does today.
- [ ] **Step 3:** `RecordingTake` takes the new-track lane's top from `rowsAbove(scope)`; `TimelinePanel`'s folded height (`tracksHidden`) uses it too. Grep `RULER_HEIGHT` across `src/`: `EndMarker` (Edit only) keeps it; every other user on a sound-scope panel moves to `rowsAbove` or `useFlagRow`.
- [ ] **Step 4:** READMEs: timeline (the marks row, `rowsAbove`, `useFlagRow`, and that stage 5's problem marks and stage 6's beat ticks are `timelineOverlays` placed with `useFlagRow`), marker, sound. Check on Edit (nothing moved) and on Sound (flags, loop, a take onto a new Voice track). Full checks. Commit: `feat(timeline): a marks row under the ruler on the Sound page`.

### Task 6: The mixer

**Files:** Create `mixer/MixerBar.tsx`, `mixer/MixerFilter.tsx`, `mixer/ReadButton.tsx`, `mixer/MasterPan.tsx`. Modify `mixer/MixerPanel.tsx`, `mixer/MixerStrip.tsx`, `mixer/MasterStrip.tsx`, `mixer/index.ts`, `sound/README.md`.

- [ ] **Step 1:** `MixerBar` (the header moved out of `MixerPanel`): "Mixer", `MixerFilter` (`SegmentedControl` with All only, selected; its TSDoc says a filter per group comes in stage 4), grow, strip count, Expand all. `MixerPanel` keeps the strips, Master and the meter loop.
- [ ] **Step 2:** `MixerStrip`: buttons M, S, `ReadButton` (`LetterToggle` "Read", `soon("mixer.read")`); `ArmButton` leaves the strip (it's on the header now). The armed strip's meters still show the microphone (unchanged).
- [ ] **Step 3:** `MasterStrip` in the prototype's order: name, OUT, Effects, Sends to `Output 1-2` (the strip's mono text style), Pan (`MasterPan`: the pan look, thumb centred, `soon("master.pan")`), fader with meters and readout, M (`LetterToggle`, `soon("master.mute")`) and Read (`soon("master.read")`).
- [ ] **Step 4:** README (mixer bullet). Full checks. Commit: `feat(sound): the mixer as the prototype draws it`.

### Task 7: The panel tabs and the Channel tab

**Files:** Create `panel/PanelWho.tsx`, `channel/PresetOthers.tsx`. Modify `panel/SoundPanel.tsx`, `panel/PanelCard.tsx`, `channel/ChannelTab.tsx`, `channel/PresetCard.tsx`, `effects/EffectSection.tsx`, `effects/EqEffectSection.tsx`, `effects/CompressorSection.tsx`, `sound.types.ts` (`SoundPanelTab` gains `"deliver"`), `sound/README.md`.

- [ ] **Step 1:** `SoundPanel`: tabs Clip, Channel, Loudness, Deliver (`SegmentedControl`, each 96 px, 32 px high), default Channel; `PanelWho` at the right in mono (`A1 Voice 1`, `Master`, or nothing), from `view.selected` and the open composition's audio-track order. Deliver mounts `DeliverTab` (Task 9; an empty grid until then). All tabs stay mounted as today.
- [ ] **Step 2:** `PresetCard`: title "Preset"; a "Sound" row with the existing picker; `PresetOthers` ("Others", then the presets that fit as text links, each one `sound.applyPreset`); Save as preset full width under them; the note goes; `+ Effect` stays below. `row-span-2`.
- [ ] **Step 3:** `EffectSection` as a `PanelCard`: title, remove X (visible on hover and focus), the `Switch` at the right; `PanelCard` gains `dim` (its body at 40 % opacity) for an effect that's off. Folding goes. `EqEffectSection` and `CompressorSection` pass `className="row-span-2"`. `CompressorSection` adds `PanelValue` "Reduction" `—` with `soon("compressor.reduction")`.
- [ ] **Step 4:** `ChannelTab` grid at `minmax(216px,1fr)`. Check every effect kind on a track and on Master, on and off, in a narrow and a wide window. README. Full checks. Commit: `feat(sound): the panel and the Channel tab as the prototype draws them`.

### Task 8: The Loudness tab

**Files:** Create `loudness/SpectrumCard.tsx`, `loudness/PhaseCard.tsx`. Modify `loudness/LoudnessTab.tsx`, `sound/README.md`.

- [ ] **Step 1:** Program loudness: the integrated value in `text-display`, LUFS small; the four rows as `PanelValue` with `valueRef` (written through the DOM as today); Reset and the "Integrated, since Reset" line stay. Grid `minmax(216px,1fr)`.
- [ ] **Step 2:** `SpectrumCard`: "Frequency spectrum", an 84 px box in `--surface-sunken` with grid lines in `--border`, no curve, `soon("loudness.spectrum")` on the box. `PhaseCard`: "Stereo phase", `PanelValue` Correlation `—` and Mono safe `—`, `soon("loudness.phase")`.
- [ ] **Step 3:** README. Full checks. Commit: `feat(sound): the Loudness tab as the prototype draws it`.

### Task 9: The Deliver tab

**Files:** Create `deliver/index.ts`, `deliver/DeliverTab.tsx`, `deliver/StandardCard.tsx`, `deliver/ProblemsCard.tsx`, `deliver/FormatCard.tsx`, `deliver/StemsCard.tsx`, `deliver/CheckRow.tsx`. Modify `panel/SoundPanel.tsx`, `sound/README.md`.

- [ ] **Step 1:** `DeliverTab`: the 216 px grid of four `row-span-2` cards, as Ruling 1's table says. `StandardCard`: Preset `—` ▾, Loudness `—` LUFS, Peak limit `—` dBTP (`PanelValue`, `soon("deliver.standard")`), then "Analyze whole mix" (`Button` primary, full width, `soon("deliver.analyze")`). `ProblemsCard`: title "Problems", the one honest line. `FormatCard`: Codec `—` ▾, Sample rate `—` ▾ (`soon("deliver.format")`), Channels `Stereo`. `StemsCard`: `CheckRow` "Full mix" and "Match target on export", unticked, `soon("deliver.stems")`.
- [ ] **Step 2:** `CheckRow`: the prototype's `.chk` (a 13 px square box, `rounded-xs`, `--on` with a check when ticked, outlined when not), label in `--muted-foreground`. One component, in `deliver/` only (rule 33: no second user yet).
- [ ] **Step 3:** README (deliver bullet; "Not yet" updated). Full checks. Commit: `feat(sound): the Deliver tab, laid out`.

### Task 10: Documents and the last look

**Files:** Modify `docs/superpowers/specs/2026-11-02-sound-page-design.md`, the stage plans 2 to 6, `sound/README.md`.

- [ ] **Step 1:** Spec: the anti-goal "A control that does nothing" becomes: "The whole layout ships first (owner, 3 Nov 2026). What a later stage builds shows as **Coming soon**: it looks as the mockup does, does nothing, says so in its tooltip, and shows no example data (`docs/superpowers/plans/2026-11-03-sound-layout.md`, Ruling 1)." "The page" lists the tabs as Clip, Channel, Loudness, Deliver, Channel first shown.
- [ ] **Step 2:** Plans 3 to 6: file paths under the new folders (`ui/lanes/ClipVolumeLine.tsx`, `ui/transport/SoundTransport.tsx`, `ui/mixer/BusStrip.tsx`, `ui/deliver/DeliverTab.tsx`, `ui/deliver/ProblemList.tsx`, `ui/lanes/ProblemMarks.tsx`, `ui/loudness/SpectrumGraph.tsx`, `ui/lanes/BeatTicks.tsx`…), and in each plan's last task a step: "Replace this stage's placeholders with the working controls and remove its entries from `ui/soon/soon.catalog.ts`" naming the ids. Their "Global Constraints" lose nothing else. Then the owner's assignments:
  - **Stage 2:** a short follow-up task, "The compressor's live gain reduction": the preview reports the reduction the dynamics worklet applies; the Channel tab's Reduction row shows it through the DOM (rule 24); removes `compressor.reduction`.
  - **Stage 3:** a task "Pointer tools": Select, the blade Cut (click a clip to cut it there, one `timeline.splitAt` at that time, snapping as a split does; Shift for every track), Fade (drag on a clip's edges sets fades through `audio.setSound`), Draw volume (already there) and Scrub (drag on the lanes plays slices through `PreviewApi.scrub`); the tool is view state; removes `transport.cut`, `transport.fade`, `transport.scrub`. Cut at the playhead stays the toolbar's Split and S.
  - **Stage 4:** Master's Pan, M and Read join the group work (`CompositionMix.master` gains `pan` and `muted`; Read is the master's automation mode once stage 3's modes exist); removes `master.pan`, `master.mute`, `master.read`.
- [ ] **Step 3:** README sweep: Contributes (the new point entries and tools), the Files list by folder, **Not yet** (each placeholder and its stage). Check every catalog id is used once and every `soon(` call names a catalog id (`pnpm typecheck` does this through `SoonId`).
- [ ] **Step 4:** `pnpm tauri dev`, open the Sound page on a project with several audio tracks, and compare side by side with the prototype, region by region (transport, tools row, ruler and marks row, headers, clips, panel tabs, mixer, Master, preview), in Cloudy Dark and one light theme. Every placeholder shows its tooltip; none reacts to a click; nothing in the history after clicking them all. Commit: `docs(sound): the layout ships first`.

## Owner's answers

1. **Clip tab:** kept, first. The tabs are Clip, Channel, Loudness, Deliver; the panel opens on Channel (Task 7).
2. **Markers and loop:** a second row under the ruler on the Sound page only; Edit keeps markers on its ruler. The timeline draws the row and says where flags go (`useFlagRow`), so `marker` and later overlays need no page check (Task 5).
3. **Controls no stage built:** shown now as coming soon. Fade and Scrub pointer tools go to stage 3; Master's Pan, M and Read to stage 4; the compressor's live Reduction reading to a stage 2 follow-up. Task 10 writes them into those plans.
4. **Cut:** becomes a blade tool (click a clip to cut there), a coming-soon pointer tool here, built in stage 3 with the other pointer tools. Cut at the playhead isn't lost: it stays the timeline toolbar's Split and the S key (Task 3).
