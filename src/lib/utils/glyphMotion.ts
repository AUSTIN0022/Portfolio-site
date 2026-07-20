/**
 * Tiny keyframe utilities for the behavioural 3D glyphs (see
 * `docs/3d-components-roadmap.md` §2 "Motion").
 *
 * Each glyph performs a scripted loop rather than a physics sim: the story has to
 * read in ~4 seconds at 120px, which means the beats need to land at exact times,
 * not emerge. So the animation is authored as keyframe tracks and sampled per
 * frame. Tracks are module-level `readonly` constants in the components, and
 * sampling allocates nothing, which keeps these safe inside `LazyCanvas`.
 */

/** Clamped smoothstep — the only easing these glyphs use, so beats feel ceramic, not linear. */
export function smoothstep(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
}

/** `[time, value]` pairs, sorted ascending by time. */
export type Keyframes = readonly (readonly [number, number])[];

/**
 * Sample a keyframe track at `t`, smoothstep-interpolated between neighbours and
 * clamped (held) outside the track's range.
 */
export function track(t: number, kf: Keyframes): number {
  const first = kf[0];
  const last = kf[kf.length - 1];
  if (t <= first[0]) return first[1];
  if (t >= last[0]) return last[1];

  for (let i = 1; i < kf.length; i++) {
    const a = kf[i - 1];
    const b = kf[i];
    if (t <= b[0]) {
      const span = b[0] - a[0];
      if (span <= 0) return b[1];
      return a[1] + (b[1] - a[1]) * smoothstep((t - a[0]) / span);
    }
  }
  return last[1];
}

/**
 * A soft-edged 0..1 window: 1 while `t` is inside `[start, end]`, easing in and
 * out over `fade`. Used for "is this worker processing right now" style queries.
 */
export function bump(t: number, start: number, end: number, fade = 0.04): number {
  const rise = smoothstep((t - start) / fade);
  const fall = smoothstep((end - t) / fade);
  return rise < fall ? rise : fall;
}
