// @ts-nocheck
// Derive a display identity from a raw handle (phone/email). The CLI enriches
// this from the macOS AddressBook; the browser build has only the address, so
// we format it nicely and build a monogram.

/** Pretty-print a phone number or email for the conversation header. */
export function prettyId(addr) {
  const s = String(addr || "").trim();
  if (!s) return "Unknown";
  if (s.includes("@")) return s;
  const digits = s.replace(/[^\d]/g, "");
  if (digits.length === 11 && digits[0] === "1") {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return s;
}

/** A 1–2 char monogram for the avatar circle. */
export function monogram(addr) {
  const s = String(addr || "").trim();
  if (!s) return "?";
  if (s.includes("@")) return s[0].toUpperCase();
  const digits = s.replace(/[^\d]/g, "");
  return digits ? digits.slice(-2) : s.slice(0, 1).toUpperCase();
}

/** Build the { name, monogram, photoDataUri } identity the model expects. */
export function identityFor(addr) {
  return { name: prettyId(addr), monogram: monogram(addr), photoDataUri: null };
}
