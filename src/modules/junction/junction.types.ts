import type { LucideIcon } from "lucide-react";
import type { z } from "zod";
import type { Micros } from "@/core";
import type { PropertyTree } from "@/modules/element";
import type {
  Clip,
  Junction,
  ProjectFormat,
  ProjectState,
  TrackId,
  TrackKind,
} from "@/modules/project";

/** How much two clips of a junction overlap; `false` when the kind doesn't overlap them. */
export type OverlapRule =
  | false
  | { default: Micros; min(state: ProjectState): Micros; max(left: Clip, right: Clip): Micros };

/** What a mix function knows besides the pictures. */
export interface MixEnv {
  format: ProjectFormat;
  /** Canvas pixels per output pixel. */
  kx: number;
  ky: number;
  /** Deterministic random in [0, 1) seeded by the junction id (stable across frames). */
  random(): number;
  /** Seconds since the junction started (for animated grain). */
  elapsed: number;
}

/** Draws one frame of a junction onto `ctx` (full frame, identity transform, canvas pixels). */
export type MixFn = (
  ctx: CanvasRenderingContext2D,
  a: CanvasImageSource,
  b: CanvasImageSource,
  progress: number,
  props: Record<string, unknown>,
  env: MixEnv,
) => void;

/** What the timeline chip shows. */
export interface JunctionDisplay {
  label: string;
  icon: LucideIcon;
}

/** What `normalize` gets besides the full value set. */
export interface NormalizeEnv {
  format: ProjectFormat;
  /** Resolved props before this change ({} on add). */
  previous: Record<string, unknown>;
}

/** A kind of junction (a transition, a plugin's): declared once with `defineJunctionKind`. */
export interface JunctionKindDefinition {
  kind: string;
  name: string;
  icon: LucideIcon;
  /** Track kinds it may sit on. */
  tracks: readonly TrackKind[];
  properties: PropertyTree;
  defaults(format: ProjectFormat): Record<string, unknown>;
  overlap: OverlapRule;
  /** Check/adjust a full value set (e.g. options against the chosen preset); throw CommandFailure. */
  normalize?(next: Record<string, unknown>, env: NormalizeEnv): Record<string, unknown>;
  mix?: MixFn;
  display?(props: Record<string, unknown>): Partial<JunctionDisplay>;
}

/** A kind with its patch schema worked out. */
export interface ResolvedJunctionKind {
  definition: JunctionKindDefinition;
  schema: z.ZodObject;
}

/** The junction registry of one kernel. */
export interface JunctionApi {
  get(kind: string): ResolvedJunctionKind | undefined;
  list(): readonly ResolvedJunctionKind[];
  /** Stored props over the kind's defaults ({} props when the kind is missing). */
  resolve(junction: Junction, format: ProjectFormat): Record<string, unknown>;
  /** Label and icon for the chip; a missing kind gives `{ label: "<kind> (not available)" }`. */
  display(junction: Junction, format: ProjectFormat): JunctionDisplay & { missing: boolean };
  /** Logs once per kernel. */
  warn(message: string): void;
}

/** How long a junction between two clips may last, in microseconds. */
export interface DurationLimits {
  min: Micros;
  max: Micros;
  /** Within `min`..`max`. */
  default: Micros;
}

/** The cut between two adjacent clips of one track (touching, or overlapping by their junction). */
export interface Cut {
  trackId: TrackId;
  left: Clip;
  right: Clip;
}
