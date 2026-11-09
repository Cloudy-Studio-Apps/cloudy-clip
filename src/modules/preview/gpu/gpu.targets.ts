import { createTexture } from "./gpu.textures";
import type { GpuTarget, GpuTargets } from "./gpu.types";

/** Free targets kept for later runs; past this the oldest is deleted (sizes come and go). */
const KEEP_FREE = 8;

/**
 * Framebuffers for pass outputs: half-float (`RGBA16F`, needs `EXT_color_buffer_float`) or 8-bit
 * (`RGBA8`). Released targets are kept and handed out again at the same size and format.
 */
export function createTargets(gl: WebGL2RenderingContext): GpuTargets {
  const all: GpuTarget[] = [];
  const free: GpuTarget[] = [];

  function allocate(width: number, height: number, float: boolean): GpuTarget {
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
    const target = { framebuffer, texture, width, height, float };
    all.push(target);
    return target;
  }

  return {
    acquire(width, height, float) {
      const index = free.findIndex(
        (t) => t.width === width && t.height === height && t.float === float,
      );
      if (index >= 0) return free.splice(index, 1)[0]!;
      return allocate(width, height, float);
    },
    release(target) {
      if (free.includes(target)) return;
      free.push(target);
      if (free.length <= KEEP_FREE) return;
      const oldest = free.shift()!;
      all.splice(all.indexOf(oldest), 1);
      gl.deleteFramebuffer(oldest.framebuffer);
      gl.deleteTexture(oldest.texture);
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
