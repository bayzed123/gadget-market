// Gadget photo studio: a large overhead softbox and two cool rim lights on a seamless dark graphite / slate / midnight
// sweep, physically based materials (anodised aluminium, glossy and soft-touch plastics, silicone, tempered glass,
// woven fabric, braided cable, lit screens and LEDs) and printed logos drawn with real fonts. The look of a tech
// product photograph — not an illustration. Units are centimetres.
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export { THREE };
export const C = (hex) => new THREE.Color(hex);

// ---------------------------------------------------------------- materials
export const plastic = (hex, o = {}) => new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 0.42, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5, ...o });
export const gloss = (hex, o = {}) => new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, ...o });
export const matte = (hex, o = {}) => new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 0.78, metalness: 0, sheen: 0.25, sheenColor: C("#ffffff"), ...o });
export const metal = (hex = "#f2c7b4", o = {}) => new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 0.28, metalness: 1, envMapIntensity: 1.8, ...o });
export const ROSE_GOLD = "#f2c7b4";
export const GOLD = "#e6c78f";
export const SILVER = "#e8e8ec";

/** Glass: clear, frosted (rough transmission) or tinted (amber, green, pink). */
export function glass(kind = "clear", o = {}) {
  const k = {
    clear: { color: "#ffffff", roughness: 0.02, att: "#f4fbff", dist: 40 },
    frosted: { color: "#ffffff", roughness: 0.42, att: "#ffffff", dist: 30 },
    pinkFrost: { color: "#ffe9ef", roughness: 0.38, att: "#f7b9c9", dist: 6 },
    amber: { color: "#ffd59a", roughness: 0.04, att: "#9c4a12", dist: 1.4 },
    sage: { color: "#eef7ee", roughness: 0.3, att: "#9cc3a2", dist: 5 },
    cobalt: { color: "#dfe8ff", roughness: 0.03, att: "#1f3a8a", dist: 1.2 },
    green: { color: "#e9f2dc", roughness: 0.04, att: "#3e5b22", dist: 1.6 },
  }[kind];
  return new THREE.MeshPhysicalMaterial({
    color: C(k.color),
    metalness: 0,
    roughness: k.roughness,
    transmission: 1,
    thickness: 0.35,
    ior: 1.5,
    attenuationColor: C(k.att),
    attenuationDistance: k.dist,
    specularIntensity: 1,
    envMapIntensity: 1.3,
    side: THREE.DoubleSide,
    ...o,
  });
}
/** Liquids and creams seen through glass. */
export const liquid = (hex, o = {}) =>
  new THREE.MeshPhysicalMaterial({ color: C("#ffffff"), roughness: 0.05, transmission: 0.96, thickness: 1.5, ior: 1.36, attenuationColor: C(hex), attenuationDistance: 1.6, ...o });
export const cream = (hex = "#fbf6f1", o = {}) => new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25, sheen: 0.4, sheenColor: C("#ffffff"), ...o });
export const silicone = (hex) => new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.3 });
export const water = () => new THREE.MeshPhysicalMaterial({ color: C("#ffffff"), roughness: 0, transmission: 1, thickness: 0.4, ior: 1.33, envMapIntensity: 2.2 });
export const leafMat = (hex = "#6f8f6a") => new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 0.48, sheen: 0.4, sheenColor: C("#cfe3c5"), side: THREE.DoubleSide });
export const petalMat = (hex = "#f2a7b8") =>
  new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 0.55, sheen: 1, sheenColor: C("#ffd9e3"), sheenRoughness: 0.4, transmission: 0.15, thickness: 0.05, side: THREE.DoubleSide });
export const cotton = () => new THREE.MeshPhysicalMaterial({ color: C("#fbfaf7"), roughness: 0.95, sheen: 1, sheenColor: C("#ffffff"), sheenRoughness: 0.8, roughnessMap: noiseTexture(256, 70, 40, 18) });

/** Fibrous paper texture (kraft, cream card) — flecks and fibres on a base colour. */
export function paperTexture(base = "#c9a77c", { size = 512, repeat = 1, fleck = 0.06 } = {}) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 30; i++) {
    const v = Math.random() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * fleck})`;
    g.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1);
  }
  g.strokeStyle = "rgba(60,40,20,0.08)";
  for (let i = 0; i < size / 2; i++) {
    const x = Math.random() * size, y = Math.random() * size, a = Math.random() * Math.PI;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}
export const kraft = (base = "#c49a6c", o = {}) => new THREE.MeshPhysicalMaterial({ map: paperTexture(base, { repeat: 2 }), roughness: 0.92, sheen: 0.15, sheenColor: C("#ffffff"), ...o });

/** Wood with long grain (boards, spoons, honey dippers). */
export function woodTexture(base = "#b08356", { size = 1024 } = {}) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < 160; i++) {
    const y = Math.random() * size, amp = 4 + Math.random() * 14, f = 0.002 + Math.random() * 0.006, ph = Math.random() * 6;
    g.strokeStyle = `rgba(${Math.random() < 0.5 ? "70,40,15" : "255,235,200"},${0.04 + Math.random() * 0.1})`;
    g.lineWidth = 1 + Math.random() * 3;
    g.beginPath();
    for (let x = 0; x <= size; x += 8) g.lineTo(x, y + Math.sin(x * f + ph) * amp);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const wood = (base = "#b08356", o = {}) => new THREE.MeshPhysicalMaterial({ map: woodTexture(base), roughness: 0.62, clearcoat: 0.15, clearcoatRoughness: 0.6, ...o });

/** Dry powder / ground spice. */
export const powder = (hex) => new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 1, roughnessMap: noiseTexture(256, 200, 50, 12), sheen: 0.1, bumpMap: noiseTexture(256, 128, 90, 24), bumpScale: 0.04 });

// ---------------------------------------------------------------- helpers
export function shadowed(o) {
  o.traverse?.((x) => {
    if (x.isMesh) {
      x.castShadow = !x.userData.noShadow;
      x.receiveShadow = true;
    }
  });
  return o;
}
export const mesh = (g, m) => shadowed(new THREE.Mesh(g, m));
export const group = (...children) => {
  const g = new THREE.Group();
  children.flat().forEach((c) => c && g.add(c));
  return g;
};
export const at = (o, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) => {
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  if (s !== 1) o.scale.setScalar(s);
  return o;
};
export const cyl = (rt, rb, h, m, seg = 96, open = false) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), m);
export const sphere = (r, m, seg = 48) => mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.6)), m);
/** Lathe from [radius, height] pairs (bottom → top), smooth. */
export const lathe = (pts, m, seg = 128) => mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), seg), m);

/** Rounded profile helper: a vertical wall from y0 to y1 at radius r with rounded bottom/top corners. */
export function roundedWall(r, y0, y1, rb = 0.4, rt = 0.4, steps = 8) {
  const pts = [[0, y0]];
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
    pts.push([r - rb + Math.cos(a) * rb, y0 + rb + Math.sin(a) * rb]);
  }
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2);
    pts.push([r - rt + Math.cos(a) * rt, y1 - rt + Math.sin(a) * rt]);
  }
  pts.push([0, y1]);
  return pts;
}

export function noiseTexture(size = 256, base = 128, amp = 30, repeat = 8) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = base + (Math.random() - 0.5) * amp;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  return t;
}

/** Travertine / limestone: warm stone with soft veins and pits. */
export function stoneTexture(tint = [236, 226, 212]) {
  const s = 1024;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const g = c.getContext("2d");
  g.fillStyle = `rgb(${tint.join(",")})`;
  g.fillRect(0, 0, s, s);
  for (let i = 0; i < 70; i++) {
    const y = Math.random() * s;
    g.strokeStyle = `rgba(${tint[0] - 60},${tint[1] - 62},${tint[2] - 66},${0.08 + Math.random() * 0.14})`;
    g.lineWidth = 1 + Math.random() * 6;
    g.beginPath();
    g.moveTo(0, y);
    for (let x = 0; x <= s; x += 32) g.lineTo(x, y + Math.sin(x / 90 + i) * 8 + (Math.random() - 0.5) * 6);
    g.stroke();
  }
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${tint[0] - 90},${tint[1] - 90},${tint[2] - 90},${Math.random() * 0.3})`;
    g.beginPath();
    g.ellipse(Math.random() * s, Math.random() * s, Math.random() * 5 + 0.5, Math.random() * 2 + 0.4, 0, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
export const stone = (tint) => new THREE.MeshPhysicalMaterial({ map: stoneTexture(tint), roughness: 0.72, roughnessMap: noiseTexture(256, 150, 60, 4), clearcoat: 0.05 });

// ---------------------------------------------------------------- labels
const FONTS_READY = (async () => {
  const faces = [
    new FontFace("Jost", "url(/fonts/jost.woff2)", { weight: "300 700" }),
    new FontFace("Cormorant", "url(/fonts/cormorant.woff2)", { weight: "300 700" }),
    new FontFace("Cormorant", "url(/fonts/cormorant-italic.woff2)", { weight: "300 700", style: "italic" }),
  ];
  for (const f of faces) document.fonts.add(await f.load());
})();
export const fontsReady = () => FONTS_READY;

/**
 * Draws a label onto a canvas. `lines` are drawn centred around the label's front (x = 0.5 of the printable band).
 * Each line: { text, font, size, color, track (letter-spacing em), gap (px before) }.
 * bg: background fill or null for a transparent screen-print on glass.
 */
export function labelCanvas({ w = 2048, h = 1024, bg = null, lines = [], frontAt = 0.5, band = null, rules = [] }) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (bg) {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
  }
  if (band) {
    g.fillStyle = band.color;
    g.fillRect(0, band.y * h, w, band.h * h);
  }
  const cx = frontAt * w;
  for (const r of rules) {
    g.fillStyle = r.color;
    g.fillRect(cx - (r.w * w) / 2, r.y * h, r.w * w, r.t ?? 3);
  }
  let y = 0;
  const total = lines.reduce((s, l) => s + (l.gap ?? 0) + l.size, 0);
  y = (h - total) / 2;
  for (const l of lines) {
    y += (l.gap ?? 0) + l.size;
    g.font = `${l.style ?? "normal"} ${l.weight ?? 400} ${l.size}px ${l.font ?? "Jost"}`;
    g.fillStyle = l.color ?? "#3a2a30";
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    if ("letterSpacing" in g) g.letterSpacing = `${(l.track ?? 0) * l.size}px`;
    const yy = l.y != null ? l.y * h : y - l.size * 0.18;
    g.fillText(l.text, cx + (l.track ?? 0) * l.size * 0.5, yy);
  }
  return c;
}
export function canvasTexture(c, o = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  Object.assign(t, o);
  return t;
}

/** A printed sleeve wrapped around a cylinder (radius r, height h, centred at y). arc = how much of the circumference it covers. */
export function sleeve(r, h, y, tex, { arc = Math.PI * 2, rough = 0.4, transparent = true, clearcoat = 0.3, start } = {}) {
  // CylinderGeometry puts theta = 0 at +z (towards the camera at yaw 0) and u grows towards +x, so text reads left→right.
  const thetaStart = start ?? -arc / 2;
  const g = new THREE.CylinderGeometry(r, r, h, 160, 1, true, thetaStart, arc);
  const m = new THREE.MeshPhysicalMaterial({ map: tex, transparent, roughness: rough, clearcoat, clearcoatRoughness: 0.2, alphaTest: transparent ? 0.02 : 0, polygonOffset: true, polygonOffsetFactor: -2 });
  const s = new THREE.Mesh(g, m);
  s.position.y = y;
  s.receiveShadow = true;
  s.userData.noShadow = true;
  return s;
}

/** A flat printed decal (for lids, sachets, boxes). */
export function decal(w, h, tex, o = {}) {
  const m = new THREE.MeshPhysicalMaterial({ map: tex, transparent: true, alphaTest: 0.02, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2, ...o });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  p.receiveShadow = true;
  return p;
}

// ---------------------------------------------------------------- studio + render
export const SWEEPS = {
  graphite: "#1b1e24",
  slate: "#252c36",
  midnight: "#141a26",
  steel: "#4a525e",
  mist: "#c9ced6",
  ink: "#0f1116",
};

/** Seamless studio sweep: floor that curves up into the back wall, with a faint satin sheen. */
function sweep(hex) {
  const W = 400, segU = 4, segV = 120;
  const g = new THREE.PlaneGeometry(1, 1, segU, segV);
  const pos = g.attributes.position;
  const R = 40, front = 140, back = 160;
  const L1 = front + 0, L2 = (Math.PI / 2) * R;
  const total = L1 + L2 + back;
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5;
    const v = pos.getY(i) + 0.5;
    const s = v * total;
    let y, z;
    if (s < L1) {
      z = front - s - 30;
      y = 0;
    } else if (s < L1 + L2) {
      const a = (s - L1) / R;
      z = -30 - Math.sin(a) * R;
      y = R - Math.cos(a) * R;
    } else {
      z = -30 - R;
      y = R + (s - L1 - L2);
    }
    pos.setXYZ(i, (u - 0.5) * W, y, z);
  }
  g.computeVertexNormals();
  const m = new THREE.MeshPhysicalMaterial({ color: C(hex), roughness: 0.62, roughnessMap: noiseTexture(256, 150, 20, 30), clearcoat: 0.35, clearcoatRoughness: 0.45 });
  m.envMapIntensity = 0.25;
  const mesh = new THREE.Mesh(g, m);
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Renders a model and returns a WebP data URL.
 * view: { size, yaw, pitch, dist, target, fov, sweep, exposure, sun: [x,y,z] direction, soft, rim: css colour }
 */
export function render(model, { size = 1200, yaw = 0, pitch = 0.32, dist = 40, target = [0, 6, 0], fov = 26, sweep: sw = "graphite", exposure = 1.0, sun = [-0.35, 1, 0.45], soft = 7, shadowArea = 30, envYaw = 0.4, rim = "#5ad8ff", rim2 = "#8b7bff", glow = true } = {}) {
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(2);
  renderer.setSize(size, size, false);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = C(SWEEPS[sw] ?? sw);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;
  scene.environmentIntensity = 0.75;
  scene.environmentRotation.y = envYaw;
  scene.add(sweep(SWEEPS[sw] ?? sw));

  // A large, soft overhead key (the softbox), a faint neutral fill and two cool rim lights that draw the edges.
  const dir = new THREE.Vector3(...sun).normalize();
  const key = new THREE.DirectionalLight(0xffffff, 3.6);
  key.position.copy(dir.clone().multiplyScalar(120)).add(new THREE.Vector3(target[0], 0, target[2]));
  key.target.position.set(target[0], 0, target[2]);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = soft;
  key.shadow.blurSamples = 25;
  key.shadow.bias = -0.0004;
  const cam = key.shadow.camera;
  cam.left = -shadowArea;
  cam.right = shadowArea;
  cam.top = shadowArea;
  cam.bottom = -shadowArea;
  cam.near = 20;
  cam.far = 260;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xf2f5ff, 0.45);
  fill.position.set(50, 30, 70);
  scene.add(fill);
  const r1 = new THREE.DirectionalLight(C(rim), 2.4);
  r1.position.set(-70, 25, -60);
  const r2 = new THREE.DirectionalLight(C(rim2), 1.6);
  r2.position.set(75, 20, -50);
  scene.add(r1, r2);
  scene.add(new THREE.HemisphereLight(0xdfe8ff, 0x101318, 0.15));
  if (glow) {
    // A soft coloured glow on the wall behind the product.
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, rim + "55");
    grd.addColorStop(1, rim + "00");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    halo.position.set(target[0], 40, -69);
    scene.add(halo);
  }

  scene.add(model);
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.5, 600);
  const t = new THREE.Vector3(...target);
  camera.position.set(t.x + dist * Math.sin(yaw) * Math.cos(pitch), t.y + dist * Math.sin(pitch), t.z + dist * Math.cos(yaw) * Math.cos(pitch));
  camera.lookAt(t);
  renderer.render(scene, camera);
  const out = document.createElement("canvas");
  out.width = out.height = size;
  const ctx = out.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, size, size);
  const url = out.toDataURL("image/webp", 0.9);
  renderer.dispose();
  pmrem.dispose();
  return url;
}
