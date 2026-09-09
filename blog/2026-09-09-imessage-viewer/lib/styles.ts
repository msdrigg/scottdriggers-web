// @ts-nocheck
// Verbatim copy of src/lib/styles.js — the iOS Messages conversation CSS.
export function css(theme = "dark") {
  const dark = theme !== "light";
  const vars = dark
    ? `
    --bg: #000000;
    --header-bg: rgba(0,0,0,0.72);
    --hairline: rgba(255,255,255,0.12);
    --recv-bg: #262628;
    --recv-text: #ffffff;
    --sent-top: #1F9DFF;
    --sent-bottom: #0A7CFF;
    --sent-solid: #0A7CFF;
    --sent-text: #ffffff;
    --meta: #8A8A8E;
    --sep-strong: #B8B8BE;
    --link: #ffffff;
    --link-recv: #6CB7FF;
    --avatar-top: #AEAEB4;
    --avatar-bottom: #7C7C82;
    --card-foot: rgba(255,255,255,0.06);
    --chip-bg: #262628;
    --reaction-gray: #3A3A3C;
    --rq-bg: rgba(120,120,128,0.20);
    --rq-border: rgba(235,235,245,0.22);
    --rq-me-bg: rgba(10,120,255,0.30);
    --rq-me-border: rgba(120,180,255,0.5);
    --rq-text: rgba(255,255,255,0.78);`
    : `
    --bg: #ffffff;
    --header-bg: rgba(255,255,255,0.8);
    --hairline: rgba(0,0,0,0.12);
    --recv-bg: #E9E9EB;
    --recv-text: #000000;
    --sent-top: #34ADFF;
    --sent-bottom: #0A7CFF;
    --sent-solid: #0A7CFF;
    --sent-text: #ffffff;
    --meta: #8A8A8E;
    --sep-strong: #3C3C43;
    --link: #ffffff;
    --link-recv: #0A6CFF;
    --avatar-top: #C9C9CE;
    --avatar-bottom: #A7A7AD;
    --card-foot: rgba(0,0,0,0.04);
    --chip-bg: #E9E9EB;
    --reaction-gray: #D1D1D6;
    --rq-bg: rgba(120,120,128,0.16);
    --rq-border: rgba(60,60,67,0.20);
    --rq-me-bg: rgba(10,124,255,0.16);
    --rq-me-border: rgba(10,124,255,0.42);
    --rq-text: rgba(0,0,0,0.6);`;

  return `
*{ box-sizing:border-box; -webkit-font-smoothing:antialiased; text-rendering:optimizeLegibility; }
:root{ ${vars}
  --font: -apple-system, "SF Pro Text", "SF Pro Display", "Helvetica Neue", system-ui, sans-serif;
}
html,body{ margin:0; padding:0; background:var(--bg); }
body{ font-family:var(--font); color:var(--recv-text); }

.imsg{ width:100%; max-width:var(--col, 100%); margin:0 auto; background:var(--bg);
  display:flex; flex-direction:column; min-height:100%; }

/* ---------- Header ---------- */
.imsg-header{ position:sticky; top:0; z-index:50; background:var(--header-bg);
  backdrop-filter:saturate(180%) blur(20px); -webkit-backdrop-filter:saturate(180%) blur(20px);
  border-bottom:0.5px solid var(--hairline);
  padding:8px 12px 9px; display:flex; align-items:center; justify-content:center; }
.imsg-header .icon-left, .imsg-header .icon-right{ position:absolute; top:50%; transform:translateY(-50%);
  color:#0A84FF; display:flex; align-items:center; justify-content:center; }
.imsg-header .icon-left{ left:16px; } .imsg-header .icon-right{ right:15px; }
.imsg-header svg{ display:block; }
.peer{ display:flex; flex-direction:column; align-items:center; gap:3px; }
.avatar{ width:50px; height:50px; border-radius:50%;
  background:linear-gradient(180deg,var(--avatar-top),var(--avatar-bottom));
  display:flex; align-items:center; justify-content:center; overflow:hidden;
  color:#fff; font-size:21px; font-weight:500; letter-spacing:.5px; }
.avatar img{ width:100%; height:100%; object-fit:cover; }
.peer-name{ display:flex; align-items:center; gap:3px; font-size:12px; color:var(--recv-text);
  font-weight:400; opacity:.92; }
.peer-name .chev{ opacity:.4; font-size:11px; }

/* ---------- Thread / messages ---------- */
.thread{ padding:8px 12px 18px; display:flex; flex-direction:column; }

.sep{ text-align:center; font-size:11px; color:var(--meta); margin:14px 0 10px;
  font-weight:400; letter-spacing:-0.1px; }
.sep b{ color:var(--sep-strong); font-weight:600; }

.system{ text-align:center; font-size:12px; color:var(--meta); margin:8px 16px; }

.row{ display:flex; flex-direction:column; }
.row.me{ align-items:flex-end; } .row.them{ align-items:flex-start; }
.row.grp-start{ margin-top:8px; } .row:first-child{ margin-top:0; }

.bubble-wrap{ position:relative; max-width:78%; margin-top:2px; }
.row.me .bubble-wrap{ align-self:flex-end; } .row.them .bubble-wrap{ align-self:flex-start; }

.bubble{ position:relative; z-index:1; font-size:17px; line-height:1.27; letter-spacing:-0.2px;
  padding:7px 13px 8px; border-radius:19px; word-wrap:break-word; overflow-wrap:anywhere;
  white-space:pre-wrap; }
.them .bubble{ background:var(--recv-bg); color:var(--recv-text); border-bottom-left-radius:19px; }
.me .bubble{ background:linear-gradient(180deg,var(--sent-top),var(--sent-bottom)); color:var(--sent-text); }

/* group nesting radii */
.them .bubble-wrap:not(.grp-first) .bubble{ border-top-left-radius:6px; }
.them .bubble-wrap:not(.grp-last) .bubble{ border-bottom-left-radius:6px; }
.me .bubble-wrap:not(.grp-first) .bubble{ border-top-right-radius:6px; }
.me .bubble-wrap:not(.grp-last) .bubble{ border-bottom-right-radius:6px; }

/* tails on the last bubble of a run */
.bubble.tail::before{ content:""; position:absolute; z-index:0; bottom:0; width:20px; height:19px; }
.bubble.tail::after{ content:""; position:absolute; z-index:1; bottom:0; width:11px; height:20px; background:var(--bg); }
.them .bubble.tail::before{ left:-7px; background:var(--recv-bg); border-bottom-right-radius:16px; }
.them .bubble.tail::after{ left:-11px; border-bottom-right-radius:11px; }
.me .bubble.tail::before{ right:-7px; background:var(--sent-bottom); border-bottom-left-radius:16px; }
.me .bubble.tail::after{ right:-11px; border-bottom-left-radius:11px; }

.bubble a{ color:var(--link); text-decoration:underline; text-underline-offset:1.5px; }
.them .bubble a{ color:var(--recv-text); }

/* emoji-only jumbo */
.jumbo{ background:transparent !important; padding:2px 4px; font-size:48px; line-height:1.1; }
.jumbo::before,.jumbo::after{ display:none !important; }

/* media */
.media{ display:block; border-radius:17px; overflow:hidden; max-width:250px; }
.media img,.media video{ display:block; width:100%; height:auto; }
.media.grid{ display:grid; grid-template-columns:1fr 1fr; gap:2px; max-width:250px; }
.media.grid img{ aspect-ratio:1/1; object-fit:cover; border-radius:3px; }
.bubble.media-bubble{ padding:0; background:transparent !important; }
.bubble.media-bubble::before,.bubble.media-bubble::after{ display:none !important; }
.video-wrap{ position:relative; }
.video-wrap .play{ position:absolute; inset:0; margin:auto; width:54px; height:54px; border-radius:50%;
  background:rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; }
.video-wrap .dur{ position:absolute; right:8px; bottom:7px; color:#fff; font-size:12px; font-weight:600;
  text-shadow:0 1px 2px rgba(0,0,0,.5); }
.sticker{ background:transparent !important; padding:0; }
.sticker img{ max-width:150px; }

/* link preview card */
.linkcard{ display:block; width:250px; max-width:100%; border-radius:17px; overflow:hidden;
  text-decoration:none !important; background:var(--recv-bg); }
.me .linkcard{ background:linear-gradient(180deg,var(--sent-top),var(--sent-bottom)); }
.linkcard .lc-img{ width:100%; aspect-ratio:1.91/1; object-fit:cover; display:block; background:rgba(127,127,127,.18); }
.linkcard.has-img .lc-foot{ display:block; padding:8px 11px 9px; }
.linkcard.has-img .lc-title{ white-space:normal; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.linkcard.no-img{ width:auto; max-width:250px; display:flex; align-items:center; gap:10px; padding:9px 12px; }
.linkcard.no-img .lc-ico{ width:32px; height:32px; flex:none; border-radius:50%;
  background:rgba(127,127,127,.25); display:flex; align-items:center; justify-content:center; color:var(--meta); }
.me .linkcard.no-img .lc-ico{ background:rgba(255,255,255,.22); color:#fff; }
.linkcard .lc-text{ min-width:0; }
.linkcard .lc-title{ font-size:14px; font-weight:500; line-height:1.25; color:var(--recv-text);
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.me .linkcard .lc-title{ color:#fff; }
.linkcard .lc-site{ display:block; font-size:12px; color:var(--meta); margin-top:1px;
  white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.me .linkcard .lc-site{ color:rgba(255,255,255,.82); }

/* file / contact / location / audio chips */
.chip{ display:flex; align-items:center; gap:10px; padding:10px 13px; border-radius:17px;
  background:var(--recv-bg); min-width:180px; max-width:250px; }
.me .chip{ background:linear-gradient(180deg,var(--sent-top),var(--sent-bottom)); color:#fff; }
.chip .ic{ width:34px; height:34px; flex:none; border-radius:8px; display:flex; align-items:center; justify-content:center;
  background:rgba(127,127,127,.25); }
.chip .meta b{ display:block; font-size:14px; font-weight:500; line-height:1.2; word-break:break-word; }
.chip .meta span{ font-size:12px; color:var(--meta); }
.me .chip .meta span{ color:rgba(255,255,255,.8); }
/* ---------- voice messages (interactive audio player) ---------- */
.audio-msg{ display:flex; flex-direction:column; max-width:260px; }
.audio{ display:flex; align-items:center; gap:10px; padding:9px 12px; border-radius:18px;
  background:var(--recv-bg); color:var(--recv-text); min-width:200px; }
.me .audio{ background:linear-gradient(180deg,var(--sent-top),var(--sent-bottom)); color:#fff; }
.audio audio{ display:none; }
.audio .play2{ width:26px; height:26px; flex:none; border:none; cursor:pointer; padding:0; border-radius:50%;
  display:flex; align-items:center; justify-content:center; color:inherit; background:rgba(127,127,127,.22); }
.me .audio .play2{ background:rgba(255,255,255,.22); }
.audio .play2 svg{ width:16px; height:16px; display:block; }
.audio .play2 .i-play{ display:flex; margin-left:1px; } .audio .play2 .i-pause{ display:none; }
.audio.playing .play2 .i-play{ display:none; } .audio.playing .play2 .i-pause{ display:flex; }
.audio .bars{ flex:1; display:flex; align-items:center; gap:2px; height:24px; cursor:pointer; }
.audio .bars i{ flex:1; min-width:2px; max-width:3px; background:currentColor; opacity:.35; border-radius:1px;
  transition:opacity .08s linear; }
.audio .bars i.on{ opacity:1; }
.audio .atime{ flex:none; font-size:12px; font-variant-numeric:tabular-nums; opacity:.8; }
.audio-missing{ min-width:200px; }

/* on-device transcript — small, selectable, searchable text under the player */
.transcript{ font-size:11.5px; line-height:1.3; color:var(--meta); margin:4px 6px 0;
  white-space:pre-wrap; word-break:break-word; }
.me .audio-msg .transcript{ text-align:right; }
.transcript a{ color:inherit; text-decoration:underline; }

/* bold MMS/iMessage subject line above the body */
.subj{ font-weight:600; margin-bottom:2px; }

/* app message card (Apple Cash, Photos slideshow, Find My, …) */
.appcard{ display:block; width:250px; max-width:100%; border-radius:17px; overflow:hidden; background:var(--recv-bg); }
.me .appcard{ background:linear-gradient(180deg,var(--sent-top),var(--sent-bottom)); }
.appcard .ac-img{ width:100%; display:block; max-height:300px; object-fit:cover; background:rgba(127,127,127,.18); }
.appcard .ac-foot{ display:block; padding:8px 11px 9px; }
.appcard .ac-foot b{ display:block; font-size:14px; font-weight:600; color:var(--recv-text); line-height:1.25; }
.me .appcard .ac-foot b{ color:#fff; }
.appcard .ac-foot span{ display:block; font-size:12px; color:var(--meta); margin-top:1px; }
.me .appcard .ac-foot span{ color:rgba(255,255,255,.82); }
.appcard .ac-app{ opacity:.8; font-size:11px !important; }

/* sticker tapback (an image reaction) */
.tapback.sticker-r{ background:transparent; border:none; padding:0; min-width:0; width:36px; height:36px; }
.tapback.sticker-r img{ width:100%; height:100%; object-fit:contain; }

/* send-effect note + edit history under a bubble */
.effect-note{ font-size:11px; color:var(--meta); margin:1px 4px; }
.row.me .effect-note{ align-self:flex-end; }
.edit-history{ font-size:11.5px; line-height:1.3; color:var(--meta); margin:2px 8px 0; max-width:78%;
  display:flex; flex-direction:column; }
.row.me .edit-history{ align-items:flex-end; text-align:right; }
.edit-history .ev{ font-style:italic; opacity:.75; word-break:break-word; }
.edit-history .ev::before{ content:"“"; } .edit-history .ev::after{ content:"”"; }

/* deleted (Recently Deleted) messages — rendered faded + tagged */
.bubble-wrap.deleted{ opacity:.6; }
.del-tag{ color:var(--meta); }
.row.them .del-tag{ align-self:flex-start; }
.rq-deleted{ font-style:italic; opacity:.7; }
.unsent-note{ font-style:italic; }

/* reply quote — a smaller, outlined, ghosted copy of the original bubble,
   tinted by its sender, sitting just above the actual reply */
.reply-quote{ display:flex; flex-direction:column; max-width:64%; margin-top:10px; margin-bottom:3px; }
.row.me .reply-quote{ align-items:flex-end; } .row.them .reply-quote{ align-items:flex-start; }
.reply-quote .rq-name{ font-size:10.5px; color:var(--meta); margin:0 12px 2px; font-weight:400; }
.reply-quote .rq-bubble{ font-size:12.5px; line-height:1.22; padding:5px 11px; border-radius:14px;
  max-width:100%; word-break:break-word; border:1px solid var(--rq-border);
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.reply-quote.them .rq-bubble{ background:var(--rq-bg); color:var(--rq-text); }
.reply-quote.me .rq-bubble{ background:var(--rq-me-bg); color:var(--rq-text); border-color:var(--rq-me-border); }
/* nudge the actual reply bubble snug under its quote */
.reply-quote + .bubble-wrap{ margin-top:0; }

/* tapback reactions */
.reactions{ position:absolute; top:-15px; z-index:5; display:flex; gap:2px; }
.row.me .reactions{ left:-12px; } .row.them .reactions{ right:-12px; }
.tapback{ position:relative; min-width:30px; height:30px; padding:0 6px; border-radius:16px;
  display:flex; align-items:center; justify-content:center;
  background:var(--reaction-gray); border:2px solid var(--bg); }
.tapback.mine{ background:linear-gradient(180deg,var(--sent-top),var(--sent-bottom)); }
.tapback svg{ width:17px; height:17px; }
.tapback .txt{ font-size:13px; font-weight:700; color:#fff; line-height:0.82; text-align:center; }
.tapback.emoji-r{ background:transparent; border:none; font-size:22px; }
.tapback .dot{ position:absolute; bottom:-3px; border-radius:50%; background:var(--reaction-gray); border:1.5px solid var(--bg); }
.tapback.mine .dot{ background:var(--sent-bottom); }
.tapback .dot.d1{ width:8px; height:8px; }
.tapback .dot.d2{ width:4px; height:4px; bottom:-7px; }
.row.me .tapback .dot{ left:2px; } .row.me .tapback .dot.d2{ left:-2px; }
.row.them .tapback .dot{ right:2px; } .row.them .tapback .dot.d2{ right:-2px; }

/* receipts + edited */
.receipt{ font-size:11px; color:var(--meta); align-self:flex-end; margin:2px 3px 2px 0; font-weight:500; }
.edited{ font-size:11px; color:var(--meta); margin:1px 4px; }
.row.me .edited{ align-self:flex-end; }
.unsent{ font-style:italic; color:var(--meta); }
`;
}
