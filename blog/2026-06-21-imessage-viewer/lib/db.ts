// @ts-nocheck
// Browser port of src/lib/db.js. Same chat.db schema queries, but the SQLite
// engine is sql.js (WASM) reading an in-memory copy of the uploaded database,
// instead of Node 22's built-in node:sqlite reading the file on disk.
import initSqlJs from "sql.js";

const MAC_EPOCH_OFFSET = 978307200; // seconds between 1970-01-01 and 2001-01-01

let _SQL = null;

/** Initialise sql.js once, loading the wasm from the site's /wasm/ path. */
export async function getSql(locateFile) {
  if (_SQL) return _SQL;
  _SQL = await initSqlJs({
    locateFile: locateFile || ((f) => `/wasm/${f}`),
  });
  return _SQL;
}

/** Open a chat.db from raw bytes (Uint8Array/ArrayBuffer). */
export async function openDB(bytes, locateFile) {
  const SQL = await getSql(locateFile);
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return new SQL.Database(u8);
}

// ---- tiny prepared-statement helpers mirroring node:sqlite's .all()/.get() ----
function all(db, sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}
function get(db, sql, params = []) {
  return all(db, sql, params)[0] || null;
}
function tableExists(db, name) {
  try {
    return !!get(db, "SELECT name FROM sqlite_master WHERE type='table' AND name=?", [name]);
  } catch {
    return false;
  }
}

/** Convert a Messages `date` value (ns or s since 2001) to a JS Date. */
export function macAbsToDate(v) {
  if (v == null || v === 0) return null;
  const n = Number(v);
  const seconds = n > 1e12 ? n / 1e9 : n;
  return new Date((seconds + MAC_EPOCH_OFFSET) * 1000);
}

/** Convert a JS Date to a Messages `date` ns value (Number is fine for filtering). */
export function dateToMacNs(d) {
  return Math.round((d.getTime() / 1000 - MAC_EPOCH_OFFSET) * 1e9);
}

/** Normalize a phone/email into a comparison key. */
export function normalizeId(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (s.includes("@")) return { kind: "email", key: s.toLowerCase(), display: s };
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return { kind: "other", key: s.toLowerCase(), display: s };
  const key = digits.length >= 10 ? digits.slice(-10) : digits;
  return { kind: "phone", key, digits, display: s };
}

function placeholders(n) {
  return Array.from({ length: n }, () => "?").join(",");
}

export function matchHandles(db, identifiers) {
  const wanted = new Set();
  for (const id of identifiers) {
    const norm = normalizeId(id);
    if (norm) wanted.add(norm.key);
  }
  const rows = all(db, "SELECT ROWID as rowid, id, service FROM handle");
  const matched = [];
  for (const r of rows) {
    const norm = normalizeId(r.id);
    if (norm && wanted.has(norm.key)) matched.push(r);
  }
  return matched;
}

export function findDirectChats(db, handleRowids) {
  if (!handleRowids.length) return [];
  return all(
    db,
    `SELECT DISTINCT c.ROWID as rowid, c.chat_identifier, c.display_name, c.style, c.service_name
     FROM chat c
     JOIN chat_handle_join chj ON chj.chat_id = c.ROWID
     WHERE chj.handle_id IN (${placeholders(handleRowids.length)})
       AND c.style = 45`,
    handleRowids
  );
}

const MESSAGE_COLUMNS = `
  m.ROWID            AS rowid,
  m.guid             AS guid,
  m.text             AS text,
  m.subject          AS subject,
  m.attributedBody   AS attributedBody,
  CAST(m.date AS REAL)           AS date,
  CAST(m.date_read AS REAL)      AS date_read,
  CAST(m.date_delivered AS REAL) AS date_delivered,
  CAST(m.date_edited AS REAL)    AS date_edited,
  CAST(m.date_retracted AS REAL) AS date_retracted,
  m.is_from_me       AS is_from_me,
  m.handle_id        AS handle_id,
  h.id               AS handle_addr,
  m.item_type        AS item_type,
  m.group_action_type AS group_action_type,
  m.associated_message_guid  AS associated_message_guid,
  m.associated_message_type  AS associated_message_type,
  m.associated_message_emoji AS associated_message_emoji,
  m.balloon_bundle_id        AS balloon_bundle_id,
  m.payload_data             AS payload_data,
  m.expressive_send_style_id AS expressive_send_style_id,
  m.thread_originator_guid   AS thread_originator_guid,
  m.thread_originator_part   AS thread_originator_part,
  m.is_audio_message         AS is_audio_message,
  m.is_played                AS is_played,
  m.expire_state             AS expire_state,
  m.cache_has_attachments    AS cache_has_attachments,
  m.message_summary_info     AS message_summary_info,
  m.service          AS service,
  m.is_delivered     AS is_delivered,
  m.is_sent          AS is_sent,
  m.is_read          AS is_read,
  m.is_from_me       AS from_me`;

export function fetchMessages(db, chatRowids, { from = null, to = null } = {}) {
  if (!chatRowids.length) return [];
  const conds = [`cmj.chat_id IN (${placeholders(chatRowids.length)})`];
  const params = [...chatRowids];
  if (from) {
    conds.push("m.date >= ?");
    params.push(dateToMacNs(from));
  }
  if (to) {
    conds.push("m.date <= ?");
    params.push(dateToMacNs(to));
  }
  return all(
    db,
    `SELECT ${MESSAGE_COLUMNS}
     FROM chat_message_join cmj
     JOIN message m ON m.ROWID = cmj.message_id
     LEFT JOIN handle h ON h.ROWID = m.handle_id
     WHERE ${conds.join(" AND ")}
     GROUP BY m.ROWID
     ORDER BY m.date ASC, m.ROWID ASC`,
    params
  );
}

export function fetchRecoverableMessages(db, chatRowids, { from = null, to = null } = {}) {
  if (!chatRowids.length) return [];
  if (!tableExists(db, "chat_recoverable_message_join")) return [];
  const conds = [`crmj.chat_id IN (${placeholders(chatRowids.length)})`];
  const params = [...chatRowids];
  if (from) {
    conds.push("m.date >= ?");
    params.push(dateToMacNs(from));
  }
  if (to) {
    conds.push("m.date <= ?");
    params.push(dateToMacNs(to));
  }
  try {
    return all(
      db,
      `SELECT ${MESSAGE_COLUMNS},
              CAST(crmj.delete_date AS REAL) AS delete_date
       FROM chat_recoverable_message_join crmj
       JOIN message m ON m.ROWID = crmj.message_id
       LEFT JOIN handle h ON h.ROWID = m.handle_id
       WHERE ${conds.join(" AND ")}
       GROUP BY m.ROWID
       ORDER BY m.date ASC, m.ROWID ASC`,
      params
    );
  } catch {
    return [];
  }
}

export function fetchAttachments(db, messageRowids) {
  const map = new Map();
  if (!messageRowids.length) return map;
  const CHUNK = 800;
  for (let i = 0; i < messageRowids.length; i += CHUNK) {
    const slice = messageRowids.slice(i, i + CHUNK);
    const rows = all(
      db,
      `SELECT maj.message_id AS message_id,
              a.ROWID        AS rowid,
              a.guid         AS guid,
              a.filename     AS filename,
              a.mime_type    AS mime_type,
              a.uti          AS uti,
              a.transfer_name AS transfer_name,
              a.total_bytes  AS total_bytes,
              a.is_sticker   AS is_sticker,
              a.hide_attachment AS hide_attachment
       FROM message_attachment_join maj
       JOIN attachment a ON a.ROWID = maj.attachment_id
       WHERE maj.message_id IN (${placeholders(slice.length)})
       ORDER BY maj.message_id, maj.ROWID`,
      slice
    );
    for (const r of rows) {
      if (!map.has(r.message_id)) map.set(r.message_id, []);
      map.get(r.message_id).push(r);
    }
  }
  return map;
}

export function resolveConversation(db, identifiers) {
  const handles = matchHandles(db, identifiers);
  const chats = findDirectChats(
    db,
    handles.map((h) => h.rowid)
  );
  return { handles, chats };
}

/** List all 1:1 conversations with message counts (aggregated SMS + iMessage). */
export function listConversations(db) {
  const rows = all(
    db,
    `SELECT h.id AS addr, h.service AS service,
            COUNT(cmj.message_id) AS cnt,
            CAST(MAX(cmj.message_date) AS REAL) AS last_date,
            CAST(MIN(cmj.message_date) AS REAL) AS first_date
     FROM chat c
     JOIN chat_handle_join chj ON chj.chat_id = c.ROWID
     JOIN handle h ON h.ROWID = chj.handle_id
     LEFT JOIN chat_message_join cmj ON cmj.chat_id = c.ROWID
     WHERE c.style = 45
     GROUP BY c.ROWID`
  );
  const agg = new Map();
  for (const r of rows) {
    const norm = normalizeId(r.addr);
    const key = norm ? norm.key : r.addr;
    const cur = agg.get(key) || {
      key,
      addr: r.addr,
      services: new Set(),
      cnt: 0,
      last: 0,
      first: Number.MAX_SAFE_INTEGER,
    };
    cur.cnt += r.cnt;
    if (r.service) cur.services.add(r.service);
    if (r.last_date && r.last_date > cur.last) cur.last = r.last_date;
    if (r.first_date && r.first_date < cur.first) cur.first = r.first_date;
    agg.set(key, cur);
  }
  return [...agg.values()]
    .map((c) => ({
      addr: c.addr,
      key: c.key,
      services: [...c.services].join("/"),
      count: c.cnt,
      last: macAbsToDate(c.last),
      first: c.first === Number.MAX_SAFE_INTEGER ? null : macAbsToDate(c.first),
    }))
    .sort((a, b) => b.count - a.count);
}
