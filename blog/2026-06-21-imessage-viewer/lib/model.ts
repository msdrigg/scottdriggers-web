// @ts-nocheck
// Browser port of src/lib/model.js. Identical logic; only imports changed.
// `row.attributedBody` arrives from sql.js as a Uint8Array — Buffer.from()
// (polyfilled) wraps it the same way node:sqlite's Buffer did.
import { macAbsToDate } from "./db";
import { parseAttributedBody } from "./typedstream";
import { parseEditVersions, parseAppPayload } from "./balloons";

const OBJ_REPLACEMENT = "￼"; // attachment placeholder character

const EFFECT_NAMES = {
  "com.apple.MobileSMS.expressivesend.impact": "Slam",
  "com.apple.MobileSMS.expressivesend.loud": "Loud",
  "com.apple.MobileSMS.expressivesend.gentle": "Gentle",
  "com.apple.MobileSMS.expressivesend.invisibleink": "Invisible Ink",
  "com.apple.messages.effect.CKHappyBirthdayEffect": "Celebration",
  "com.apple.messages.effect.CKConfettiEffect": "Confetti",
  "com.apple.messages.effect.CKHeartEffect": "Love",
  "com.apple.messages.effect.CKLasersEffect": "Lasers",
  "com.apple.messages.effect.CKFireworksEffect": "Fireworks",
  "com.apple.messages.effect.CKSparklesEffect": "Spotlight",
  "com.apple.messages.effect.CKShootingStarEffect": "Shooting Star",
  "com.apple.messages.effect.CKEchoEffect": "Echo",
  "com.apple.messages.effect.CKSpotlightEffect": "Spotlight",
};
function effectName(id) {
  if (!id) return null;
  if (EFFECT_NAMES[id]) return EFFECT_NAMES[id];
  const m = /CK([A-Za-z]+?)Effect$/.exec(id) || /expressivesend\.([a-z]+)$/.exec(id);
  if (m) return m[1].replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^\w/, (c) => c.toUpperCase());
  return null;
}

const REACTION_TYPES = {
  2000: { kind: "love", glyph: "❤" },
  2001: { kind: "like", glyph: "👍" },
  2002: { kind: "dislike", glyph: "👎" },
  2003: { kind: "laugh", glyph: "HA\nHA" },
  2004: { kind: "emphasize", glyph: "‼" },
  2005: { kind: "question", glyph: "?" },
};
const REACTION_ADD_MIN = 2000;
const REACTION_ADD_MAX = 2007;
const REACTION_REMOVE_MIN = 3000;
const REACTION_REMOVE_MAX = 3007;

export function decodeMessageText(row) {
  if (row.text != null && row.text !== "") return row.text;
  if (row.attributedBody) {
    const parsed = parseAttributedBody(Buffer.from(row.attributedBody));
    if (parsed && parsed.text) return parsed.text;
  }
  return "";
}

export function decodeSubject(row) {
  return row.subject != null && row.subject !== "" ? String(row.subject).trim() : "";
}

function systemEventText(row, who) {
  const actor = row.is_from_me ? "You" : who || "They";
  switch (row.item_type) {
    case 1:
      return row.group_action_type === 1
        ? `${actor} removed someone from the conversation`
        : `${actor} added someone to the conversation`;
    case 2:
      return `${actor} changed the group name`;
    case 3:
      return `${actor} left the conversation`;
    case 4:
      return `${actor} shared their location`;
    default:
      return "";
  }
}

export function decodeAudioTranscript(row) {
  if (!row.is_audio_message || !row.attributedBody) return "";
  try {
    const parsed = parseAttributedBody(Buffer.from(row.attributedBody));
    return parsed && parsed.audioTranscription ? parsed.audioTranscription : "";
  } catch {
    return "";
  }
}

function tapbackTargetGuid(assocGuid) {
  if (!assocGuid) return null;
  const slash = assocGuid.lastIndexOf("/");
  if (slash >= 0) return assocGuid.slice(slash + 1);
  const colon = assocGuid.indexOf(":");
  return colon >= 0 ? assocGuid.slice(colon + 1) : assocGuid;
}

const URL_BALLOON = "com.apple.messages.URLBalloonProvider";

function classifyAttachment(att) {
  const mime = (att.mime_type || "").toLowerCase();
  const uti = (att.uti || "").toLowerCase();
  const name = (att.transfer_name || att.filename || "").toLowerCase();
  if (att.is_sticker) return "sticker";
  if (mime.startsWith("image/") || uti.includes("image") || /\.(heic|heif|jpg|jpeg|png|gif|webp|tiff?|bmp)$/.test(name))
    return "image";
  if (mime.startsWith("video/") || uti.includes("movie") || uti.includes("video") || /\.(mov|mp4|m4v|3gp)$/.test(name))
    return "video";
  if (mime.startsWith("audio/") || uti.includes("audio") || /\.(caf|m4a|amr|wav|mp3|aac)$/.test(name))
    return "audio";
  if (uti.includes("vcard") || /\.vcf$/.test(name) || mime.includes("vcard")) return "contact";
  if (uti.includes("location") || /\.(vlocation|loc)$/.test(name) || mime.includes("location")) return "location";
  return "file";
}

function buildParts(row, text, attachments) {
  const audioMeta = {
    isVoiceMessage: !!row.is_audio_message,
    expireState: row.expire_state || 0,
    isPlayed: !!row.is_played,
    transcript: row.is_audio_message ? decodeAudioTranscript(row) : "",
  };
  const parts = [];

  if (row.balloon_bundle_id === URL_BALLOON) {
    const imageAtts = attachments.slice().sort((a, b) => (b.total_bytes || 0) - (a.total_bytes || 0));
    parts.push({
      kind: "linkCard",
      url: text.trim(),
      payload: row.payload_data || null,
      imageAttachment: imageAtts[0] || null,
    });
    return parts;
  }
  if (row.balloon_bundle_id) {
    const decoded = row.payload_data ? parseAppPayload(row.payload_data) : null;
    parts.push({
      kind: "appCard",
      bundleId: row.balloon_bundle_id,
      text: text.trim(),
      caption: decoded?.caption || "",
      subtitle: decoded?.subtitle || "",
      imageDataUri: decoded?.imageDataUri || null,
    });
    return parts;
  }

  const atts = attachments.slice();
  if (atts.length && text.includes(OBJ_REPLACEMENT)) {
    const segments = text.split(OBJ_REPLACEMENT);
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i].trim();
      if (seg) parts.push({ kind: "text", text: seg });
      if (i < segments.length - 1) {
        const att = atts.shift();
        if (att) parts.push(attachmentPart(att, audioMeta));
      }
    }
    for (const att of atts) parts.push(attachmentPart(att, audioMeta));
    return parts;
  }

  for (const att of atts) parts.push(attachmentPart(att, audioMeta));
  const clean = text.replace(new RegExp(OBJ_REPLACEMENT, "g"), "").trim();
  if (clean) parts.push({ kind: "text", text: clean });
  return parts;
}

function attachmentPart(att, audioMeta) {
  const kind = classifyAttachment(att);
  const part = { kind, attachment: att };
  if (kind === "audio" && audioMeta) {
    part.isVoiceMessage = audioMeta.isVoiceMessage;
    part.expireState = audioMeta.expireState;
    part.isPlayed = audioMeta.isPlayed;
    part.transcript = audioMeta.transcript;
  }
  return part;
}

export function buildConversation(rows, attachmentsByMsg, identity, opts = {}) {
  const gapMs = (opts.gapMinutes ?? 60) * 60 * 1000;
  const recoverable = opts.recoverable || [];
  const includeDeleted = opts.includeDeleted !== false;
  for (const r of recoverable) r.__deleted = true;

  const byGuid = new Map();
  for (const r of rows) byGuid.set(r.guid, r);
  for (const r of recoverable) if (!byGuid.has(r.guid)) byGuid.set(r.guid, r);

  const timeline = includeDeleted
    ? [...rows, ...recoverable].sort((a, b) => Number(a.date) - Number(b.date) || a.rowid - b.rowid)
    : rows;

  const reactionsByTarget = new Map();
  for (const r of rows) {
    const t = r.associated_message_type;
    if (!t) continue;
    const isAdd = t >= REACTION_ADD_MIN && t <= REACTION_ADD_MAX;
    const isRemove = t >= REACTION_REMOVE_MIN && t <= REACTION_REMOVE_MAX;
    if (!isAdd && !isRemove) continue;
    const targetGuid = tapbackTargetGuid(r.associated_message_guid);
    if (!targetGuid) continue;
    if (!reactionsByTarget.has(targetGuid)) reactionsByTarget.set(targetGuid, new Map());
    const set = reactionsByTarget.get(targetGuid);
    const reactorKey = `${r.is_from_me ? "me" : "them"}`;
    const baseType = isAdd ? t : t - 1000;
    let kind,
      glyph,
      stickerGuid = null;
    if (REACTION_TYPES[baseType]) {
      ({ kind, glyph } = REACTION_TYPES[baseType]);
    } else {
      const atts = attachmentsByMsg.get(r.rowid) || [];
      const sticker =
        atts.find((a) => a.is_sticker) || atts.find((a) => /image|sticker/.test((a.uti || "") + (a.mime_type || "")));
      if (sticker) {
        kind = "sticker";
        glyph = "";
        stickerGuid = sticker.guid;
      } else {
        kind = "emoji";
        glyph = r.associated_message_emoji || "⭐";
      }
    }
    const slot = `${reactorKey}:${kind}:${glyph || stickerGuid}`;
    if (isAdd) {
      set.set(slot, { kind, glyph, fromMe: !!r.is_from_me, ts: r.date, stickerGuid });
    } else {
      set.delete(slot);
    }
  }

  const items = [];
  let lastTs = null;
  let lastSender = null;

  for (const r of timeline) {
    const at = r.associated_message_type;
    if ((at >= REACTION_ADD_MIN && at <= REACTION_ADD_MAX) || (at >= REACTION_REMOVE_MIN && at <= REACTION_REMOVE_MAX))
      continue;
    const date = macAbsToDate(r.date);
    if (!date) continue;

    if (r.item_type && r.item_type !== 0) {
      const sysText = decodeMessageText(r) || systemEventText(r, identity.name);
      if (sysText) items.push({ type: "system", text: sysText, date });
      lastTs = date.getTime();
      lastSender = null;
      continue;
    }

    const text = decodeMessageText(r);
    const attachments = attachmentsByMsg.get(r.rowid) || [];
    const parts = buildParts(r, text, attachments);

    const hasContent = parts.some((p) => (p.kind === "text" && p.text) || p.kind !== "text");
    if (!hasContent && !r.balloon_bundle_id) {
      continue;
    }

    const sender = r.is_from_me ? "me" : "them";
    const ts = date.getTime();

    const needSep = lastTs === null || ts - lastTs >= gapMs || !sameDay(new Date(lastTs), date);
    if (needSep) {
      items.push({ type: "sep", date });
      lastSender = null;
    }

    const rmap = reactionsByTarget.get(r.guid);
    const reactions = rmap ? [...rmap.values()] : [];

    let reply = null;
    if (r.thread_originator_guid) {
      const orig = byGuid.get(r.thread_originator_guid);
      if (orig) {
        const origText = decodeMessageText(orig).replace(new RegExp(OBJ_REPLACEMENT, "g"), "🖼").trim();
        reply = {
          sender: orig.is_from_me ? "me" : "them",
          snippet: origText || "Attachment",
          senderName: orig.is_from_me ? "You" : identity.name,
          deleted: !!orig.__deleted,
        };
      } else {
        reply = { sender: "them", snippet: "", senderName: "", deleted: true, missing: true };
      }
    }

    const startsGroup = sender !== lastSender;

    items.push({
      type: "bubble",
      sender,
      date,
      startsGroup,
      parts,
      reactions,
      reply,
      subject: decodeSubject(r),
      edited: !!r.date_edited,
      editHistory: r.date_edited && r.message_summary_info ? parseEditVersions(r.message_summary_info) : [],
      effect: effectName(r.expressive_send_style_id),
      unsent: !!r.date_retracted,
      deleted: !!r.__deleted,
      senderName: r.is_from_me ? "You" : identity.name,
      expressive: r.expressive_send_style_id || null,
      service: r.service,
      isDelivered: !!r.is_delivered,
      dateRead: r.date_read ? macAbsToDate(r.date_read) : null,
      guid: r.guid,
    });

    lastTs = ts;
    lastSender = sender;
  }

  for (let i = 0; i < items.length; i++) {
    if (items[i].type !== "bubble") continue;
    const next = items[i + 1];
    items[i].endsGroup = !next || next.type !== "bubble" || next.sender !== items[i].sender;
  }

  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].type === "bubble") {
      if (items[i].sender === "me" && !items[i].unsent && !items[i].deleted) {
        items[i].receipt = items[i].dateRead ? { kind: "read", date: items[i].dateRead } : { kind: "delivered" };
      }
      break;
    }
  }

  const days = [];
  let cur = null;
  for (const it of items) {
    const d = it.date;
    const key = dayKey(d);
    if (!cur || cur.dateKey !== key) {
      cur = { dateKey: key, date: startOfDay(d), items: [] };
      days.push(cur);
    }
    cur.items.push(it);
  }

  return { contact: identity, days };
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function dayKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
