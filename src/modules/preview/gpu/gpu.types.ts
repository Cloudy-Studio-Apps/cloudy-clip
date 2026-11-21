import type { GpuPass, GpuTexture } from "@/modules/junction";
import type { PictureSize } from "@/modules/project";

/** The pass types live in `junction`, so a transition's mix can name them; re-exported here. */
export type { GpuInt, GpuPass, GpuTexture, GpuUniform } from "@/modules/junction";

/** Runs picture passes on one WebGL2 context. The only owner of WebGL in the app. */
export interface GpuRunner {
  /**
   * Whether WebGL2 is there. Asking makes the context the first time. Turns false for good when a
   * lost context can't be made again; `run` then throws `GpuUnavailable`.
   */
  readonly available: boolean;
  /** Whether passes render to half-float targets (`RGBA16F`) rather than 8-bit ones. */
  readonly floatTargets: boolean;
  /**
   * Uploads `source` (or each of several: input -1 is the first, -2 the second) once, runs
   * `passes` in order at `size` and returns the runner's canvas holding the last pass. Draw it
   * (`drawImage`) before the next `run`: it is reused. A lost context is made again first;
   * throws `GpuUnavailable` when that fails.
   */
  run(
    source: TexImageSource | readonly TexImageSource[],
    size: PictureSize,
    passes: readonly GpuPass[],
  ): HTMLCanvasElement;
  /** Frees the context and everything on it. */
  dispose(): void;
}

/** A framebuffer with its color texture. */
export interface GpuTarget {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
  /** Half-float (`RGBA16F`) rather than `RGBA8`. */
  float: boolean;
}

/** Framebuffers for the outputs of passes, kept between runs. */
export interface GpuTargets {
  /** A free target of that size and format, made when none is. */
  acquire(width: number, height: number, float: boolean): GpuTarget;
  /** Gives a target back once nothing reads it any more. */
  release(target: GpuTarget): void;
  dispose(): void;
}

/** A linked program and where its uniforms are. */
export interface GpuProgram {
  program: WebGLProgram;
  locations: Map<string, WebGLUniformLocation | null>;
}

/** Compiled programs by pass key and input count. */
export interface GpuPrograms {
  get(pass: GpuPass): GpuProgram;
  dispose(): void;
}

/** Data textures by key, uploaded again only when their version changes. */
export interface GpuDataTextures {
  /** The texture for `data`, current. Binds it on the active unit. */
  bind(data: GpuTexture): void;
  /** Deletes the least recently bound textures past the cap; called between runs only. */
  trim(): void;
  dispose(): void;
}

/** Everything that lives on one context. */
export interface GpuContext {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  floatTargets: boolean;
  programs: GpuPrograms;
  targets: GpuTargets;
  data: GpuDataTextures;
  /** One texture per source a run was given, made when a run gives more than before. */
  sources: WebGLTexture[];
  /** Set by `webglcontextlost`. */
  lost: boolean;
}
