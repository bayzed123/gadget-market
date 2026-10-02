// Gadget models: small factories that build each device from physically based parts (rounded aluminium and plastic
// shells, silicone, glass, woven fabric, braided cable, lit screens). Every factory returns a THREE.Group standing on
// the floor (y = 0) with its front towards +z. Units are centimetres. Printed logos are drawn with real fonts, so the
// renders always match the (fictional) sample brands in scripts/seed-data.mjs.
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { THREE, C, at, canvasTexture, cyl, decal, group, lathe, mesh, noiseTexture, roundedWall, sphere } from "./studio.js";

// ---------------------------------------------------------------- materials
export const glossy = (hex, o = {}) => new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, ...o });
export const satin = (hex, o = {}) => new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4, ...o });
/** Soft-touch / matte plastic. */
export const soft = (hex, o = {}) => new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 0.78, roughnessMap: noiseTexture(256, 200, 30, 12), sheen: 0.2, sheenColor: C("#ffffff"), ...o });
/** Anodised aluminium: fine brushed grain. */
export const alu = (hex, o = {}) => new THREE.MeshPhysicalMaterial({ color: C(hex), metalness: 1, roughness: 0.34, roughnessMap: brushTexture(), envMapIntensity: 1.6, ...o });
export const chrome = (hex = "#e9edf2", o = {}) => new THREE.MeshPhysicalMaterial({ color: C(hex), metalness: 1, roughness: 0.12, envMapIntensity: 2, ...o });
export const rubber = (hex, o = {}) => new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 0.92, ...o });
export const silicone = (hex, o = {}) => new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.45, sheen: 0.08, sheenColor: C("#ffffff"), ...o });
/** Clear polycarbonate / tempered glass. */
export const clear = (o = {}) =>
  new THREE.MeshPhysicalMaterial({ color: C("#ffffff"), roughness: 0.06, transmission: 1, thickness: 0.2, ior: 1.5, specularIntensity: 1, envMapIntensity: 1.6, side: THREE.DoubleSide, ...o });
/** Black glass (screens off, camera fronts). */
export const blackGlass = (o = {}) => new THREE.MeshPhysicalMaterial({ color: C("#05070a"), roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.4, ...o });
export const led = (hex, intensity = 2.2) => new THREE.MeshStandardMaterial({ color: C("#000000"), emissive: C(hex), emissiveIntensity: intensity });
/** Woven speaker fabric. */
export function fabricMat(hex, repeat) {
  const bump = weaveTexture();
  bump.repeat.set(repeat, repeat);
  return new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 1, bumpMap: bump, bumpScale: 0.8, sheen: 0.5, sheenColor: C("#9aa3b0"), sheenRoughness: 0.8 });
}
/** Braided nylon cable: diagonal weave along the length (TubeGeometry u runs along the tube). */
export const braid = (hex, len = 200) => {
  const t = braidTexture();
  t.repeat.set(len, 1);
  return new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 0.62, bumpMap: t, bumpScale: 0.5, sheen: 0.12, sheenColor: C("#ffffff"), sheenRoughness: 0.6 });
};

function brushTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "rgb(120,120,120)";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const v = 90 + Math.random() * 80;
    g.fillStyle = `rgba(${v},${v},${v},0.5)`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 30 + Math.random() * 90, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  return t;
}
function weaveTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 4)
    for (let x = 0; x < 64; x += 4) {
      g.fillStyle = (x + y) % 8 === 0 ? "#cfcfcf" : "#3a3a3a";
      g.fillRect(x, y, 3, 3);
    }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function braidTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 64, 64);
  g.lineWidth = 7;
  for (let i = -64; i < 128; i += 16) {
    g.strokeStyle = "#d8d8d8";
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 64, 64);
    g.stroke();
    g.strokeStyle = "#2a2a2a";
    g.beginPath();
    g.moveTo(i + 64, 0);
    g.lineTo(i, 64);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// ---------------------------------------------------------------- shapes
/** Rounded box centred on the origin. */
export const rbox = (w, h, d, r, m, seg = 5) => mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001)), m);

export function rrShape(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x = cx - w / 2, y = cy - h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
const rrPath = (w, h, r, cx = 0, cy = 0) => {
  const s = rrShape(w, h, r, cx, cy);
  const p = new THREE.Path();
  p.curves = s.curves;
  return p;
};
/** Extrudes a shape along +z (from z = 0 to z = depth). */
export const extrude = (shape, depth, m, bevel = 0.04) =>
  mesh(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 24 }), m);

/** Tube along points (CatmullRom). */
export const tube = (pts, r, m, segs = 400, closed = false) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), closed, "catmullrom", 0.4), segs, r, 16, closed), m);

/**
 * Printed text (logo, specs) as a flat decal, w × h cm. lines: [{ text, size, weight, color, track, gap }] in px on a
 * 1024-wide canvas; each line shrinks to fit 92% of the width, and the block is centred vertically.
 */
export function print(w, h, lines, o = {}) {
  const W = 1024, H = Math.max(16, Math.round((1024 * h) / w));
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d");
  if (o.bg) {
    g.fillStyle = o.bg;
    g.fillRect(0, 0, W, H);
  }
  const L = lines.map((l) => ({ weight: 600, track: 0.12, color: "#d7dde6", gap: 0, ...l }));
  const fit = (l) => {
    let size = l.size;
    for (; size > 8; size *= 0.94) {
      g.font = `${l.weight} ${size}px Jost`;
      if ("letterSpacing" in g) g.letterSpacing = `${l.track * size}px`;
      const tw = g.measureText(l.text).width;
      if (tw <= W * 0.92) break;
    }
    return size;
  };
  L.forEach((l) => (l.fs = fit(l)));
  const total = L.reduce((s2, l) => s2 + l.gap + l.fs, 0);
  let y = (H - total) / 2;
  for (const l of L) {
    y += l.gap + l.fs;
    g.font = `${l.weight} ${l.fs}px Jost`;
    if ("letterSpacing" in g) g.letterSpacing = `${l.track * l.fs}px`;
    g.fillStyle = l.color;
    g.textAlign = "center";
    g.fillText(l.text, W / 2 + (l.track * l.fs) / 2, y - l.fs * 0.18);
  }
  const tex = canvasTexture(c);
  return decal(w, h, tex, { roughness: o.rough ?? 0.5, ...(o.emissive ? { emissive: C("#ffffff"), emissiveMap: tex, emissiveIntensity: o.emissive } : {}) });
}

/** A screen texture drawn with a callback (g, w, h). */
export function screenTex(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, w, h);
  draw(g, w, h);
  return canvasTexture(c);
}
export const screenMat = (tex, intensity = 1.25) =>
  new THREE.MeshPhysicalMaterial({ color: C("#000000"), emissive: C("#ffffff"), emissiveMap: tex, emissiveIntensity: intensity, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.03 });

/** A dark port opening on a face (USB-C, USB-A, HDMI …) as a shallow recessed rounded slot. */
export const port = (w, h, r = 0.12, depth = 0.08) => rbox(w, h, depth, r, satin("#07080a"));

/** Lathe a rounded disc (radius r, thickness t) whose axis is +z. */
export function disc(r, t, m, round = 0.35) {
  const g = lathe(roundedWall(r, -t / 2, t / 2, Math.min(round, t / 2 - 0.01), Math.min(round, t / 2 - 0.01), 10), m, 128);
  g.rotation.x = Math.PI / 2;
  return group(g);
}

/** Places `o` at the end of a curve, looking along the curve. */
function atEnd(o, curve, start = false) {
  const p = curve.getPointAt(start ? 0 : 1);
  const t = curve.getTangentAt(start ? 0 : 1).multiplyScalar(start ? -1 : 1);
  o.position.copy(p);
  o.lookAt(p.clone().add(t));
  return o;
}

// ---------------------------------------------------------------- audio
/** True-wireless earbud lying on its side (head + silicone tip + optional stem). */
export function bud(hex, { stem = true, tip = "#8b929c" } = {}) {
  const shell = glossy(hex);
  const head = sphere(1.0, shell);
  head.scale.set(1.05, 0.95, 1.1);
  const tipM = silicone(tip);
  const t = sphere(0.62, tipM);
  t.scale.set(1, 1, 0.75);
  t.position.set(-0.55, 0.15, 0.75);
  const grill = cyl(0.32, 0.32, 0.06, satin("#14171c"), 32);
  grill.rotation.x = Math.PI / 2;
  grill.position.set(0.25, 0.35, -1.05);
  const parts = [head, t, grill];
  if (stem) {
    const s = mesh(new THREE.CapsuleGeometry(0.34, 2.2, 8, 24), shell);
    s.rotation.set(0.25, 0, 0.05);
    s.position.set(0.15, -1.55, -0.25);
    const mic = cyl(0.12, 0.12, 0.05, satin("#2a2f36"), 16);
    mic.position.set(0.17, -2.85, -0.55);
    parts.push(s, mic);
  }
  return group(...parts);
}

/** Pebble charging case, standing; `open` hinges the lid back and shows the buds inside. */
export function budsCase(hex, { w = 6.2, h = 4.8, d = 2.7, open = false, logo = "SONIX", logoColor = "#9aa3ad" } = {}) {
  const m = glossy(hex);
  const r = Math.min(1.25, d / 2 - 0.05);
  const seamY = h * 0.66;
  const parts = [at(sphere(0.07, led("#5ad8ff", 3)), 0, seamY * 0.45, d / 2 + 0.005)];
  if (!open) {
    parts.push(at(rbox(w, h, d, r, m), 0, h / 2, 0));
    // The lid seam: a thin dark line around the shell where the straight sides are.
    const seamShape = rrShape(w + 0.01, d + 0.01, r * 0.98);
    seamShape.holes.push(rrPath(w - 0.2, d - 0.2, r * 0.9));
    const seam = mesh(new THREE.ExtrudeGeometry(seamShape, { depth: 0.045, bevelEnabled: false, curveSegments: 24 }), satin("#050506"));
    seam.rotation.x = Math.PI / 2;
    seam.position.y = seamY;
    parts.push(seam);
    parts.push(at(print(2.4, 0.6, [{ text: logo, size: 150, color: logoColor, track: 0.35 }]), 0, seamY + 0.55, d / 2 + 0.01));
  } else {
    // Lower shell cut at the seam, and the lid (cut the same way) hinged open along the back edge.
    const lowH = seamY + 2 * r;
    const lower = clipKeep(at(rbox(w, lowH, d, r, m), 0, lowH / 2, 0), new THREE.Vector3(0, -1, 0), seamY - lowH / 2);
    const deck = at(rbox(w - 0.22, 0.04, d - 0.22, 0.02, satin("#0a0b0e")), 0, seamY - 0.03, 0);
    const lidH = h - seamY + 2 * r;
    const lid = clipKeep(rbox(w, lidH, d, r, m), new THREE.Vector3(0, 1, 0), lidH / 2 - (h - seamY));
    lid.position.set(0, lidH / 2 - (h - seamY) * 0 - (lidH - (h - seamY)), d / 2);
    const hinge = new THREE.Group();
    hinge.position.set(0, seamY, -d / 2);
    hinge.add(lid);
    hinge.rotation.x = -1.9;
    parts.push(lower, deck, hinge);
    for (const sgn of [-1, 1]) {
      const b = bud(hex, { stem: false });
      b.scale.setScalar(0.72);
      at(b, sgn * 1.35, seamY + 0.25, 0.05, 0.4, sgn * 0.4, 0);
      parts.push(b);
    }
  }
  return group(...parts);
}

/** Keeps only the part of `o` (a mesh) on the positive side of a plane given in its own space: normal · p + c ≥ 0. */
function clipKeep(o, normal, c) {
  const local = new THREE.Plane(normal.clone().normalize(), c);
  const world = new THREE.Plane();
  o.material = o.material.clone();
  o.material.side = THREE.DoubleSide;
  o.material.clippingPlanes = [world];
  o.material.clipShadows = true;
  o.onBeforeRender = () => world.copy(local).applyMatrix4(o.matrixWorld);
  o.onBeforeShadow = o.onBeforeRender;
  return o;
}

/** Over-ear headphones standing on their cups. */
export function headphones(hex, { accent = null, boom = false, logo = "SONIX", cushion = "#1c1f24" } = {}) {
  const shell = satin(hex);
  const soft1 = soft(cushion);
  const R = 8.2;
  const band = mesh(new THREE.TorusGeometry(R, 0.55, 24, 120, Math.PI), shell);
  band.scale.set(1, 1.05, 2.2);
  const pad = mesh(new THREE.TorusGeometry(R - 0.75, 0.42, 20, 100, Math.PI * 0.62), soft1);
  pad.rotation.z = Math.PI * 0.19;
  pad.scale.set(1, 1.05, 2.2);
  const top = group(band, pad);
  top.position.y = 10.6;
  const parts = [top];
  for (const s of [-1, 1]) {
    const yoke = at(rbox(0.8, 3.2, 1.2, 0.3, chrome("#9aa1aa")), s * R, 9.4, 0);
    const cupShell = lathe(roundedWall(4.1, -1.6, 1.6, 1.0, 0.7, 10), shell, 96);
    cupShell.rotation.z = (s * Math.PI) / 2;
    const cushionRing = mesh(new THREE.TorusGeometry(3.25, 1.05, 24, 80), soft1);
    cushionRing.rotation.y = Math.PI / 2;
    cushionRing.position.x = -s * 1.75;
    cushionRing.scale.set(1.35, 1, 1);
    const plate = disc(2.6, 0.35, satin(accent ?? hex), 0.15);
    plate.rotation.y = (s * Math.PI) / 2;
    plate.position.x = s * 1.62;
    const cup = group(cupShell, cushionRing, plate);
    cup.position.set(s * (R + 0.4), 4.6, 0);
    cup.scale.set(1, 1.18, 1);
    parts.push(yoke, cup);
    if (accent) {
      const ring = mesh(new THREE.TorusGeometry(2.75, 0.09, 12, 80), led(accent, 2.6));
      ring.rotation.y = Math.PI / 2;
      ring.position.set(s * (R + 2.25), 4.6, 0);
      ring.scale.set(1, 1.18, 1);
      parts.push(ring);
    }
  }
  if (logo) {
    const l = print(3, 0.8, [{ text: logo, size: 140, color: "#aab2bd", track: 0.4 }]);
    l.rotation.y = Math.PI / 2;
    at(l, R + 2.28, 4.6, 0, 0, Math.PI / 2, 0);
    parts.push(l);
  }
  if (boom) {
    const pts = [[-(R + 2.0), 3.6, 1.2], [-(R + 2.6), 2.6, 4.2], [-(R + 2.0), 2.2, 7.5], [-(R + 0.2), 2.4, 9.6]];
    parts.push(tube(pts, 0.22, satin("#16191e"), 120));
    const tip = mesh(new THREE.CapsuleGeometry(0.42, 0.9, 8, 20), rubber("#1a1d22"));
    tip.rotation.set(0, 0, Math.PI / 2);
    tip.position.set(-(R - 0.4), 2.4, 9.9);
    parts.push(tip);
  }
  return group(...parts);
}

/** Palm-size round Bluetooth speaker on its edge, fabric front, strap loop. */
export function miniSpeaker(hex, { fabricHex = null } = {}) {
  const r = 4.7, t = 4.2;
  const body = disc(r, t, rubber(hex), 1.2);
  const front = mesh(new THREE.CircleGeometry(r - 0.55, 96), fabricMat(fabricHex ?? hex, 14));
  front.position.z = t / 2 + 0.01;
  const ring = mesh(new THREE.TorusGeometry(r - 0.5, 0.12, 12, 96), satin(hex));
  ring.position.z = t / 2 - 0.02;
  const logo = at(print(3, 0.7, [{ text: "SONIX", size: 160, color: "#e4e8ee", track: 0.4 }]), 0, -r * 0.42, t / 2 + 0.03);
  const g = group(body, front, ring, logo);
  for (const [x, ic] of [[-1.1, "−"], [0, "▶"], [1.1, "+"]]) {
    const b = at(rbox(0.8, 0.25, 0.8, 0.12, rubber(hex)), x, r - 0.05, 0);
    g.add(b);
    void ic;
  }
  const loop = mesh(new THREE.TorusGeometry(1.0, 0.18, 12, 40), rubber("#22262c"));
  loop.position.set(r * 0.72, r * 0.72, -0.4);
  loop.rotation.z = -Math.PI / 4;
  g.add(loop);
  g.position.y = r;
  return group(g);
}

/** Tall party speaker with a glowing light ring and a fabric front. */
export function partySpeaker() {
  const W = 15, H = 26, D = 13;
  const body = at(rbox(W, H, D, 2.2, soft("#15181d")), 0, H / 2, 0);
  const grille = at(rbox(W - 1.6, H - 5, 0.3, 0.6, fabricMat("#22262d", 16)), 0, H / 2 - 1.2, D / 2 - 0.05);
  const parts = [body, grille];
  for (const [y, r, hex] of [[H * 0.62, 4.6, "#38e1ff"], [H * 0.27, 3.6, "#9a6bff"]]) {
    const ring = mesh(new THREE.TorusGeometry(r, 0.22, 16, 120), led(hex, 3));
    ring.position.set(0, y, D / 2 + 0.25);
    parts.push(ring);
    const inner = mesh(new THREE.CircleGeometry(r - 0.25, 64), new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 1, transparent: true, opacity: 0.08 }));
    inner.position.set(0, y, D / 2 + 0.2);
    parts.push(inner);
  }
  parts.push(at(print(6, 1.2, [{ text: "SONIX", size: 190, color: "#e8edf3", track: 0.45 }]), 0, H - 4.7, D / 2 + 0.25));
  // Top control strip and carry strap.
  parts.push(at(rbox(9, 0.3, 3, 0.15, satin("#0b0d10")), 0, H + 0.02, 1.6));
  for (const x of [-3, -1, 1, 3]) parts.push(at(cyl(0.45, 0.45, 0.2, rubber("#2a2f37"), 24), x, H + 0.15, 1.6));
  parts.push(tube([[-5.5, H - 0.4, -2.5], [-4, H + 3.4, -2.6], [0, H + 4.4, -2.7], [4, H + 3.4, -2.6], [5.5, H - 0.4, -2.5]], 0.45, rubber("#101216"), 120));
  return group(...parts);
}

// ---------------------------------------------------------------- wearables
export function watchFace({ accent = "#5ad8ff" } = {}) {
  return screenTex(1024, 1024, (g, w) => {
    const c = w / 2;
    // Activity rings.
    for (const [r, hex, end] of [[440, "#ff3d7f", 1.55], [395, "#a3ff3d", 1.15], [350, accent, 0.8]]) {
      g.lineCap = "round";
      g.lineWidth = 34;
      g.strokeStyle = hex + "33";
      g.beginPath();
      g.arc(c, c, r, 0, Math.PI * 2);
      g.stroke();
      g.strokeStyle = hex;
      g.beginPath();
      g.arc(c, c, r, -Math.PI / 2, -Math.PI / 2 + end * Math.PI);
      g.stroke();
    }
    g.textAlign = "center";
    g.fillStyle = "#ffffff";
    g.font = "600 250px Jost";
    g.fillText("10:09", c, c + 60);
    g.font = "500 70px Jost";
    g.fillStyle = "#aab6c4";
    g.fillText("FRI 02", c, c - 160);
    g.fillStyle = accent;
    g.font = "600 66px Jost";
    g.fillText("♥ 72   ⚡ 8,432", c, c + 190);
  });
}

/** Strap loop (an extruded elliptical band) standing on the floor, its front at +z. */
function strapLoop(hex, { rz = 3.0, ry = 3.7, width = 2.2, thick = 0.32, holes = false } = {}) {
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, rz, ry, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, rz - thick, ry - thick, 0, Math.PI * 2, true, 0);
  shape.holes.push(hole);
  const band = mesh(new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 3, curveSegments: 96 }), silicone(hex));
  band.rotation.y = -Math.PI / 2;
  band.position.set(width / 2, ry, 0);
  const g = group(band);
  if (holes)
    for (let i = 0; i < 6; i++) {
      const a = -0.35 - i * 0.22;
      g.add(at(cyl(0.12, 0.12, 0.1, satin("#000000"), 16), 0, ry + Math.sin(a) * ry, -Math.cos(a) * rz + 0.02, Math.PI / 2 + a, 0, 0));
    }
  return g;
}

/** Round AMOLED smartwatch on its strap loop. */
export function watch(caseHex, strapHex, { accent = "#5ad8ff" } = {}) {
  const rz = 3.0, ry = 3.7;
  const loop = strapLoop(strapHex, { rz, ry });
  const head = new THREE.Group();
  const body = disc(2.35, 1.15, alu(caseHex), 0.45);
  const bezel = mesh(new THREE.TorusGeometry(2.12, 0.14, 16, 96), blackGlass());
  bezel.position.z = 0.56;
  const screen = mesh(new THREE.CircleGeometry(2.0, 96), screenMat(watchFace({ accent }), 1.1));
  screen.position.z = 0.6;
  const glassTop = mesh(new THREE.CircleGeometry(2.12, 96), clear({ roughness: 0.02, transmission: 0.95, thickness: 0.05 }));
  glassTop.position.z = 0.62;
  const crown = cyl(0.32, 0.32, 0.35, alu(caseHex), 32);
  crown.rotation.z = Math.PI / 2;
  crown.position.set(2.4, 0.45, 0);
  const btn = cyl(0.2, 0.2, 0.25, alu(caseHex), 24);
  btn.rotation.z = Math.PI / 2;
  btn.position.set(2.33, -0.65, 0);
  // Lugs where the strap joins.
  const lugs = [1, -1].map((s) => at(rbox(2.3, 0.9, 0.9, 0.3, alu(caseHex)), 0, s * 2.2, -0.15));
  head.add(body, bezel, screen, glassTop, crown, btn, ...lugs);
  head.position.set(0, ry, rz + 0.35);
  return group(loop, head);
}

/** Pill-shaped fitness band on its strap loop. */
export function band(strapHex) {
  const rz = 2.5, ry = 3.3;
  const loop = strapLoop(strapHex, { rz, ry, width: 1.7, thick: 0.26 });
  const pod = rbox(1.9, 4.3, 1.05, 0.5, glossy("#0b0d10"));
  const tex = screenTex(400, 900, (g, w, h) => {
    g.textAlign = "center";
    g.fillStyle = "#ffffff";
    g.font = "600 150px Jost";
    g.fillText("10", w / 2, h * 0.3);
    g.fillText("09", w / 2, h * 0.48);
    g.fillStyle = "#5ad8ff";
    g.font = "500 60px Jost";
    g.fillText("8,432", w / 2, h * 0.68);
    g.fillStyle = "#ff3d7f";
    g.fillText("♥ 72", w / 2, h * 0.8);
  });
  const scr = rbox(1.55, 3.6, 0.05, 0.4, screenMat(tex, 1.1));
  scr.position.z = 0.52;
  const head = group(pod, scr);
  head.position.set(0, ry, rz + 0.3);
  return group(loop, head);
}

/** A loose 22 mm strap lying flat, with holes and a steel buckle. */
export function flatStrap(hex) {
  const a = at(rbox(2.2, 0.3, 9.5, 0.12, silicone(hex)), 0, 0.15, -5.4);
  const b = at(rbox(2.2, 0.3, 7.5, 0.12, silicone(hex)), 0, 0.15, 4.4);
  const parts = [a, b];
  for (let i = 0; i < 7; i++) parts.push(at(cyl(0.13, 0.13, 0.04, satin("#050506"), 16), 0, 0.31, -2.2 - i * 0.95));
  const buckleShape = rrShape(2.7, 1.8, 0.5);
  buckleShape.holes.push(rrPath(2.1, 1.2, 0.3));
  const buckle = extrude(buckleShape, 0.18, chrome("#cfd5dc"), 0.04);
  buckle.rotation.x = -Math.PI / 2;
  buckle.position.set(0, 0.3, 1.2);
  parts.push(buckle);
  return group(...parts);
}

// ---------------------------------------------------------------- power
/** Upright power bank: logo, capacity print, LED dots or a digital screen, ports on top. */
export function powerBank(hex, { w = 6.8, h = 14, d = 1.5, cap = "10000mAh · 22.5W", screen = null, ports = ["c", "a"], light = "#e6ebf2", ring = false } = {}) {
  const body = at(rbox(w, h, d, Math.min(0.7, d / 2 - 0.01), soft(hex)), 0, h / 2, 0);
  const ink = light;
  const parts = [body];
  parts.push(at(print(w * 0.7, w * 0.16, [{ text: "VOLTRA", size: 170, color: ink, track: 0.45 }]), 0, h * 0.74, d / 2 + 0.01));
  parts.push(at(print(w * 0.8, w * 0.1, [{ text: cap, size: 110, weight: 500, color: ink, track: 0.12 }]), 0, h * 0.64, d / 2 + 0.01));
  if (screen) {
    const tex = screenTex(600, 300, (g, W, H) => {
      g.textAlign = "center";
      g.fillStyle = "#5ad8ff";
      g.font = "600 190px Jost";
      g.fillText(screen, W / 2, H * 0.72);
    });
    parts.push(at(rbox(w * 0.42, w * 0.21, 0.04, 0.2, screenMat(tex, 1.4)), 0, h * 0.3, d / 2 + 0.005));
  } else {
    for (let i = 0; i < 4; i++) parts.push(at(sphere(0.09, i < 3 ? led("#5ad8ff", 3) : satin("#3a4048")), -0.75 + i * 0.5, h * 0.2, d / 2 + 0.01));
  }
  if (ring) {
    const r = mesh(new THREE.TorusGeometry(2.4, 0.06, 12, 96), satin(light === "#e6ebf2" ? "#3d434c" : "#c8cdd4"));
    r.position.set(0, h * 0.4, d / 2 + 0.01);
    parts.push(r);
  }
  // Ports on the top edge.
  const xs = ports.map((_, i) => (i - (ports.length - 1) / 2) * 1.6);
  ports.forEach((p, i) => {
    const slot = p === "a" ? rbox(1.25, 0.06, 0.5, 0.03, satin("#050607")) : rbox(0.9, 0.06, 0.32, 0.12, satin("#050607"));
    parts.push(at(slot, xs[i], h + 0.0, 0));
  });
  return group(...parts);
}

/** Two-pin wall charger, ports on the front face, pins out of the back. */
export function wallCharger(hex, { s = 4, depth = 3, ports = ["c"], label = "20W", ink = "#5d6672" } = {}) {
  const body = rbox(s, s, depth, 0.55, glossy(hex));
  const parts = [body];
  ports.forEach((p, i) => {
    const y = (ports.length - 1) / 2 * 0.9 - i * 0.9;
    const slot = p === "a" ? port(1.3, 0.5, 0.06) : port(0.95, 0.34, 0.16);
    parts.push(at(slot, 0, y * 1.1, depth / 2));
    if (ports.length > 1) parts.push(at(print(0.7, 0.35, [{ text: p === "a" ? "A" : `C${i + 1}`, size: 300, color: ink }]), -1.25, y * 1.1, depth / 2 + 0.01));
  });
  parts.push(at(print(s * 0.7, s * 0.2, [{ text: label, size: 200, color: ink, track: 0.2 }]), 0, s / 2 + 0.01, 0, -Math.PI / 2, 0, Math.PI));
  for (const x of [-0.95, 0.95]) {
    const pin = cyl(0.24, 0.24, 1.9, chrome("#d9dde2"), 24);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(x, 0, -depth / 2 - 0.9);
    parts.push(pin);
  }
  const g = group(...parts);
  g.position.y = s / 2;
  return group(g);
}

/** Round Qi charging pad with a soft-touch top and the cable leaving the back. */
export function wirelessPad() {
  const base = disc(4.5, 0.95, satin("#16191e"), 0.4);
  base.rotation.x = 0;
  const b = lathe(roundedWall(4.5, 0, 0.95, 0.35, 0.4, 10), satin("#16191e"), 128);
  const top = mesh(new THREE.CircleGeometry(3.9, 96), soft("#24282f"));
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.96;
  const ring = mesh(new THREE.TorusGeometry(4.15, 0.05, 8, 96), satin("#3a4049"));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.92;
  const ledDot = at(rbox(0.6, 0.08, 0.12, 0.04, led("#5ad8ff", 3)), 0, 0.45, 4.48);
  const logo = print(2.4, 0.5, [{ text: "VOLTRA", size: 170, color: "#6f7884", track: 0.4 }]);
  logo.rotation.x = -Math.PI / 2;
  logo.position.set(0, 0.97, 1.6);
  const cable = tube([[0, 0.3, -4.4], [0.3, 0.3, -7.5], [3, 0.3, -10.5], [8, 0.3, -11.5], [14, 0.3, -10]], 0.22, satin("#121418"), 160);
  void base;
  return group(b, top, ring, ledDot, logo, cable);
}

/** USB-C plug: housing + metal tip, pointing along +z from the origin. */
function plug(hex, kind = "c", { metal = true } = {}) {
  const housing = at(rbox(1.05, 0.62, 2.4, 0.24, metal ? alu(hex) : glossy(hex)), 0, 0, 1.2);
  const boot = at(cyl(0.3, 0.38, 0.8, metal ? alu(hex) : glossy(hex), 24), 0, 0, -0.1, Math.PI / 2, 0, 0);
  let tip;
  if (kind === "lightning") tip = at(rbox(0.78, 0.15, 0.75, 0.06, chrome("#e8d9b6")), 0, 0, 2.75);
  else if (kind === "a") tip = at(rbox(1.25, 0.48, 1.2, 0.03, chrome()), 0, 0, 2.95);
  else tip = at(rbox(0.84, 0.27, 0.7, 0.13, chrome()), 0, 0, 2.75);
  return group(housing, boot, tip);
}

/** A loosely coiled cable lying on the floor with a plug at each end (leads leave the coil tangentially). */
export function cable(hex, { a = "c", b = "c", braided = true, plugHex = "#2b2f36", loops = 1.6, r = 6.8, metal = true } = {}) {
  const coil = [];
  const N = 120;
  for (let i = 0; i <= N; i++) {
    const t = i / N, ang = 0.6 + t * loops * Math.PI * 2;
    const rr = r * (1 - 0.16 * t);
    const cx = t * 1.4, cz = t * 0.9;
    // Later turns rest on earlier ones where they cross.
    coil.push(new THREE.Vector3(cx + Math.cos(ang) * rr, 0.22 + t * 0.32, cz + Math.sin(ang) * rr));
  }
  const tan = (i, j) => coil[j].clone().sub(coil[i]).normalize();
  const t0 = tan(1, 0), t1 = tan(N - 1, N);
  const lead = (p, dir, len) => [1, 2, 3].map((k) => p.clone().add(dir.clone().multiplyScalar((len * k) / 3)).setY(0.22));
  const pts = [...lead(coil[0], t0, 5).reverse(), ...coil, ...lead(coil[N], t1, 5)];
  const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
  const m = braided ? braid(hex, 300) : satin(hex);
  const cord = mesh(new THREE.TubeGeometry(curve, 1000, 0.21, 14, false), m);
  const p1 = atEnd(plug(plugHex, a, { metal }), curve, true);
  const p2 = atEnd(plug(plugHex, b, { metal }), curve, false);
  return group(cord, p1, p2);
}

// ---------------------------------------------------------------- mobile accessories
/** A phone (body + camera bump) that cases are shown on. */
export function phone(model = "iphone", hex = "#2d3b4c") {
  const w = 7.1, h = 14.7, d = 0.8;
  const body = rbox(w, h, d, 0.38, glossy(hex, { roughness: 0.35 }));
  const parts = [body];
  if (model === "iphone") {
    const bump = at(rbox(3.4, 3.4, 0.25, 0.75, glossy(hex, { roughness: 0.15 })), -w / 2 + 2.1, h / 2 - 2.1, d / 2 + 0.05);
    parts.push(bump);
    for (const [x, y] of [[-0.75, 0.75], [-0.75, -0.75], [0.75, 0]]) {
      parts.push(at(cyl(0.62, 0.62, 0.28, chrome("#8f99a6"), 48), -w / 2 + 2.1 + x, h / 2 - 2.1 + y, d / 2 + 0.25, Math.PI / 2, 0, 0));
      parts.push(at(cyl(0.48, 0.48, 0.3, blackGlass(), 48), -w / 2 + 2.1 + x, h / 2 - 2.1 + y, d / 2 + 0.27, Math.PI / 2, 0, 0));
    }
  } else {
    for (const y of [0, -1.6, -3.2]) {
      parts.push(at(cyl(0.6, 0.6, 0.22, chrome("#1b1d21"), 48), -w / 2 + 1.4, h / 2 - 1.6 + y, d / 2 + 0.08, Math.PI / 2, 0, 0));
      parts.push(at(cyl(0.45, 0.45, 0.24, blackGlass(), 48), -w / 2 + 1.4, h / 2 - 1.6 + y, d / 2 + 0.1, Math.PI / 2, 0, 0));
    }
  }
  return group(...parts);
}

/** Phone case on a phone, standing and leaning back, the case's back towards the camera. */
export function caseOnPhone({ kind = "clear", model = "iphone", phoneHex = "#2d3b4c" } = {}) {
  const w = 7.6, h = 15.2, depth = 1.15;
  const isClear = kind === "clear";
  const m = isClear ? clear({ roughness: 0.12, thickness: 0.15, attenuationColor: C("#e9f3ff"), attenuationDistance: 3 }) : soft("#141619", { roughness: 0.7 });
  const backShape = rrShape(w, h, 1.15);
  if (model === "iphone") backShape.holes.push(rrPath(3.8, 3.8, 0.95, -w / 2 + 2.25, h / 2 - 2.25));
  else backShape.holes.push(rrPath(1.6, 4.9, 0.8, -w / 2 + 1.45, h / 2 - 3.2));
  const back = extrude(backShape, 0.12, m, 0.04);
  back.position.z = depth - 0.12;
  const rimShape = rrShape(w, h, 1.15);
  rimShape.holes.push(rrPath(w - 0.36, h - 0.36, 0.95));
  const rim = extrude(rimShape, depth, m, 0.06);
  const parts = [back, rim];
  const ph = phone(model, phoneHex);
  ph.position.z = depth / 2 - 0.05;
  parts.push(ph);
  if (isClear) {
    // Magnet ring printed on the inside of the back.
    const ringM = new THREE.MeshPhysicalMaterial({ color: C("#f4f6f8"), roughness: 0.4 });
    const ring = mesh(new THREE.RingGeometry(2.25, 2.75, 96), ringM);
    ring.position.set(0, -0.6, depth - 0.11);
    parts.push(ring);
    parts.push(at(print(2.2, 0.4, [{ text: "SHIELDR", size: 180, color: "#c9d0d8", track: 0.45 }]), 0, -h / 2 + 1.6, depth + 0.02));
  } else {
    // Carbon texture panel and air-cushion corners.
    const carbon = screenTex(256, 256, (g) => {
      for (let y = 0; y < 256; y += 8) for (let x = 0; x < 256; x += 8) {
        g.fillStyle = (x + y) % 16 ? "#1c1f23" : "#26292e";
        g.fillRect(x, y, 8, 8);
      }
    });
    const panel = mesh(new THREE.PlaneGeometry(4.4, 6.5), new THREE.MeshPhysicalMaterial({ map: carbon, roughness: 0.5, clearcoat: 0.6 }));
    panel.position.set(0.6, -2.4, depth + 0.045);
    parts.push(panel);
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(at(sphere(0.55, soft("#141619")), x * (w / 2 - 0.45), y * (h / 2 - 0.45), depth / 2));
    parts.push(at(print(2.4, 0.45, [{ text: "SHIELDR", size: 180, color: "#7b8591", track: 0.45 }]), 0.6, -h / 2 + 1.6, depth + 0.05));
  }
  const g = group(...parts);
  g.rotation.x = -0.2;
  g.position.set(0, (h / 2) * Math.cos(0.2) + 0.25, -(h / 2) * Math.sin(0.2));
  return group(g);
}

/** Retail box with a printed front. */
export function retailBox(w, h, d, lines, { hex = "#111419", accent = "#22d3ee" } = {}) {
  const box = at(rbox(w, h, d, 0.08, satin(hex)), 0, h / 2, 0);
  const front = at(print(w * 0.92, h * 0.92, lines.map((l) => ({ color: "#e7ecf3", ...l })), { bg: null }), 0, h / 2, d / 2 + 0.01);
  const stripe = at(rbox(w, h * 0.04, 0.02, 0.01, led(accent, 1.2)), 0, h * 0.12, d / 2 + 0.01);
  return group(box, front, stripe);
}

/** Two tempered-glass sheets and the install frame in front of their box. */
export function glassPack() {
  const box = retailBox(9.4, 17.5, 1.8, [
    { text: "SHIELDR", size: 120, track: 0.5 },
    { text: "9H TEMPERED GLASS", size: 64, gap: 60, weight: 500 },
    { text: "2 PACK · INSTALL FRAME", size: 48, gap: 40, weight: 500, color: "#22d3ee" },
  ]);
  box.rotation.x = -0.18;
  box.position.set(-2.5, 0.8, -5);
  const sheetM = clear({ roughness: 0.02, thickness: 0.05, attenuationColor: C("#cfe9ff"), attenuationDistance: 2 });
  const s1 = at(rbox(7.1, 0.06, 14.6, 0.03, sheetM), 3.2, 0.05, 2.4, 0, -0.32, 0);
  const s2 = at(rbox(7.1, 0.06, 14.6, 0.03, sheetM), 4.1, 0.13, 2.9, 0, -0.18, 0);
  const frameShape = rrShape(8.4, 16, 1.1);
  frameShape.holes.push(rrPath(7.3, 14.9, 0.9));
  const frame = extrude(frameShape, 0.5, satin("#0d0f12"), 0.04);
  frame.rotation.x = -Math.PI / 2;
  frame.position.set(-4.2, 0, 4.5);
  frame.rotation.z = 0.25;
  return group(box, s1, s2, frame);
}

/** Air-vent car holder: cradle with side arms, back plate and the vent hook. */
export function carHolder() {
  const m = soft("#15181c");
  const plate = at(rbox(7.2, 8.4, 0.6, 0.5, m), 0, 5.6, 0);
  const cradle = at(rbox(7.6, 1.2, 2.2, 0.45, m), 0, 1.4, 0.9);
  const parts = [plate, cradle];
  for (const s of [-1, 1]) {
    parts.push(at(rbox(1.1, 6.2, 2.2, 0.4, m), s * 4.1, 4.4, 0.9));
    parts.push(at(rbox(0.25, 4.5, 1.4, 0.1, silicone("#2b3038")), s * 3.5, 4.5, 1.2));
  }
  parts.push(at(rbox(5.4, 0.25, 1.4, 0.1, silicone("#2b3038")), 0, 2.05, 1.2));
  parts.push(at(cyl(1.3, 1.3, 1.4, chrome("#9aa2ac"), 48), 0, 6, -1, Math.PI / 2, 0, 0));
  parts.push(at(rbox(1, 1, 3.6, 0.3, m), 0, 6, -3.4));
  parts.push(at(rbox(3.2, 0.5, 0.5, 0.2, m), 0, 6.4, -5.1));
  parts.push(at(print(2.4, 0.4, [{ text: "SHIELDR", size: 180, color: "#6f7985", track: 0.45 }]), 0, 8.6, 0.31));
  return group(...parts);
}

// ---------------------------------------------------------------- gaming
/** Wireless controller lying flat, face up, grips towards the camera. */
export function controller(hex, { accent = "#5ad8ff", buttons = "#1b1e23" } = {}) {
  const shell = satin(hex);
  const T = 2.4;
  const body = at(rbox(10.2, T, 5.6, 1.15, shell), 0, T / 2, -0.4);
  const parts = [body];
  for (const s of [-1, 1]) {
    const grip = mesh(new THREE.CapsuleGeometry(1.6, 3.4, 10, 32), shell);
    grip.rotation.set(Math.PI / 2 - 0.25, 0, -s * 0.42, "YXZ");
    grip.position.set(s * 3.7, 1.25, 1.9);
    grip.scale.set(1, 1, 0.78);
    parts.push(grip);
    parts.push(at(rbox(2.6, 0.75, 1.1, 0.35, satin(hex)), s * 3.3, T - 0.1, -3.05));
  }
  const top = T;
  const stick = (x, z) => {
    const ring = mesh(new THREE.TorusGeometry(1.15, 0.12, 12, 48), satin("#0b0d10"));
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, top + 0.02, z);
    const shaft = at(cyl(0.45, 0.5, 0.7, satin("#16181c"), 32), x, top + 0.35, z);
    const capM = rubber("#1e2126");
    const cap = at(cyl(0.95, 0.9, 0.35, capM, 48), x, top + 0.85, z);
    const glowRing = mesh(new THREE.TorusGeometry(1.25, 0.05, 8, 64), led(accent, 2.2));
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.set(x, top + 0.03, z);
    return [ring, shaft, cap, glowRing];
  };
  parts.push(...stick(-2.9, -1.2), ...stick(1.7, 1.0));
  // D-pad
  parts.push(at(rbox(1.9, 0.3, 0.6, 0.12, satin(buttons)), -1.7, top + 0.12, 1.0), at(rbox(0.6, 0.3, 1.9, 0.12, satin(buttons)), -1.7, top + 0.12, 1.0));
  // Face buttons
  for (const [dx, dz] of [[0, -0.85], [0.85, 0], [0, 0.85], [-0.85, 0]]) parts.push(at(cyl(0.38, 0.38, 0.32, glossy(buttons), 32), 3.0 + dx, top + 0.12, -1.25 + dz));
  // Home button with a lit ring, and two small menu buttons.
  parts.push(at(cyl(0.5, 0.5, 0.15, glossy("#0b0d10"), 32), 0, top + 0.06, -2.2));
  const home = mesh(new THREE.TorusGeometry(0.55, 0.06, 8, 48), led(accent, 3));
  home.rotation.x = Math.PI / 2;
  home.position.set(0, top + 0.08, -2.2);
  parts.push(home);
  for (const x of [-0.9, 0.9]) parts.push(at(rbox(0.5, 0.15, 0.3, 0.07, glossy(buttons)), x, top + 0.06, -0.9));
  return group(...parts);
}

/** Lightweight gaming mouse (front towards -z) with an RGB skirt and a paracord cable. */
export function gamingMouse(hex = "#121417", { rgb = "#38e1ff", cableHex = "#1a1d22", office = false, logo = true } = {}) {
  const shell = office ? glossy(hex) : satin(hex);
  const top = mesh(new THREE.SphereGeometry(1, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), shell);
  top.scale.set(3.1, 2.3, 6.1);
  top.position.y = 0.45;
  const skirt = at(cyl(1, 1, 0.45, office ? satin("#2a2e35") : led(rgb, 1.6), 64), 0, 0.23, 0);
  skirt.scale.set(3.1, 1, 6.1);
  const split = at(rbox(0.06, 0.3, 4.6, 0.02, satin("#030304")), 0, 2.45, -2.6, 0.32, 0, 0);
  const wheel = at(cyl(0.45, 0.45, 0.45, rubber("#2a2e34"), 32), 0, 2.55, -2.1, 0, 0, Math.PI / 2);
  const parts = [top, skirt, split, wheel];
  if (!office) {
    parts.push(at(rbox(0.25, 0.55, 1.1, 0.12, satin("#0b0c0e")), -3.0, 1.35, -0.6, 0, 0, 0.25));
    parts.push(at(rbox(0.25, 0.55, 1.1, 0.12, satin("#0b0c0e")), -3.0, 1.35, 0.7, 0, 0, 0.25));
    if (logo) {
      const l = print(1.2, 1.2, [{ text: "N", size: 640, color: rgb, weight: 700, track: 0 }], { emissive: 1.4 });
      l.rotation.x = -Math.PI / 2 + 0.45;
      l.position.set(0, 2.45, 2.4);
      parts.push(l);
    }
    parts.push(tube([[0, 0.55, -6.0], [0, 0.4, -9], [2, 0.3, -12], [6, 0.3, -13], [10, 0.3, -12]], 0.17, braid(cableHex, 120), 160));
  }
  return group(...parts);
}

// ---------------------------------------------------------------- smart home
export function smartPlug() {
  const body = at(rbox(5.6, 6.4, 5.6, 1.1, glossy("#f1f3f5")), 0, 3.2, 0);
  const face = screenTex(512, 512, (g, w) => {
    g.fillStyle = "#e9ecef";
    g.fillRect(0, 0, w, w);
    g.fillStyle = "#c9ced4";
    g.beginPath();
    g.arc(256, 256, 200, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#2a2f36";
    for (const [x, y, rw, rh] of [[176, 220, 34, 84], [302, 220, 34, 84]]) g.fillRect(x, y, rw, rh);
    for (const [x, y] of [[193, 352], [319, 352], [256, 150]]) {
      g.beginPath();
      g.arc(x, y, 20, 0, Math.PI * 2);
      g.fill();
    }
  });
  const faceM = new THREE.MeshPhysicalMaterial({ map: face, roughness: 0.3, clearcoat: 0.8 });
  const front = at(mesh(new THREE.CircleGeometry(2.45, 96), faceM), 0, 3.2, 2.81);
  const btn = at(cyl(0.6, 0.6, 0.18, glossy("#e5e8ec"), 32), 1.6, 6.45, 1.4);
  const ringLed = mesh(new THREE.TorusGeometry(0.66, 0.05, 8, 48), led("#5ad8ff", 3));
  ringLed.rotation.x = Math.PI / 2;
  ringLed.position.set(1.6, 6.42, 1.4);
  const logo = at(print(2, 0.4, [{ text: "lumio", size: 200, color: "#8a929c", track: 0.2, weight: 500 }]), 0, 0.75, 2.81);
  return group(body, front, btn, ringLed, logo);
}

export function smartBulb() {
  const glassM = new THREE.MeshPhysicalMaterial({ color: C("#fff4e2"), roughness: 0.55, transmission: 0.35, thickness: 0.6, emissive: C("#ffd9a0"), emissiveIntensity: 0.55 });
  // Classic A60 shape: a sphere on top tapering into the neck (profile from the neck up to the crown).
  const prof = [];
  for (let i = 0; i <= 24; i++) {
    const a = -0.95 + (i / 24) * (Math.PI / 2 + 0.95);
    prof.push([Math.cos(a) * 3.3, 7.6 + Math.sin(a) * 3.3]);
  }
  const dome = lathe([[1.75, 4.25], [2.1, 4.7], ...prof.map(([r, y]) => [Math.max(0.01, r), y])], glassM, 128);
  const neck = lathe([[1.8, 4.25], [1.65, 3.5], [1.35, 2.7], [1.25, 2.4]], glossy("#f2f3f5"), 96);
  const cap = at(cyl(1.15, 1.15, 2.2, chrome("#d6dbe0"), 48), 0, 1.3, 0);
  const base = at(cyl(0.6, 1.15, 0.25, satin("#1b1d21"), 48), 0, 0.12, 0);
  const pins = [-1, 1].map((s) => at(cyl(0.13, 0.13, 0.5, chrome(), 16), s * 1.3, 1.4, 0, 0, 0, Math.PI / 2));
  return group(dome, neck, cap, base, ...pins);
}

export function indoorCamera() {
  const m = glossy("#f3f4f6");
  const base = lathe(roundedWall(3.1, 0, 1.4, 0.3, 0.9, 10), m, 96);
  const stem = at(cyl(1.0, 1.4, 1.6, m, 48), 0, 2.0, 0);
  const head = at(sphere(3.5, m, 96), 0, 5.9, 0);
  const faceM = blackGlass();
  const face = mesh(new THREE.SphereGeometry(3.52, 96, 48, 0, Math.PI * 2, 0, 0.78), faceM);
  face.rotation.x = Math.PI / 2;
  face.position.set(0, 5.9, 0);
  const lensRing = at(cyl(0.95, 0.95, 0.12, chrome("#3d434c"), 48), 0, 6.2, 3.5, Math.PI / 2, 0, 0);
  const lens = at(sphere(0.7, blackGlass({ color: C("#0b1430") })), 0, 6.2, 3.45);
  const parts = [base, stem, head, face, lensRing, lens];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(at(sphere(0.07, satin("#2a1418")), Math.cos(a) * 1.6, 6.2 + Math.sin(a) * 1.6, 3.15));
  }
  parts.push(at(sphere(0.09, led("#5ad8ff", 3)), 1.4, 4.5, 3.05));
  parts.push(at(print(2, 0.4, [{ text: "lumio", size: 200, color: "#9aa2ad", track: 0.2, weight: 500 }]), 0, 3.1, 3.1, -0.45, 0, 0));
  return group(...parts);
}

// ---------------------------------------------------------------- computer accessories
/** Full-size keyboard with sculpted keycaps. */
export function keyboard(hex = "#16191d", keyHex = "#22262c") {
  const W = 41, D = 13.6;
  const base = at(rbox(W, 1.5, D, 0.6, satin(hex)), 0, 0.75, 0);
  const keyM = satin(keyHex, { roughness: 0.55 });
  const u = 1.9, cap = 1.62;
  const rows = [
    [1, 0.5, 1, 1, 1, 1, 0.25, 1, 1, 1, 1, 0.25, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2],
    [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5],
    [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25],
    [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75],
    [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25],
  ];
  const parts = [base];
  const x0 = -W / 2 + 0.9;
  rows.forEach((row, ri) => {
    let x = x0;
    const z = -D / 2 + 1.25 + ri * u * (ri === 0 ? 1 : 1) + (ri > 0 ? 0.35 : 0);
    row.forEach((wu, i) => {
      const gap = ri === 0 && (i === 1 || i === 6 || i === 11);
      if (!gap) parts.push(at(rbox(wu * u - (u - cap), 0.75, cap, 0.25, keyM), x + (wu * u) / 2, 1.85, z));
      x += wu * u;
    });
  });
  // Numpad
  for (let r = 1; r < 6; r++) for (let c2 = 0; c2 < 4; c2++) parts.push(at(rbox(cap, 0.75, cap, 0.25, keyM), W / 2 - 0.9 - u * 4 + c2 * u + u / 2, 1.85, -D / 2 + 1.25 + r * u + 0.35));
  return group(...parts);
}

/** Aluminium USB-C hub with ports on its front and a short cable. */
export function usbHub() {
  const body = at(rbox(11.4, 1.6, 3.4, 0.7, alu("#7d858f")), 0, 0.8, 0);
  const parts = [body];
  const f = 1.7 + 0.01;
  const portsX = [[-4.1, port(1.55, 0.55, 0.12)], [-2.0, port(1.3, 0.5, 0.04)], [-0.3, port(1.3, 0.5, 0.04)], [1.4, port(1.3, 0.5, 0.04)], [3.1, port(1.1, 0.22, 0.05)], [4.5, port(0.85, 0.32, 0.15)]];
  for (const [x, p] of portsX) parts.push(at(p, x, 0.8, f));
  parts.push(at(sphere(0.06, led("#5ad8ff", 3)), 5.3, 1.2, 1.72));
  const logo = print(3, 0.5, [{ text: "KEYRA", size: 190, color: "#3a4048", track: 0.45 }]);
  logo.rotation.x = -Math.PI / 2;
  logo.position.set(-1.5, 1.61, 0);
  parts.push(logo);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-5.6, 0.7, 0), new THREE.Vector3(-8, 0.5, 0.4), new THREE.Vector3(-11, 0.4, 3.5), new THREE.Vector3(-11.5, 0.4, 7.5)], false, "catmullrom", 0.4);
  parts.push(mesh(new THREE.TubeGeometry(curve, 200, 0.2, 12, false), braid("#5f6670", 80)));
  parts.push(atEnd(plug("#7d858f", "c"), curve));
  return group(...parts);
}

/** Portable SSD lying flat: aluminium top, rubber bumper, USB-C port at one end. */
export function portableSsd() {
  const bumper = at(rbox(8.7, 0.95, 5.7, 0.45, rubber("#121418")), 0, 0.48, 0);
  const top = at(rbox(7.9, 1.02, 4.9, 0.4, alu("#25292f")), 0, 0.5, 0);
  const logo = print(4.4, 1.6, [
    { text: "KEYRA", size: 150, color: "#e3e8ee", track: 0.45 },
    { text: "1TB · PORTABLE SSD", size: 62, gap: 40, weight: 500, color: "#5ad8ff" },
  ]);
  logo.rotation.x = -Math.PI / 2;
  logo.position.set(-0.6, 1.03, 0);
  const p = at(port(0.85, 0.3, 0.14), 4.36, 0.48, 0, 0, Math.PI / 2, 0);
  const ledDot = at(sphere(0.06, led("#5ad8ff", 3)), 3.6, 1.03, 2.0);
  return group(bumper, top, logo, p, ledDot);
}
