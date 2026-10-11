/**
 * Rollout: a zero-downtime rolling deployment. A low load balancer sits at the
 * head of a plinth, its dashed feed running past five bays, each holding a
 * container with a ribbed front and a status line. The pointer sweeps the row:
 * the container under it is being replaced, the old one lifting up and back out
 * of its bay while the new one settles in from above. Only that bay is ever
 * open, so the feed always has live containers. Containers left of the pointer
 * are swapped and show their status line bright; the rest are still old. The
 * slider is the stagger, in ms.
 */
const {
  Cam, clamp, facing, fit, open, poly, proj, rings, prism, rrect, ringAt, seg,
  tdone, tset, tval, tween, disposer, mk, place, pointer, register, solid, put,
} = HL;

const N = 5, PITCH = 34, CX0 = 54, CY = 17, HX = 12, HY = 11, HT = 28;
const LIFT = 30, BACK = 30, DROP = 30, PZ = -8;
const PX0 = -6, PX1 = CX0 + (N - 1) * PITCH + 34, PY0 = -4, PY1 = 46, FEED = 39;
const REST = [1, 1, 0.5, 0, 0];

/** Swap progress s (0 old seated, 0.5 mid-swap, 1 new seated) as two poses: [cy, z0, scale] for the old and the new. */
function poses(s) {
  const e = Math.min(1, 2 * s), so = 1 - Math.max(0, 2 * s - 1), sn = Math.min(1, 2 * s);
  return {
    old: [CY - BACK * e, LIFT * e + (HT / 2) * (1 - so), so],
    neu: [CY, DROP * (1 - s) + (HT / 2) * (1 - sn), sn],
  };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let stag = value;

  // fitted to the plinth with a container lifted back and one dropping in, so no pose leaves the frame
  const C = Cam(45, 0.5, 1.36);
  const xl = CX0 + (N - 1) * PITCH;
  fit(C, [[PX0, PY0, PZ], [PX1, PY1, PZ], [PX0, PY1, PZ], [PX1, PY0, 0], [xl + HX, CY - BACK - HY, LIFT + HT],
    [CX0 - HX, CY - HY, DROP + HT / 2], [xl + HX, CY - HY, DROP + HT / 2]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);

  // the plinth, its bays, and the feed: painted before anything stands on them
  const [pr, pi] = rings(PX0, PY0, PX1, PY1, 6, 1.8);
  put(solid(g), prism(P, front, pr, pi, PZ, 0));
  for (let i = 0; i < N; i++) {
    const cx = CX0 + i * PITCH;
    mk("path", { d: poly(ringAt(P, rrect(cx - HX - 3, CY - HY - 3, cx + HX + 3, CY + HY + 3, 5, 4), 0)), class: "nf lo" }, g);
  }
  mk("path", { d: open([P(18, 30, 0), P(18, FEED, 0), P(PX1 - 8, FEED, 0)]), class: "nf dash" }, g);

  // the load balancer: a low block with three ports on its top
  const [lr, li] = rings(4, 6, 32, 30, 4, 1.6);
  put(solid(g), prism(P, front, lr, li, 0, 10));
  [10, 18, 26].forEach((x) => place(mk("circle", { r: 1.3, class: "dot off" }, g), P(x, 24, 10)));

  /** One container's paths: a solid, five ribs on its front, and the status line across its top. */
  const box = () => { const s = solid(g); return { s, ribs: mk("path", { class: "nf lo" }, s.g), st: mk("path", { class: "nf" }, s.g) }; };
  function draw(el, cx, [cy, z0, sc]) {
    if (sc < 0.08) { for (const p of [el.s.sil, el.s.cr, el.ribs, el.st]) p.setAttribute("d", ""); return; }
    const hx = HX * sc, hy = HY * sc, h = HT * sc, fy = cy + hy;
    const [ring, inner] = rings(cx - hx, cy - hy, cx + hx, cy + hy, 4 * sc, 1.6 * sc);
    put(el.s, prism(P, front, ring, inner, z0, z0 + h));
    let r = "";
    for (let k = -2; k <= 2; k++) r += seg(P(cx + k * 3.6 * sc, fy, z0 + 3 * sc), P(cx + k * 3.6 * sc, fy, z0 + h - 10 * sc));
    el.ribs.setAttribute("d", r);
    el.st.setAttribute("d", seg(P(cx - hx + 4 * sc, fy, z0 + h - 5 * sc), P(cx + hx - 4 * sc, fy, z0 + h - 5 * sc)));
  }

  // per bay, back to front: the old container, then the new one in front of it
  const bays = [];
  for (let i = 0; i < N; i++) bays.push({ cx: CX0 + i * PITCH, old: box(), neu: box(), t: tween(REST[i]), last: -1 });

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const b of bays) {
      const s = tval(b.t, now);
      if (s !== b.last) { const q = poses(s); draw(b.old, b.cx, q.old); draw(b.neu, b.cx, q.neu); b.last = s; }
      if (!tdone(b.t, now)) moving = true;
    }
    return moving;
  });
  bag.add(B.unregister);

  // hit: the rest centres along the row, in screen x; one bay past the last means the rollout is done
  const sx0 = P(CX0, CY, HT / 2)[0], sx1 = P(xl, CY, HT / 2)[0];
  const hit = ([x]) => clamp(Math.round(((x - sx0) / (sx1 - sx0)) * (N - 1)), 0, N);

  let act = null;
  /** Rolls out to bay a (N: all swapped; -1: rest, mid-rollout at bay 2). The stagger spreads from a. */
  function setActive(a) {
    if (a === act) return;
    const now = performance.now(), from = a < 0 ? 2 : a;
    act = a;
    bays.forEach((b, i) => {
      const to = a < 0 ? REST[i] : i < a ? 1 : i === a ? 0.5 : 0;
      tset(b.t, to, now, Math.abs(i - from) * stag);
      b.neu.st.classList.toggle("hi", to === 1);
    });
    read.textContent = a < 0 ? "rest" : a >= N ? `live ${N}/${N} · 0 downtime` : `deploy ${a + 1}/${N} · 0 downtime`;
    B.wake();
  }
  setActive(-1);

  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { stag = v; },
    destroy: bag.dispose,
  };
}

hairline({
  name: "rollout",
  means: "A rolling deploy: one container at a time lifts out of its bay as its replacement settles in, so the feed is never dropped.",
  rules: [1, 2, 4, 5, 8, 10],
  range: [0, 40, 90],
  tour: [[151, 118], [216, 148], [310, 210], null],
  mount,
});
