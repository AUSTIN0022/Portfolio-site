/**
 * Claim: a rail of seven job crates under a gantry with three clamp workers.
 * The pointer picks a crate; the worker parked nearest it slides over, comes
 * down, closes its jaws and drops a lock collar round it, which takes the
 * bright stroke. Whoever held a job before opens and goes home: one job, one
 * holder. The slider is the step between the phases (open, lift, slide,
 * descend, lock), in ms.
 *
 * Paint order: each worker's back jaw and the back of its collar sit just
 * before the crate it is over; the rest of it after every crate.
 */
const {
  Cam, clamp, facing, fit, lerp, mk, open, poly, prism, proj, ringAt, rings, rrect, run, seg,
  solid, put, tset, tval, tdone, tween, disposer, pointer, reflect, register,
} = HL;

const N = 7, PITCH = 22, HS = [12, 16, 13, 16, 11, 15, 13], FLOOR = 3, CR = 8;
const PARKS = [0, 60, 140], PARK = 36, BEAM = 62, PX = [-30, 168];
const REST = { job: 4, w: 1 };
const jx = (j) => j * PITCH, top = (j) => FLOOR + HS[j];

/** A worker at x, its head's underside at z, its grip g in 0..1: every path string it needs. */
function pose(P, front, x, z, g) {
  const jy = lerp(10, 8.4, g), cx = lerp(8.5, 9.6, g), cy = jy + 4;
  const jaw = (s) => { const [r, i] = rings(x - 5, s > 0 ? jy : -jy - 3, x + 5, s > 0 ? jy + 3 : -jy, 1.2, 0.7); return prism(P, front, r, i, z - 10, z); };
  const [hr, hi] = rings(x - 7, -12, x + 7, 12, 3, 1.4);
  const [ar, ai] = rings(x - 2, -2, x + 2, 2, 1.6, 0.6);
  const ring = rrect(x - cx, -cy, x + cx, cy, 3, 4), z1 = z - lerp(0.5, 5, g), z0 = z1 - 3;
  const fT = ringAt(P, run(ring, front), z1), fB = ringAt(P, run(ring, front), z0);
  return {
    back: jaw(-1), front: jaw(1), head: prism(P, front, hr, hi, z, z + 5), arm: prism(P, front, ar, ai, z + 5, BEAM),
    cBack: open(ringAt(P, run(ring, (q) => !front(q)), z1)),
    cFill: poly([...fT, ...fB.slice().reverse()]),
    cLine: open([fT[0], ...fB, fT[fT.length - 1]]) + open(fT),
  };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let step = value;
  const C = Cam(45, 0.5, 1.6);
  fit(C, [[PX[0] - 3, -17, 0], [PX[1] + 3, 17, 0], [PX[0] - 3, -17, 72], [PX[1] + 3, 3.5, 72], [-12, 17, -6]], 200, 166);
  const P = proj(C), front = facing(C);
  const g = mk("g", {}, svg);
  const solidAt = (x0, y0, x1, y1, r, b, z0, z1, par = g) => { const [ri, ii] = rings(x0, y0, x1, y1, r, b); const s = solid(par); put(s, prism(P, front, ri, ii, z0, z1)); return s; };

  const [tr] = rings(-13, -14, jx(N - 1) + 13, 14, 5, 1.8);
  reflect(svg, g, P, front, tr, 0, 12);
  solidAt(PX[0] - 3, -3, PX[0] + 3, 3, 2, 0.8, 0, BEAM);
  solidAt(-13, -14, jx(N - 1) + 13, 14, 5, 1.8, 0, FLOOR);

  // the crates: a lid with its crease and one slat, and a hand slot cut in the front face
  const jobs = HS.map((h, j) => {
    const x = jx(j), t = top(j), grp = mk("g", {}, g);
    solidAt(x - CR, -CR, x + CR, CR, 2.2, 1.3, FLOOR, t, grp);
    mk("path", { d: seg(P(x, -CR + 2, t), P(x, CR - 2, t)), class: "nf lo" }, grp);
    mk("path", { d: poly(rrect(x - 4, t - 5.5, x + 4, t - 3, 1.2, 3).map((q) => P(q.u, CR, q.v))), class: "nf lo" }, grp);
    return { g: grp };
  });

  const slot = (x) => clamp(Math.round(x / PITCH), 0, N - 1);
  const order = mk("g", {}, g); // the workers' near parts, after every crate
  const workers = PARKS.map((px) => {
    const bk = mk("g", {}, g), fr = mk("g", {}, order);
    const el = {
      back: solid(bk), cBack: mk("path", { class: "nf lo" }, bk),
      front: solid(fr), cFill: mk("path", { class: "fo" }, fr), cLine: mk("path", { class: "nf sil" }, fr),
      head: solid(fr), arm: solid(fr),
    };
    jobs[slot(px)].g.before(bk);
    return { bk, el, x: tween(px), z: tween(PARK), g: tween(0), job: -1, drawn: "" };
  });
  solidAt(PX[1] - 3, -3, PX[1] + 3, 3, 2, 0.8, 0, BEAM);
  solidAt(PX[0] - 6, -3.5, PX[1] + 6, 3.5, 3, 1.2, BEAM, BEAM + 5);
  const carts = workers.map(() => solid(g));

  function draw(w, x, z, gr) {
    const key = x.toFixed(2) + z.toFixed(2) + gr.toFixed(3);
    if (key === w.drawn) return;
    w.drawn = key;
    const q = pose(P, front, x, z, gr), e = w.el;
    put(e.back, q.back); put(e.front, q.front); put(e.head, q.head); put(e.arm, q.arm);
    e.cBack.setAttribute("d", q.cBack); e.cFill.setAttribute("d", q.cFill); e.cLine.setAttribute("d", q.cLine);
    const [cr, ci] = rings(x - 7, -5, x + 7, 5, 2.4, 1);
    put(carts[workers.indexOf(w)], prism(P, front, cr, ci, BEAM + 5, BEAM + 9));
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    for (const w of workers) {
      draw(w, tval(w.x, now), tval(w.z, now), tval(w.g, now));
      if (!tdone(w.x, now) || !tdone(w.z, now) || !tdone(w.g, now)) moving = true;
    }
    return moving;
  });
  bag.add(B.unregister);

  let held = null;
  /** Job j is claimed by the worker parked nearest it; any other holder lets go and goes home. */
  function claim(j, instant) {
    const wi = PARKS.reduce((b, p, i) => (Math.abs(p - jx(j)) < Math.abs(PARKS[b] - jx(j)) ? i : b), 0);
    if (held && held.job === j && held.w === wi) return;
    held = { job: j, w: wi };
    const now = instant ? -1e6 : performance.now(), d = (k) => k * step;
    workers.forEach((w, i) => {
      const was = w.job, want = i === wi ? j : -1;
      w.el.cLine.classList.toggle("hi", i === wi);
      if (was === want) return;
      const t0 = was >= 0 ? 2 : 0; // a worker holding something opens and lifts first
      if (was >= 0) { tset(w.g, 0, now, 0); tset(w.z, PARK, now, d(1)); }
      const tx = want >= 0 ? jx(want) : PARKS[i];
      tset(w.x, tx, now, d(t0));
      w.bk.remove(); jobs[slot(tx)].g.before(w.bk);
      if (want >= 0) { tset(w.z, top(want) + 1, now, d(t0 + 1)); tset(w.g, 1, now, d(t0 + 2)); }
      w.job = want;
    });
    read.textContent = instant ? "rest" : `job ${String(j + 1).padStart(2, "0")} · locked by w${wi + 1}`;
    B.wake();
  }

  // hit: a static band along the crates' resting row; the slot is the nearest along it
  const g0 = P(0, 0, 10), g1 = P(PITCH, 0, 10), dv = [g1[0] - g0[0], g1[1] - g0[1]], L2 = dv[0] ** 2 + dv[1] ** 2;
  function hit([px, py]) {
    const qx = px - g0[0], qy = py - g0[1], s = (qx * dv[0] + qy * dv[1]) / L2;
    const perp = Math.abs(qx * dv[1] - qy * dv[0]) / Math.sqrt(L2);
    return perp > 24 || s < -0.6 || s > N - 0.4 ? -1 : clamp(Math.round(s), 0, N - 1);
  }
  const rest = () => { claim(REST.job, false); read.textContent = "rest"; };
  const at = (p) => { const j = hit(p); if (j < 0) rest(); else claim(j, false); };
  claim(REST.job, true);
  bag.add(pointer(stage, { move: at, leave: rest }));
  bag.add(() => svg.replaceChildren());

  return { set: (v) => { step = v; }, destroy: bag.dispose };
}

hairline({
  name: "claim",
  means: "A job queue on a rail: the worker nearest the job you pick comes down and locks it; a job is only ever held by one.",
  rules: [1, 4, 5, 8, 10],
  range: [120, 220, 340],
  tour: [[271, 229], [122, 156], [197, 193], null],
  mount,
});
