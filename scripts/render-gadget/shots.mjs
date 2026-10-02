// One entry per photo: which scene and the camera. Units are cm; `pitch` is the camera's angle above the floor
// (0 = eye level, 1.57 = straight down), `dist` its distance from `target`, `sweep` the backdrop, `rim` the edge light.
const v = (dist, ty, o = {}) => ({ dist, target: [0, ty, 0], pitch: 0.3, size: 1000, ...o });

export const SHOTS = [
  // Audio
  { file: "sonix-buds-pro", scene: "budsPro", view: v(30, 2.4, { target: [2, 2.4, 0.5], sweep: "graphite" }) },
  { file: "sonix-buds-pro-open", scene: "budsProOpen", view: v(30, 2.8, { target: [0.6, 2.8, 0], sweep: "slate", rim2: "#5ad8ff" }) },
  { file: "sonix-buds-lite", scene: "budsLite", view: v(28, 2.2, { target: [0.4, 2.2, 0.8], sweep: "midnight" }) },
  { file: "sonix-wave-500", scene: "wave500", view: v(58, 8.4, { sweep: "graphite", pitch: 0.22 }) },
  { file: "sonix-boom-mini", scene: "boomMini", view: v(44, 4.6, { target: [1.6, 4.6, -1], sweep: "slate", rim: "#4f8dff" }) },
  { file: "sonix-party-40", scene: "party40", view: v(80, 14.5, { sweep: "ink", pitch: 0.18, rim: "#38e1ff", rim2: "#9a6bff" }) },
  // Wearables
  { file: "arcwave-watch-s2", scene: "watchS2", view: v(24, 3.9, { sweep: "graphite", pitch: 0.2 }) },
  { file: "arcwave-watch-s2-duo", scene: "watchS2Duo", view: v(34, 3.8, { target: [0.2, 3.8, -0.8], sweep: "slate", pitch: 0.22, rim2: "#8b7bff" }) },
  { file: "arcwave-band-5", scene: "band5", view: v(30, 3.2, { target: [0.4, 3.2, -0.6], sweep: "midnight", pitch: 0.24 }) },
  { file: "arcwave-sport-strap", scene: "sportStrap", view: v(34, 0, { target: [0, 0, -0.5], sweep: "graphite", pitch: 1.05, yaw: 0.3 }) },
  // Power
  { file: "voltra-powerbank-10000", scene: "bank10000", view: v(44, 6.6, { target: [1.2, 6.6, -1], sweep: "graphite", pitch: 0.18 }) },
  { file: "voltra-powerbank-20000", scene: "bank20000", view: v(46, 7, { target: [2.5, 6.4, 1.5], sweep: "slate", pitch: 0.22 }) },
  { file: "voltra-magsnap-5000", scene: "magSnap", view: v(36, 4.6, { target: [1.1, 4.6, -1], sweep: "midnight", pitch: 0.2 }) },
  { file: "voltra-20w-charger", scene: "charger20", view: v(30, 1.8, { target: [1, 1.6, 2.5], sweep: "graphite", pitch: 0.42 }) },
  { file: "voltra-gan-65w", scene: "gan65", view: v(26, 2.6, { sweep: "slate", pitch: 0.3 }) },
  { file: "voltra-gan-65w-duo", scene: "gan65Duo", view: v(34, 2.6, { target: [0.4, 2.6, -1], sweep: "graphite", pitch: 0.28 }) },
  { file: "voltra-wireless-pad", scene: "pad15", view: v(34, 0.6, { target: [1.5, 0.6, -1.5], sweep: "midnight", pitch: 0.55 }) },
  { file: "voltra-usb-c-cable", scene: "cableC", view: v(46, 0, { target: [0, 0, 0], sweep: "slate", pitch: 1.1 }) },
  { file: "voltra-lightning-cable", scene: "cableLightning", view: v(46, 0, { target: [0, 0, 0], sweep: "graphite", pitch: 1.1 }) },
  // Mobile accessories
  { file: "shieldr-clear-case", scene: "clearCase", view: v(52, 7.4, { target: [0.4, 7.2, -1.5], sweep: "slate", pitch: 0.16, rim: "#7fe6ff" }) },
  { file: "shieldr-rugged-case", scene: "ruggedCase", view: v(40, 7.4, { sweep: "steel", pitch: 0.16 }) },
  { file: "shieldr-tempered-glass", scene: "temperedGlass", view: v(52, 4, { target: [0, 3, 0], sweep: "graphite", pitch: 0.55 }) },
  { file: "shieldr-car-holder", scene: "holder", view: v(34, 4.6, { sweep: "slate", pitch: 0.22, yaw: -0.25 }) },
  // Gaming
  { file: "nexplay-pro-controller", scene: "proController", view: v(48, 1, { target: [1.2, 1, -2.2], sweep: "ink", pitch: 0.72, rim: "#38e1ff", rim2: "#ff3d9a" }) },
  { file: "nexplay-gaming-mouse", scene: "mouse", view: v(34, 1.4, { target: [2.5, 1.4, -3], sweep: "ink", pitch: 0.42, rim: "#38e1ff", rim2: "#ff3d9a" }) },
  { file: "nexplay-gaming-headset", scene: "headset", view: v(58, 7.6, { target: [-1.5, 7.2, 1.5], sweep: "ink", pitch: 0.22, rim: "#38e1ff", rim2: "#ff3d9a" }) },
  // Smart home
  { file: "lumio-smart-plug", scene: "plug", view: v(28, 3.2, { sweep: "slate", pitch: 0.22 }) },
  { file: "lumio-smart-bulb", scene: "bulb", view: v(30, 4.4, { sweep: "ink", pitch: 0.12, rim: "#ffb35a", rim2: "#8b7bff" }) },
  { file: "lumio-indoor-camera", scene: "camera", view: v(34, 4.8, { sweep: "midnight", pitch: 0.16 }) },
  // Computer accessories
  { file: "keyra-k3-combo", scene: "k3Combo", view: v(66, 0.8, { target: [5, 0.8, 2], sweep: "graphite", pitch: 0.7 }) },
  { file: "keyra-usb-c-hub", scene: "hub", view: v(36, 0.8, { target: [-2, 0.8, 1.5], sweep: "slate", pitch: 0.5 }) },
  { file: "keyra-portable-ssd", scene: "ssd", view: v(36, 0.6, { target: [-3, 0.6, 1], sweep: "midnight", pitch: 0.62 }) },
  // Combos
  { file: "iphone-charging-combo", scene: "iphoneCombo", view: v(62, 5, { target: [0, 4, -1], sweep: "graphite", pitch: 0.38 }) },
  { file: "laptop-power-combo", scene: "laptopCombo", view: v(62, 5, { target: [0, 4, -1], sweep: "slate", pitch: 0.38 }) },
  { file: "gaming-starter-combo", scene: "gamingCombo", view: v(66, 5, { target: [0.5, 4, -1.5], sweep: "ink", pitch: 0.38, rim: "#38e1ff", rim2: "#ff3d9a" }) },
];
