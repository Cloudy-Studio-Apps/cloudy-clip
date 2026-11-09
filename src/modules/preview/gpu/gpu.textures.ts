import type { GpuDataTextures, GpuTexture } from "./gpu.types";

/** Creates an empty texture of `target` sampled linearly and clamped at the edges. */
export function createTexture(
  gl: WebGL2RenderingContext,
  target: GLenum = gl.TEXTURE_2D,
): WebGLTexture {
  const texture = gl.createTexture();
  gl.bindTexture(target, texture);
  gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (target === gl.TEXTURE_3D) gl.texParameteri(target, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
  return texture;
}

/**
 * Uploads a picture (a `<video>` frame, a canvas, an image) into `texture` as 8-bit RGBA, rows
 * flipped so the picture's top is at `v_uv.y = 1`, colors as they are: not premultiplied and not
 * converted to another color space, so it holds what a 2D canvas would.
 */
export function uploadSource(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  source: TexImageSource,
): void {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
}

/** Writes a data texture's texels into the bound texture of its kind. */
function writeData(gl: WebGL2RenderingContext, data: GpuTexture): void {
  const float = data.data instanceof Float32Array;
  const internal = float ? gl.RGBA16F : gl.RGBA8;
  const type = float ? gl.FLOAT : gl.UNSIGNED_BYTE;
  const height = data.kind === "1d" ? 1 : data.height;
  const expected = data.width * height * (data.kind === "3d" ? (data.depth ?? 1) : 1) * 4;
  if (data.data.length !== expected) {
    throw new Error(`Texture ${data.key} holds ${data.data.length} values, not ${expected}`);
  }
  if (data.kind === "3d") {
    const depth = data.depth ?? 1;
    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      internal,
      data.width,
      height,
      depth,
      0,
      gl.RGBA,
      type,
      data.data,
    );
  } else {
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, data.width, height, 0, gl.RGBA, type, data.data);
  }
}

/** Data textures of passes, kept by key and uploaded again only when their version changes. */
export function createDataTextures(gl: WebGL2RenderingContext): GpuDataTextures {
  const held = new Map<string, { texture: WebGLTexture; version: number; target: GLenum }>();
  return {
    bind(data) {
      const target = data.kind === "3d" ? gl.TEXTURE_3D : gl.TEXTURE_2D;
      let entry = held.get(data.key);
      if (entry && entry.target !== target) {
        gl.deleteTexture(entry.texture);
        held.delete(data.key);
        entry = undefined;
      }
      if (entry && entry.version === data.version) {
        gl.bindTexture(target, entry.texture);
        return;
      }
      const texture = entry?.texture ?? createTexture(gl, target);
      // Until the write succeeds it counts as out of date.
      const kept = { texture, version: Number.NaN, target };
      held.set(data.key, kept);
      gl.bindTexture(target, texture);
      writeData(gl, data);
      kept.version = data.version;
    },
    dispose() {
      for (const { texture } of held.values()) gl.deleteTexture(texture);
      held.clear();
    },
  };
}
