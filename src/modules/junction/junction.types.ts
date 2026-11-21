import type { LucideIcon } from "lucide-react";
import type { z } from "zod";
import type { Micros } from "@/core";
import type { PropertyTree } from "@/modules/element";
import type { Clip, Junction, ProjectFormat, TrackId, TrackKind } from "@/modules/project";

/** How much two clips of a junction overlap; `false` when the kind doesn't overlap them. */
export type OverlapRule =
  | false
  | { default: Micros; min(format: ProjectFormat): Micros; max(left: Clip, right: Clip): Micros };

/**
 * A uniform the shader declares as `int` (or `ivec2`…`ivec4`), made with `gpuInt`. A plain
 * number is always a `float`.
 */
export interface GpuInt {
  readonly int: number | readonly number[];
}

/** A uniform value: a number is a `float`, 2 to 4 numbers a `vec2` to `vec4`, `GpuInt` an `int`. */
export type GpuUniform = number | readonly number[] | GpuInt;

/**
 * A small data texture of a pass (a curve, a table, a LUT), RGBA. Uploaded again only when its
 * `key` or `version` changes. `"1d"` is a 2D texture one row high (`sampler2D`), `"3d"` a
 * `sampler3D` of `depth` slices. Bytes are `RGBA8`, floats `RGBA16F`; both are sampled linearly.
 */
export interface GpuTexture {
  key: string;
  version: number;
  kind: "1d" | "2d" | "3d";
  width: number;
  height: number;
  depth?: number;
  data: Float32Array | Uint8Array;
}

/** One picture pass of the GPU runner: a fragment shader over earlier pictures. */
export interface GpuPass {
  /** Program cache key: passes with the same key share one compiled program. */
  key: string;
  /**
   * GLSL body. The runner adds `#version 300 es`, `precision highp float`, `in vec2 v_uv`,
   * `out vec4 o` and a `sampler2D u_in<n>` per input; the body declares its own uniforms and the
   * samplers of its `textures` (`sampler2D`, or `sampler3D` for a `"3d"` one).
   */
  fragment: string;
  /** What each input samples: -1 is source 0, -2 source 1, n the output of pass n. */
  inputs: readonly number[];
  /** Uniform values by name. */
  uniforms?: Readonly<Record<string, GpuUniform>>;
  /** Data textures by sampler name. */
  textures?: Readonly<Record<string, GpuTexture>>;
}

/** The preview's GPU runner as a mix sees it (`MixEnv.gpu`). */
export interface MixGpu {
  /**
   * Uploads `sources` (input -1 is the first, -2 the second), runs `passes` in order at `size`
   * and returns a shared canvas holding the last pass: draw it before the next `run`. Throws
   * `GpuUnavailable` when WebGL2 isn't there (a capture or an export, which must not fall back).
   */
  run(
    sources: readonly CanvasImageSource[],
    size: { width: number; height: number },
    passes: readonly GpuPass[],
  ): CanvasImageSource;
}

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
  /**
   * The GPU, when the mix may use it: absent in the live preview without WebGL2 and in
   * thumbnails. Without it a mix draws a plainer 2D path and calls `withoutGpu`.
   */
  gpu?: MixGpu;
  /**
   * Call when drawing the plainer 2D path for want of `gpu`. The live preview tells the user
   * once; a capture or an export throws, so it never writes the plainer look.
   */
  withoutGpu(): void;
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
  /** The values this change gave ({} on add: the whole set is new). */
  patch: Record<string, unknown>;
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
