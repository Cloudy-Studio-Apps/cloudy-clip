# Sound page: design

The Sound page becomes a mixing room, in the spirit of DaVinci Resolve's Fairlight, for finishing a video's
sound and delivering it professionally. Today it is an empty page with the seal. Sound exists only per clip
(`Clip.sound`, the inspector's Audio tab).

**Visual reference:** `docs/prototype/designs/sound-page.html`. It shows the finished page, with every stage
done. Click **Mark new tools** at its top right to see the tools the owner added late. It is a clickable
picture: no sound, and the faders don't move.

## Why

The owner wants a page that is pleasant for someone who has never mixed and has real tools for professional
work: "I prefer user experience but at the same time tools for a professional edition". A person with three
tracks should see three strips and nothing to learn. A professional should be able to mix, measure and deliver
without leaving the app.

## Goals

- Balance a whole mix on one page: fader, pan, mute, solo and live meters per track, and a Master.
- Shape sound with effects, and over time with volume lines and automation.
- Group tracks and export stems.
- Measure loudness and deliver to a standard such as YouTube.
- Quick tools that save time: find beats, strip silence, match level, presets, compare two mixes.
- What you hear in the preview is what the export contains. This is the rule the whole design is built around.
- Agents can do all of it (rule 14, 18, 19).

## Non-goals

- Surround. Stereo only.
- Reverb, delay and creative effects. The `+ Effect` list holds only what's in this design.
- Third-party audio plugins (VST, LV2). The Rust side builds FFmpeg arguments from a closed list of effect
  kinds and never from text the webview wrote, so effect kinds stay a closed list here.
- Automation of anything but volume. Pan and effect parameters come later.
- Nested groups: a group sends to Master, never to another group.
- AI features, including AI dialogue leveling.
- Folding groups in the mixer and a narrow strip size. The owner chose sideways scrolling and Expand all instead.

## Anti-goals

- **A control that does nothing.** The mockup is the destination, not the first release. Each stage ships only
  the controls that work. An unfinished tool is absent, not disabled.
- **A preview that lies.** If an effect can't sound the same in preview and export, it doesn't ship.
- **Clutter for simple users.** A project with one sound track must look calm. Empty effect chains show only
  `+ Effect`.
- **Breaking old projects.** Everything new in the document is optional, and a value equal to its default is
  never stored, as with `Clip.sound`. An old file opens and sounds the same.

## Stages

Each stage gets its own plan and can ship alone. This is the agreed order, with the owner's "basics first".

| Stage | Name             | What ships                                                                                                                                        |
| ----- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | The page and mix | Layout B, timeline with Select, Cut, Fade and Snap, Clip tab, mixer, Expand all, Master, meters, live loudness with its history, Mix A/B, monitor |
| 2     | Effects          | Channel tab, effect chains, EQ, compressor, gate, de-esser, limiter, noise reduction, ducking, presets                                            |
| 3     | Keyframes        | Volume lines on clips (their keys), Draw volume, track automation with modes                                                                      |
| 4     | Groups and stems | Group tracks, Sends to, filters per group, audio formats, stem export                                                                             |
| 5     | Delivery         | Deliver tab, standards, Analyze whole mix, Problems, match target, spectrum, stereo phase                                                         |
| 6     | Quick tools      | Find beats, Strip silence, Match level                                                                                                            |
| 7     | Session tools    | Markers, loop region, audio scrub, voice recording                                                                                                |

Stage 7 wasn't in the owner's list of five. It holds what the mockup shows that the app doesn't have yet. It
also starts with a check that a microphone can be opened at all in WebKitGTK and WebView2.

## What the code already has (checked 3 Nov 2026)

This design was written before these landed. The plans build on them:

- **Clip speed and speed ramps** are in `mixdown.ts`, the engine and `recipe.rs`. A clip's business; nothing here
  changes them.
- **Keyframes** (`keyframe` module): keys on a clip's values, eases, the Keyframes and Curves dock under the
  tracks, a mode switch in the timeline's tools, a badge on clips. **`sound.volumeDb` and `sound.pan` can already be
  keyed on audio clips**: the engine reads them per frame, and export turns them into `gainEnvelope` and
  `panEnvelope` (`export/logic/envelope.ts`) and `volume`/`pan` expressions in `recipe.rs`.
- **Long filter graphs** already go in a file (`INLINE_GRAPH_LIMIT`, `ScriptOption` in `recipe.rs`), probed from
  `ffmpeg -version`. Stage 3 no longer needs that step.
- **Themes** (`theme` module) change every token. Rule 34: app chrome never hard-codes a colour. The mockup's
  colours are Cloudy Dark's; meters, faders and graphs use tokens (`--on`, `--mark`, `--foreground`,
  `--surface-sunken`), so they follow any theme.
- **Settings** (`settings` module, `settingsSections`): the user's own choices, outside the project, kept in
  `localStorage` as `theme.store.ts` does. CLAUDE.md now says a user's app settings stay the user's alone, which
  decides where sound presets live (stage 2).
- **Timeline points** `timelineTools`, `timelineDocks` and `clipActions.badge`: `keyframe` adds a tool, a dock and a
  badge; `speed` adds a box over clips through its clip actions. See "The timeline on this page".
- `recipe.rs` is over 1,000 lines, so the mix graph goes in a new file next to it (rule 27).

## The page

Layout B, decided by the owner. From the top: the app's top bar, a transport row, then the stage.

- **Left column:** the timeline on top; below it the panel with tabs (Clip, Channel, Loudness, Deliver) and a
  small preview. The tabs appear as their stages ship. Stage 1 has Clip and Loudness.
- **Clip tab:** this page has no inspector, so this tab shows the Audio tab's sections for the selected clip
  (`inspectorSections` on tab `audio`), so volume, fades, pitch and EQ of a clip can be changed here too, with the
  key diamonds of Volume and Pan as on Edit.
- **Right column:** the mixer. Track strips scroll sideways. Master stays pinned at the right edge and never
  scrolls.
- **Expand all** (mixer header, right): hides the left column so the mixer takes the page, and turns into
  "Back to timeline". The transport row stays. It's a view state, not in history.
- The Mesa look (rule 34 to 36), in tokens so every theme works: exposure-sheet timeline, peg bar, pencil tabs,
  dashed dividers between strips, `--on` for what is merely on, `--mark` for values you changed. A fader at 0 dB
  shows in `--foreground`; moved, its value is `--mark`.
- Clicking a track selects its strip and scrolls it into view, and the reverse. This selection is `sound`'s own
  view state: a track, not clips.

The mixer shows the audio tracks of the composition the user has open, in `trackOrder`. Video tracks hold
pictures only, and a video's sound is a linked clip on an audio track, so nothing is missed. With no audio
track, the mixer shows an `EmptyState` and Master.

### The page changes sound, never the picture

A person on the Sound page can't see the video tracks, so nothing done here may change them. This is the
owner's question and my recommendation; it's listed under the calls to check.

| Edit on a linked sound clip | What happens                                                                  |
| --------------------------- | ----------------------------------------------------------------------------- |
| Volume, fades, EQ, pitch    | Sound only, as always                                                         |
| Cut (S)                     | Both are cut at that point, since a cut alone changes nothing you see or hear |
| Delete, move, trim          | The sound is unlinked first, then edited, and the picture stays as it was     |

Unlinking is part of the same command, so one undo restores the sound and the link. A short message says so the
first time in a session: "Sound unlinked from its picture". Moved sound can drift from the picture on purpose:
that's how sync is slipped by hand. These rules apply only on the Sound page, and Edit keeps its linked behaviour.
The timeline commands take a way to ask for this, and the Sound page's timeline passes it. The MCP tools keep
today's behaviour unless the caller asks.

The right-click menu on this page shows only entries that can't change a picture. Speed, ripple delete and
copy and paste stay on Edit, since each can reach or bring a linked picture. The page has no media library, so new
sound is added on Edit, or recorded here from stage 7.

### Playback on this page

Three things stop the Sound page working today, and stage 1 changes them:

- `preview.module.ts` pauses playback when any other page covers the editor. Pages get a flag in `appPages` (my
  name: `keepsPlayback`) that the preview reads, and Sound sets it.
- `app.keybindings.ts` runs plain keys only on the editor page. The same flag lets Space, S and Delete work on
  Sound.
- There is one preview canvas, and it's mounted behind the page. `attachCanvas` returns a detach function, so
  the Sound page mounts its own small `PreviewStage`, exported from `preview`, and the Edit canvas takes over
  again when the page closes. The builder checks that two mounted canvases don't fight.

### The timeline on this page

`TimelinePanel` takes a scope: `"all"` on Edit, `"sound"` here, where it shows audio tracks only. The timeline
stays virtualized (rule 26), and its selection, zoom and playhead are shared with Edit, so moving between pages
keeps your place. The header column on this page is its own width; it doesn't change Edit's `headerWidth`.

What modules add to the timeline is shown on the Sound page **only when it says so**, so a new contribution can't
reach a picture by accident:

- `clipActions`, `timelineTools`, `timelineDocks`, `timelineOverlays` and `timelineMenuItems` entries take an
  optional `scopes` list. Missing means Edit only.
- A `ClipMenuEntry` opts in the same way, so a module's menu can offer some entries here and not others.
- Opted in: `keyframe`'s mode switch, dock and badge (volume and pan keys are sound); `audio`'s menu;
  `collab`'s playheads; `timeline`'s Cut. Not: `speed`'s box and menu, `transform`, `composition`, copy and paste,
  ripple delete.

The page tells the timeline it's on the Sound page through `AppPage`. Pages get two optional flags:
`keepsPlayback` (the preview doesn't pause, plain keys work) and `timelineScope: "sound"` (plain keys and commands
run from this page edit sound only). The timeline reads the active page's flags from `appPages`, a core point, so
it never knows the `sound` module.

**Fade tool:** clips of audio tracks get fade handles on the timeline, dragged to set `Clip.sound` fades through
`audio.setSound`. The handles belong to `timeline`, or to `audio` through a timeline point, and show on Edit too.

## Architecture

### Where things live

This follows how the Audio tab was built: the data sits in `project` because core modules read it, and the
feature owns everything else.

| Module    | Owns                                                                                         |
| --------- | -------------------------------------------------------------------------------------------- |
| `project` | The types and defaults (`TrackMix`, `CompositionMix`, `DEFAULT_TRACK_MIX`) and the selectors |
| `sound`   | The page, the mixer, all `sound.*` commands and `sound_*` MCP tools                          |
| `preview` | The Web Audio graph, meters, live loudness; it reads the mix like it reads `Clip.sound`      |
| `export`  | Turning the mix into a structured spec; `recipe.rs` turns the spec into FFmpeg arguments     |
| `audio`   | Stays as is: per-clip sound and the inspector's Audio tab                                    |

`sound` stays `tier: feature` and requires `project`, `timeline`, `preview`, `inspector` (the Clip tab), and later
`settings` (presets, stage 2), `keyframe` (stage 3) and `export` (stems and delivery, stages 4 and 5).

### The document

Both fields are optional and missing means the defaults.

```ts
interface Track {
  mix?: TrackMix;
}

interface TrackMix {
  volumeDb: number; // -60 to 12
  pan: number; // -1 to 1
  effects?: SoundEffect[]; // stage 2. Ordered, one of each kind
  busId?: BusId; // stage 4. Missing sends to Master
  volumeLine?: Keyframe[]; // stage 3. Sorted by time
}

interface Composition {
  mix?: CompositionMix;
}

interface CompositionMix {
  master: { volumeDb: number; effects?: SoundEffect[] };
  buses?: MixBus[]; // stage 4
  /** Stage 5. The standard and target only. Codec and sample rate stay in the Export form. Not part of Mix A/B. */
  delivery?: DeliverySettings;
  /** The mix that isn't active: Mix A while on B. The active one is what's in the fields above. */
  otherMix?: MixSnapshot;
  activeMix: "a" | "b";
}
```

`Track.muted` stays where it is and keeps its existing command. Mute is part of the document and of the export.

**Solo isn't.** Solo is for listening, so it's ephemeral (rule 16), per kernel, never in history, and it never
reaches an export. So are the monitor controls.

**Mix A/B** covers every track's `mix`, Master and groups. It doesn't cover clips, `muted` or delivery.
Switching is one undoable command, and the first switch to B copies A.

### Preview: one graph for all sound

Today an element at its defaults plays directly and enters Web Audio only when it needs more. That can't stay:
a meter needs every sound to pass through it. From stage 1, **every element of an audio track goes through the
graph**. `audio/README.md` and `engine.audio.ts` state the old invariant, so they change with it.

```
element -> clip chain (pitch, EQ, pan, level)      existing, per element
        -> track bus (effects, fader, pan, meter)  one per audio track
        -> group bus (effects, fader, meter)       stage 4
        -> master (effects, fader, meter, loudness)
        -> monitor (mono, dim, speaker volume)     never in export
        -> destination
```

- The pool reuses elements across tracks, so a clip chain reconnects to the right track bus when its slot
  changes.
- An element that fails to enter the graph plays as a plain element, as it does now, but it's outside the mix.
  That's reported once through `notify`, not only logged (rule 32).
- The AudioContext rule from `2026-11-02-audio-preview-check.md` stands: call `resume()` without waiting.
- Solo silences the other track buses with their gain, not the elements, so sync isn't disturbed.
- **Meters** are peak, −60 to 0 dBFS, with a peak hold line for 1.5 s, read from `AnalyserNode`s and drawn with
  direct DOM writes (rule 24). No React state per frame. Meters read nothing while the page is closed.
- **Live loudness** is an `AudioWorklet` on Master doing BS.1770 K-weighting: momentary, short term, integrated
  since play started, range, and true peak. Stopping keeps the numbers, Reset clears them. The arithmetic goes
  in `logic/` and is pure.
- Drags send values to the graph directly, through a preview API in the spirit of `previewProps`, and one
  command on release (rule 15).

### Export: the same shape as the preview

`amix` flattens everything into one pool today. It becomes the same tree as the preview:

```
segments of a track -> amix -> track effects, fader, pan
tracks              -> amix -> group effects, fader     stage 4
all                 -> amix -> master effects, fader -> [mixed]
```

- `mixdown.ts` returns segments per track plus the track's mix values. `SoundSegment` keeps what it has.
- The existing order inside a segment stays. A default track adds no filter, so a project with no mix produces
  the same filter graph as today, apart from nesting. The existing Rust tests pin this down.
- The graph already goes in a file when it's long, so nothing changes there. The tree is built in a new
  `src-tauri/src/export/mixgraph.rs`; `recipe.rs` keeps the per-segment chain and calls it.

### Placed compositions

A composition placed inside another arrives as one clip on an outer audio track, and that track's strip is what
you mix. Its inner tracks keep their `muted`, volume and pan, on top of each other, as `mixdown` does with
gain today. The inner composition's effects, groups, volume lines and Master apply only when it's the one being
played or exported. **Limit, stated in the UI as a note on the strip:** inner effects aren't heard from outside.
A real submix would need a separate graph per placement, which the "same in preview and export" rule makes
expensive. It can come later.

### Effects (stage 2)

`SoundEffect` is a tagged union with a closed list of kinds. Each kind has three parts that must agree: a Web
Audio side, an FFmpeg side and a Zod schema.

| Effect          | FFmpeg                       | Preview                                    |
| --------------- | ---------------------------- | ------------------------------------------ |
| EQ              | as `Clip.sound` (six bands)  | `BiquadFilterNode`, as `Clip.sound`        |
| Compressor      | `acompressor`                | AudioWorklet port of the same formula      |
| Noise gate      | `agate`                      | AudioWorklet port of the same formula      |
| De-esser        | `deesser`                    | AudioWorklet port of the same formula      |
| Limiter         | `alimiter`                   | AudioWorklet port, lookahead 5 ms          |
| Ducking         | `sidechaincompress`          | The compressor worklet with a second input |
| Noise reduction | `afftdn`, rendered to a file | Plays that rendered file                   |

Web Audio's own `DynamicsCompressorNode` is not used: its behaviour isn't specified closely enough to match
FFmpeg. Worklets are confirmed working on WebKitGTK.

**Noise reduction** is the one effect that doesn't run live. Applying it renders each file on the track through
FFmpeg to a cached file, keyed by file and settings, exactly as a proxy is made. Preview and export both read
the cached file, so they match by construction. While it renders, the strip shows progress and the track plays
the original. "Learn from selection" measures the noise floor of a time range and sets the filter's noise floor.
The cache follows the same cleanup as proxies.

**Ducking** sits on the track being lowered, and lists what it listens to: "Listens to Voice 1, Voice 2, by
−9 dB". The listened tracks are summed into one key signal, so one compressor runs however many people talk, and
two voices at once don't duck twice. From stage 4 it can sit on a group and listen to a group. A choice that
would make a loop is refused (`sound.duck_loop`). It's real sidechain compression, so it follows the voice and not
the clip's edges. The graphs stop being a strict tree here: the key signal is a branch taken after the listened
track's fader, and both sides process tracks in an order that puts it first.

**How "the same" is measured:** on a test signal, steady-state gain reduction within 0.5 dB of FFmpeg for every
threshold and ratio tried, and attack and release within 10%. Stage 2 builds this check first, on the compressor,
and it decides the rest. If a port can't meet it, that effect is cut and the owner is told. No effect ships on a
promise.

**Presets** are a named set of values for a chain: Clear voice, Podcast, Phone, Radio, Warm, and the user's own.
The user's own are kept outside the project in `localStorage`, as the theme is, and listed in a Settings section
(`settingsSections`, "Sound presets") where they're renamed and removed. Applying one is one command and writes
plain values, so a project never depends on a preset. Agents can apply any preset (`sound_apply_preset`) and list
them, but can't save, rename or remove the user's own: those are the user's settings (CLAUDE.md, idea 1).

### Keyframes (stage 3)

Two kinds of volume line exist, as in Fairlight and Premiere, and both show on the lanes:

- **Clip volume line** (first): the clip's `sound.volumeDb` keys, which already exist, drawn as a line over the
  clip on both pages. Points drag, double-click adds one, and every change goes through `keyframe.*` commands, so
  preview, export and the Curves dock already agree. It travels with the clip. Nothing new in the document.
- **Track automation** (second): a line on the track that stays put when clips move. It **is a `KeyTrack`**, the
  same type clip keys use, stored in `TrackMix.volumeLine` with its keys' `t` on timeline time (a track's own time
  is the timeline's). So nothing new is written to evaluate it: `trackValue` reads it, `keyMoments` and
  `envelope.ts` turn it into an export envelope, `envelope_expr` into FFmpeg, and eases come for free. In signal
  order, clip keys act in the clip chain, then the line in the track bus.
- `timelineOverlays` (scoped to both pages) draws the track line over each audio lane, behind the clip lines.
  Points drag; one command on release.
- **Draw volume** draws on the clip line by default and on the track line when the track is in automation view,
  thinned so a stroke isn't thousands of points.
- **Automation modes** per track: Read plays the line; Touch writes while you hold the fader and returns to the
  line when you let go; Latch writes from the first touch until stop. The mode is view state. One pass while
  playing is one undo step, sent on stop (rule 15).
- With a line present, the fader's position is an offset on top of it, shown as such.

### Groups and stems (stage 4)

A `MixBus` has `id`, `name`, `volumeDb`, `muted` and `effects`. Tracks choose one in **Sends to**. New tracks send
to Master directly. Group strips sit after track strips and scroll with them; only Master is pinned. The mixer
filters are one button per group.

**Stems** are separate files, one per group plus the full mix, exported as a sound-only job through the existing
queue. If some tracks send directly to Master, an automatic stem named Other holds them, so stems add up to the
mix. A stem is taken after its group and before Master, so effects on Master aren't in stems. That's the usual
meaning of a stem. Solo is ignored. The choice sits on the Export page in this stage, and the Deliver tab shows it
too once it exists.

**Audio formats** arrive here because stems need them: AAC, Opus, WAV, FLAC, MP3; 44.1 or 48 kHz; 16 or 24 bit for
WAV and FLAC. Sound-only export grows from just MP3 to these. `recipe.rs` hardcodes `SAMPLE_RATE` at 48 kHz, and
that becomes part of the spec. These settings stay in the Export form, view state as they are today.

### Delivery (stage 5)

Standards are data: YouTube −14 LUFS and −1 dBTP, Spotify −14, Apple Podcasts −16, TikTok −14, EBU R128 −23 and
−1, ATSC A/85 −24 and −2, plus Custom. The builder checks each figure against the platform's current docs before
writing it down, since platforms change these.

- **Analyze whole mix** renders the sound through FFmpeg's `ebur128` without playing it, as a background job with
  progress, and gives true figures. The live reading depends on what you played. This one doesn't.
- **Problems** lists stretches over the peak limit and clipped stretches, from the same pass, with red marks on
  the ruler. Clicking one seeks there.
- **Match target** moves Master's volume by the measured difference, and adds a Limiter to Master at the peak
  limit if none is there, in one undoable command, so preview and export agree. A limiter lowers loudness a
  little, so it then analyzes once more and corrects once, and the panel shows where the mix landed. A first-time
  user can't deliver a clipped file this way. FFmpeg's `loudnorm` isn't used on export: it changes the sound in
  ways the preview wouldn't play.
- **Match target on export** does the same for one job, without changing the project. The job gains analysis
  passes before it runs, shown as a step in the queue.
- **Standard and target** live in `CompositionMix.delivery`, per composition and undoable. Codec and sample rate
  stay in the Export form. The Deliver tab shows and edits that form, so there's one source for each.
- **Spectrum and stereo phase** join the Loudness tab: an `AnalyserNode` on Master and a correlation reading in
  the loudness worklet.

### Quick tools (stage 6)

- **Find beats** detects beats in a music clip's file and draws ticks on the ruler. Detection is native (the
  builder chooses: onset detection over FFmpeg-decoded samples is enough). The result is cached per file, not in
  history, and snapping uses it. It can't place clips by itself.
- **Strip silence** finds quiet stretches with `silencedetect` and shows what it would cut before it does. One
  undo step. On the Sound page it cuts sound only and leaves gaps, so a linked clip is unlinked as above.
  On Edit it's in the clip menu (`clipActions`), and on a video it's a jump cut: picture and sound are both cut and
  the gaps close. Closing gaps moves everything after them, so its preview warns when other tracks would drift.
- **Match level** sets each selected clip's `volumeDb` so their loudness matches, measured with `ebur128`. One
  undo step.

### Session tools (stage 7)

- **Markers:** named points on a composition, shared with the timeline on Edit. Undoable.
- **Loop region:** a range on the ruler, ephemeral per composition. Loop plays it.
- **Scrub:** dragging the playhead plays short slices of sound.
- **Recording:** Record-arm on a track and the record button write a WAV next to the project and place it as a
  clip. Starts with the microphone check. If either webview can't do it, recording is cut from that platform.

## Agents

Every command has a tool (rule 18): `sound_set_track_mix`, `sound_set_master`, `sound_set_mix`, and those of later
stages. `project_get_state` shows the mix (rule 19). `sound_get_levels` returns the latest meter and loudness
readings, which exist only while the user plays. Since an agent's clock draws and plays nothing, agents get true
figures from `sound_analyze_mix` in stage 5.

## Keeping it right

- Rule 3 decides tests. These qualify: default mix adds nothing to the filter graph, interpolation of volume
  lines, command validation, `mixdown` per track, Mix A/B swap, the loudness arithmetic against the published
  BS.1770 reference values.
- The manual test of a stage is the same project exported and played in preview, compared by ear and with
  `ebur128`: integrated loudness within 0.5 LU of the live reading after a full play.
- **WebView2 (Windows) has never been checked for this audio path.** Stage 1 includes that check. Until it passes,
  Windows keeps the risk the Audio tab already carries.

## Reuse

The owner's rule: no second copy of anything the app already does. What this design reuses, moves or
generalizes, before anything new is written:

| Existing piece                                                   | How it's reused                                                         |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Zod schemas for volume, pan, EQ band in `audio.commands.ts`      | Moved to `project/logic/sound.schema.ts`; `audio` and `sound` import them |
| `DEFAULT_SOUND.eq`, `EqBand`, `bandActive`, `dbToLinear`          | The track EQ effect is the same `{ on, bands }` shape and defaults       |
| `setBand`, upmix and panner in `engine.audiograph.ts`             | Moved to `engine/engine.soundnodes.ts`; clip chains and buses build from them |
| Pan, EQ, envelope and tempo filters in `recipe.rs`               | Moved unchanged to `export/soundfilters.rs`; segments and `mixgraph.rs` call them |
| `EqGraph`, `EqBandRow`, `SoundRow`, `eq.gesture.ts` (already take values and callbacks) | Exported from `audio`; `EqSection` becomes a thin wrapper over a new `EqEditor` both use |
| The inspector's Audio sections                                   | The Clip tab renders them through `ClipTabSections`                       |
| `KeyTrack`, `trackValue`, `keyMoments`, `envelope.ts`, `envelope_expr` | The track volume line is a `KeyTrack`; no new interpolation or envelope code |
| `keyframe.*` commands and the Curves dock                         | The clip volume line edits clip keys through them                        |
| `localStorage` load and save with Zod in `theme.store.ts`         | Moved to `core/store` as `createSavedStore`; theme and sound presets use it |
| Reversed copies (`media.reversed.ts`, `reversed.rs`, `cache_path` in `proxy.rs`) | Generalized to derived files; noise reduction is one more kind of derived file |
| `splitAt`, `deleteClips`, `rippleDelete`, `unlinkClips`          | Strip silence and sound-only edits run them nested, as one undo step     |
| Timeline snapping in `timeline/logic/placement.ts`               | Beats and markers join it as snap targets through one point              |
| Export queue, runner, `job.rs`                                    | Stems and analysis are jobs of the same queue                            |

`sound` requires `audio` for its editors, so the clip's and the track's EQ are one component. The two modules stay
apart by concern: `audio` is how a clip sounds, `sound` is the mix and its page.

## File tree

Every stage, at the level of folders and main files. `+` is new, `~` is edited. Each plan has its own full tree,
file by file, checked against the repo.

```
docs/prototype/designs/
  + sound-page.html                    the mockup
src/app/
  ~ app.keybindings.ts                 1: plain keys on pages that keep playback
src/core/shell/
  ~ shell.types.ts                     1: keepsPlayback, timelineScope on AppPage
src/modules/keyframe/, audio/, collab/
  ~ <name>.module.ts                   1: scopes on what they add to the timeline
src/modules/project/
  ~ project.types.ts                   1: TrackMix, CompositionMix. 2: SoundEffect. 3: volumeLine (a KeyTrack). 4: MixBus
  ~ project.selectors.ts               1: trackMixOf, compositionMixOf
  + logic/mix.ts                       1: defaults, minimize, nestedSound
  + logic/sound.schema.ts              1: volume, pan and EQ band schemas, moved from audio.commands.ts
  ~ project.mcp.ts, index.ts, README.md
src/modules/sound/
  ~ sound.module.ts, sound.ref.ts, sound.types.ts, index.ts, README.md
  + sound.store.ts                     1: selected track, solo, expanded, monitor. 3: automation modes
  + sound.mix.commands.ts              1: track mix, master, Mix A/B
  + sound.mcp.ts                       1, and each stage's tools
  + logic/meter.ts, logic/loudness.ts  1: dB scale, BS.1770 arithmetic
  ~ ui/SoundPage.tsx                   1: the page
  + ui/SoundTransport.tsx, MixerPanel.tsx, MixerStrip.tsx, MasterStrip.tsx, Fader.tsx, PanSlider.tsx, Meter.tsx
  + ui/SoundPanelTabs.tsx, ClipTab.tsx, LoudnessTab.tsx                                               1
  + sound.effects.commands.ts, sound.presets.store.ts, ui/ChannelTab.tsx, ui/EffectChain.tsx, ui/effects/,
    ui/PresetsSection.tsx (Settings)                                                                  2
  + sound.line.commands.ts, ui/ClipVolumeLine.tsx, ui/TrackVolumeLine.tsx, ui/automation.hook.ts      3
  + sound.bus.commands.ts, ui/BusStrip.tsx                                                            4
  + sound.delivery.commands.ts, logic/standards.ts, ui/DeliverTab.tsx, ui/ProblemList.tsx             5
  + sound.tools.commands.ts, ui/StripSilencePreview.tsx                                               6
  + sound.markers.commands.ts, sound.record.ts                                                        7
src/modules/preview/
  ~ engine/engine.audiograph.ts        1: track buses, master, monitor; every element in the graph
  ~ engine/engine.audio.ts             1: the old invariant goes
  ~ engine/engine.html.ts, engine.types.ts, preview.module.ts, preview.types.ts, index.ts, README.md
  ~ ui/index.ts                        1: export PreviewStage
  + engine/engine.meters.ts            1: analysers
  + engine/worklets/loudness.worklet.ts       1
  + engine/worklets/dynamics.worklet.ts       2: compressor, gate, de-esser, limiter, ducking
  + logic/volumeline.ts                       3: scheduling the line on the graph
src/modules/timeline/
  ~ timeline.types.ts                  1: TimelineScope, scopes on point entries
  ~ ui/TimelinePanel.tsx, TrackHeader.tsx, TimelineClip.tsx, TimelineToolbar.tsx                         1
  ~ timeline.move.commands.ts, timeline.split.commands.ts, timeline.keys.ts                             1: soundOnly
  ~ README.md, index.ts
src/modules/audio/
  ~ README.md                          1: the old invariant goes
  ~ ui/index.ts, index.ts              1: fade handles and sections the Clip tab reuses
src/modules/export/
  ~ logic/mixdown.ts, logic/mixdown.test.ts, export.types.ts, export.runner.ts, README.md   1 to 5
  ~ logic/presets.ts, ui/                                                                   4: formats, stems
src-tauri/src/export/
  ~ recipe.rs, mod.rs                  1: calls the mix graph. 4: formats
  + mixgraph.rs                        1: the tree. 2: effects. 3: track line. 4: buses, stems
  ~ commands.rs, job.rs                4: stem jobs. 5: analysis passes
src-tauri/src/sound/
  + mod.rs, commands.rs                2: Tauri commands of this module
  + denoise.rs                         2: rendered noise reduction
  + analyze.rs                         5: ebur128, Problems. 6: silencedetect, Match level
  + beats.rs                           6
src-tauri/src/
  ~ lib.rs                             2: registers the module
```

## Left to the builder

- Names of types, commands and files, within the rules in `CLAUDE.md`.
- How the second preview canvas attaches, as long as nothing fights.
- `AnalyserNode` or a meter worklet, as long as 14 stereo tracks stay smooth.
- The default width of the mixer column and how it adapts to small windows.
- Whether the live loudness worklet shares code with the Rust side.
