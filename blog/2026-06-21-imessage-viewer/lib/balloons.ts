// @ts-nocheck
// Browser port of src/lib/balloons.js — rich link previews, edited-message
// history, and app-message cards. Unchanged from the CLI except imports.
import { unarchive } from "./plist";
import { parseAttributedBody } from "./typedstream";

/** Extract LPLinkMetadata (title/siteName/summary/url) from a URL balloon payload. */
export function parseLinkMetadata(payloadBuf) {
  if (!payloadBuf) return null;
  try {
    const top = unarchive(Buffer.from(payloadBuf));
    const m = top?.root?.richLinkMetadata;
    if (!m) return null;
    const url =
      (typeof m.URL === "string" && m.URL) || (typeof m.originalURL === "string" && m.originalURL) || "";
    return {
      title: typeof m.title === "string" ? m.title : "",
      siteName: typeof m.siteName === "string" ? m.siteName : "",
      summary: typeof m.summary === "string" ? m.summary : "",
      url,
    };
  } catch {
    return null;
  }
}

/**
 * Decode an edited message's prior versions from `message_summary_info`.
 * Returns a flat, de-duplicated list of prior version strings (oldest first).
 */
export function parseEditVersions(summaryBuf) {
  if (!summaryBuf) return [];
  try {
    const top = unarchive(Buffer.from(summaryBuf));
    const ec = top && top.ec;
    if (!ec || typeof ec !== "object") return [];
    const out = [];
    for (const part of Object.keys(ec)) {
      const versions = Array.isArray(ec[part]) ? ec[part] : [];
      if (versions.length < 2) continue;
      const prior = versions.slice(0, -1);
      for (const v of prior) {
        const buf = v && v.t ? (Buffer.isBuffer(v.t) ? v.t : Buffer.from(v.t.data || v.t)) : null;
        if (!buf) continue;
        const parsed = parseAttributedBody(buf);
        const text = (parsed && parsed.text ? parsed.text : "").trim();
        if (text && out[out.length - 1] !== text) out.push(text);
      }
    }
    return out;
  } catch {
    return [];
  }
}

const IMG_MIME = (buf) => {
  if (!buf || buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  return null;
};

/**
 * Decode an app-message `payload_data` balloon (Apple Cash, Photos slideshow,
 * Find My, GamePigeon, …). Returns { caption, subtitle, imageDataUri }.
 */
export function parseAppPayload(payloadBuf) {
  if (!payloadBuf) return null;
  try {
    const top = unarchive(Buffer.from(payloadBuf));
    const root = (top && top.root) || top;
    if (!root || typeof root !== "object") return null;
    const ui = root.userInfo || {};
    const caption = (ui.caption || root.an || "").toString().trim();
    const subtitle = (root.ldtext || ui.subcaption || ui["secondary-subcaption"] || "").toString().trim();
    let imageDataUri = null;
    const img = root.ai || root.li;
    const buf = Buffer.isBuffer(img) ? img : img && img.data ? Buffer.from(img.data) : null;
    const mime = IMG_MIME(buf);
    if (buf && mime && buf.length <= 400 * 1024) {
      imageDataUri = `data:${mime};base64,${buf.toString("base64")}`;
    }
    if (!caption && !subtitle && !imageDataUri) return null;
    return { caption, subtitle, imageDataUri };
  } catch {
    return null;
  }
}
