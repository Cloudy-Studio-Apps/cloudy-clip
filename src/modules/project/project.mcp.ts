import { z } from "zod";
import { defineMcpTool, textResult } from "@/core";
import { orderedJunctions } from "./logic/junctions";
import { orderedMasks } from "./logic/mask";
import { stylesOf } from "./logic/subtitles";
import {
  compositionMarkers,
  orderedTracks,
  requireComposition,
  trackClips,
} from "./project.selectors";
import { projectRef } from "./project.ref";
import type { Clip, Composition, ProjectState } from "./project.types";

/** Sections left out unless asked for in `include`, each counted in `counts`. */
const SECTIONS = ["media", "bins", "solids", "gradeGroups", "luts", "stills"] as const;

/** A clip as agents see it: as stored, with its masks listed in order (id, name, kind, mode, on, invert). */
function clipView(clip: Clip) {
  if (!clip.masks) return clip;
  return {
    ...clip,
    masks: orderedMasks(clip).map(({ id, name, shape, mode, on, invert }) => ({
      id,
      name,
      kind: shape.kind,
      mode,
      on,
      invert,
    })),
  };
}

/** One composition in full: settings, mix and grade as stored, tracks with clips, junctions, markers, subtitle styles. */
function fullComposition(state: ProjectState, composition: Composition) {
  const { id, name, format, background, duration, extendToFit, mix, grade } = composition;
  return {
    id,
    name,
    format,
    background,
    duration,
    extendToFit,
    mix,
    grade,
    tracks: orderedTracks(state, id).map((track) => ({
      id: track.id,
      kind: track.kind,
      name: track.name,
      muted: track.muted || undefined,
      hidden: track.hidden || undefined,
      mix: track.mix,
      clips: trackClips(state, track).map(clipView),
    })),
    junctions: orderedJunctions(state, id),
    markers: compositionMarkers(state, id),
    subtitleStyles: stylesOf(state, id),
  };
}

/** A line per composition: what it is and how much it holds. */
function compositionSummary(state: ProjectState, composition: Composition) {
  const tracks = orderedTracks(state, composition.id);
  return {
    id: composition.id,
    name: composition.name,
    format: composition.format,
    duration: composition.duration,
    tracks: tracks.length,
    clips: tracks.reduce((sum, track) => sum + track.clipIds.length, 0),
    junctions: orderedJunctions(state, composition.id).length,
    markers: compositionMarkers(state, composition.id).length,
  };
}

/** An optional section in full, by name. */
function section(state: ProjectState, name: (typeof SECTIONS)[number]): unknown[] {
  switch (name) {
    case "media":
      return state.mediaOrder.map((id) => state.media[id]);
    case "bins":
      return state.binOrder.map((id) => state.bins[id]);
    case "solids":
      return state.solidOrder.map((id) => state.solids[id]);
    case "gradeGroups":
      return Object.values(state.gradeGroups ?? {}).map(({ id, name, grade }) => ({
        id,
        name,
        grade,
      }));
    case "luts":
      return Object.values(state.luts ?? {});
    case "stills":
      return (state.stillOrder ?? []).map((id) => state.stills?.[id]);
  }
}

/** The project for agents: an overview, with one composition and the sections asked for in full. */
const getState = defineMcpTool({
  name: "project_get_state",
  readOnly: true,
  description:
    "Returns the project, compact. Call this first. Always: its `description` (when given), `main` (the main composition's id), `open` (the one you have open), `compositions` (one line each: id, name, format, duration and how many tracks, clips, junctions and markers it holds), `composition` (one in full: the `compositionId` you pass, else your open one, else Main), `media` (id, name, kind; media_list has the metadata) and `counts` (how many items each `include` section has). The full composition has its settings, `mix` (master, groups, the active and other mix), whole-timeline `grade`, tracks top to bottom (audio ones with their `mix`) with their clips in timeline order, `junctions` (transitions between adjacent clips, by track then time) and `markers` (by time). Values at their defaults are left out: a track is shown `muted` or `hidden` only when it is, a missing `mix` means 0 dB, centered, mix A, no groups or effects, and a clip without `transform`, `sound`, `speed`, `grade` or `animation` shows its media as it is. `include` adds sections in full: `media` (path, size, binId, info), `bins`, `solids`, `gradeGroups` (shot groups: id, name, grade; a clip's `gradeGroup` names one), `luts` (imported .cube files) and `stills` (grabbed frames with their grades). Times are microseconds.",
  input: z.object({
    compositionId: z
      .string()
      .optional()
      .describe(
        "The composition to return in full (an id from `compositions`). Default: your open one, else Main",
      ),
    include: z
      .array(z.enum(SECTIONS))
      .optional()
      .describe('Sections to add in full, e.g. ["media", "gradeGroups"]'),
  }),
  handler(input, ctx) {
    const { store, view } = ctx.require(projectRef);
    const state = store.getState();
    const open = view.openFor(ctx.caller.key);
    const fullId = input.compositionId ?? open;
    const full = fullId === null ? undefined : requireComposition(state, fullId);
    const included = new Set(input.include);
    return textResult({
      description: state.description,
      main: state.mainCompositionId,
      open,
      compositions: state.compositionOrder.flatMap((id) => {
        const composition = state.compositions[id];
        return composition ? [compositionSummary(state, composition)] : [];
      }),
      composition: full && fullComposition(state, full),
      media: state.mediaOrder.flatMap((id) => {
        const item = state.media[id];
        return item ? [{ id, name: item.name, kind: item.kind }] : [];
      }),
      counts: Object.fromEntries(SECTIONS.map((name) => [name, section(state, name).length])),
      ...Object.fromEntries(
        SECTIONS.filter((name) => included.has(name)).map((name) => [name, section(state, name)]),
      ),
    });
  },
});

export const projectMcpTools = [getState];
