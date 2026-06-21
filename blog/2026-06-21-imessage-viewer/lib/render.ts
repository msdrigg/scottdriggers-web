// @ts-nocheck
// Browser port of src/lib/render.js. Produces a complete, self-contained
// iMessage-styled HTML document (CSS inlined) — rendered into an <iframe>
// srcdoc so its global styles stay isolated from the Docusaurus page.
//
// Differences from the CLI: there is no local Attachments folder in the
// browser, so asset URLs always resolve to null and media (photos/video/voice)
// render as labelled "not downloaded" placeholders. Everything derived from the
// database itself — text, reactions, replies, link previews, app cards, edit
// history, voice-message transcripts — renders fully.
import { css } from "./styles";
import { parseLinkMetadata } from "./balloons";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,!?;:)\]}'"”’])/;
const EMAIL_RE = /([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/;
const PHONE_RE = /(\+?\d[\d().\-\s]{7,}\d)/;
const COMBINED = new RegExp(`${URL_RE.source}|${EMAIL_RE.source}|${PHONE_RE.source}`, "g");

function linkify(text) {
  let out = "";
  let last = 0;
  let m;
  COMBINED.lastIndex = 0;
  while ((m = COMBINED.exec(text)) !== null) {
    const [full] = m;
    const start = m.index;
    out += esc(text.slice(last, start));
    let href;
    if (m[1]) href = full;
    else if (m[2]) href = `mailto:${full}`;
    else {
      const digits = full.replace(/[^\d+]/g, "");
      if (digits.replace(/\D/g, "").length >= 10 && /[().\-\s]/.test(full)) href = `tel:${digits}`;
      else {
        out += esc(full);
        last = start + full.length;
        continue;
      }
    }
    out += `<a href="${esc(href)}" target="_blank" rel="noopener">${esc(full)}</a>`;
    last = start + full.length;
  }
  out += esc(text.slice(last));
  return out;
}

const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("en", { granularity: "grapheme" }) : null;
const EMOJI_RE = /^[\p{Extended_Pictographic}\p{Emoji_Component}‍️⃣\s]+$/u;
function isJumboEmoji(text) {
  const t = text.trim();
  if (!t || !EMOJI_RE.test(t)) return false;
  if (!segmenter) return t.length <= 6;
  const count = [...segmenter.segment(t)].filter((s) => s.segment.trim()).length;
  return count >= 1 && count <= 3;
}

const ICONS = {
  back: `<svg width="13" height="22" viewBox="0 0 13 22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 1.5 2 11l9 9.5"/></svg>`,
  video: `<svg width="25" height="25" viewBox="0 0 26 22" fill="currentColor"><rect x="1.5" y="4.5" width="15" height="13" rx="3.6"/><path d="M18 9.2l4.6-3c.66-.43 1.55.04 1.55.86v9.9c0 .82-.89 1.29-1.55.86L18 12.8z"/></svg>`,
  chevron: `<svg width="7" height="11" viewBox="0 0 7 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 1.5 5.5 5.5 1.5 9.5"/></svg>`,
  play: `<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M8 5.5v13l11-6.5z"/></svg>`,
  playSmall: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>`,
  pauseSmall: `<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>`,
  heart: (c) => `<svg viewBox="0 0 24 24" fill="${c}"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`,
  thumbup: `<svg viewBox="0 0 24 24" fill="#fff"><path d="M2 21h2.5V10H2v11zM22 11.2c0-1.05-.86-1.9-1.9-1.9h-5.4l.82-3.93.03-.35c0-.39-.16-.75-.42-1.01L14.2 3 8.6 8.6c-.35.34-.56.82-.56 1.34V19c0 1.05.86 1.9 1.9 1.9h8.04c.74 0 1.39-.45 1.66-1.1l2.55-5.97c.08-.2.12-.41.12-.63v-2z"/></svg>`,
  thumbdown: `<svg viewBox="0 0 24 24" fill="#fff"><path d="M22 3h-2.5v11H22V3zM2 12.8c0 1.05.86 1.9 1.9 1.9h5.4l-.82 3.93-.03.35c0 .39.16.75.42 1.01L9.8 21l5.6-5.6c.35-.34.56-.82.56-1.34V5c0-1.05-.86-1.9-1.9-1.9H6.02c-.74 0-1.39.45-1.66 1.1L1.81 10.2c-.08.2-.12.41-.12.63v2z"/></svg>`,
  file: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v4h4"/></svg>`,
  contact: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7z"/></svg>`,
  pin: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>`,
  globe: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.6 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3z"/></svg>`,
  mic: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4" stroke="currentColor" stroke-width="1.6" fill="none"/></svg>`,
};

const fmtStrong = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const fmtTime = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
function separatorHtml(date) {
  return `<div class="sep"><b>${esc(fmtStrong.format(date))}</b> ${esc(fmtTime.format(date))}</div>`;
}

// In the browser there are no local attachment files; every asset URL is null,
// so media renders as a labelled placeholder.
function makeAssetUrl() {
  return () => null;
}

function humanSize(bytes) {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u++;
  }
  return `${n >= 10 || u === 0 ? Math.round(n) : n.toFixed(1)} ${units[u]}`;
}

/**
 * Attach lightweight placeholder asset descriptors so media parts render as
 * "Photo · Not downloaded" chips rather than disappearing. (The CLI attaches
 * real transcoded files here; the browser build has none.)
 */
export function attachPlaceholders(model) {
  for (const day of model.days) {
    for (const it of day.items) {
      if (it.type !== "bubble") continue;
      for (const p of it.parts) {
        if (p.attachment && !p.attachment.__asset) {
          const att = p.attachment;
          const name = att.transfer_name || att.filename || "";
          const ext = name.includes(".") ? name.split(".").pop() : "";
          p.attachment.__asset = {
            missing: true,
            filename: name.split("/").pop() || "",
            ext,
            sizeLabel: humanSize(att.total_bytes),
          };
        }
      }
    }
  }
  return model;
}

function reactionHtml(reactions, assetUrl) {
  if (!reactions || !reactions.length) return "";
  const seen = new Set();
  const pills = [];
  for (const r of reactions) {
    const key = `${r.fromMe ? "m" : "t"}:${r.kind}:${r.glyph || r.stickerGuid || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const mine = r.fromMe ? " mine" : "";
    if (r.kind === "sticker" && r.stickerAsset && r.stickerAsset.file) {
      const url = assetUrl(r.stickerAsset.file);
      if (url) {
        pills.push(`<span class="tapback sticker-r"><img src="${url}" alt=""></span>`);
        continue;
      }
    }
    if (r.kind === "emoji" || r.kind === "sticker") {
      pills.push(`<span class="tapback emoji-r">${esc(r.glyph || "⭐")}</span>`);
      continue;
    }
    let inner;
    if (r.kind === "love") inner = ICONS.heart(r.fromMe ? "#fff" : "#FF3B5C");
    else if (r.kind === "like") inner = ICONS.thumbup;
    else if (r.kind === "dislike") inner = ICONS.thumbdown;
    else if (r.kind === "laugh") inner = `<span class="txt">HA<br>HA</span>`;
    else if (r.kind === "emphasize") inner = `<span class="txt">!!</span>`;
    else if (r.kind === "question") inner = `<span class="txt">?</span>`;
    else continue;
    pills.push(`<span class="tapback${mine}">${inner}<span class="dot d1"></span><span class="dot d2"></span></span>`);
  }
  if (!pills.length) return "";
  return `<div class="reactions">${pills.join("")}</div>`;
}

function imagePart(asset, assetUrl) {
  const url = asset.file ? assetUrl(asset.file) : null;
  if (!url)
    return `<div class="chip"><span class="ic">${ICONS.file}</span><div class="meta"><b>Photo</b><span>${esc(
      asset.sizeLabel ? asset.sizeLabel + " · Not downloaded" : "Not downloaded"
    )}</span></div></div>`;
  const dims = asset.width && asset.height ? ` width="${asset.width}" height="${asset.height}"` : "";
  return `<span class="media"><img src="${url}"${dims} loading="lazy" alt=""></span>`;
}

function partHtml(part, assetUrl) {
  switch (part.kind) {
    case "text":
      return null;
    case "image":
    case "sticker": {
      const a = part.attachment.__asset;
      if (!a) return "";
      if (part.kind === "sticker") {
        const url = assetUrl(a.file);
        return url
          ? `<span class="media sticker"><img src="${url}" alt=""></span>`
          : `<div class="chip"><span class="ic">${ICONS.file}</span><div class="meta"><b>Sticker</b><span>Not downloaded</span></div></div>`;
      }
      return imagePart(a, assetUrl);
    }
    case "video": {
      const a = part.attachment.__asset;
      const poster = a && a.poster ? assetUrl(a.poster) : null;
      const dur = a && a.duration ? formatDur(a.duration) : "";
      if (!poster)
        return `<div class="chip"><span class="ic">${ICONS.play}</span><div class="meta"><b>Video</b><span>${esc(
          a?.sizeLabel ? a.sizeLabel + " · Not downloaded" : "Not downloaded"
        )}</span></div></div>`;
      return `<span class="media"><span class="video-wrap"><img src="${poster}" alt=""><span class="play">${ICONS.play}</span>${
        dur ? `<span class="dur">${esc(dur)}</span>` : ""
      }</span></span>`;
    }
    case "audio":
      return audioHtml(part, assetUrl);
    case "contact": {
      const a = part.attachment.__asset || {};
      return `<div class="chip"><span class="ic">${ICONS.contact}</span><div class="meta"><b>${esc(
        a.filename || "Contact"
      )}</b><span>Contact Card</span></div></div>`;
    }
    case "location":
      return `<div class="chip"><span class="ic">${ICONS.pin}</span><div class="meta"><b>Location</b><span>Shared location</span></div></div>`;
    case "file": {
      const a = part.attachment.__asset || {};
      const url = a.file ? assetUrl(a.file) : null;
      const inner = `<span class="ic">${ICONS.file}</span><div class="meta"><b>${esc(
        a.filename || "File"
      )}</b><span>${esc([a.ext?.toUpperCase(), a.sizeLabel].filter(Boolean).join(" · "))}</span></div>`;
      return url
        ? `<a class="chip" href="${url}" style="text-decoration:none;color:inherit">${inner}</a>`
        : `<div class="chip">${inner}</div>`;
    }
    case "linkCard":
      return linkCardHtml(part, assetUrl);
    case "appCard":
      return appCardHtml(part);
    default:
      return "";
  }
}

function formatDur(s) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function waveformBars(waveform) {
  const peaks = Array.isArray(waveform) && waveform.length ? waveform : [40, 70, 55, 80, 45, 60, 35, 75, 50, 65];
  const MIN = 3;
  const MAX = 22;
  const total = peaks.length;
  return peaks
    .map((p, i) => {
      const h = Math.max(MIN, Math.round((Math.min(100, Math.max(0, p)) / 100) * MAX) || MIN);
      return `<i style="height:${h}px" data-f="${(i / total).toFixed(3)}"></i>`;
    })
    .join("");
}

function audioHtml(part, assetUrl) {
  const asset = part.attachment && part.attachment.__asset;
  const isVoice = part.isVoiceMessage;
  const label = isVoice ? "Audio Message" : (asset && asset.filename) || "Audio";
  const transcript = (part.transcript || "").trim();
  const transcriptHtml = transcript
    ? `<div class="transcript" title="Audio transcript">${linkify(transcript)}</div>`
    : "";

  const url = asset && !asset.missing ? assetUrl(asset.file) : null;
  if (!url) {
    const why = part.expireState === 3 ? "Not kept · expired" : "Not downloaded";
    return `<div class="audio-msg"><div class="chip audio-missing"><span class="ic">${ICONS.mic}</span><div class="meta"><b>${esc(
      label
    )}</b><span>${esc(why)}</span></div></div>${transcriptHtml}</div>`;
  }

  const dur = asset.duration ? formatDur(asset.duration) : "";
  const durAttr = asset.duration ? ` data-dur="${Number(asset.duration).toFixed(2)}"` : "";
  const bars = waveformBars(asset.waveform);
  return (
    `<div class="audio-msg"><div class="audio" data-audio${durAttr}>` +
    `<audio preload="metadata" src="${url}"></audio>` +
    `<button class="play2" type="button" aria-label="Play ${esc(label)}"><span class="i-play">${ICONS.playSmall}</span><span class="i-pause">${ICONS.pauseSmall}</span></button>` +
    `<span class="bars" aria-hidden="true">${bars}</span>` +
    `<span class="atime">${esc(dur || "0:00")}</span>` +
    `</div>${transcriptHtml}</div>`
  );
}

function linkCardHtml(part, assetUrl) {
  const meta = part.payload ? parseLinkMetadata(part.payload) : null;
  const url = (meta && meta.url) || part.url || "";
  let domain = "";
  try {
    domain = url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    /* ignore */
  }
  const rawTitle = ((meta && meta.title) || "").trim();
  const site = ((meta && meta.siteName) || "").trim() || domain;
  const title = rawTitle && rawTitle.toLowerCase() !== domain.toLowerCase() ? rawTitle : domain || url;
  const showSite = site && site.toLowerCase() !== title.toLowerCase();
  const siteHtml = showSite ? `<span class="lc-site">${esc(site)}</span>` : "";
  const imgUrl = part.imageAsset ? assetUrl(part.imageAsset.file) : null;

  if (imgUrl) {
    return `<a class="linkcard has-img" href="${esc(url)}" target="_blank" rel="noopener"><img class="lc-img" src="${imgUrl}" alt=""><span class="lc-foot"><span class="lc-title">${esc(
      title
    )}</span>${siteHtml}</span></a>`;
  }
  return `<a class="linkcard no-img" href="${esc(url)}" target="_blank" rel="noopener"><span class="lc-ico">${ICONS.globe}</span><span class="lc-text"><span class="lc-title">${esc(
    title
  )}</span>${siteHtml}</span></a>`;
}

function appCardHtml(part) {
  const name = appName(part.bundleId);
  const title = (part.caption || "").trim() || name;
  let subtitle = (part.subtitle || "").trim();
  if (!subtitle || subtitle === title) subtitle = (part.text || "").trim();
  if (subtitle === title) subtitle = "";
  const footName = name !== title ? name : "";

  if (part.imageDataUri) {
    return `<div class="appcard"><img class="ac-img" src="${part.imageDataUri}" alt=""><span class="ac-foot"><b>${esc(
      title
    )}</b>${subtitle ? `<span>${esc(subtitle)}</span>` : ""}${
      footName ? `<span class="ac-app">${esc(footName)}</span>` : ""
    }</span></div>`;
  }
  return `<div class="chip"><span class="ic">${ICONS.file}</span><div class="meta"><b>${esc(title)}</b><span>${esc(
    subtitle || name
  )}</span></div></div>`;
}
function appName(bundleId) {
  if (!bundleId) return "App";
  if (bundleId.includes("gamepigeon")) return "GamePigeon";
  if (bundleId.includes("PeerPayment") || bundleId.includes("PassbookUIService")) return "Apple Cash";
  if (bundleId.includes("findmy") || bundleId.includes("FindMy")) return "Find My";
  if (bundleId.includes("mobileslideshow") || bundleId.includes("PhotosMessages")) return "Photos";
  if (bundleId.includes("DigitalTouch")) return "Digital Touch";
  return "App";
}

function bubbleHtml(item, assetUrl) {
  const wrapCls = [
    "bubble-wrap",
    item.startsGroup ? "grp-first" : "",
    item.endsGroup ? "grp-last tail" : "",
    item.deleted ? "deleted" : "",
  ]
    .filter(Boolean)
    .join(" ");

  let replyHtml = "";
  if (item.reply) {
    const origSide = item.reply.sender === "me" ? "me" : "them";
    if (item.reply.missing) {
      replyHtml = `<div class="reply-quote them deleted"><div class="rq-bubble rq-deleted">Deleted message</div></div>`;
    } else {
      const delCls = item.reply.deleted ? " rq-deleted" : "";
      const nameHtml = item.reply.senderName ? `<div class="rq-name">${esc(item.reply.senderName)}</div>` : "";
      replyHtml = `<div class="reply-quote ${origSide}${item.reply.deleted ? " deleted" : ""}">${nameHtml}<div class="rq-bubble${delCls}">${esc(
        item.reply.snippet
      )}</div></div>`;
    }
  }

  const mediaParts = item.parts.filter((p) => p.kind !== "text");
  const textParts = item.parts.filter((p) => p.kind === "text" && p.text);
  const textBody = textParts.map((p) => p.text).join("\n");

  const bubbles = [];

  const images = mediaParts.filter((p) => p.kind === "image");
  if (images.length > 1) {
    const imgs = images
      .map((p) => {
        const a = p.attachment.__asset;
        const url = a ? assetUrl(a.file) : null;
        return url ? `<img src="${url}" alt="">` : "";
      })
      .join("");
    if (imgs) {
      bubbles.push({ html: `<div class="bubble media-bubble"><span class="media grid">${imgs}</span></div>`, text: false });
    } else {
      for (const p of images) {
        const h = wrapMediaBubble(partHtml(p, assetUrl));
        if (h) bubbles.push({ html: h, text: false });
      }
    }
    for (const p of mediaParts.filter((x) => x.kind !== "image")) {
      const h = wrapMediaBubble(partHtml(p, assetUrl));
      if (h) bubbles.push({ html: h, text: false });
    }
  } else {
    for (const p of mediaParts) {
      const h = wrapMediaBubble(partHtml(p, assetUrl));
      if (h) bubbles.push({ html: h, text: false });
    }
  }

  const subjHtml = item.subject ? `<div class="subj">${esc(item.subject)}</div>` : "";
  if (textBody || item.subject) {
    if (!item.subject && isJumboEmoji(textBody)) {
      bubbles.push({ html: `<div class="bubble jumbo">${esc(textBody)}</div>`, text: false });
    } else {
      bubbles.push({ html: `<div class="bubble">${subjHtml}${linkify(textBody)}</div>`, text: true });
    }
  }

  if (item.endsGroup && bubbles.length) {
    const last = bubbles[bubbles.length - 1];
    if (last.text) last.html = last.html.replace('<div class="bubble"', '<div class="bubble tail"');
  }

  const reactions = reactionHtml(item.reactions, assetUrl);
  const editedHtml = item.edited ? `<div class="edited">Edited</div>` : "";
  const deletedHtml = item.deleted ? `<div class="edited del-tag">Deleted</div>` : "";
  const effectHtml = item.effect ? `<div class="effect-note">sent with ${esc(item.effect)}</div>` : "";
  let editHistHtml = "";
  if (item.editHistory && item.editHistory.length) {
    const evs = item.editHistory.map((v) => `<div class="ev">${linkify(v)}</div>`).join("");
    editHistHtml = `<div class="edit-history" title="Previous versions">${evs}</div>`;
  }
  const bubblesHtml = bubbles.map((b) => b.html).join("");
  return `${replyHtml}<div class="${wrapCls}">${bubblesHtml}${reactions}</div>${editHistHtml}${editedHtml}${deletedHtml}${effectHtml}`;
}

function wrapMediaBubble(inner) {
  if (!inner) return "";
  if (/^<span class="media/.test(inner)) return `<div class="bubble media-bubble">${inner}</div>`;
  return inner;
}

function audioScript() {
  return `<script>
(function(){
  function fmt(s){s=Math.max(0,Math.floor(s||0));var m=Math.floor(s/60),x=s%60;return m+":"+(x<10?"0":"")+x;}
  var players=Array.prototype.slice.call(document.querySelectorAll('[data-audio]'));
  players.forEach(function(p){
    var audio=p.querySelector('audio'); if(!audio)return;
    var btn=p.querySelector('.play2');
    var bars=p.querySelectorAll('.bars i');
    var time=p.querySelector('.atime');
    var total=parseFloat(p.getAttribute('data-dur'))||0;
    function paint(){
      var d=audio.duration||total||0, f=d?audio.currentTime/d:0;
      for(var i=0;i<bars.length;i++){var bf=parseFloat(bars[i].getAttribute('data-f'))||0;bars[i].classList.toggle('on',bf<=f);}
    }
    if(btn)btn.addEventListener('click',function(){
      if(audio.paused){players.forEach(function(o){var a=o.querySelector('audio');if(a&&a!==audio)a.pause();});audio.play();}
      else{audio.pause();}
    });
    audio.addEventListener('play',function(){p.classList.add('playing');});
    audio.addEventListener('pause',function(){p.classList.remove('playing');});
    audio.addEventListener('timeupdate',function(){paint();if(time)time.textContent=fmt(audio.currentTime);});
    audio.addEventListener('ended',function(){p.classList.remove('playing');if(time)time.textContent=fmt(total||audio.duration);for(var i=0;i<bars.length;i++)bars[i].classList.remove('on');});
    audio.addEventListener('loadedmetadata',function(){if(!total&&time)time.textContent=fmt(audio.duration);});
    var bw=p.querySelector('.bars');
    if(bw)bw.addEventListener('click',function(e){var r=bw.getBoundingClientRect();var f=(e.clientX-r.left)/r.width;var d=audio.duration||total||0;if(d){audio.currentTime=Math.max(0,Math.min(d,f*d));paint();}});
  });
})();
</script>`;
}

/** Render the inner conversation chrome (header + thread) as an HTML fragment. */
export function renderConversationBody(model) {
  const assetUrl = makeAssetUrl();
  const c = model.contact;

  const avatar = c.photoDataUri
    ? `<div class="avatar"><img src="${c.photoDataUri}" alt=""></div>`
    : `<div class="avatar">${esc(c.monogram)}</div>`;

  const rows = [];
  let prevSender = null;
  for (const day of model.days) {
    for (const it of day.items) {
      if (it.type === "sep") {
        rows.push(separatorHtml(it.date));
        prevSender = null;
        continue;
      }
      if (it.type === "system") {
        rows.push(`<div class="system">${esc(it.text)}</div>`);
        prevSender = null;
        continue;
      }
      if (it.type === "bubble" && it.unsent) {
        const who = it.sender === "me" ? "You" : it.senderName || c.name;
        rows.push(`<div class="system unsent-note">${esc(who)} unsent a message.</div>`);
        prevSender = null;
        continue;
      }
      const grpStart = it.sender !== prevSender;
      const rowCls = `row ${it.sender}${grpStart ? " grp-start" : ""}`;
      let receipt = "";
      if (it.receipt) {
        receipt =
          it.receipt.kind === "read"
            ? `<div class="receipt">Read ${esc(fmtTime.format(it.receipt.date))}</div>`
            : `<div class="receipt">Delivered</div>`;
      }
      rows.push(`<div class="${rowCls}">${bubbleHtml(it, assetUrl)}${receipt}</div>`);
      prevSender = it.sender;
    }
  }

  return `<div class="imsg">
  <div class="imsg-header">
    <div class="icon-left">${ICONS.back}</div>
    <div class="peer">${avatar}<div class="peer-name">${esc(c.name)}<span class="chev">${ICONS.chevron}</span></div></div>
    <div class="icon-right">${ICONS.video}</div>
  </div>
  <div class="thread">
${rows.join("\n")}
  </div>
</div>`;
}

/** Render a complete standalone HTML document (for the <iframe> srcdoc and .html export). */
export function renderHtml(model, opts = {}) {
  const { theme = "dark", title, colWidth = null } = opts;
  const c = model.contact;
  const extraCss = colWidth ? `.imsg{--col:${colWidth}px;}` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title || c.name)}</title>
<style>${css(theme)}${extraCss}</style>
</head>
<body>
${renderConversationBody(model)}
${audioScript()}
</body></html>`;
}
