# Text properties — design

Date: 2026-10-29. Status: approved in conversation, ready for a plan.

## Intent

Text clips work (add, move, trim, split, transform) but always say "Text" in one fixed style. This
round makes text fully editable, as in CapCut and other short-form editors: the words, the font,
and the look (fill, outline, background box, shadow), with presets for common looks. Everything a
user can change, an agent can change through MCP, and every change is one undo step.

Success: a user can type their own words, pick any installed or Google font, and style the text
the way they would in CapCut, entirely from the inspector (and edit the words directly on the
canvas). The preview draws exactly what the inspector says.

## Goals

1. **Content**
   - A multi-line text box in the inspector. Typing previews live and is committed as one step
     when the box loses focus (or after a short pause; see "Left to the builder").
   - Double-click a text on the preview canvas to edit its words in place: a DOM textarea
     overlay sitting on the text's box. Enter inserts a new line; Escape or a click outside
     commits. An empty result keeps the previous words. In-place editing is a preview overlay
     contributed by `text` through the preview's `previewOverlays` point.
2. **Font**
   - Font family (installed fonts plus Google Fonts, see Fonts), size (output pixels), weight
     (the weights the family has), italic, letter spacing, line spacing, alignment
     (left / center / right) and an UPPERCASE toggle. UPPERCASE changes only how the words are
     drawn; the stored words keep their case.
3. **Fill:** color and opacity.
4. **Outline:** on/off, color, thickness.
5. **Background (highlight box):** on/off, color, opacity, padding, corner roundness.
6. **Shadow:** on/off, color, blur, distance, angle.
7. **Presets:** Title, Highlight, Outline, Pop!, Lower third (looks from `docs/prototype/`). A
   preset replaces the style fields it defines in one step. Everything stays editable afterwards.
8. **Color picker component, like Cloudy Canvas:** a reusable component in `@/ui`. It has a
   swatch that opens a popover, a saturation/value area, a hue slider, an opacity slider, a hex
   input, and recent colors. Every step of a drag is reported as `{ done: false }` and the end
   as `{ done: true }`. Reference: `../cloudy-canvas/src/canvas-ui/components/color-picker.tsx`,
   `color-field/`, `color/`.
9. **MCP parity:** every inspector edit is a command with an MCP tool. Agents can list and search
   fonts.
10. **README to-do:** the `text` module README lists what is not done yet (see Non-goals).

## Non-goals (go in `src/modules/text/README.md` under "Not yet")

- In/out/loop animations (the next project)
- Styling single words or ranges (rich text)
- Gradient fills
- Curved text or text on a path
- Keyframes on any property
- Auto captions
- Vertical alignment and fixed-width boxes with wrapping (text sizes to its content and lines
  break only where the user types a new line)
- Exporting fonts with a project

## Anti-goals

- A slider drag that creates dozens of undo steps, or that re-renders React on every frame
  (rules 14 and 23).
- The preview and the canvas tools disagreeing on where the text box is: `textBox` and
  `clipPlacement` stay the single source (rule 22).
- An eyedropper button that does nothing. WebKitGTK has no `EyeDropper` API, so the picker has
  no eyedropper unless the API exists at runtime.
- Breaking projects that have text clips without a style. They render with the current default
  look.

## Constraints

- All CLAUDE.md rules. Two are especially relevant. Rule 9: `text` owns its commands, tools and
  UI, even when the UI shows in the inspector. Rule 4: `@/ui` imports only React and its own
  files, so the popover is built in `@/ui` and no Radix is added.
- Update CLAUDE.md "Scope of v1": text styling moves into scope.
- Fonts follow Cloudy Canvas (`../cloudy-canvas/src/platform/fonts/`,
  `src/shared/core/fonts/`, `src-tauri/src/system_fonts.rs`):
  - Installed families come from Rust (`fontdb`, scanned once, off the main thread). The webview
    draws them by name.
  - Google's catalog (`https://fonts.google.com/metadata/fonts`) is fetched through
    `@tauri-apps/plugin-http`, because CORS blocks it from the webview. It is cached for a week
    in `<appData>/fonts/` (`@tauri-apps/plugin-fs`), and a short list of popular families is the
    fallback when offline.
  - A Google face's CSS and files are downloaded the first time and cached in
    `<appData>/fonts/google/…`, then registered with `new FontFace(...)` and `document.fonts.add`.
  - An installed family wins over Google's copy of it.
  - Each face is loaded once per session.
  - Port the pure parts (catalog parse, CSS parse, variants and weights) with their tests.
- While a font loads, the text is drawn in Inter at once (never hold the frame), and the engine
  redraws when the font arrives (see "Settled calls" 1).
- Times are `Micros`; sizes and offsets are output pixels; ids come from `createId()`.

## Decisions

### Data model (in `project`, because it is document state)

`TextClip` gains `style?: TextStyle`. A missing `style` means `defaultTextStyle(format)`, the
current look: Inter 700, white, soft shadow, size 9% of the frame's short side. New clips from
`text.add` store an explicit full style. `TextStyle` is a plain, JSON-serializable object that
`project_get_state` returns as-is:

```ts
interface TextStyle {
  font: { family: string; source: "installed" | "google" | "bundled" }; // Inter is bundled
  size: number; // output px
  weight: FontWeight; // "100" … "900"
  italic: boolean;
  letterSpacing: number; // output px
  lineHeight: number; // multiple of size
  align: "left" | "center" | "right";
  uppercase: boolean;
  fill: { color: string; opacity: number }; // #rrggbb, 0–1
  outline: { enabled: boolean; color: string; width: number }; // width output px
  background: { enabled: boolean; color: string; opacity: number; padding: number; radius: number };
  shadow: {
    enabled: boolean;
    color: string;
    opacity: number;
    blur: number;
    distance: number;
    angle: number;
  }; // degrees, 90 = down
}
```

Exact field names, ranges and defaults are the builder's call, as long as they are validated by
Zod in the commands and documented in TSDoc.

The geometry stays in `project`:

- `textBox(format, clip, measure)` measures the lines (split on `\n`) with letter spacing, the
  outline and the background padding.
- `textFont(style)` builds the CSS font.

Both the engine and the transform hit-test keep going through `textBox` and `clipPlacement`. The
shadow does not grow the box.

### Fonts: a new core module `fonts`

The preview (core) must wait for fonts, and core can't require a feature, so the font library is
its own **core** module `fonts`:

- **API:** `families()`, `load(request) → Promise<boolean>`, `status(request)`
  (`loaded | loading | missing`), and a subscription for "a font finished loading".
- **Native side:** `src-tauri/src/fonts/` registers `fonts_system_list` (fontdb).
- **Dependencies:** `@tauri-apps/plugin-http` and `@tauri-apps/plugin-fs`, with capability
  scopes limited to `fonts.google.com`, `fonts.googleapis.com`, `fonts.gstatic.com` and
  `$APPDATA/fonts/**`.
- **MCP:** `fonts_list` (optional `query`, `source`, `limit`) so agents can find a family and
  its weights.
- **Users:** the preview requires `fonts` to load and await faces and redraw. `text` requires it
  for the picker.
- **Missing fonts:** a font that is not installed and cannot be downloaded draws in Inter. The
  inspector marks the family as missing (for example "Font missing — showing Inter"). No error
  toast while drawing.

### Commands and tools (all in `text`)

| Command               | MCP tool            | Notes                                                                           |
| --------------------- | ------------------- | ------------------------------------------------------------------------------- |
| `text.setText`        | `text_set_text`     | `clipId`, `text` (non-empty)                                                    |
| `text.setStyle`       | `text_set_style`    | `clipId` (or `clipIds`), a deep-partial `TextStyle` patch, merged and validated |
| `text.applyPreset`    | `text_apply_preset` | `clipId`, `preset` (`title`, `highlight`, `outline`, `pop`, `lower-third`)      |
| `text.add` (existing) | `text_add`          | gains optional `text`, `style` and `preset`                                     |

`setStyle` accepts any family name (see "Settled calls" 2) and does not depend on the network.
When the family is in the list already loaded, a weight it lacks fails with
`CommandFailure("text.weight_unavailable", …)`; otherwise the weight is stored as given and drawn
with the nearest available face.

### Live editing without history spam

A slider or color drag previews live through a new preview API `previewTextStyle(clipId, style | null)`,
the same idea as the existing `previewTransform`. Release sends one `text.setStyle`. Typing in the
inspector previews through `previewText(clipId, text | null)` (or one combined
`previewTextClip` override; builder's call) and commits once.

### UI

- The inspector owns a new point, `inspectorSections` (in `inspector.points.ts`): a section
  contributed for a clip kind, with a component and an order.
- `text` contributes its sections from `src/modules/text/ui/`:
  - Content: the textarea and the preset row.
  - Font: the family picker (searchable list, installed first, then Google, with the source
    shown; font names are drawn in their own font only after they are loaded, and the list is
    virtualized), size, weight, italic, letter spacing, line spacing, align segmented control
    and the UPPERCASE toggle.
  - Fill.
  - Outline.
  - Background.
  - Shadow.
- Shared controls a second module will need (slider with number field, toggle row, number
  field) go in `@/ui` (rule 32).
- Look follows `docs/prototype/inspector.js` `textTab`: swatches row plus the custom color
  swatch, toggles, segmented controls. Tokens only, `rounded-xs`–`rounded-lg`.
- Recent colors: `@/ui`'s picker takes `recents` and `onPick` as props. The `text` module keeps
  a per-kernel recent-colors store, persisted to `localStorage` with try/catch. Moving it to a
  shared place is fine if the builder needs it in more than one module.

### Drawing (`preview/engine/engine.text.ts`)

Drawing order per text: background box (rounded rect, its opacity), shadow, outline
(`strokeText`, `lineJoin = "round"`, drawn under the fill), then fill, line by line, aligned
within the box. Shadow sizes are in output pixels, scaled to canvas pixels. Letter spacing uses
`ctx.letterSpacing` when the WebKitGTK webview supports it; otherwise the builder draws the
characters one by one. The builder checks this in the running app.

## Settled calls (made by Claude after the builder check; flag any you disagree with)

1. **Font still loading:** draw in Inter immediately, redraw when the face arrives. The text box can
   change size then; the transform hit-test always reads the current box, so nothing breaks. A
   future export will await fonts itself.
2. **Family validation:** commands accept any family name, independent of the catalog and network.
   `fonts.status` marks it missing when it can't be had; the inspector shows that. `families()` is
   async; command tests stub `fonts`.
3. **Presets:** Title, Highlight, Outline, Pop! are looks only (Pop! has no animation). Lower third
   is a look (left aligned, smaller, background box) **and** moves the text to the bottom-left safe
   area: `text.applyPreset` runs `transform.setClipTransform` inside the same undo step, so `text`
   requires `transform`.
4. **Sizes scale with the frame:** preset and default sizes are defined as fractions of the frame's
   short side and stored as output pixels at apply time, so presets look alike on 9:16, 16:9, 4K.
5. **Inspector:** the clip view keeps its header, Timing and Info. Transform moves onto the
   `inspectorSections` point too (contributed by `transform`), so `inspector` stops requiring
   `transform`; `text` contributes its sections the same way.
6. **Bundled fonts:** Inter and JetBrains Mono (both already shipped via Fontsource), listed first
   in the picker as "Bundled". Fonts the app adds later join that list.

## Left to the builder

- Exact defaults, slider ranges and preset values (start from `docs/prototype/inspector.js`).
- Whether inspector typing commits on blur only or also after a pause.
- File splits, store shapes and the font list virtualization technique.
- How `fonts` caches the family list per kernel.
- Whether `previewText` and `previewTextStyle` are one API or two.
- README updates for `project`, `preview`, `inspector`, `text`, the new `fonts` module and
  `@/ui`, plus the CLAUDE.md scope line and the "Where to look" table.
