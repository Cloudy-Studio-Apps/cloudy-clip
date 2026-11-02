# Solid colors, composite and gradients

## Why

Cloudy Clip is moving to a professional model under an easy surface. Solid colors exist but stop short
(they don't follow the frame, and only agents can edit a library solid). Every picture clip lacks opacity
and blend modes, which pros reach for constantly. Gradients don't exist. All three are small next to
keyframes, and they work without them.

Masks, keyframes and the `shape` element are other sessions. Nothing here may block them.

## Goals

1. Solid colors are complete: they follow the frame by default, and the user can do everything an agent can.
2. Every picture clip has a Composite section with a blend mode and opacity, as in DaVinci Resolve, directly
   under Transform.
3. Solids and text fill can be a linear or radial gradient.

Preview, `preview_capture_frame` and export must all match, except for the Linux limit below.

## Non-goals

- Masks, keyframes, shapes, picture effects.
- The blend modes canvas 2D can't do (Subtract, Linear Burn, Vivid Light and the like). They need a custom
  GPU pipeline.
- A switch on the Composite band. Transform has none either, and it needs an `enabled` value everything honors.
- Changing clips when their library solid changes. Clips keep their own copy (Mesa spec).
- Gradients on text outline, text background, text shadow or stickers.

## Composite

**Values.** `Clip.composite: { mode: BlendMode, opacity: number }`, a shared group stored like
`Clip.transform`. Missing means Normal at 100%. `element.setProps` already removes a group equal to its
defaults, so untouched clips and old files stay as they are. `opacity` is 0 to 1, shown as %.

**Modes, in menu order:** Normal, Add, Multiply, Screen, Overlay, Soft Light, Hard Light, Darken, Lighten,
Color Dodge, Color Burn, Difference, Exclusion, Hue, Saturation, Color, Luminosity.

**Ownership.** The type and `clipComposite(clip, live?)` live in `project`, like `clipTransform`, because the
engine (core) can't import a feature. The group lives in `transform` (feature), which already lists opacity
as "not yet". All five picture elements opt in with `supports`: `media`, `text`, `sticker`, `solid`,
`composition`. It applies on video tracks only.

**Panel.** Section "Composite", order 910, in the Video tab, so right under Transform. Mode is a select,
opacity a slider. The band's reset works as Transform's.

**Drawing.** A clip at Normal and 100% takes today's path, untouched. Any other clip is painted on a pooled
scratch canvas and landed once with `globalAlpha` and `globalCompositeOperation`. Everything goes through
that one path. It is needed because text paints in several passes and sets `globalAlpha` itself: drawn
directly, each pass would blend alone.

**Under a transition.** The clips are drawn offscreen, with no backdrop to blend against. Each keeps its
opacity. When both have the same mode, the transition's result lands with that mode. When they differ, it
lands Normal for the overlap, so a small jump is expected there.

**Inside a composition.** A clip blends with what's inside that composition. To blend with what's under the
placement, set the mode on the composition clip.

**Known limit, Linux preview.** WebKitGTK squeezes video to black 15, white 236, and only export corrects it
(`preview` README). Screen and Add over video look slightly hazy in the live preview and not in the export.
Reading frames back is too slow to fix this while playing. The real-app check measures it, and the preview
README records it.

## Solid colors

**Following the frame.** `solid`'s `defaults(format)` gives the format's width and height. `clip.props` keeps
only what differs from the defaults, so a clip that stores no size follows its composition, at any depth.
This is the one rule. A size equal to the frame's is stored as nothing, so it follows too.

**Resize with "scale".** `composition.setSettings` multiplies `transform.scale`. A clip that follows the
frame already grows, so it would scale twice. `PictureDefinition` gets `followsFrame?(clip)`, and the command
skips clips that answer yes. For a solid, yes means neither `width` nor `height` is stored.

**Old projects.** A clip that stored no size used to be 1920×1080 and now follows the frame, so it changes in
any composition that isn't 1920×1080. Accepted: the app is pre-release, and in those compositions the old
size was the bug. A clip with a stored size keeps it.

**Library.** `Solid.width` and `Solid.height` become optional; missing means Match frame. The new-solid dialog
has a Match frame switch, on by default. Old library solids keep their sizes. The same dialog edits a solid.
Right click on a tile offers Edit and Remove, and a double click edits. Editing never touches clips.

**Commands.** `solid.create` takes optional `width` and `height`. `solid.update` takes them nullable, where
null means Match frame. Giving only one of the two fails with `solid.invalid_size`. Colors are stored
lowercase, as `element` stores them.

**Panel.** Width and height show as a Size row. The row's reset goes back to following the frame.

## Gradients

**Value.**

```ts
interface GradientStop {
  at: number;
  color: string;
  opacity: number;
} // at and opacity 0–1, color #rrggbb
interface Gradient {
  type: "linear" | "radial";
  angle: number;
  stops: GradientStop[];
} // 2–8 stops
```

The types live in `project` (a library solid stores one, and `project` sits below `element`). `gradient` is a
built-in `PropKind` in `element`, like `color`, with `prop.gradient()`, not a custom prop type. It is a kind
of value any element, plugin or future `shape` should have, and a custom type would make every test kernel
load another module. An agent always sends a whole gradient, never part of one.

**Geometry.** Pure, in `element`. `angle` is in degrees, clockwise, with 0 running left to right and 90 top to
bottom. A linear line passes through the box's center with length `|w·cos a| + |h·sin a|`, so the end stops
reach the corners. A radial gradient is centered with radius `hypot(w, h) / 2`, and ignores `angle`. The
gradient is measured on the picture's box before its transform, so it rotates and scales with the clip.

**Solid.** New props: `fillType` (`color` | `gradient`, default `color`) and `gradient`. `color` stays where it
is, so saved clips still load. The library solid stores the same two, and the tile draws the gradient.

**Text.** The `fill` group gains `type` (`color` | `gradient`) and `gradient`. The gradient spans the text box.
`fill.opacity` still multiplies it, because in-place editing hides the canvas text with `fill: { opacity: 0 }`.
While the gradient shows, the opacity isn't on screen, because the color field that edits it is hidden. Stops
have their own opacity, and Composite has one too. Presets set `type: "color"`, so applying one gives what it
shows. The editor shows the gradient too, with `background-clip: text`.

**Control.** `GradientField` in `@/ui`: Linear or Radial, a bar with draggable stops, the angle, and the
selected stop's color and opacity. A click on the bar adds a stop, and a Remove button takes one away, never
below 2. The `gradient` control in `inspector` adapts it, as `ColorControl` adapts `ColorField`. The solid
dialog uses the same field. Dragging a stop moves the handle through refs and sends live patches, and release
sends one command.

## Order and risk

The canvas blends in this webview are unproven, and earlier canvas work has hit WebKitGTK bugs. The check runs
in the real app straight after the engine change, before any UI or gradient work. If blending is broken, stop
and report: the rest of composite needs a different approach. Solids and gradients don't depend on it.

## Left to the builder

Layout details of `GradientField`, the default gradient's colors (a visible two-stop gradient, not black), and
the wording of labels and tooltips.
