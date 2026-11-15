import type { PictureSize } from "@/modules/project";

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
  /** What each input samples: -1 is the source, n the output of pass n. */
  inputs: readonly number[];
  /** Uniform values by name. */
  uniforms?: Readonly<Record<string, GpuUniform>>;
  /** Data textures by sampler name. */
  textures?: Readonly<Record<string, GpuTexture>>;
}

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
   * Uploads `source` once, runs `passes` in order at `size` and returns the runner's canvas
   * holding the last pass. Draw it (`drawImage`) before the next `run`: it is reused. A lost
   * context is made again first; throws `GpuUnavailable` when that fails.
   */
  run(source: TexImageSource, size: PictureSize, passes: readonly GpuPass[]): HTMLCanvasElement;
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
  source: WebGLTexture;
  /** Set by `webglcontextlost`. */
  lost: boolean;
}
