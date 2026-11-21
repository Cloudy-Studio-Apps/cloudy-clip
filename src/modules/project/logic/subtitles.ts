import { current, isDraft, type Draft } from "immer";
import { createId } from "@/core";
import type {
  Clip,
  CompositionId,
  ProjectState,
  SubtitleStyle,
  SubtitleStyleId,
} from "../project.types";

/** The subtitle styles of a composition, in its order (the first is its default). */
export function stylesOf(state: ProjectState, compositionId: CompositionId): SubtitleStyle[] {
  const styles = state.subtitleStyles ?? {};
  const order = state.compositions[compositionId]?.subtitleStyleOrder ?? [];
  return order.flatMap((id) => {
    const style = styles[id];
    return style && style.compositionId === compositionId ? [style] : [];
  });
}

/**
 * Keeps styles and marks whole after any edit: a style leaves with its composition, a mark leaves
 * with its style, a marked clip that landed in another composition takes a copy of its style
 * there, and every order lists exactly its composition's styles. Clips and compositions a command
 * wrote whole are frozen values, so they are replaced instead of edited.
 */
export function settleSubtitles(draft: Draft<ProjectState>): void {
  // Missing styles still need settling: marks and orders may name styles that aren't there.
  const styles = (draft.subtitleStyles ?? {}) as Record<SubtitleStyleId, SubtitleStyle>;
  for (const [id, style] of Object.entries(styles)) {
    if (!draft.compositions[style.compositionId]) delete styles[id];
  }
  const copies = new Map<string, SubtitleStyleId>();
  for (const [clipId, clip] of Object.entries(draft.clips) as Array<[string, Clip]>) {
    if (!clip.subtitle) continue;
    const style = styles[clip.subtitle.styleId];
    const home = draft.tracks[clip.trackId]?.compositionId;
    if (!style || home === undefined) {
      const rest = { ...clip };
      delete rest.subtitle;
      draft.clips[clipId] = rest;
      continue;
    }
    if (style.compositionId === home) continue;
    const key = `${style.id}|${home}`;
    let copyId = copies.get(key);
    if (!copyId) {
      copyId = createId("sub");
      // Shared with the source: the document is immutable, so the copy can reuse its values.
      const source = isDraft(style) ? current(style) : style;
      styles[copyId] = { ...source, id: copyId, compositionId: home };
      copies.set(key, copyId);
    }
    draft.clips[clipId] = { ...clip, subtitle: { styleId: copyId } };
  }
  const held = new Map<CompositionId, SubtitleStyleId[]>();
  for (const style of Object.values(styles)) {
    held.set(style.compositionId, [...(held.get(style.compositionId) ?? []), style.id]);
  }
  for (const [id, composition] of Object.entries(draft.compositions)) {
    const ids = held.get(id) ?? [];
    const old = composition.subtitleStyleOrder;
    if (!old && ids.length === 0) continue;
    const kept = (old ?? []).filter((styleId) => ids.includes(styleId));
    const order = [...new Set(kept), ...ids.filter((styleId) => !kept.includes(styleId))];
    if (old && order.length === old.length && order.every((styleId, i) => styleId === old[i])) {
      continue;
    }
    draft.compositions[id] = { ...composition, subtitleStyleOrder: order };
  }
}

/** A style without its composition, or a mark naming a missing style or one of another composition. */
export function subtitleProblem(state: ProjectState): string | null {
  const styles = state.subtitleStyles ?? {};
  for (const [id, style] of Object.entries(styles)) {
    if (style.id !== id) return "a subtitle style would be stored under another id";
    if (!state.compositions[style.compositionId]) {
      return "a subtitle style would be left without its composition";
    }
  }
  for (const clip of Object.values(state.clips)) {
    if (!clip.subtitle) continue;
    const style = styles[clip.subtitle.styleId];
    if (!style) return "a subtitle would name a missing style";
    if (state.tracks[clip.trackId]?.compositionId !== style.compositionId) {
      return "a subtitle would use a style of another composition";
    }
  }
  return null;
}
