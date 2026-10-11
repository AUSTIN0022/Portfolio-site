/**
 * Apistack: a backend API as four rounded slabs over a database cylinder.
 * Router (port notches on its faces), controller (a row of switch tabs),
 * service (a raised inset panel), repository (a grid of slots). The pointer's
 * height picks a layer: the slabs above it lift away, staggered outwards from
 * it, and a request token slides into the gap that opens. The token is the one
 * bright stroke. The slider is how far the layers above lift.
 *
 * Hit test: each layer's fixed band on screen, taken from the closed stack, so
 * a slab lifting out from under the pointer cannot change the choice.
 */
const {
  Cam, circ, fit, hull, open, poly, prism, proj, rings, ringAt, rrect, run, seg, facing,
  tdone, tset, tval, tween, disposer, mk, pointer, put, reflect, register, solid,
} = HL;

const W = 96, D = 64, R = 7, T = 10, G = 5, HDB = 26, DBR = 27, Z0 = HDB + 8;
const NAMES = ["router", "controller", "service", "repository", "database"];
const REST = 2, REST_K = 0.6, STEP = 45, SLIDE = 16, TX = 28, TY = 20;
const base = (i) => Z0 + (3 - i) * (T + G);        // layer i: 0 is the router, at the top
const topOf = (a) => (a === 4 ? HDB : base(a) + T); // where the token rides

/** The marks a layer would really have, along one face: [medium path, dim path]. f(u, v) maps along-face u and up-face v to the screen. */
function marks(kind, f, L) {
  const ring = (u0, v0, u1, v1, r) => poly(rrect(u0, v0, u1, v1, r, 3).map((q) => f(q.u, q.v)));
  let a = "", b = "";
  if (kind === 0) {             // router: a row of ports, each with its latch
    for (let u = -L + 6; u <= L - 6; u += 11) { a += ring(u - 3.4, 2.4, u + 3.4, 7.6, 1.2); b += seg(f(u - 1.4, 6.2), f(u + 1.4, 6.2)); }
  } else if (kind === 1) {      // controller: toggles, each a pill with its knob thrown left or right
    let k = 0;
    for (let u = -L + 7; u <= L - 7; u += 14, k++) { a += ring(u - 5, 3, u + 5, 7, 2); const c = k % 3 === 1 ? u - 2.6 : u + 2.6; b += ring(c - 1.4, 3.8, c + 1.4, 6.2, 1.2); }
  } else if (kind === 2) {      // service: one raised panel, with its inset edge
    a = ring(-L + 3, 1.8, L - 3, 8.2, 2.6); b = ring(-L + 5, 3.4, L - 5, 6.6, 1.4);
  } else {                      // repository: a grid of slots
    for (const v of [3.4, 6.6]) for (let u = -L + 4; u + 5 <= L - 4; u += 8) a += seg(f(u, v), f(u + 5, v));
    b = seg(f(-L + 2, 5), f(L - 2, 5));
  }
  return [a, b];
}

function mount({ stage, svg, read }, value) {
  const bag = disposer();
  let lift = value;

  // Fitted with the stack opened at the database by the slider's far end, so no pose leaves the frame.
  const C = Cam(45, 0.5, 1.7);
  fit(C, [[-W / 2, -D / 2, -6], [W / 2, D / 2, 0], [W / 2, -D / 2, 0], [-W / 2, D / 2, 0], [-W / 2, -D / 2, topOf(0) + 32]], 200, 166);
  const P = proj(C), front = facing(C);
  const [ring, inner] = rings(-W / 2, -D / 2, W / 2, D / 2, R, 1.6);
  const cyl = circ(DBR, 48), cylIn = circ(DBR - 1.6, 48);

  const g = mk("g", {}, svg);
  reflect(svg, g, P, front, cyl, 0, 14);

  // the database: a cylinder with two platter seams on its front
  const db = mk("g", {}, g), dbs = solid(db);
  put(dbs, prism(P, front, cyl, cylIn, 0, HDB));
  const fr = run(cyl, front);
  mk("path", { class: "nf lo", d: [HDB * 0.36, HDB * 0.68].map((z) => open(ringAt(P, fr, z))).join("") }, db);

  // four slabs, painted bottom to top so each covers the one below
  const L = W / 2 - R - 1, LD = D / 2 - R - 1;
  const layers = [];
  for (const i of [3, 2, 1, 0]) {
    const lg = mk("g", {}, g), s = solid(lg);
    const m = mk("path", { class: "nf" }, lg), lo = mk("path", { class: "nf lo" }, lg);
    layers[i] = { lg, s, m, lo, z: tween(i < REST ? lift * REST_K : 0), last: NaN };
  }
  const groups = [layers[0].lg, layers[1].lg, layers[2].lg, layers[3].lg, db];

  function drawLayer(i, dz) {
    const ly = layers[i];
    if (ly.last === dz) return;
    ly.last = dz;
    const z0 = base(i) + dz;
    put(ly.s, prism(P, front, ring, inner, z0, z0 + T));
    const fy = marks(i, (u, v) => P(u, D / 2, z0 + v), L), fx = marks(i, (u, v) => P(W / 2, -u, z0 + v), LD);
    ly.m.setAttribute("d", fy[0] + fx[0]);
    ly.lo.setAttribute("d", fy[1] + fx[1]);
  }

  // the request token: a small pill, the one bright stroke
  const [pill, pillIn] = rings(-7, -3.2, 7, 3.2, 3.2, 0.9);
  const tk = solid(mk("g", {}, g));
  tk.sil.classList.add("hi");
  const shift = (rg, dx, dy) => rg.map((q) => ({ ...q, u: q.u + dx, v: q.v + dy }));
  let at = REST, slide = tween(0), tLast = "";
  function drawToken(s) {
    const key = at + ":" + s;
    if (key === tLast) return;
    tLast = key;
    const dy = TY + s * (D / 2 - TY + SLIDE), z = topOf(at);
    put(tk, prism(P, front, shift(pill, TX, dy), shift(pillIn, TX, dy), z, z + 4));
  }
  groups[at].after(tk.g);

  // hit bands: each layer's front-face middle on the CLOSED stack. They never move.
  const ref = (z) => P(W / 4, D / 4, z)[1];
  const bands = [0, 1, 2, 3].map((i) => ref(base(i) + T / 2)).concat(ref(HDB / 2) + 4);
  const outline = hull(ringAt(P, ring, topOf(0)).concat(ringAt(P, ring, Z0), ringAt(P, cyl, 0)));
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const inside = (p) => outline.every((q, k) => cross(q, outline[(k + 1) % outline.length], p) >= -40);
  function hit(p) {
    if (!inside(p)) return -1;
    let best = 0;
    bands.forEach((y, i) => { if (Math.abs(p[1] - y) < Math.abs(p[1] - bands[best])) best = i; });
    return best;
  }

  const B = register(stage, (_dt, now) => {
    let moving = false;
    layers.forEach((ly, i) => { drawLayer(i, tval(ly.z, now)); if (!tdone(ly.z, now)) moving = true; });
    drawToken(tval(slide, now));
    return moving || !tdone(slide, now);
  });
  bag.add(B.unregister);

  let act = -1;
  /** Opens the stack at layer a (-1 is rest): the slabs above it lift, nearest first. */
  function setActive(a, force) {
    if (a === act && !force) return;
    const now = performance.now(), open = a < 0 ? REST : a, k = a < 0 ? REST_K : 1;
    const from = a >= 0 ? a : act >= 0 ? act : REST;
    act = a;
    layers.forEach((ly, i) => tset(ly.z, i < open ? lift * k : 0, now, Math.abs(i - from) * STEP));
    if (open !== at) { at = open; groups[at].after(tk.g); slide = tween(1); tset(slide, 0, now, 120); }
    read.textContent = a < 0 ? "rest" : "layer " + String(a + 1).padStart(2, "0") + " · " + NAMES[a];
    B.wake();
  }

  read.textContent = "rest";
  bag.add(pointer(stage, { move: (p) => setActive(hit(p)), leave: () => setActive(-1) }));
  bag.add(() => svg.replaceChildren());

  return {
    set: (v) => { lift = v; setActive(act, true); },
    destroy: bag.dispose,
  };
}

hairline({
  name: "apistack",
  means: "An API as stacked layers over its database: point at a layer and the ones above lift, letting a request in.",
  rules: [1, 2, 5, 10],
  range: [12, 22, 32],
  tour: [[210, 147], [200, 252], [210, 192], null],
  mount,
});
