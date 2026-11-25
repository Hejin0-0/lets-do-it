import { f32ToF16 } from './half';

export const QUAD_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

export interface Program {
  bind(): void;
  u: Record<string, WebGLUniformLocation | null>;
}

export interface Rect { x0: number; y0: number; x1: number; y1: number }
export interface Format { internal: number; format: number; type: number }

export interface Target {
  w: number;
  h: number;
  fbo: WebGLFramebuffer;
  tex: WebGLTexture[];
  views: WebGLFramebuffer[];
}

export interface DoubleTarget {
  w: number;
  h: number;
  readonly read: Target;
  readonly write: Target;
  swap(): void;
}

export class GL {
  readonly gl: WebGL2RenderingContext;
  private vs: WebGLShader;
  private resources = new Map<Target, () => void>();

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.vs = this.compile(gl.VERTEX_SHADER, QUAD_VS);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }

  private compile(type: number, src: string): WebGLShader {
    const { gl } = this;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(`${gl.getShaderInfoLog(s)}`);
    }
    return s;
  }

  program(fs: string): Program {
    const { gl } = this;
    const p = gl.createProgram()!;
    gl.attachShader(p, this.vs);
    gl.attachShader(p, this.compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link failed');
    const u: Record<string, WebGLUniformLocation | null> = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i)!;
      u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
    }
    return { u, bind: () => gl.useProgram(p) };
  }

  target(w: number, h: number, formats: Format[], filter: number): Target {
    const { gl } = this;
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    const tex: WebGLTexture[] = [];
    const views: WebGLFramebuffer[] = [];
    formats.forEach((f, i) => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texStorage2D(gl.TEXTURE_2D, 1, f.internal, w, h);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0);
      tex.push(t);
    });
    gl.drawBuffers(formats.map((_, i) => gl.COLOR_ATTACHMENT0 + i));
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error(`framebuffer incomplete: 0x${status.toString(16)}`);
    for (const t of tex) {
      const v = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, v);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
      views.push(v);
    }
    const target = { w, h, fbo, tex, views };
    this.clearTarget(target);
    this.resources.set(target, () => {
      gl.deleteFramebuffer(fbo);
      views.forEach(v => gl.deleteFramebuffer(v));
      tex.forEach(t => gl.deleteTexture(t));
    });
    return target;
  }

  double(w: number, h: number, formats: Format[], filter: number): DoubleTarget {
    let a = this.target(w, h, formats, filter);
    let b = this.target(w, h, formats, filter);
    return {
      w, h,
      get read() { return a; },
      get write() { return b; },
      swap() { const t = a; a = b; b = t; },
    };
  }

  clearTarget(t: Target, rect?: Rect) {
    const { gl } = this;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    if (rect) this.scissor(rect);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
  }

  scissor(r: Rect) {
    const { gl } = this;
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(r.x0, r.y0, Math.max(0, r.x1 - r.x0), Math.max(0, r.y1 - r.y0));
  }

  draw(target: Target | null, rect?: Rect | null, canvasSize?: [number, number]) {
    const { gl } = this;
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvasSize![0], canvasSize![1]);
    }
    if (rect) this.scissor(rect);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (rect) gl.disable(gl.SCISSOR_TEST);
  }

  bindTex(unit: number, tex: WebGLTexture): number {
    const { gl } = this;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    return unit;
  }

  blit(src: WebGLFramebuffer, sx: number, sy: number, dst: WebGLFramebuffer, dx: number, dy: number, w: number, h: number) {
    const { gl } = this;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst);
    gl.blitFramebuffer(sx, sy, sx + w, sy + h, dx, dy, dx + w, dy + h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  readHalf(fb: WebGLFramebuffer, w: number, h: number, channels: 1 | 4, rect?: Rect): Uint16Array {
    const { gl } = this;
    const x0 = rect?.x0 ?? 0, y0 = rect?.y0 ?? 0, rw = (rect?.x1 ?? w) - x0, rh = (rect?.y1 ?? h) - y0;
    const out = new Uint16Array(Math.max(0, rw * rh * channels));
    if (rw <= 0 || rh <= 0) return out;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
    const band32 = new Float32Array(rw * rh * 4);
    gl.readPixels(x0, y0, rw, rh, gl.RGBA, gl.FLOAT, band32);
    if (channels === 4) { f32ToF16(band32, out, rw * rh * 4); }
    else {
      const tmp = new Uint16Array(rw * rh * 4);
      f32ToF16(band32, tmp, rw * rh * 4);
      for (let i = 0, m = rw * rh; i < m; i++) out[i] = tmp[i * 4];
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return out;
  }

  disposeTarget(t: Target) {
    this.resources.get(t)?.();
    this.resources.delete(t);
  }

  disposeTargets() {
    this.resources.forEach(f => f());
    this.resources.clear();
  }
}
