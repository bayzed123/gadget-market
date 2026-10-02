/**
 * Brand identity — one file to rename or relocate the shop. The storefront HTML is filled from the same
 * JSON by scripts/build.mjs, and the owner can override contact details later in Admin → Settings → Store.
 *
 * ADJUSTABLE: the location (Dhaka), phone numbers, domain and palette are placeholders to confirm with the owner.
 */
import brand from "./brand.json";

export const BRAND = brand;
export type Brand = typeof brand;
