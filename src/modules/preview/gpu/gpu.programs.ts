import type { GpuPass, GpuProgram, GpuPrograms } from "./gpu.types";

/** One triangle over the whole target, without buffers; `v_uv` runs 0…1 over the picture. */
const VERTEX = `#version 300 es
out vec2 v_uv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  v_uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** What every fragment body can use. */
function header(inputs: number): string {
  const samplers = Array.from({ length: inputs }, (_, n) => `uniform sampler2D u_in${n};`);
  return ["#version 300 es", "precision highp float;", "in vec2 v_uv;", "out vec4 o;", ...samplers]
    .join("\n")
    .concat("\n");
}

function compile(gl: WebGL2RenderingContext, type: GLenum, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Could not create a shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "";
    gl.deleteShader(shader);
    throw new Error(`A shader did not compile: ${log}`);
  }
  return shader;
}

function link(gl: WebGL2RenderingContext, pass: GpuPass): GpuProgram {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, header(pass.inputs.length) + pass.fragment);
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "";
    gl.deleteProgram(program);
    throw new Error(`A program did not link: ${log}`);
  }
  const locations = new Map<string, WebGLUniformLocation | null>();
  gl.useProgram(program);
  pass.inputs.forEach((_, n) => gl.uniform1i(gl.getUniformLocation(program, `u_in${n}`), n));
  return { program, locations };
}

/** Compiles each pass's program once, by key and input count. */
export function createPrograms(gl: WebGL2RenderingContext): GpuPrograms {
  const programs = new Map<string, GpuProgram>();
  return {
    get(pass) {
      const key = `${pass.key}/${pass.inputs.length}`;
      let found = programs.get(key);
      if (!found) {
        found = link(gl, pass);
        programs.set(key, found);
      }
      return found;
    },
    dispose() {
      for (const { program } of programs.values()) gl.deleteProgram(program);
      programs.clear();
    },
  };
}

/** Sets a pass's uniforms on its (bound) program. */
export function setUniforms(gl: WebGL2RenderingContext, found: GpuProgram, pass: GpuPass): void {
  for (const [name, value] of Object.entries(pass.uniforms ?? {})) {
    let location = found.locations.get(name);
    if (location === undefined) {
      location = gl.getUniformLocation(found.program, name);
      found.locations.set(name, location);
    }
    if (location === null) continue;
    if (typeof value === "number") gl.uniform1f(location, value);
    else if (value.length === 2) gl.uniform2fv(location, value);
    else if (value.length === 3) gl.uniform3fv(location, value);
    else if (value.length === 4) gl.uniform4fv(location, value);
    else gl.uniform1fv(location, value);
  }
}
