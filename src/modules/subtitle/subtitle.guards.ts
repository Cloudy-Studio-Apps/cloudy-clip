import { CommandFailure, type CommandContext } from "@/core";
import {
  projectRef,
  type Clip,
  type Composition,
  type ProjectState,
  type SubtitleStyle,
} from "@/modules/project";
import { isTextClip } from "@/modules/text";

// Ids come from agents: own keys only, so "constructor" or "__proto__" is never found.
const own = <T>(record: Record<string, T> | undefined, id: string): T | undefined =>
  record && Object.hasOwn(record, id) ? record[id] : undefined;

/** The text clip, or `subtitle.clip_not_found` / `subtitle.not_text`. */
export function requireTextClip(state: ProjectState, id: string): Clip {
  const clip = own(state.clips, id);
  if (!clip) throw new CommandFailure("subtitle.clip_not_found", `No clip "${id}".`);
  if (!isTextClip(clip)) {
    throw new CommandFailure("subtitle.not_text", `Clip "${id}" is not a text clip.`);
  }
  return clip;
}

/** The marked text clip and its style, or `subtitle.not_marked` (and the clip's failures). */
export function requireCue(state: ProjectState, id: string): { clip: Clip; style: SubtitleStyle } {
  const clip = requireTextClip(state, id);
  const style = clip.subtitle && own(state.subtitleStyles, clip.subtitle.styleId);
  if (!style) throw new CommandFailure("subtitle.not_marked", `Clip "${id}" is not a subtitle.`);
  return { clip, style };
}

/** The style, or `subtitle.style_not_found`. */
export function requireStyle(state: ProjectState, id: string): SubtitleStyle {
  const style = own(state.subtitleStyles, id);
  if (!style) throw new CommandFailure("subtitle.style_not_found", `No subtitle style "${id}".`);
  return style;
}

/** The composition a clip sits in, or `subtitle.composition_not_found`. */
export function compositionOfClip(state: ProjectState, clip: Clip): Composition {
  const id = state.tracks[clip.trackId]?.compositionId;
  const composition = id === undefined ? undefined : own(state.compositions, id);
  if (!composition) {
    throw new CommandFailure(
      "subtitle.composition_not_found",
      `Clip "${clip.id}" has no composition.`,
    );
  }
  return composition;
}

/** The composition by id, or the one the caller has open; `subtitle.composition_not_found`. */
export function requireComposition(ctx: CommandContext, id: string | undefined): Composition {
  const { store, view } = ctx.require(projectRef);
  if (id === undefined) return view.requireOpen(ctx.actor);
  const composition = own(store.getState().compositions, id);
  if (!composition)
    throw new CommandFailure("subtitle.composition_not_found", `No composition "${id}".`);
  return composition;
}
