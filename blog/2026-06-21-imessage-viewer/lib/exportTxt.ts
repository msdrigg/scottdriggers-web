// @ts-nocheck
// Plain-text export of a conversation model — a readable transcript suitable for
// archiving or searching. Walks the same model the HTML renderer uses.

const fmtDay = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const fmtTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

const REACTION_VERB = {
  love: "Loved",
  like: "Liked",
  dislike: "Disliked",
  laugh: "Laughed at",
  emphasize: "Emphasized",
  question: "Questioned",
};

function partToText(part) {
  switch (part.kind) {
    case "text":
      return part.text;
    case "image":
      return "[Photo]";
    case "sticker":
      return "[Sticker]";
    case "video":
      return "[Video]";
    case "audio": {
      const t = (part.transcript || "").trim();
      return t ? `[Voice message] “${t}”` : "[Voice message]";
    }
    case "contact":
      return "[Contact card]";
    case "location":
      return "[Location]";
    case "file":
      return "[Attachment]";
    case "linkCard":
      return part.url ? `[Link] ${part.url}` : "[Link]";
    case "appCard":
      return `[${(part.caption || "App message").trim()}]`;
    default:
      return "";
  }
}

function bubbleToLines(item, contactName) {
  const who = item.sender === "me" ? "You" : item.senderName || contactName || "Them";
  const time = fmtTime.format(item.date);
  const lines = [];

  if (item.unsent) {
    lines.push(`${time}  ${who} unsent a message.`);
    return lines;
  }

  if (item.reply && !item.reply.missing && item.reply.snippet) {
    lines.push(`${time}  ${who} (replying to “${item.reply.snippet}”):`);
  }

  const body = item.parts
    .map(partToText)
    .filter(Boolean)
    .join(" ");
  const prefix = item.reply && !item.reply.missing && item.reply.snippet ? "          " : `${time}  ${who}: `;
  lines.push(`${prefix}${body}`.trimEnd());

  if (item.edited) lines.push("          (edited)");
  if (item.deleted) lines.push("          (deleted)");
  if (item.editHistory && item.editHistory.length) {
    for (const v of item.editHistory) lines.push(`          (was: “${v}”)`);
  }
  for (const r of item.reactions || []) {
    const reactor = r.fromMe ? "You" : contactName || "Them";
    const verb = REACTION_VERB[r.kind] || `Reacted ${r.glyph || ""}`.trim();
    lines.push(`          ${reactor} ${verb.toLowerCase()} this message`);
  }
  return lines;
}

/** Build a plain-text transcript string from a conversation model. */
export function conversationToText(model) {
  const c = model.contact || {};
  const out = [];
  out.push(`Conversation with ${c.name || "Unknown"}`);
  const allItems = model.days.flatMap((d) => d.items).filter((it) => it.date);
  if (allItems.length) {
    const first = allItems[0].date;
    const last = allItems[allItems.length - 1].date;
    out.push(`${fmtDay.format(first)} – ${fmtDay.format(last)}`);
  }
  out.push("");

  for (const day of model.days) {
    out.push(`──────────  ${fmtDay.format(day.date)}  ──────────`);
    for (const it of day.items) {
      if (it.type === "sep") continue;
      if (it.type === "system") {
        out.push(`           — ${it.text} —`);
        continue;
      }
      if (it.type === "bubble") {
        for (const line of bubbleToLines(it, c.name)) out.push(line);
      }
    }
    out.push("");
  }
  return out.join("\n");
}

/** Trigger a browser download of `text` as a .txt file. */
export function downloadText(filename, text, mime = "text/plain") {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
