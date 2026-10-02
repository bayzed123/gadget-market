// Product scenes: each export returns a THREE.Group standing on the floor (y = 0). The combo shots reuse the very same
// device factories, so a combo photo always shows the products it really contains.
import { at, group } from "./studio.js";
import {
  band, bud, budsCase, cable, carHolder, caseOnPhone, controller, flatStrap, gamingMouse, glassPack, headphones, indoorCamera, keyboard,
  miniSpeaker, partySpeaker, portableSsd, powerBank, retailBox, smartBulb, smartPlug, usbHub, wallCharger, watch, wirelessPad,
} from "./gear.js";

const BLACK = "#16181c";
const WHITE = "#eef0f3";

// ---------------------------------------------------------------- audio
export const budsPro = () =>
  group(at(budsCase(BLACK), 0, 0, 0, 0, -0.25, 0), at(bud(BLACK), 5.2, 1.0, 2.2, -1.2, 0.6, 0.2), at(bud(BLACK), 6.4, 1.0, -0.6, -1.3, 1.6, 0.1));
export const budsProOpen = () =>
  group(at(budsCase(WHITE, { open: true, logoColor: "#7d8692" }), -2.6, 0, 0, 0, 0.35, 0), at(budsCase(BLACK), 4.4, 0, -1.5, 0, -0.35, 0));
export const budsLite = () =>
  group(
    at(budsCase("#1f4fa8", { w: 5.4, h: 3.8, d: 2.6, logoColor: "#b9c6dc" }), -2.6, 0, 0, 0, 0.3, 0),
    at(budsCase(WHITE, { w: 5.4, h: 3.8, d: 2.6, logoColor: "#7d8692" }), 3.4, 0, -1.4, 0, -0.3, 0),
    at(bud("#1f4fa8", { stem: false }), 0.8, 0.95, 4.0, -1.0, 0.2, 0),
  );
export const wave500 = () => group(at(headphones(BLACK), 0, 0, 0, 0, 0.55, 0));
export const boomMini = () =>
  group(at(miniSpeaker("#1f4fa8"), -3.2, 0, 0, 0, 0.35, 0), at(miniSpeaker("#b3242c"), 6.8, 0, -4, 0, -0.25, 0));
export const party40 = () => group(at(partySpeaker(), 0, 0, 0, 0, -0.35, 0));

// ---------------------------------------------------------------- wearables
export const watchS2 = () => group(at(watch("#2a2e35", "#15171b"), 0, 0, 0, 0, -0.3, 0));
export const watchS2Duo = () =>
  group(at(watch("#2a2e35", "#15171b"), -3.6, 0, 0, 0, 0.25, 0), at(watch("#c9cdd3", "#d9dde2", { accent: "#8b7bff" }), 4.0, 0, -2.2, 0, -0.3, 0));
export const band5 = () =>
  group(at(band("#14171b"), -2.6, 0, 0, 0, 0.3, 0), at(band("#1c8f86"), 3.4, 0, -1.6, 0, -0.3, 0));
export const sportStrap = () =>
  group(at(flatStrap("#15171b"), -3.2, 0, 0, 0, 0.18, 0), at(flatStrap("#1d2c52"), 0, 0, -0.6, 0, 0.18, 0), at(flatStrap("#e8661f"), 3.2, 0, -1.2, 0, 0.18, 0));

// ---------------------------------------------------------------- power
export const bank10000 = () =>
  group(at(powerBank(BLACK), -2.4, 0, 0, 0, 0.3, 0), at(powerBank(WHITE, { light: "#4d5560" }), 4.8, 0, -2.6, 0, -0.25, 0));
export const bank20000 = () =>
  group(at(powerBank("#3b4149", { w: 7.4, h: 15.8, d: 2.7, cap: "20000mAh · 65W PD", screen: "87%", ports: ["c", "c", "a"] }), 0, 0, 0, 0, -0.3, 0), at(cable("#2b2f36", { r: 5.2, loops: 1.2 }), 7, 0, 5, 0, 0.6, 0));
export const magSnap = () =>
  group(
    at(powerBank(WHITE, { w: 6.6, h: 9.6, d: 1.5, cap: "MagSnap · 5000mAh", light: "#59616c", ports: ["c"], ring: true }), -2.4, 0, 0, -0.08, 0.3, 0),
    at(powerBank("#1c2333", { w: 6.6, h: 9.6, d: 1.5, cap: "MagSnap · 5000mAh", ports: ["c"], ring: true }), 4.6, 0, -2.4, -0.08, -0.3, 0),
  );
export const charger20 = () => group(at(wallCharger(WHITE), 0, 0, 0, 0, 0.6, 0), at(cable(WHITE, { braided: false, plugHex: WHITE, metal: false, r: 5.4, loops: 1.3 }), 2, 0, 6, 0, -0.5, 0));
export const gan65 = () => group(at(wallCharger(BLACK, { s: 5.2, depth: 3.2, ports: ["c", "c", "a"], label: "65W GaN", ink: "#8a939e" }), 0, 0, 0, 0, 0.55, 0));
export const gan65Duo = () =>
  group(
    at(wallCharger(BLACK, { s: 5.2, depth: 3.2, ports: ["c", "c", "a"], label: "65W GaN", ink: "#8a939e" }), -3.2, 0, 0, 0, 0.5, 0),
    at(wallCharger(WHITE, { s: 5.2, depth: 3.2, ports: ["c", "c", "a"], label: "65W GaN", ink: "#8d96a1" }), 4.0, 0, -2.4, 0, -0.45, 0),
  );
export const pad15 = () => group(at(wirelessPad(), 0, 0, 0, 0, -0.4, 0));
export const cableC = () => group(at(cable("#1b1e23"), 0, 0, 0, 0, 0.3, 0));
export const cableLightning = () => group(at(cable(WHITE, { b: "lightning", plugHex: "#f1f3f5", metal: false }), 0, 0, 0, 0, 0.3, 0));

// ---------------------------------------------------------------- mobile accessories
export const clearCase = () =>
  group(at(caseOnPhone({ kind: "clear", model: "iphone", phoneHex: "#3a4a5e" }), -3.6, 0, 0, 0, 0.3, 0), at(caseOnPhone({ kind: "clear", model: "iphone", phoneHex: "#cfc6b8" }), 4.4, 0, -3, 0, -0.25, 0));
export const ruggedCase = () => group(at(caseOnPhone({ kind: "rugged", model: "s24", phoneHex: "#2b2e33" }), 0, 0, 0, 0, -0.3, 0));
export const temperedGlass = () => group(glassPack());
export const holder = () => group(at(carHolder(), 0, 0, 0, 0, 0.5, 0));

// ---------------------------------------------------------------- gaming
export const proController = () =>
  group(at(controller("#15171b"), -1.4, 0, 1.6, 0, 0.2, 0), at(controller("#e9ebee", { buttons: "#cfd3d8" }), 4.6, 0, -6.2, 0, -0.2, 0));
export const mouse = () => group(at(gamingMouse(), 0, 0, 0, 0, 2.6, 0));
export const headset = () => group(at(headphones("#121417", { accent: "#38e1ff", boom: true, logo: "NEXPLAY", cushion: "#24272d" }), 0, 0, 0, 0, 0.6, 0));

// ---------------------------------------------------------------- smart home
export const plug = () => group(at(smartPlug(), 0, 0, 0, 0, -0.45, 0));
export const bulb = () => group(at(smartBulb(), 0, 0, 0, 0, 0, 0));
export const camera = () => group(at(indoorCamera(), 0, 0, 0, 0, -0.35, 0));

// ---------------------------------------------------------------- computer accessories
export const k3Combo = () => group(at(keyboard(), -4.5, 0, 0, 0, 0.1, 0), at(gamingMouse("#16191d", { office: true }), 19.5, 0, 4.5, 0, -0.25, 0, 0.9));
export const hub = () => group(at(usbHub(), 0, 0, 0, 0, -0.35, 0));
export const ssd = () => group(at(portableSsd(), 0, 0, 0, 0, -0.45, 0), at(cable("#1b1e23", { r: 4.6, loops: 1.1 }), -9.5, 0, 2.5, 0, 0.4, 0));

// ---------------------------------------------------------------- combos: the box behind, the products in front
const comboBox = (name, sub) =>
  retailBox(22, 13, 4, [
    { text: "GADGET MARKET COMBO", size: 50, track: 0.5, color: "#22d3ee" },
    { text: name, size: 92, gap: 40 },
    { text: sub, size: 46, gap: 30, weight: 500, color: "#aab4c0" },
  ]);
export const iphoneCombo = () =>
  group(
    at(comboBox("iPhone Charging", "20W CHARGER · LIGHTNING CABLE · 9H GLASS"), 0, 0, -9, -0.12, 0, 0),
    at(wallCharger(WHITE), -7, 0, 2.5, 0, 0.6, 0),
    at(cable(WHITE, { b: "lightning", plugHex: "#f1f3f5", metal: false, r: 4.6, loops: 1.2 }), 1.5, 0, 4.5, 0, 0.2, 0),
    at(glassPack(), 9.5, 0, 0, 0, -0.35, 0, 0.62),
  );
export const laptopCombo = () =>
  group(
    at(comboBox("Laptop Power", "65W GaN · 100W CABLE · 7-IN-1 HUB"), 0, 0, -9, -0.12, 0, 0),
    at(wallCharger(BLACK, { s: 5.2, depth: 3.2, ports: ["c", "c", "a"], label: "65W GaN", ink: "#8a939e" }), -8, 0, 2, 0, 0.6, 0),
    at(cable("#1b1e23", { r: 4.6, loops: 1.2 }), 0, 0, 5, 0, 0.2, 0),
    at(usbHub(), 8.5, 0, 1.5, 0, -0.5, 0, 0.85),
  );
export const gamingCombo = () =>
  group(
    at(comboBox("Gaming Starter", "CONTROLLER · H7 HEADSET · RGB MOUSE"), 0, 0, -10, -0.12, 0, 0),
    at(headphones("#121417", { accent: "#38e1ff", boom: true, logo: "NEXPLAY", cushion: "#24272d" }), -8, 0, -1, 0, 0.7, 0, 0.62),
    at(controller("#15171b"), 2.5, 0, 4, 0, 0.15, 0),
    at(gamingMouse(), 11, 0, 1, 0, 2.6, 0, 0.9),
  );

export const SCENES = {
  budsPro, budsProOpen, budsLite, wave500, boomMini, party40,
  watchS2, watchS2Duo, band5, sportStrap,
  bank10000, bank20000, magSnap, charger20, gan65, gan65Duo, pad15, cableC, cableLightning,
  clearCase, ruggedCase, temperedGlass, holder,
  proController, mouse, headset,
  plug, bulb, camera,
  k3Combo, hub, ssd,
  iphoneCombo, laptopCombo, gamingCombo,
};
