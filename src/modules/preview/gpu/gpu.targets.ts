import { createTexture } from "./gpu.textures";
import type { GpuTarget, GpuTargets } from "./gpu.types";

/**
 * Framebuffers for pass outputs, half-float when `float` (needs `EXT_color_buffer_float`), else
 * 8-bit. Released targets are kept and handed out again at the same size.
 */
export function createTargets(gl: WebGL2RenderingContext, float: boolean): GpuTargets {
  const all: GpuTarget[] = [];
  const free: GpuTarget[] = [];

  function allocate(width: number, height: number): GpuTarget {
    const texture = createTexture(gl);
    if (float) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, width, height, 0, gl.RGBA, gl.HALF_FLOAT, null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
      throw new Error(`A ${float ? "half-float" : "8-bit"} render target is not complete`);
    }
    const target = { framebuffer, texture, width, height };
    all.push(target);
    return target;
  }

  return {
    acquire(width, height) {
      const index = free.findIndex((t) => t.width === width && t.height === height);
      if (index >= 0) return free.splice(index, 1)[0]!;
      return allocate(width, height);
    },
    release(target) {
      free.push(target);
    },
    dispose() {
      for (const { framebuffer, texture } of all) {
        gl.deleteFramebuffer(framebuffer);
        gl.deleteTexture(texture);
      }
      all.length = 0;
      free.length = 0;
    },
  };
}
