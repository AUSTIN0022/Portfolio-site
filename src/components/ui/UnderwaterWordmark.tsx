'use client'

import { useEffect, useRef } from 'react'
import { program } from '@/components/ui/WaterRipple'

/**
 * The footer's giant "AUSTIN", sunk to the sea floor. As the footer scrolls
 * in, a shimmering waterline rises across it and the seabed appears: sun
 * breaking through the surface and fanning down in shafts, a sand floor
 * receding in perspective to a hazy horizon, a far-off stand of kelp, and an
 * old brass diving helmet trailing bubbles. Once the footer is mostly on screen the wordmark drops in
 * from above, sways down like a sign through water, lands crooked in the
 * sand with a puff of silt, and stays half-buried. Scroll away and back to
 * drop it again.
 *
 * Everything is one fragment shader. The wordmark is redrawn into a texture
 * (same font, size and gradient as the DOM version); the DOM text is hidden
 * only once WebGL is running, so reduced motion or no WebGL2 keeps the plain
 * CSS wordmark. Renders only while the footer is on screen. Must sit inside
 * a `position: relative` footer: the canvas fills it.
 */

const SCENE = `#version 300 es
precision highp float;
uniform sampler2D text;
uniform vec2 res;        // device px
uniform float t, sink, dpr;
uniform vec4 word;       // glyph box at rest: center xy, size zw (device px, y up)
uniform float sandY;     // front sand line, where the wordmark is buried (device px, y up)
uniform float horizon;   // where the sea floor recedes to (device px, y up)
uniform vec3 fall;       // wordmark offset xy + rotation while dropping
uniform float impact;    // seconds since it hit the sand, <0 before
in vec2 uv; out vec4 o;

const vec3 SUN = vec3(1.0, 0.988, 0.78);   // white with a breath of the accent yellow
const vec3 BRASS = vec3(0.40, 0.34, 0.12);  // the accent yellow, tarnished

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash1(float x) { return fract(sin(x * 127.1) * 43758.5453); }
float noise1(float x) { float i = floor(x), f = fract(x); return mix(hash1(i), hash1(i + 1.0), f * f * (3.0 - 2.0 * f)); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
// Tileable water caustic (the well-known iterative trig pattern).
float caustic(vec2 p, float t) {
  vec2 i = p; float c = 1.0;
  for (int n = 0; n < 4; n++) {
    float tn = t * (1.0 - 3.5 / float(n + 1));
    i = p + vec2(cos(tn - i.x) + sin(tn + i.y), sin(tn - i.y) + cos(tn + i.x));
    c += 1.0 / length(vec2(p.x / (sin(i.x + tn) / 0.005), p.y / (cos(i.y + tn) / 0.005)));
  }
  c = 1.17 - pow(c / 4.0, 1.4);
  return pow(abs(c), 8.0);
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float box(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
float fill(float d) { return clamp(0.5 - d / dpr, 0.0, 1.0); } // ~1 CSS px antialiasing

float sandAt(float x) {
  return sandY + (0.5 * sin(x / res.x * 7.0) + noise1(x / (90.0 * dpr)) - 0.5) * 14.0 * dpr;
}

float kelp(vec2 p, float rootX, float rootY, float H, float W, float ph) {
  float v = (p.y - rootY) / H;
  if (v < 0.0 || v > 1.0) return 0.0;
  float cx = rootX + W * 2.2 * pow(v, 1.4) * sin(t * 0.7 + ph + v * 2.5);
  float hw = W * (1.0 - 0.75 * v) * (0.55 + 0.45 * abs(sin(v * 14.0 + ph)));
  return fill(abs(p.x - cx) - hw) * smoothstep(1.0, 0.94, v);
}

// Perspective sea floor: a ground plane from the bottom edge back to a hazy
// horizon. Shading is done in ground coordinates, so ripples and caustics
// shrink with distance and fade into the haze — that's what reads as depth.
vec4 seabed(vec2 p, float U) {
  float hz = horizon + (noise1(p.x / (160.0 * dpr)) - 0.5) * U * 0.07; // distant dunes
  float dyh = max(hz - p.y, 0.5 * dpr);
  float z = horizon / dyh;                                             // 1 at the bottom edge
  vec2 w = vec2((p.x - res.x * 0.5) / dyh, z) * horizon / U;           // ground plane, in U
  float rp = w.y * 14.0 + noise(w * vec2(1.2, 3.0)) * 4.0 + w.x * 0.6;
  float ripple = sin(rp) * (1.0 - smoothstep(0.5, 2.0, fwidth(rp)));
  vec2 cw = w * 0.9;
  float c = mix(caustic(mod(cw * 6.2831, 6.2831) - 250.0, t * 0.45), 0.35, smoothstep(0.08, 0.5, fwidth(cw.x)));
  vec3 sand = vec3(0.13, 0.125, 0.11) * (0.78 + 0.22 * ripple) * (0.92 + 0.16 * hash(floor(p / (1.5 * dpr))))
            + SUN * min(c, 2.0) * 0.2;
  float fog = 1.0 - exp(-(z - 1.0) * 0.16);
  vec3 col = mix(sand, vec3(0.03, 0.03, 0.028) + SUN * 0.035, fog);
  return vec4(col, smoothstep(hz + 2.0 * dpr, hz - 2.0 * dpr, p.y));
}

// Mark V diving helmet, unit-radius dome; returns color + coverage.
vec4 helmet(vec2 p, vec2 C, float R, float caust) {
  vec2 q = rot(0.22) * (p - C) / R;
  float side = min(length(q - vec2(0.92, 0.05)) - 0.24, length(q + vec2(0.92, -0.05)) - 0.24);
  float d = min(min(length(q) - 1.0, side), min(box(q - vec2(0.0, 1.08), vec2(0.13, 0.14)), box(q - vec2(0.0, -0.95), vec2(1.0, 0.18)) - 0.08));
  float cov = fill(d * R);
  if (cov <= 0.0) return vec4(0.0);
  vec3 n = normalize(vec3(q, sqrt(max(1.0 - dot(q, q), 0.05))));
  float dif = clamp(dot(n, normalize(vec3(-0.3, 0.8, 0.6))), 0.0, 1.0);
  vec3 col = BRASS * (0.25 + 0.9 * dif) + SUN * pow(dif, 24.0) * 0.5 + SUN * caust * 0.22;
  float port = length(q - vec2(0.08, 0.05)) - 0.46;
  col = mix(col, vec3(0.02) + SUN * 0.3 * fill((length(q - vec2(-0.08, 0.24)) - 0.07) * R), fill(port * R));
  col = mix(col, BRASS * (0.6 + dif), fill((abs(port) - 0.07) * R));
  col = mix(col, vec3(0.03), fill((side + 0.08) * R));
  float bolts = 1e5;
  for (int i = 0; i < 5; i++) bolts = min(bolts, length(q - vec2(-0.8 + 0.4 * float(i), -0.95)) - 0.055);
  col = mix(col, BRASS * 1.5 + SUN * 0.1, fill(bolts * R));
  return vec4(col, cov);
}

void main() {
  vec2 p = uv * res;
  float y = 1.0 - uv.y;  // 0 at the footer's top edge
  vec2 wc = word.xy, wsz = word.zw;
  float U = wsz.y;       // scene unit: the wordmark's glyph height

  // Waterline: below the footer at sink 0, past its top by sink 0.7.
  float surf = mix(1.08, -0.08, smoothstep(0.0, 0.7, sink))
             + 0.006 * sin(p.x / res.x * 22.0 + t * 1.6) + 0.004 * sin(p.x / res.x * 57.0 - t * 2.3);
  float dy = (y - surf) * res.y;
  float under = smoothstep(-2.0, 2.0, dy);
  float depth = max(y - surf, 0.0);
  float deep = smoothstep(0.55, 1.0, sink);
  float caust = min(caustic(mod(p / res.x * 4.0 * 6.2831, 6.2831) - 250.0, t * 0.45), 2.0);
  float lit = exp(-depth * 1.6);

  // Sunlight: a glow where it breaks through the surface, and irregular
  // shafts of mixed width all fanning from that one point above the edge.
  vec2 S = vec2(res.x * 0.32, res.y + res.x * 0.12);
  vec2 sd = p - S;
  float a = atan(sd.x, -sd.y);
  float shafts = smoothstep(0.45, 0.9, noise1(a * 16.0 + t * 0.12) * 0.65 + noise1(a * 37.0 - t * 0.09) * 0.35);
  shafts *= smoothstep(1.15, 0.4, abs(a - 0.1));
  float rays = shafts * exp(-max(length(sd) - res.x * 0.12, 0.0) / (res.y * 0.85));
  float glow = exp(-pow(length((p - vec2(S.x, res.y)) / vec2(res.x * 0.32, res.y * 0.22)), 2.0));
  vec3 col = SUN * (rays * (0.16 + deep * 0.07) + glow * 0.12 + caust * lit * 0.04);

  // The sea floor, stretching back to the horizon.
  vec4 bed = seabed(p, U);
  col = mix(col, bed.rgb, bed.a);

  // A small, far-off stand of kelp on the left, behind the wordmark.
  float kRoot = mix(sandY, horizon, 0.35);
  float kelpM = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    kelpM = max(kelpM, kelp(p, res.x * (0.045 + 0.035 * fi), kRoot - fi * U * 0.04, U * (0.75 + 0.3 * hash1(fi + 2.0)), U * 0.025, fi * 2.1));
  }
  col = mix(col, vec3(0.06) + SUN * caust * lit * 0.06, kelpM * 0.85);

  // The wordmark, dropping then resting: map this pixel back into rest pose.
  vec2 lp = rot(-fall.z) * (p - wc - fall.xy) + wc;
  // Lean it back ~8 degrees, hinged at its base: invert a perspective
  // projection so the tops of the letters recede into the scene.
  vec2 B = vec2(wc.x, wc.y - wsz.y * 0.5), rel = lp - B;
  float lf = U * 3.0, ls = 0.139, lc = 0.990; // focal length, sin/cos of the lean
  float oy = rel.y * lf / (lf * lc - rel.y * ls);
  lp = B + vec2(rel.x * (lf + oy * ls) / lf, oy);
  lp += vec2(sin(lp.y / res.y * 9.0 + t * 1.2), cos(lp.x / res.x * 14.0 + t * 0.9)) * 2.5 * dpr;
  vec2 tuv = lp / res;
  vec4 tx = texture(text, vec2(tuv.x, 1.0 - tuv.y));
  float mask = tx.a * step(0.0, tuv.y) * step(tuv.y, 1.0);
  col = mix(col, vec3(tx.r) + SUN * caust * lit * (0.8 + deep * 0.5), mask);

  // Helmet, half-sunk at the right edge.
  float R = U * 0.18;
  vec2 C = vec2(res.x - R * 1.6, 0.0);
  C.y = sandAt(C.x) + R * 0.25;
  vec4 hm = helmet(p, C, R, caust);
  col = mix(col, hm.rgb, hm.a);

  // The near sand lip, in front of everything it buries.
  float sTop = sandAt(p.x);
  vec4 lip = seabed(p, U);
  col = mix(col, lip.rgb + SUN * 0.07 * exp(-max(sTop - p.y, 0.0) / (3.0 * dpr)), fill(p.y - sTop));

  // Silt kicked up where the wordmark landed.
  if (impact >= 0.0) {
    float above = p.y - sTop;
    float h = U * 0.45 * (1.0 - exp(-impact * 1.8));
    float dens = noise(p / (26.0 * dpr) + vec2(t * 0.25, -t * 0.15)) * smoothstep(h, 0.0, above) * step(-4.0 * dpr, above)
               * smoothstep(wsz.x * 0.62, wsz.x * 0.4, abs(p.x - wc.x)) * exp(-impact * 0.8);
    col = mix(col, vec3(0.16, 0.155, 0.14) + SUN * caust * 0.05, clamp(dens, 0.0, 1.0));
  }

  // The shafts carry on down through the water in front of the floor.
  col += SUN * rays * 0.05 * bed.a;

  // Bubbles from the helmet's valve.
  vec2 valve = C + rot(-0.22) * vec2(0.0, 1.2 * R);
  for (int k = 0; k < 6; k++) {
    float fk = float(k);
    float age = fract(t * 0.22 + fk / 6.0 + hash1(fk) * 0.1);
    vec2 bp = valve + vec2(sin(age * 9.0 + fk * 2.0) * 5.0 * dpr, age * U * 2.2);
    float r = (1.6 + 3.2 * age) * dpr;
    col += SUN * (1.0 - age) * (fill(abs(length(p - bp) - r) - 0.6 * dpr) * 0.7 + fill(length(p - bp + vec2(0.35, -0.35) * r) - 0.4 * r) * 0.5);
  }

  // Marine snow drifting up.
  vec2 q = p / res.x * 60.0 + vec2(0.0, -t * 0.6);
  vec2 cell = floor(q), f = fract(q) - 0.5;
  vec2 off = vec2(hash(cell + 7.1), hash(cell + 3.7)) - 0.5;
  col += 0.45 * lit * step(0.93, hash(cell)) * smoothstep(0.08, 0.0, length(f - off * 0.6)) * (0.4 + 0.6 * sin(t * 2.0 + hash(cell) * 40.0));

  // Above the waterline nothing has sunk yet; the meniscus rides on top.
  col *= under;
  col += SUN * exp(-dy * dy / 6.0) * 0.5 * (0.6 + 0.4 * caust) + SUN * under * exp(-depth * 12.0) * 0.07;
  col = min(col, vec3(1.0));
  o = vec4(col, max(col.r, max(col.g, col.b))); // premultiplied, over the black footer
}`

const FALL_S = 2.4 // seconds from the top of the footer to the sand
const DROP_AT = 0.55 // sink progress that releases the wordmark
const RESET_AT = 0.12 // scrolled back this far: re-arm the drop

export function UnderwaterWordmark({ text, style }: { text: string; style: React.CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wordRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = canvasRef.current!
    const word = wordRef.current!
    const footer = canvas.parentElement!
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false })
    if (!gl) return
    let scene
    try {
      scene = program(gl, SCENE)
    } catch {
      return
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.useProgram(scene.p)

    // Redraw the wordmark into the texture exactly where the DOM puts it,
    // and bury its bottom 15% in the sand.
    const paint = document.createElement('canvas')
    let dpr = 1, glyphBottomUp = 0 // glyph bottom edge, device px from the canvas bottom
    const layout = () => {
      dpr = Math.min(window.devicePixelRatio, 1.25) // soft scene: extra pixels buy nothing
      const cs = getComputedStyle(word)
      word.style.paddingBottom = `${Math.round(parseFloat(cs.fontSize) * 0.1)}px` // room for the sand lip
      // Layout metrics, not getBoundingClientRect: they share units with
      // the font size even under page zoom or a transformed ancestor.
      const fr = { width: footer.clientWidth, height: footer.clientHeight }
      const wr = { left: word.offsetLeft, top: word.offsetTop, width: word.offsetWidth, height: word.offsetHeight }
      canvas.width = paint.width = Math.round(fr.width * dpr)
      canvas.height = paint.height = Math.round(fr.height * dpr)
      const ctx = paint.getContext('2d')!
      ctx.scale(dpr, dpr)
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
      if ('letterSpacing' in ctx) ctx.letterSpacing = cs.letterSpacing
      ctx.textAlign = 'center'
      const m = ctx.measureText(text)
      const top = wr.top
      const lineH = wr.height - parseFloat(word.style.paddingBottom)
      const baseline = top + lineH / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2
      const gTop = baseline - m.actualBoundingBoxAscent
      const gH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
      const g = ctx.createLinearGradient(0, gTop, 0, gTop + gH)
      g.addColorStop(0, '#5a5a5a')
      g.addColorStop(1, '#151515')
      ctx.fillStyle = g
      const cx = wr.left + wr.width / 2
      ctx.fillText(text, cx, baseline)
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, paint)
      gl.viewport(0, 0, canvas.width, canvas.height)
      const up = (cssY: number) => (fr.height - cssY) * dpr
      glyphBottomUp = up(gTop + gH)
      gl.uniform2f(scene.u('res'), canvas.width, canvas.height)
      gl.uniform1f(scene.u('dpr'), dpr)
      gl.uniform4f(scene.u('word'), cx * dpr, up(gTop + gH / 2), m.width * dpr, gH * dpr)
      gl.uniform1f(scene.u('sandY'), up(gTop + gH * 0.85))
      // The floor recedes from just under the footer's last row (Back to top).
      const above = canvas.previousElementSibling as HTMLElement | null
      gl.uniform1f(scene.u('horizon'), up(above ? above.offsetTop + above.offsetHeight : wr.top))
    }

    let raf = 0, dropAt = -1
    const t0 = performance.now()
    const frame = (now: number) => {
      const r = footer.getBoundingClientRect()
      const sink = Math.min(1, Math.max(0, (window.innerHeight - r.top) / r.height))
      if (sink < RESET_AT) dropAt = -1
      else if (dropAt < 0 && sink > DROP_AT) dropAt = now

      // Falling through water: near-terminal speed, a lazy sway that dies
      // out on the way down, a small bob on landing, resting slightly crooked.
      const lift = canvas.height - glyphBottomUp + 40 * dpr // fully above the top edge
      let fx = 0, fy = lift, ang = 0, impact = -1
      if (dropAt >= 0) {
        const age = (now - dropAt) / 1000
        const k = Math.min(age / FALL_S, 1)
        const after = age - FALL_S
        fy = lift * (1 - Math.pow(k, 1.15)) - (after > 0 ? 6 * dpr * Math.exp(-after * 5) * Math.sin(after * 14) : 0)
        fx = Math.sin(age * 2.2) * 14 * dpr * (1 - k)
        ang = 0.07 * Math.sin(age * 2.6) * (1 - k) - 0.02 * k
        impact = after
      }
      gl.uniform3f(scene.u('fall'), fx, fy, ang)
      gl.uniform1f(scene.u('impact'), impact)
      gl.uniform1f(scene.u('t'), (now - t0) / 1000)
      gl.uniform1f(scene.u('sink'), sink)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      raf = requestAnimationFrame(frame)
    }

    let ready = false
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf)
      raf = e.isIntersecting && ready ? requestAnimationFrame(frame) : 0
    })
    const ro = new ResizeObserver(() => ready && layout())

    document.fonts.ready.then(() => {
      if (gl.isContextLost()) return
      ready = true
      layout()
      word.style.opacity = '0' // the canvas draws it now
      io.observe(footer)
      ro.observe(footer)
    })

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      word.style.opacity = ''
      word.style.paddingBottom = ''
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [text])

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
      <div ref={wordRef} aria-hidden style={style}>
        {text}
      </div>
    </>
  )
}
