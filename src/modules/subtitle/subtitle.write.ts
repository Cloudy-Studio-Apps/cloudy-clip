import { CommandFailure, createId, type CommandContext } from "@/core";
import { elementRef, mergeProps, setProps } from "@/modules/element";
import {
  formatOf,
  MARKER_COLORS,
  projectRef,
  stylesOf,
  type Composition,
  type SubtitleStyle,
} from "@/modules/project";
import { normalizeTextStyle, textStyleOf } from "@/modules/text";
import { restylePatch } from "./logic/overrides";
import { subtitlePreset } from "./logic/presets";

/** Text props as a cue stores them (faces snapped, colors as the schema writes them); `subtitle.invalid_style`. */
export function normalizeStyleProps(
  ctx: CommandContext,
  props: Record<string, unknown>,
  composition: Composition,
): Record<string, unknown> {
  try {
    return normalizeTextStyle(props, {
      patch: {},
      format: composition.format,
      require: ctx.require,
    });
  } catch (error) {
    if (!(error instanceof CommandFailure)) throw error;
    throw new CommandFailure("subtitle.invalid_style", error.message);
  }
}

/**
 * A new style of `composition` (not stored yet). `before` counts styles made earlier in the same
 * command; colors cycle from blue in the order styles are made.
 */
export function makeStyle(
  ctx: CommandContext,
  composition: Composition,
  name: string,
  look: { props: Record<string, unknown>; position: { x: number; y: number } },
  before = 0,
): SubtitleStyle {
  const state = ctx.require(projectRef).store.getState();
  const count = stylesOf(state, composition.id).length + before;
  const color = MARKER_COLORS[(MARKER_COLORS.indexOf("blue") + count) % MARKER_COLORS.length]!;
  return {
    id: createId("sub"),
    compositionId: composition.id,
    name,
    color,
    props: normalizeStyleProps(ctx, look.props, composition),
    position: { ...look.position },
  };
}

/** `Default` (Classic) for a composition with no style yet, else null. */
export function missingDefault(
  ctx: CommandContext,
  composition: Composition,
): SubtitleStyle | null {
  const state = ctx.require(projectRef).store.getState();
  if (stylesOf(state, composition.id).length > 0) return null;
  return makeStyle(ctx, composition, "Default", subtitlePreset("classic", composition.format));
}

/** Stores new styles at the end of their compositions' orders. */
export function storeStyles(ctx: CommandContext, styles: readonly SubtitleStyle[]): void {
  if (styles.length === 0) return;
  ctx.mutate(ctx.require(projectRef).store, (draft) => {
    for (const style of styles) {
      (draft.subtitleStyles ??= {})[style.id] = style;
      const composition = draft.compositions[style.compositionId]!;
      (composition.subtitleStyleOrder ??= []).push(style.id);
    }
  });
}

/**
 * Writes `to`'s values into the cue where it followed `from` (all of them when `from` is null),
 * with one nested `element.setProps`. Keyed paths and `skip` stay. True when something changed.
 */
export async function restyle(
  ctx: CommandContext,
  clipId: string,
  from: SubtitleStyle | null,
  to: SubtitleStyle,
  skip: Iterable<string> = [],
): Promise<boolean> {
  const state = ctx.require(projectRef).store.getState();
  const clip = state.clips[clipId]!;
  const format = formatOf(state, clip);
  const values = ctx.require(elementRef).resolve(clip, format);
  const keyed = new Set([...Object.keys(clip.animation ?? {}), ...skip]);
  const patch = restylePatch(values, from, to, keyed);
  if (Object.keys(patch).length === 0) return false;
  if (patch.weight !== undefined || patch.italic !== undefined) {
    // A cue with its own font may lack the style's face: take the closest one it has.
    const props = { ...patch };
    delete props.transform;
    const merged = mergeProps(
      textStyleOf(clip, format) as unknown as Record<string, unknown>,
      props,
    );
    const snapped = normalizeTextStyle(merged, { patch: {}, format, require: ctx.require });
    if (patch.weight !== undefined) patch.weight = snapped.weight;
    if (patch.italic !== undefined) patch.italic = snapped.italic;
  }
  await ctx.execute(setProps, { clipIds: [clipId], patch });
  return true;
}
