# Text Properties Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make text clips fully editable: words, font (installed + Google), size, weight, italic, spacing, alignment, case, fill, outline, background box, shadow, presets. Edits are possible from the inspector, from the canvas (in-place typing), and through MCP.

**Architecture:**

- `TextStyle` is document data on `TextClip` in `project`. Layout and geometry also live in `project` (`textLayout`, `textBox`), so the engine and the canvas tools agree.
- A new **core** module `fonts` lists installed and Google families and loads faces. The preview requires it to draw and to redraw when a font arrives.
- The `text` feature owns the commands, the MCP tools, the inspector sections (through a new `inspector` point) and the in-place editor (through `previewOverlays`).
- The color picker and small form controls go into `@/ui`.

**Tech Stack:** TypeScript strict, React 19, Zustand/Immer, Zod, Vitest (node), Tauri 2 + Rust (`fontdb`), `@tauri-apps/plugin-http`, `@tauri-apps/plugin-fs`.

**Spec:** `docs/superpowers/specs/2026-10-29-text-properties-design.md` (read its "Settled calls").

## Global Constraints

- All rules in `CLAUDE.md`. Each task updates the READMEs of the folders it touches (README template in `docs/modules.md`).
- Done means `pnpm typecheck && pnpm lint && pnpm test` pass. Rust changes also pass `cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test`.
- Times are `Micros`. Sizes, offsets, padding, outline width, blur and distance are **output pixels**. Colors are `#rrggbb` (lowercase). Opacities are 0–1. Angles are degrees.
- A text clip without `style` renders exactly as today. Defaults:
  - Inter 700, white.
  - Shadow `rgba(0,0,0,0.6)`: blur `0.08·size`, distance `0.03·size`, angle 90.
  - `lineHeight` 1.25, padding `0.25·size`.
  - size `round(0.09 · min(w, h))`.
- Font sources: `"bundled"` (Inter, JetBrains Mono; Fontsource families `"Inter Variable"`, `"JetBrains Mono Variable"`), `"installed"`, `"google"`. An installed family wins over Google's copy.
- While a font loads, the text draws in Inter. It redraws when the font arrives. Commands never depend on the network.
- Preset and default sizes are fractions of the frame's short side, stored as output px when applied.
- Lower third deviates from the spec's "bottom-left safe area": commands can't measure text (no DOM in the node tests or the command layer). The preset sets `align: "left"` and a transform of `x = −0.2·width`, `y = +0.32·height`. Note this in the text README.
- No eyedropper unless `"EyeDropper" in window`.
- No Radix or other new UI dependency. The popover is built in `@/ui`.
- Commits: no Co-Authored-By lines (user memory overrides the harness reminder).

## Review Focus

1. **Old projects:** a clip without `style` must render and hit-test identically. A test in Task 1 pins `textBox` for the default style to the old numbers.
2. **Empty and odd text:** empty or whitespace-only words are refused (`text.empty`). Trailing newlines and blank lines still take a line's height. The in-place editor keeps the old words when emptied. Tests are in Tasks 1, 5 and 9.
3. **Offline first run:** the catalog is unreachable, so the fallback list is used. A Google face that fails to download reports `missing`, the text draws in Inter, and there is no error toast. Tests are in Task 3.
4. **Font names in CSS:** families with spaces, quotes or digits (`"Source Sans 3"`, `O'Font`) must be quoted and escaped in the CSS font string. Test in Task 1.
5. **Undo granularity:** one `text.setStyle`/`applyPreset` (including its nested transform) is exactly one history entry. Tests are in Task 5.

---

### Task 1: TextStyle model and layout in `project`

**Files:**

- Modify: `src/modules/project/project.types.ts` (add `TextStyle` and friends; `TextClip.style?: TextStyle`)
- Modify: `src/modules/project/project.text.ts` (replace `TEXT_STYLE`/`textFont`/`textFontSize`)
- Create: `src/modules/project/project.text.test.ts`
- Modify: `src/modules/project/index.ts`, `src/modules/project/README.md`
- Modify callers: `src/modules/transform/logic/layers.ts`, `src/modules/preview/engine/engine.text.ts` (compile only; real drawing in Task 4)

**Interfaces:**

- Produces (types, TSDoc on each):
  ```ts
  type FontWeight = "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
  type FontSource = "bundled" | "installed" | "google";
  interface TextFontRef {
    family: string;
    source: FontSource;
  }
  type TextAlign = "left" | "center" | "right";
  interface TextFill {
    color: string;
    opacity: number;
  }
  interface TextOutline {
    enabled: boolean;
    color: string;
    width: number;
  }
  interface TextBackground {
    enabled: boolean;
    color: string;
    opacity: number;
    padding: number;
    radius: number;
  }
  interface TextShadow {
    enabled: boolean;
    color: string;
    opacity: number;
    blur: number;
    distance: number;
    angle: number;
  }
  interface TextStyle {
    font: TextFontRef;
    size: number;
    weight: FontWeight;
    italic: boolean;
    letterSpacing: number;
    lineHeight: number;
    align: TextAlign;
    uppercase: boolean;
    fill: TextFill;
    outline: TextOutline;
    background: TextBackground;
    shadow: TextShadow;
  }
  type TextStylePatch = {
    [K in keyof TextStyle]?: TextStyle[K] extends object ? Partial<TextStyle[K]> : TextStyle[K];
  };
  interface TextLine {
    text: string;
    x: number;
    y: number;
    width: number;
  } // x,y: left/baseline-middle offset from box center
  interface TextLayout {
    box: PictureSize;
    lines: TextLine[];
    font: string;
    lineHeight: number;
  }
  type TextMeasure = (text: string, font: string, letterSpacing: number) => number; // signature extended
  ```
- Produces (functions in `project.text.ts`):
  - `defaultTextStyle(format: ProjectFormat): TextStyle`: the current look. Background off (black, 0.6, padding `0.25·size`, radius `0.15·size`); outline off (black, `0.08·size`).
  - `textStyleOf(clip: TextClip, format: ProjectFormat): TextStyle`: `clip.style ?? defaultTextStyle(format)`.
  - `mergeTextStyle(style: TextStyle, patch: TextStylePatch): TextStyle`: one level of deep merge.
  - `cssFontFamily(font: TextFontRef): string`: the quoted, escaped family followed by `, "Inter Variable", sans-serif`. Bundled names map to their Fontsource family.
  - `textFont(style: TextStyle): string`: CSS font: `${italic?"italic ":""}${weight} ${size}px ${cssFontFamily}`.
  - `displayText(text: string, style: TextStyle): string`: applies `uppercase`.
  - `textLayout(text: string, style: TextStyle, measure: TextMeasure): TextLayout`.
  - `textBox(format, clip, measure): PictureSize`: now `textLayout(...).box`.
  - `textPadding(style: TextStyle): number`.
- Removed: `TEXT_STYLE`, `textFontSize`, old `textFont(format)`. Update the three callers.

Layout rules (`textLayout`):

- Lines = `displayText(text).split("\n")`. An empty line has width 0 but takes a full line.
- `lineHeightPx = size·lineHeight`.
- `pad` = the larger of `0.25·size` (or `background.padding` when the background is enabled) and `outline.width/2` when the outline is enabled.
- `box.width = max(1, max(line widths) + 2·pad)`.
- `box.height = lines·lineHeightPx + 2·pad`.
- Each line's `y` is its middle, relative to the box center.
- Each line's `x` is its left edge, relative to the box center:
  - left: `−box.width/2 + pad`
  - center: `−width/2`
  - right: `box.width/2 − pad − width`

- [ ] **Step 1: Write failing tests** in `project.text.test.ts`. Use a fake measure `(t, _f, ls) => t.length * 10 + Math.max(0, t.length - 1) * ls`, and format 1080×1920.
  - `defaultTextStyle` → `size` 97, `font` `{family:"Inter",source:"bundled"}`, `weight` "700", `shadow.enabled` true, `outline.enabled`/`background.enabled` false.
  - `textBox` of a style-less clip with "Text" equals `{ width: 40 + 2*24.25, height: 97*1.25 + 2*24.25 }`. This is the old formula, pinned for back-compat.
  - `"a\n\nccc"` center-aligned: 3 lines, middle line width 0, `box.height = 3*lineHeightPx + 2*pad`, line x's are `-5, 0, -15`.
  - Left and right alignment x's as per the rules above.
  - Trailing `"ab\n"` has 2 lines.
  - Letter spacing 4 widens `"abc"` by 8.
  - Uppercase lays out `"ABC"` but `clip.text` is untouched.
  - Outline width 80 (`pad = 40` > 24.25) grows the box.
  - Background padding 50, enabled, gives pad 50.
  - `cssFontFamily({family:'O\'Font "X"', source:"google"})` returns a double-quoted string with `\"` escaped. `"Source Sans 3"` is quoted.
  - `textFont` with italic 400 → starts with `"italic 400 97px "`.
  - `mergeTextStyle(style, { fill: { opacity: 0.5 } })` keeps `fill.color`.
- [ ] **Step 2:** `pnpm vitest run src/modules/project/project.text.test.ts`. Expected: FAIL (exports missing).
- [ ] **Step 3:** Implement the types in `project.types.ts`, the functions in `project.text.ts`, and the exports in `index.ts`. Update the callers: `layers.ts` passes `clip` to `textBox`; `engine.text.ts` uses `textLayout` and draws only the fill for now.
- [ ] **Step 4:** `pnpm typecheck && pnpm vitest run src/modules/project src/modules/transform`. Expected: PASS. The existing `project.geometry.test.ts` text cases still pass (adjust only the `textBox` call signature).
- [ ] **Step 5:** Update `src/modules/project/README.md` (TextStyle, layout). Commit `feat(project): text style model and multi-line layout`.

---

### Task 2: Fonts pure logic

**Files:**

- Create: `src/modules/fonts/fonts.types.ts`, `src/modules/fonts/logic/catalog.ts`, `src/modules/fonts/logic/variants.ts`, `src/modules/fonts/logic/logic.test.ts`

**Interfaces:**

- Consumes: `FontWeight`, `FontSource` from `@/modules/project`.
- Produces (in `fonts.types.ts`):
  - `FontVariant { weight: FontWeight; style: "normal"|"italic" }`
  - `FontRequest extends FontVariant { family: string; source: FontSource }`
  - `FontFamily { family: string; source: FontSource; category?: string; variants: FontVariant[] }`
  - `FontFaceSource { url: string; unicodeRange?: string }`
  - `FontStatus = "loaded" | "loading" | "missing"`
- Produces (logic, ported from `../cloudy-canvas/src/shared/core/fonts/google-fonts.ts` and `font-variants.ts`):
  - `GOOGLE_CATALOG_URL`, `parseGoogleCatalog(text): FontFamily[]`
  - `googleFontCssUrl(family, variant): string`, `parseFontFaceCss(css): FontFaceSource[]`
  - `GOOGLE_FALLBACK_FAMILIES: readonly FontFamily[]` (same 16 names)
  - `BUNDLED_FAMILIES: readonly FontFamily[]`: Inter and JetBrains Mono, weights 100–900, normal + italic.
  - `sortVariants(v): FontVariant[]`, `nearestWeight(n: number): FontWeight`, `closestVariant(family: FontFamily, want: FontVariant): FontVariant`
  - `mergeFamilies(bundled, installed, google): FontFamily[]`: drops installed or Google duplicates of bundled names, and Google duplicates of installed names. Order: bundled, installed (alphabetical), Google.
  - `fontKey(r: FontRequest): string`
  - `searchFamilies(families, query: string, limit: number): FontFamily[]`: case-insensitive substring match, prefix matches first.

- [ ] **Step 1: Write failing tests** in `logic.test.ts`:
  - The catalog parse strips `)]}'` and maps `"700i"` to `{weight:"700",style:"italic"}`. It skips families with no variants.
  - CSS parse returns 2 sources with `unicodeRange` for a two-block sample.
  - `googleFontCssUrl("Source Sans 3",{weight:"700",style:"italic"})` → `...family=Source+Sans+3:ital,wght@1,700`.
  - `nearestWeight(650)` → `"700"`, `nearestWeight(40)` → `"100"`.
  - `closestVariant` prefers the same style, then the nearest weight.
  - `mergeFamilies` drops Google `"Inter"` and installed `"Inter"`, and keeps installed `"Roboto"` over Google `"Roboto"` with source `installed`.
  - `searchFamilies(..., "rob", 5)` puts `"Roboto"` before `"Fira Robust"`.
- [ ] **Step 2:** `pnpm vitest run src/modules/fonts/logic`. Expected: FAIL.
- [ ] **Step 3:** Implement the logic (port the Canvas code; adapt imports).
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(fonts): catalog, variants and search logic`.

---

### Task 3: `fonts` core module (native list, Google cache, loader, MCP)

**Files:**

- Create Rust: `src-tauri/src/fonts/mod.rs`, `src-tauri/src/fonts/commands.rs` (port `../cloudy-canvas/src-tauri/src/system_fonts.rs`'s listing only, command named `fonts_system_list`). Add `fontdb` to `Cargo.toml`. Register `tauri_plugin_http::init()` and `tauri_plugin_fs::init()` and the command in `lib.rs` (`mod fonts;`).
- Modify: `src-tauri/capabilities/default.json`: `http:default` scoped to `https://fonts.google.com/*`, `https://fonts.googleapis.com/*`, `https://fonts.gstatic.com/*`; `fs` read/write/mkdir/exists scoped to `$APPDATA/fonts/**`.
- `pnpm add @tauri-apps/plugin-http @tauri-apps/plugin-fs`
- Create TS: `src/modules/fonts/{index.ts, fonts.ref.ts, fonts.module.ts, fonts.store.ts, fonts.service.ts, fonts.library.ts, fonts.mcp.ts, fonts.testing.ts, fonts.library.test.ts, README.md}`
- Modify: `src/app/bootstrap.ts` (add `fontsModule`), the `docs/modules.md` tier table, and the CLAUDE.md "Where to look".

**Interfaces:**

- Produces in `fonts.types.ts`:
  ```ts
  interface FontService {
    // native + network; faked in tests
    installed(): Promise<{ family: string; weight: number; italic: boolean }[]>;
    googleCatalog(): Promise<FontFamily[]>; // cache ≤ 7 days, else fetch+cache, else stale, else fallback
    loadGoogleFace(r: FontRequest): Promise<boolean>; // cache files in <appData>/fonts/google/<slug>/<w>[i]/, FontFace + document.fonts.add
    loadByName(r: FontRequest): Promise<boolean>; // document.fonts.load + check (installed/bundled)
  }
  interface FontsApi {
    families(): Promise<FontFamily[]>; // cached per kernel after first call
    load(r: FontRequest): Promise<boolean>; // once per fontKey per kernel
    status(r: FontRequest): FontStatus | undefined; // undefined = never requested
    ensure(r: FontRequest): boolean; // true if loaded; otherwise starts load, returns false
    onLoaded(listener: (r: FontRequest) => void): () => void; // also fires on "missing"
  }
  ```
- `createFontsLibrary(service: FontService): FontsApi` in `fonts.library.ts`. This is the logic, tested with a fake service.
- `fontsRef`, `fontsModule` (tier **core**, requires nothing), `createFakeFontsModule(options?: { families?: FontFamily[]; fail?: string[] })` exported from `index.ts` (like `createFakeMediaModule`).
- MCP `fonts_list`: a read tool (follow `project.mcp.ts`'s read-tool pattern). Input `{ query?: string; source?: FontSource; limit?: number (default 50, max 200) }`. Returns `{ family, source, weights: FontWeight[], italic: boolean }[]`.

- [ ] **Step 1: Write failing tests** in `fonts.library.test.ts` (fake `FontService`):
  - `families()` merges in the bundled → installed → Google order and calls the service once across two calls.
  - Installed faces group into a family with `nearestWeight` variants.
  - `load()` twice with the same request calls the service once.
  - A bundled or installed family uses `loadByName`; a Google one uses `loadGoogleFace`.
  - `ensure()` returns false, then `onLoaded` fires, then `status` is `"loaded"`, then `ensure()` returns true.
  - A service rejection or `false` gives status `"missing"`, fires `onLoaded`, and does not throw.
  - When `googleCatalog` rejects (offline), `families()` still resolves with bundled and installed.
- [ ] **Step 2:** `pnpm vitest run src/modules/fonts`. Expected: FAIL.
- [ ] **Step 3:** Implement `fonts.library.ts`, `fonts.store.ts` (status map, per kernel), `fonts.service.ts` (Tauri; port `../cloudy-canvas/src/platform/fonts/google-fonts.ts` and `font-cache.ts`, using `plugin-http` `fetch` for the catalog and CSS and `plugin-fs` under `BaseDirectory.AppData`), `fonts.module.ts` (wiring only), `fonts.mcp.ts`, `fonts.testing.ts`, Rust command, and capabilities.
- [ ] **Step 4:** `pnpm vitest run src/modules/fonts && pnpm typecheck && cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test`. Expected: PASS.
- [ ] **Step 5:** Write the README (template). Commit `feat(fonts): installed and Google font library`.

---

### Task 4: Preview draws the full style, live text overrides, font loading

**Files:**

- Modify: `src/modules/preview/engine/engine.text.ts`, `engine.html.ts`, `engine.types.ts`, `preview.controller.ts`, `preview.types.ts`, `preview.module.ts` (requires `fonts`), `README.md`
- Modify: `src/modules/preview/preview.controller.test.ts` and every test that loads `previewModule` (add `createFakeFontsModule()`). Callers: `grep -rl previewModule src --include=*.test.ts`.

**Interfaces:**

- Consumes: `textLayout`, `textStyleOf`, `textFont`, `mergeTextStyle` (Task 1); `FontsApi.ensure`, `onLoaded` (Task 3).
- Produces on `PreviewApi`:
  - `previewTextClip(clipId: ClipId, override: { text?: string; style?: TextStyle } | null): void`: drawn instead of the saved values until cleared, like `previewTransform`, and triggers a redraw.
  - `textClipOverride(clipId): { text?: string; style?: TextStyle } | undefined`: so the transform overlay and the in-place editor measure the live box.
- `drawText(ctx, format, clip, style, text, transform, kx, ky)`. Order:
  1. Background `roundRect` (`globalAlpha = background.opacity`).
  2. Each line: shadow set on the first painted pass only. The shadow offset is `distance` at `angle` (90 = down) and the blur is `blur`, both scaled by `kx·scale`. Color is `shadow.color` with `shadow.opacity`.
  3. Outline `strokeText` (`lineWidth = outline.width`, `lineJoin = "round"`).
  4. Fill `fillText` with `globalAlpha = fill.opacity`.
- Set `ctx.letterSpacing = \`${letterSpacing}px\``when`"letterSpacing" in ctx`. Otherwise draw character by character (`measure`must match: same fallback in the engine's`TextMeasure`).
- When `fonts.ensure(request)` is false, draw with the Inter fallback font. `preview.module` subscribes `fonts.onLoaded(() => controller.redraw())` and registers it with `onDispose`.

- [ ] **Step 1: Write failing test** in `preview.controller.test.ts`: `previewTextClip(id, { text: "Hi" })` then `textClipOverride(id)` returns `{ text: "Hi" }`. Passing `null` clears it.
- [ ] **Step 2:** `pnpm vitest run src/modules/preview`. Expected: FAIL.
- [ ] **Step 3:** Implement. Drawing has no unit test (node env, no canvas); its geometry is already tested in Task 1.
- [ ] **Step 4:** `pnpm test && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5:** Update the preview README. Commit `feat(preview): draw styled text and wait for fonts`.

---

### Task 5: Text commands, presets and MCP tools

**Files:**

- Create: `src/modules/text/logic/presets.ts`, `src/modules/text/logic/presets.test.ts`, `src/modules/text/text.schema.ts` (Zod for `TextStylePatch`)
- Modify: `src/modules/text/text.commands.ts` (split into `text.add.command.ts` / `text.style.commands.ts` if > ~200 lines), `text.commands.test.ts`, `text.mcp.ts`, `text.module.ts` (requires `project, preview, timeline, transform, fonts`), `index.ts`, `text.types.ts`

**Interfaces:**

- Consumes: `mergeTextStyle`, `textStyleOf`, `defaultTextStyle` (Task 1); `fontsRef` (Task 3); `setClipTransform` from `@/modules/transform`.
- Produces:
  - `TextPresetId = "title" | "highlight" | "outline" | "pop" | "lower-third"` (in `text.types.ts`).
  - `presetStyle(id, format: ProjectFormat): TextStylePatch` and `presetTransform(id, format): ClipTransform | null` in `logic/presets.ts`. Let `s = min(w, h)`:
    - title: size `0.09·s`, weight 900, white, outline off, background off, shadow on.
    - highlight: size `0.06·s`, weight 600, color `#1f2430`, background on, `#f2a385`, opacity 1, padding `0.02·s`, radius `0.006·s`.
    - outline: size `0.067·s`, weight 900, white, outline on, `#000000`, width `0.008·s`, shadow off.
    - pop: size `0.074·s`, weight 700, italic, color `#8cc4f0`, shadow on.
    - lower-third: size `0.04·s`, weight 700, align left, background on, `#1f2430`, opacity 0.8, padding `0.015·s`. Transform `{ x: −0.2·w, y: 0.32·h, scale: 1, rotation: 0 }`. All other presets: null.
    - All sizes are rounded to integers.
  - Commands (TSDoc, Zod input, `undoable: true`):
    - `setText` `text.setText` `{ clipId, text }`. Fails with `text.clip_not_found`, `text.not_text` or `text.empty` (when `text.trim() === ""`).
    - `setTextStyle` `text.setStyle` `{ clipIds: string[] (min 1), style: TextStylePatch }`. Validates all clips first, then mutates. Validation:
      - size 1–2000
      - letterSpacing −200–1000
      - lineHeight 0.5–4
      - opacities 0–1
      - colors `/^#[0-9a-f]{6}$/i`, lowercased
      - outline width 0–200, padding 0–500, radius 0–500, blur 0–500, distance 0–500
      - angle −180–360
      - Weight: when `fonts.families()` contains the family (match by `family` name), the weight must exist in its variants, else `text.weight_unavailable`. Unknown families are accepted.
    - `applyTextPreset` `text.applyPreset` `{ clipId, preset: TextPresetId }`: style merge, plus `ctx.execute(setClipTransform, …)` when `presetTransform` is non-null.
    - `addText` gains optional `text`, `style: TextStylePatch` and `preset`. It stores `mergeTextStyle(defaultTextStyle(format), presetStyle ?? {}, style ?? {})` (apply in that order).
  - MCP: `text_set_text`, `text_set_style`, `text_apply_preset` via `commandTool`. Their descriptions mention `fonts_list` for picking a family.

- [ ] **Step 1: Write failing tests:**
  - In `presets.test.ts`: title at 1080×1920 has size 97. Lower-third transform at 1080×1920 is `{x:-216, y:614.4, …}`. Only lower-third has a transform.
  - In `text.commands.test.ts` (load `createFakeFontsModule({ families: [{ family: "Roboto", source: "google", variants: [{weight:"400",style:"normal"}] }] })` and `transformModule`):
    - `setText` changes the words. `"  "` fails with `text.empty`. A media clip fails with `text.not_text`.
    - `setStyle` `{ fill: { opacity: 0.5 } }` keeps the default color.
    - A Roboto weight of 700 fails with `text.weight_unavailable`. `"Nonexistent Font"` 700 is accepted.
    - `"#FFAA00"` is stored as `"#ffaa00"`. `size: 0` is rejected by the input.
    - Two clipIds, one bad: nothing changes.
    - `applyPreset("lower-third")` sets `style.align` "left" **and** `transform`, and `kernel.history.undo()` once restores both (one step).
    - `add` with `{ preset: "outline", text: "Hi" }` stores outline enabled and "Hi".
- [ ] **Step 2:** `pnpm vitest run src/modules/text`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `pnpm vitest run src/modules/text && pnpm typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(text): set text, set style and presets commands`.

---

### Task 6: `@/ui` color picker and form controls

**Files:**

- Create: `src/ui/lib/color.ts` + `src/ui/lib/color.test.ts` (hex ↔ HSV, `normalizeHex`)
- Create (one component per file, in `src/ui/kit/`): `Popover.tsx`, `ColorArea.tsx` (saturation/value), `ColorSlider.tsx` (hue or opacity track), `HexInput.tsx`, `ColorPicker.tsx`, `ColorField.tsx`, `ColorSwatches.tsx`, `SliderField.tsx` (label + range + number input), `NumberField.tsx`, `ToggleRow.tsx`, `SelectField.tsx` if needed. Add a `kit.pointer.ts` hook file (pointer drag) if shared.
- Modify: `src/ui/kit/kit.types.ts`, `src/ui/index.ts`, `src/ui/README.md`

**Interfaces:**

- `color.ts`: `normalizeHex(input: string): string | null` (accepts `#abc`, `abc`, `#aabbcc`, returns lowercase `#aabbcc`); `hexToHsv(hex): {h,s,v}` (h 0–360, s/v 0–1); `hsvToHex(hsv): string`.
- `ColorChangeInfo { done: boolean }`. Every drag step reports `done: false`; release, typed hex and swatch picks report `done: true`.
- `ColorPicker({ color, opacity?, onChange(color: string, opacity: number, info), recents?: string[], swatches?: string[] })`: area, hue, opacity (only when `opacity` is given), hex, optional eyedropper (only if `"EyeDropper" in window`), swatches, recents.
- `ColorField({ label, color, opacity?, onChange, recents?, swatches? })`: a swatch button (checkerboard under the color) that opens `Popover` with `ColorPicker`, then hex text, then opacity %. Visual reference: `../cloudy-canvas/src/canvas-ui/components/color-field/`.
- `Popover({ trigger, open?, onOpenChange?, side?, children })`: portal to `document.body`, positioned from the trigger's rect, closes on outside pointerdown or Escape, focus returns to the trigger.
- `SliderField({ label, value, min, max, step, unit?, onInput(v), onCommit(v) })`: `onInput` fires per move (no React state up the tree is required), `onCommit` fires once on release or Enter.
- `ToggleRow({ label, checked, onChange, children? })`: when checked, it shows its children (the sub-fields).
- Tokens only; `rounded-xs`–`rounded-lg`; text sizes `text-2xs`–`text-base`.

- [ ] **Step 1: Write failing tests** in `color.test.ts`:
  - `normalizeHex("ABC")` → `"#aabbcc"`; `normalizeHex("#12345")` → null.
  - `hsvToHex(hexToHsv("#f2a385"))` → `"#f2a385"`.
  - `hexToHsv("#ff0000")` → `{h:0,s:1,v:1}`; `#000000` has `v` 0.
- [ ] **Step 2:** `pnpm vitest run src/ui`. Expected: FAIL.
- [ ] **Step 3:** Implement `color.ts`, then the components.
- [ ] **Step 4:** `pnpm vitest run src/ui && pnpm typecheck && pnpm lint`. Expected: PASS.
- [ ] **Step 5:** Update the UI README kit list. Commit `feat(ui): color picker and form fields`.

---

### Task 7: Inspector sections point

**Files:**

- Create: `src/modules/inspector/inspector.points.ts`
- Modify: `inspector.types.ts`, `inspector.module.ts` (requires `project, timeline` only), `ui/ClipView.tsx`, `index.ts`, `README.md`
- Move: `src/modules/inspector/ui/TransformSection.tsx` → `src/modules/transform/ui/TransformSection.tsx`. Its `InspectorSection` wrapper becomes an exported `InspectorSection` from `@/modules/inspector` (or a kit `Section` in `@/ui` if transform shouldn't import inspector; prefer `@/ui` `Section` so features don't depend on inspector's UI).
- Modify: `src/modules/transform/transform.module.ts` (requires adds `inspector`; contributes its section), `README.md`

**Interfaces:**

- `InspectorClipSection { id: string; title: string; order: number; appliesTo(clip: Clip, track: Track): boolean; component: ComponentType<{ clip: Clip }> }`
- `inspectorSections = definePoint<InspectorClipSection>("inspector.sections", { keyOf: s => s.id })`, exported from `@/modules/inspector`.
- `ClipView` renders the header, then the sections whose `appliesTo` is true (sorted by `order`, each wrapped in a collapsible section with the given title), then Timing and Info.
- Orders: transform 100, text sections 10–60 (text above transform).

- [ ] **Step 1: Write a failing test** in `src/modules/inspector/inspector.points.test.ts`: a kernel loading project and timeline, inspector, plus a test module contributing a section. Reading the point returns it, and `appliesTo` filters by kind. Follow the existing point-reading pattern in `src/core` tests.
- [ ] **Step 2:** `pnpm vitest run src/modules/inspector`. Expected: FAIL.
- [ ] **Step 3:** Implement and move the transform section.
- [ ] **Step 4:** `pnpm test && pnpm typecheck && pnpm lint`. Expected: PASS (the module-boundary rule must be satisfied).
- [ ] **Step 5:** Commit `feat(inspector): sections contributed per clip kind`.

---

### Task 8: Text inspector sections

**Files:**

- Create in `src/modules/text/ui/`:
  - `TextContentSection.tsx`: the textarea plus the preset row.
  - `TextFontSection.tsx`: family picker, size, weight, italic, letter spacing, line spacing, align, uppercase.
  - `FontPicker.tsx`: popover with search over `families()`, virtualized by rendering only the visible window (row height fixed), the source label per row, and a missing badge.
  - `TextFillSection.tsx`, `TextOutlineSection.tsx`, `TextBackgroundSection.tsx`, `TextShadowSection.tsx`
  - `text.live.hook.ts`: live preview plus commit.
  - `text.recents.store.ts`: per-kernel recent colors, max 12, `localStorage` key `cloudy-clip.colors.recent`, try/catch.
- Modify: `text.module.ts` (contribute 6 sections, create the recents store in `setup`), `ui/index.ts`, `README.md`

**Interfaces:**

- Consumes: `inspectorSections` (Task 7); `setText`, `setTextStyle`, `applyTextPreset` (Task 5); `PreviewApi.previewTextClip` (Task 4); `FontsApi.families`, `status` (Task 3); `ColorField`, `SliderField`, `ToggleRow`, `SegmentedControl` (Task 6).
- `useTextLive(clip)` returns `{ input(patch: TextStylePatch): void; commit(patch: TextStylePatch): void; inputText(text): void; commitText(text): void }`.
  - `input` merges into the live override and calls `previewTextClip`. It does not change React state.
  - `commit` runs the command and then clears the override.
  - `commitText` runs on blur, and on Ctrl/Cmd+Enter. It is skipped when unchanged, and when empty the field reverts.
- When picking a family, keep the current weight if the family has it, else `closestVariant`. Kick off `fonts.load`.
- The family row shows "Missing — showing Inter" when `status(...) === "missing"`.
- Swatches row: `#ffffff #1f2430 #f2a385 #8cc4f0 #f5d97a #b9a3f0` (from the prototype).

- [ ] **Step 1: Write a failing test** for the recents logic. Put pure helpers in `src/modules/text/logic/recents.ts` with `pushRecent(list: string[], color: string, max = 12): string[]`: dedupe, newest first, capped. Test it in `logic/recents.test.ts`.
- [ ] **Step 2:** `pnpm vitest run src/modules/text/logic`. Expected: FAIL.
- [ ] **Step 3:** Implement the helper, store, hook and sections.
- [ ] **Step 4:** `pnpm test && pnpm typecheck && pnpm lint`. Expected: PASS.
- [ ] **Step 5:** Manual check (`pnpm tauri dev`):
  - A slider drag updates the preview live and is one undo step (Ctrl+Z reverts the whole drag).
  - A Google font (e.g. "Lobster") draws after download.
  - Offline, an uncached Google font shows the missing badge and draws in Inter.
- [ ] **Step 6:** Commit `feat(text): inspector sections for words, font and look`.

---

### Task 9: In-place editing on the canvas

**Files:**

- Create: `src/modules/text/ui/TextEditOverlay.tsx`, `src/modules/text/ui/text.edit.gesture.ts` if needed, `src/modules/text/logic/editing.ts` + `editing.test.ts`
- Modify: `text.module.ts` (contribute `previewOverlays` `{ id: "text.editor" }`), `README.md`

**Interfaces:**

- Consumes: the `previewOverlays` point; `textLayout`, `clipPlacement` (frame placement); the `TransformOverlay` approach for mapping output px to screen (read `src/modules/transform/ui/` and reuse its frame-rect logic; if a helper is private, export it from `@/modules/transform`'s `index.ts`).
- `editCommitAction(before: string, after: string): "none" | "revert" | "commit"` in `logic/editing.ts`: `"none"` when unchanged, `"revert"` when `after.trim() === ""`, else `"commit"`.
- Behavior:
  - Double-clicking a text clip's box opens a `textarea` over it, matching the font, size (scaled to screen), color and alignment, with transparent background and rotation via CSS `transform`.
  - While editing, the canvas text is hidden (`previewTextClip(id, { text: "" })` or an equivalent hidden flag) and typing calls `inputText`.
  - Enter inserts a newline. Escape, blur or an outside click ends the edit through `editCommitAction`.
  - The transform overlay must not start a drag while the editor is open.

- [ ] **Step 1: Write failing tests** for `editCommitAction`: `("a","a")` → none, `("a","  \n")` → revert, `("a","b")` → commit.
- [ ] **Step 2:** `pnpm vitest run src/modules/text/logic/editing.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the logic and the overlay.
- [ ] **Step 4:** `pnpm test && pnpm typecheck && pnpm lint`. Expected: PASS.
- [ ] **Step 5:** Manual check: double-click edits in place; a rotated and scaled text lines up; Ctrl+Z reverts the edit as one step.
- [ ] **Step 6:** Commit `feat(text): edit words in place on the canvas`.

---

### Task 10: Docs, scope and end-to-end check

**Files:** `CLAUDE.md`, `src/modules/text/README.md`, `docs/architecture.md` (if it lists modules), any README not yet updated.

- [ ] **Step 1:** CLAUDE.md:
  - The Scope of v1 line now includes text styling ("plain text clips" → "text clips with full styling and fonts"); remove "text styling" from the "No …" list.
  - Add `fonts/` to "Where to look".
- [ ] **Step 2:** Rewrite `text/README.md` to cover:
  - the commands and tools table (`text.add`, `text.setText`, `text.setStyle`, `text.applyPreset`)
  - presets, including the Lower third deviation
  - the live editing flow
  - **Not yet**: in/out/loop animations; styling single words (rich text); gradient fills; curved text; keyframes; auto captions; vertical alignment and wrapping boxes; exporting fonts with a project; exact left-anchored Lower third.
- [ ] **Step 3:** Run `pnpm typecheck && pnpm lint && pnpm test && cd src-tauri && cargo clippy --all-targets -- -D warnings && cargo test`. Expected: all PASS.
- [ ] **Step 4:** MCP check against the running app:
  - `fonts_list {query:"lob"}`
  - `text_add {preset:"title", text:"Hello"}`
  - `text_set_style` with a Google family
  - `project_get_state` shows the full `style`
- [ ] **Step 5:** Check letter spacing in WebKitGTK (`"letterSpacing" in CanvasRenderingContext2D.prototype`). If it's false, confirm the per-character fallback draws correctly.
- [ ] **Step 6:** Commit `docs: text properties`.
