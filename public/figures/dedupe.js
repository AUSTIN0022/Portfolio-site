/**
 * Dedupe: a desk plinth holding twelve contact cards for seven contacts. The
 * duplicates lie crooked on top of their original. The pointer is projected
 * onto the ground, and every contact within reach slides its copies together
 * and squares up into one stack, on its own spring; the farther, the less.
 * Leaving lets them drift apart again. Each card carries an avatar circle and
 * two line creases. The slider is the reach, in world units.
 *
 * The pattern: a field (Terrain's), over discrete clusters. The hit test is
 * the ground plane against each contact's fixed home, so nothing moving can
 * change what is chosen.
 */
const {
  Cam, circ, clamp, facing, fit, open, poly, prism, proj, rad, rings, rrect, seg, unproj,
  spring, stepS, mk, pointer, put, register, disposer, solid,
} = HL;

const W = 36, H = 23, T = 1.8, PB = 6, RAMP = 24;
const X0 = -72, Y0 = -66, X1 = 72, Y1 = 66;
// Seven contacts: home [x, y], resting angle, and each duplicate's crooked offset [dx, dy, dAngle].
const CONTACTS = [
  { at: [-38, -28], a: 8, dup: [[9, -7, 14]] },
  { at: [8, -44], a: -14, dup: [] },
  { at: [43, -17], a: 12, dup: [[-8, 7, -16]] },
  { at: [-44, 17], a: -9, dup: [] },
  { at: [-2, 4], a: 3, dup: [[10, 4, -13]] },
  { at: [38, 28], a: 17, dup: [] },
  { at: [-6, 46], a: -6, dup: [[8, -7, 12], [-6, 8, -15]] },
];
const TOTAL = CONTACTS.reduce((s, c) => s + 1 + c.dup.length, 0);

/** A ring turned by deg and moved to (cx, cy), normals turned with it. */
const place2 = (ring, cx, cy, deg) => {
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  return ring.map((q) => ({ u: cx + q.u * c - q.v * s, v: cy + q.u * s + q.v * c, nu: q.nu * c - q.nv * s, nv: q.nu * s + q.nv * c }));
};

const CARD = rrect(-W / 2, -H / 2, W / 2, H / 2, 2.6, 4);
const AVATAR = circ(4.7, 20).map((q) => ({ ...q, u: q.u - 10.2 }));

/** One card lying at (cx, cy), turned deg, its base at z0: silhouette, thickness line, avatar, two lines. */
function cardPaths(P, front, cx, cy, deg, z0) {
  const ring = place2(CARD, cx, cy, deg), z1 = z0 + T;
  const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
  const w = (u, v) => P(cx + u * c - v * s, cy + u * s + v * c, z1);
  return {
    body: prism(P, front, ring, ring, z0, z1),
    avatar: poly(place2(AVATAR, cx, cy, deg).map((q) => P(q.u, q.v, z1))),
    lines: seg(w(-2.5, -3.6), w(12.5, -3.6)) + seg(w(-2.5, 3), w(7, 3)),
  };
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let R = value, over = null;

  const C = Cam(45, 0.5, 1.55);
  fit(C, [[X0, Y0, -PB], [X1, Y1, -PB], [X1, Y0, -PB], [X0, Y1, -PB], [X0, Y0, 3 * T]], 200, 166);
  const P = proj(C), front = facing(C);

  const g = mk("g", {}, svg);
  const [pr, pi] = rings(X0, Y0, X1, Y1, 12, 2.2);
  put(solid(g), prism(P, front, pr, pi, -PB, 0));

  // Contacts far to near, so appending is painting back to front; inside one, the original first, then its copies up the stack.
  const order = CONTACTS.map((c, i) => i).sort((i, j) => CONTACTS[i].at[0] + CONTACTS[i].at[1] - (CONTACTS[j].at[0] + CONTACTS[j].at[1]));
  const clusters = [];
  for (const i of order) {
    const ct = CONTACTS[i];
    const cards = [[0, 0, 0], ...ct.dup].map((off) => {
      const el = solid(mk("g", {}, g));
      return { off, el, avatar: mk("path", { class: "nf" }, el.g), lines: mk("path", { class: "nf lo" }, el.g) };
    });
    clusters.push({ ct, cards, sp: spring(0, { eps: 0.002 }), drawn: NaN });
  }
  const top = (cl) => cl.cards[cl.cards.length - 1].el.sil;
  const restMark = clusters.reduce((a, b) => (b.cards.length > a.cards.length ? b : a));

  function drawCluster(cl) {
    const m = clamp(cl.sp.x, 0, 1);
    if (m === cl.drawn) return;
    cl.drawn = m;
    const [hx, hy] = cl.ct.at, k = 1 - m;
    cl.cards.forEach((cd, j) => {
      const q = cardPaths(P, front, hx + cd.off[0] * k, hy + cd.off[1] * k, (cl.ct.a + cd.off[2]) * k, j * T);
      put(cd.el, q.body);
      cd.avatar.setAttribute("d", q.avatar);
      cd.lines.setAttribute("d", q.lines);
    });
  }

  const B = register(stage, (dt) => {
    let moving = false;
    for (const cl of clusters) { if (stepS(cl.sp, dt)) moving = true; drawCluster(cl); }
    return moving;
  });
  bag.add(B.unregister);

  /** Every contact within reach of the ground point squares up: 1 inside R − RAMP, falling to 0 at R. */
  function retarget() {
    let near = null, best = Infinity, merged = 0;
    for (const cl of clusters) {
      if (!over) { cl.sp.t = 0; continue; }
      const d = Math.hypot(cl.ct.at[0] - over[0], cl.ct.at[1] - over[1]);
      cl.sp.t = clamp((R - d) / RAMP, 0, 1);
      if (cl.sp.t >= 0.5) merged += cl.cards.length - 1;
      if (d < best) { best = d; near = cl; }
    }
    const lit = over ? near : restMark;
    for (const cl of clusters) top(cl).classList.toggle("hi", cl === lit);
    read.textContent = over ? `contacts ${TOTAL} → ${TOTAL - merged}` : "rest";
    B.wake();
  }

  bag.add(pointer(stage, {
    move: (p) => { over = unproj(C, p[0], p[1], 0); retarget(); },
    leave: () => { over = null; retarget(); },
  }));
  bag.add(() => svg.replaceChildren());
  retarget();

  return {
    set: (v) => { R = v; if (over) retarget(); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "dedupe",
  means: "Contact cards with crooked duplicates: near the pointer, each contact's copies slide into one square stack.",
  rules: [1, 3, 5, 10],
  range: [40, 72, 110],
  tour: [[106, 204], [161, 174], [200, 166], null],
  mount,
});
