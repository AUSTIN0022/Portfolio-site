'use client'

import { useEffect, useRef } from 'react'

/**
 * The page as still water. A heightfield wave simulation (two ping-pong
 * half-float textures on the GPU) runs at 1/4 viewport resolution; the
 * visible pass draws only the surface's *light* — white glints where a
 * crest faces the light, soft black where it faces away — on a fixed,
 * pointer-transparent canvas. White reads on the black sections, black on
 * the light ones, so it works in both themes without a uniform.
 *
 * WebGL can't sample HTML, so the page itself isn't refracted — except for
 * `[data-ripple-text]` elements (the hero display type): each frame their
 * patch of the heightfield is read back, turned into a slope map, and fed
 * to an SVG feDisplacementMap on that element, so the big letters really
 * bend as a wave passes. The loop sleeps once the water is still.
 */

const SIM_SCALE = 4 // one sim texel = 4 CSS px
const STEP_MS = 1000 / 60 // fixed sim rate, so 120Hz screens don't run waves 2x fast
const IDLE_MS = 7000 // stop rendering this long after the last drop
const TRAIL_PX = 14 // cursor distance between wake drops
const BEND_PX = 26 // max text displacement at a full-strength slope
const SLOPE_GAIN = 900 // heightfield slope -> map byte offset

export const VERT = `#version 300 es
in vec2 p; out vec2 uv;
void main(){ uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`

const DROP = `#version 300 es
precision highp float;
uniform sampler2D tex; uniform vec2 res; uniform vec2 center; uniform float radius; uniform float strength;
in vec2 uv; out vec4 o;
void main(){
  vec4 info = texture(tex, uv);
  float d = max(0.0, 1.0 - length((uv - center) * res) / radius);
  info.r += (0.5 - cos(d * 3.14159265) * 0.5) * strength;
  o = info;
}`

const UPDATE = `#version 300 es
precision highp float;
uniform sampler2D tex; uniform vec2 res;
in vec2 uv; out vec4 o;
void main(){
  vec2 dx = vec2(1.0 / res.x, 0.0), dy = vec2(0.0, 1.0 / res.y);
  vec4 info = texture(tex, uv);
  float avg = (texture(tex, uv - dx).r + texture(tex, uv + dx).r
             + texture(tex, uv - dy).r + texture(tex, uv + dy).r) * 0.25;
  info.g += (avg - info.r) * 2.0;
  info.g *= 0.985;
  info.r += info.g;
  o = info;
}`

const RENDER = `#version 300 es
precision highp float;
uniform sampler2D tex; uniform vec2 res;
in vec2 uv; out vec4 o;
void main(){
  vec2 dx = vec2(1.0 / res.x, 0.0), dy = vec2(0.0, 1.0 / res.y);
  float hx = texture(tex, uv + dx).r - texture(tex, uv - dx).r;
  float hy = texture(tex, uv + dy).r - texture(tex, uv - dy).r;
  vec3 n = normalize(vec3(-hx, -hy, 0.35));
  vec3 L = normalize(vec3(-0.5, 0.6, 1.0));
  float shade = dot(n, L) - L.z; // 0 on flat water
  float spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 60.0)
             - pow(L.z, 60.0);
  float hi = clamp(spec * 0.9 + max(shade, 0.0) * 1.4, 0.0, 0.45);
  float lo = clamp(-shade * 1.1, 0.0, 0.22);
  o = vec4(vec3(hi), hi + lo); // premultiplied: white glint over black shadow
}`

type Drop = { x: number; y: number; radius: number; strength: number }

export function program(gl: WebGL2RenderingContext, frag: string) {
  const p = gl.createProgram()!
  for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, frag]] as const) {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    gl.attachShader(p, s)
  }
  gl.bindAttribLocation(p, 0, 'p')
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link')
  const u = (name: string) => gl.getUniformLocation(p, name)
  return { p, u }
}

export function WaterRipple() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const canvas = canvasRef.current!
    const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false })
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return // no float targets: stay dry

    let drop, update, render
    try {
      drop = program(gl, DROP)
      update = program(gl, UPDATE)
      render = program(gl, RENDER)
    } catch {
      return
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    let w = 0, h = 0, cur = 0
    let tex: WebGLTexture[] = [], fbo: WebGLFramebuffer[] = []

    const resize = () => {
      tex.forEach((t) => gl.deleteTexture(t))
      fbo.forEach((f) => gl.deleteFramebuffer(f))
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      w = Math.ceil(canvas.width / SIM_SCALE)
      h = Math.ceil(canvas.height / SIM_SCALE)
      tex = [0, 1].map(() => {
        const t = gl.createTexture()!
        gl.bindTexture(gl.TEXTURE_2D, t)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        return t
      })
      fbo = tex.map((t) => {
        const f = gl.createFramebuffer()!
        gl.bindFramebuffer(gl.FRAMEBUFFER, f)
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0)
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        return f
      })
    }
    resize()

    // One sim pass: read tex[cur], write the other, flip.
    const pass = (prog: ReturnType<typeof program>, set?: () => void) => {
      gl.useProgram(prog.p)
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[1 - cur])
      gl.viewport(0, 0, w, h)
      gl.bindTexture(gl.TEXTURE_2D, tex[cur])
      gl.uniform2f(prog.u('res'), w, h)
      set?.()
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      cur = 1 - cur
    }

    // --- Text bending: one SVG displacement filter per [data-ripple-text] ---
    const NS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(NS, 'svg')
    svg.setAttribute('aria-hidden', 'true')
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden'
    document.body.appendChild(svg)
    const mapCanvas = document.createElement('canvas')
    const mapCtx = mapCanvas.getContext('2d')!
    type Bend = { filter: SVGFilterElement; img: SVGFEImageElement }
    const bends = new Map<HTMLElement, Bend>()
    let bendSeq = 0

    const bendFor = (el: HTMLElement) => {
      let b = bends.get(el)
      if (!b) {
        const id = `ripple-bend-${bendSeq++}`
        const filter = document.createElementNS(NS, 'filter')
        filter.id = id
        filter.setAttribute('filterUnits', 'userSpaceOnUse')
        filter.setAttribute('color-interpolation-filters', 'sRGB')
        const img = document.createElementNS(NS, 'feImage')
        img.setAttribute('preserveAspectRatio', 'none')
        img.setAttribute('result', 'm')
        const disp = document.createElementNS(NS, 'feDisplacementMap')
        disp.setAttribute('in', 'SourceGraphic')
        disp.setAttribute('in2', 'm')
        disp.setAttribute('scale', String(BEND_PX))
        disp.setAttribute('xChannelSelector', 'R')
        disp.setAttribute('yChannelSelector', 'G')
        filter.append(img, disp)
        svg.append(filter)
        b = { filter, img }
        bends.set(el, b)
      }
      return b
    }

    const unbend = () => bends.forEach((_, el) => (el.style.filter = ''))

    const bendText = () => {
      for (const [el, b] of bends) if (!el.isConnected) { b.filter.remove(); bends.delete(el) }
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fbo[cur])
      for (const el of document.querySelectorAll<HTMLElement>('[data-ripple-text]')) {
        const r = el.getBoundingClientRect()
        if (r.bottom < 0 || r.top > window.innerHeight || !r.width) { el.style.filter = ''; continue }
        // Map covers the element plus a BEND_PX margin, so glyph edges can
        // bend outward without sampling an undefined (fully offset) border.
        const M = BEND_PX
        const x0 = Math.floor((r.left - M) / SIM_SCALE), y0 = Math.floor((r.top - M) / SIM_SCALE)
        const mw = Math.ceil((r.width + 2 * M) / SIM_SCALE), mh = Math.ceil((r.height + 2 * M) / SIM_SCALE)
        // Read the patch plus a 1-texel apron for the slope stencil, clamped to the sim.
        const rx = Math.max(0, x0 - 1), ry = Math.max(0, y0 - 1)
        const rw = Math.min(w, x0 + mw + 1) - rx, rh = Math.min(h, y0 + mh + 1) - ry
        if (rw <= 0 || rh <= 0) { el.style.filter = ''; continue }
        const px = new Float32Array(rw * rh * 4)
        gl.readPixels(rx, h - ry - rh, rw, rh, gl.RGBA, gl.FLOAT, px) // GL rows run bottom-up
        const height = (x: number, y: number) => {
          const cx = Math.min(rw - 1, Math.max(0, x - rx)), cy = Math.min(rh - 1, Math.max(0, y - ry))
          return px[((rh - 1 - cy) * rw + cx) * 4]
        }
        const data = new ImageData(mw, mh)
        let peak = 0
        for (let my = 0; my < mh; my++) {
          for (let mx = 0; mx < mw; mx++) {
            const x = x0 + mx, y = y0 + my
            const dx = Math.max(-127, Math.min(127, (height(x + 1, y) - height(x - 1, y)) * SLOPE_GAIN))
            const dy = Math.max(-127, Math.min(127, (height(x, y + 1) - height(x, y - 1)) * SLOPE_GAIN))
            peak = Math.max(peak, Math.abs(dx), Math.abs(dy))
            const i = (my * mw + mx) * 4
            data.data[i] = 128 + dx
            data.data[i + 1] = 128 + dy
            data.data[i + 2] = 128
            data.data[i + 3] = 255
          }
        }
        if (peak < 3) { el.style.filter = ''; continue } // calm here: skip the filter cost
        const b = bendFor(el)
        mapCanvas.width = mw
        mapCanvas.height = mh
        mapCtx.putImageData(data, 0, 0)
        for (const node of [b.filter, b.img]) {
          node.setAttribute('x', String(-M))
          node.setAttribute('y', String(-M))
          node.setAttribute('width', String(r.width + 2 * M))
          node.setAttribute('height', String(r.height + 2 * M))
        }
        b.img.setAttribute('href', mapCanvas.toDataURL())
        el.style.filter = `url(#${b.filter.id})`
      }
    }

    const queue: Drop[] = []
    let raf = 0, last = 0, acc = 0, lastDropAt = 0

    const frame = (now: number) => {
      acc = Math.min(acc + now - last, STEP_MS * 4)
      last = now
      for (const d of queue.splice(0)) {
        pass(drop, () => {
          gl.uniform2f(drop.u('center'), d.x / canvas.width, 1 - d.y / canvas.height)
          gl.uniform1f(drop.u('radius'), d.radius)
          gl.uniform1f(drop.u('strength'), d.strength)
        })
      }
      for (; acc >= STEP_MS; acc -= STEP_MS) pass(update)

      const shoot = document.documentElement.classList.contains('shoot-mode-active')
      if (shoot) unbend()
      else bendText()

      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
      if (now - lastDropAt > IDLE_MS) {
        gl.clear(gl.COLOR_BUFFER_BIT)
        unbend()
        raf = 0
        return
      }
      gl.useProgram(render.p)
      gl.bindTexture(gl.TEXTURE_2D, tex[cur])
      gl.uniform2f(render.u('res'), w, h)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      raf = requestAnimationFrame(frame)
    }

    const addDrop = (d: Drop) => {
      // The paintball easter egg owns the pointer while it's on.
      if (document.documentElement.classList.contains('shoot-mode-active')) return
      queue.push(d)
      lastDropAt = performance.now()
      if (!raf) {
        last = lastDropAt
        raf = requestAnimationFrame(frame)
      }
    }

    let px = -1e4, py = -1e4
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return // touch-move is a scroll, not a wake
      if (Math.hypot(e.clientX - px, e.clientY - py) < TRAIL_PX) return
      px = e.clientX
      py = e.clientY
      addDrop({ x: px, y: py, radius: 5, strength: 0.035 })
    }
    const onDown = (e: PointerEvent) =>
      addDrop({ x: e.clientX, y: e.clientY, radius: 11, strength: 0.5 })

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('resize', resize)
      unbend()
      svg.remove()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 46, // over content, under the nav island (48–50)
      }}
    />
  )
}
