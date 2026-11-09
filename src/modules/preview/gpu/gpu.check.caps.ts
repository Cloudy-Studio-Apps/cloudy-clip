// TEMPORARY (Task 1 check): removed before the commit.
import { createGpuRunner } from "./gpu.runner";
import { canvas2d, exposure, IDENTITY, region } from "./gpu.check.read";

const LUT_FRAGMENT = `#version 300 es
precision highp float;
precision highp sampler3D;
uniform sampler3D u_lut;
out vec4 o;
void main() { o = vec4(texture(u_lut, vec3(0.25, 0.5, 0.75)).rgb, 1.0); }`;
const LUT_VERTEX = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** A 33³ identity LUT sampled at (0.25, 0.5, 0.75), in 8-bit and half-float. */
function check3d(gl: WebGL2RenderingContext) {
  const out: Record<string, unknown> = {};
  const n = 33;
  const program = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, LUT_VERTEX],
    [gl.FRAGMENT_SHADER, LUT_FRAGMENT],
  ] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  out.linked = gl.getProgramParameter(program, gl.LINK_STATUS) as boolean;
  gl.useProgram(program);
  for (const float of [false, true]) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, texture);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    for (const wrap of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) {
      gl.texParameteri(gl.TEXTURE_3D, wrap, gl.CLAMP_TO_EDGE);
    }
    const values = new Float32Array(n * n * n * 4);
    for (let b = 0; b < n; b++)
      for (let g = 0; g < n; g++)
        for (let r = 0; r < n; r++) {
          const i = ((b * n + g) * n + r) * 4;
          values.set([r / (n - 1), g / (n - 1), b / (n - 1), 1], i);
        }
    if (float) {
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA16F, n, n, n, 0, gl.RGBA, gl.FLOAT, values);
    } else {
      const bytes = Uint8Array.from(values, (v) => Math.round(v * 255));
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, n, n, n, 0, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    }
    const error = gl.getError();
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const pixel = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    out[float ? "rgba16f" : "rgba8"] = { glError: error, sample: [...pixel.slice(0, 3)] };
    gl.deleteTexture(texture);
  }
  out.expected = [64, 128, 191];
  return out;
}

/** What the context offers, and the runner on a known picture. */
export function checkCaps() {
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const gl = probe.getContext("webgl2");
  if (!gl) return { webgl2: false };
  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const caps = {
    webgl2: true,
    renderer: debug ? (gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string) : null,
    vendor: debug ? (gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) as string) : null,
    version: gl.getParameter(gl.VERSION) as string,
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    max3dTextureSize: gl.getParameter(gl.MAX_3D_TEXTURE_SIZE) as number,
    EXT_color_buffer_float: gl.getExtension("EXT_color_buffer_float") !== null,
    EXT_color_buffer_half_float: gl.getExtension("EXT_color_buffer_half_float") !== null,
    OES_texture_float_linear: gl.getExtension("OES_texture_float_linear") !== null,
    texture3d: check3d(gl),
  };
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return { ...caps, runner: checkRunner() };
}

/** Identity, exposure ×2, and a precision chain (×0.25 then ×4, six times) through the runner. */
function checkRunner() {
  const runner = createGpuRunner();
  try {
    if (!runner.available) return { available: false };
    const size = { width: 64, height: 64 };
    const { canvas, ctx } = canvas2d(64, 64);
    ctx.fillStyle = "rgb(64, 96, 3)";
    ctx.fillRect(0, 0, 64, 64);
    const read = (passes: Parameters<typeof runner.run>[2]) =>
      region(runner.run(canvas, size, passes), 64, 64, 30, 30, 1);
    const chain = Array.from({ length: 12 }, (_, i) => exposure(i + 1, i % 2 === 0 ? 0.25 : 4));
    return {
      available: true,
      floatTargets: runner.floatTargets,
      source: [64, 96, 3],
      identity: read([IDENTITY]),
      exposure2: read([IDENTITY, exposure(1, 2)]),
      chain12QuarterThenFour: read([IDENTITY, ...chain]),
    };
  } finally {
    runner.dispose();
  }
}
