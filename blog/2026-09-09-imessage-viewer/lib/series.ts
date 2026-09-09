// @ts-nocheck
// Browser port of the data half of src/lib/graph.js: bucket messages by day or
// month, counting sent vs received. The CLI rendered this to a hand-built SVG;
// here the React component feeds the series to recharts instead.
import { macAbsToDate } from "./db";

const REACTION_ADD_MIN = 2000;
const REACTION_ADD_MAX = 2007;
const REACTION_REMOVE_MIN = 3000;
const REACTION_REMOVE_MAX = 3007;

function isReaction(at) {
  return (at >= REACTION_ADD_MIN && at <= REACTION_ADD_MAX) || (at >= REACTION_REMOVE_MIN && at <= REACTION_REMOVE_MAX);
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dayLabel(d) {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function monthLabel(d) {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function buildSeries(rows, { by = "day" } = {}) {
  const buckets = new Map();
  let min = null;
  let max = null;
  for (const r of rows) {
    if (isReaction(r.associated_message_type)) continue;
    if (r.item_type && r.item_type !== 0) continue;
    const d = macAbsToDate(r.date);
    if (!d) continue;
    const key = by === "month" ? monthKey(d) : dayKey(d);
    let b = buckets.get(key);
    if (!b) {
      b = { sent: 0, received: 0 };
      buckets.set(key, b);
    }
    if (r.is_from_me) b.sent++;
    else b.received++;
    if (!min || d < min) min = d;
    if (!max || d > max) max = d;
  }
  if (!min) return [];

  const series = [];
  const cursor =
    by === "month"
      ? new Date(min.getFullYear(), min.getMonth(), 1)
      : new Date(min.getFullYear(), min.getMonth(), min.getDate());
  const end =
    by === "month"
      ? new Date(max.getFullYear(), max.getMonth(), 1)
      : new Date(max.getFullYear(), max.getMonth(), max.getDate());
  while (cursor <= end) {
    const key = by === "month" ? monthKey(cursor) : dayKey(cursor);
    const b = buckets.get(key) || { sent: 0, received: 0 };
    series.push({
      key,
      label: by === "month" ? monthLabel(cursor) : dayLabel(cursor),
      sent: b.sent,
      received: b.received,
      total: b.sent + b.received,
    });
    if (by === "month") cursor.setMonth(cursor.getMonth() + 1);
    else cursor.setDate(cursor.getDate() + 1);
  }
  return series;
}

export function seriesTotals(series) {
  return series.reduce(
    (acc, b) => {
      acc.sent += b.sent;
      acc.received += b.received;
      acc.total += b.total;
      return acc;
    },
    { sent: 0, received: 0, total: 0 }
  );
}
