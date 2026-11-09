import type { PictureSize } from "@/modules/project";

/** One picture pass of the GPU runner: a fragment shader over earlier pictures. */
export interface GpuPass {
  /** Program cache key: passes with the same key share one compiled program. */
  key: string;
  /**
   * GLSL body. The runner adds `#version 300 es`, `precision highp float`, `in vec2 v_uv`,
   * `out vec4 o` and a `sampler2D u_in<n>` per input; the body declares its own uniforms.
   */
  fragment: string;
  /** What each input samples: -1 is the source, n the output of pass n. */
  inputs: readonly number[];
  /** Uniform values by name: a number is a `float`, 2 to 4 numbers a `vec2` to `vec4`. */
  uniforms?: Readonly<Record<string, number | readonly number[]>>;
}

/** Runs picture passes on one WebGL2 context. The only owner of WebGL in the app. */
export interface GpuRunner {
  /** Whether WebGL2 came up. When false, `run` throws. */
  readonly available: boolean;
  /** Whether passes render to half-float targets (`RGBA16F`) rather than 8-bit ones. */
  readonly floatTargets: boolean;
  /**
   * Uploads `source`, runs `passes` in order at `size` and returns the runner's canvas holding
   * the last pass. Draw it (`drawImage`) before the next `run`: it is reused.
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
}

/** Framebuffers for the outputs of passes, kept between runs. */
export interface GpuTargets {
  /** A free target at `width` × `height`, made when none is. */
  acquire(width: number, height: number): GpuTarget;
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
