// @ts-nocheck
// Browser port of src/lib/plist.js's NSKeyedArchiver unarchiver.
//
// The CLI shelled out to macOS `plutil` to normalize a (binary) plist into XML,
// then parsed that. In the browser we parse the binary plist directly with the
// pure-JS `bplist-parser` (per the "keep plist as a browser-only dependency"
// requirement) and run the same NSKeyedArchiver object-graph resolution on top.
import * as bplistNs from "bplist-parser";

const bplist: any = (bplistNs as any).default || bplistNs;

/** True for a bplist-parser UID node (it tags them as `{ UID: <int> }`). */
function uidOf(node) {
  return node && typeof node === "object" && typeof node.UID === "number" ? node.UID : null;
}

/** Parse any binary-plist buffer into a JS value (data → Buffer, UIDs preserved). */
export function parsePlist(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const parsed = bplist.parseBuffer(buf);
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

/**
 * Resolve an NSKeyedArchiver plist into a plain object graph.
 * NSString/NSURL → string, NSDictionary/NSArray → js, NSData → Buffer,
 * unknown classes → their raw dict (with $class stripped).
 */
export function unarchive(buffer) {
  let root;
  try {
    root = parsePlist(buffer);
  } catch {
    return null;
  }
  if (!root || typeof root !== "object" || !Array.isArray(root["$objects"])) return root;
  const objects = root["$objects"];
  const seen = new Map();

  function resolve(node) {
    const uid = uidOf(node);
    if (uid !== null) {
      const idx = uid;
      if (seen.has(idx)) return seen.get(idx);
      const target = objects[idx];
      const placeholder = {};
      seen.set(idx, placeholder);
      const resolved = resolveObject(target);
      seen.set(idx, resolved);
      return resolved;
    }
    if (Array.isArray(node)) return node.map(resolve);
    if (Buffer.isBuffer(node)) return node;
    if (node && typeof node === "object") {
      const out = {};
      for (const [k, v] of Object.entries(node)) out[k] = resolve(v);
      return out;
    }
    return node;
  }

  function resolveObject(obj) {
    if (obj === "$null") return null;
    if (uidOf(obj) !== null) return resolve(obj);
    if (Array.isArray(obj)) return obj.map(resolve);
    if (Buffer.isBuffer(obj)) return obj;
    if (obj && typeof obj === "object") {
      const clsUid = uidOf(obj["$class"]);
      const cls = clsUid !== null ? objects[clsUid] : null;
      const clsName = cls && cls["$classname"];
      if (clsName === "NSString" || clsName === "NSMutableString") return obj["NS.string"] ?? "";
      if (clsName === "NSURL") {
        const rel = resolve(obj["NS.relative"]);
        return typeof rel === "string" ? rel : rel;
      }
      if (clsName === "NSArray" || clsName === "NSMutableArray") {
        return (obj["NS.objects"] || []).map(resolve);
      }
      if (clsName === "NSDictionary" || clsName === "NSMutableDictionary") {
        const keys = (obj["NS.keys"] || []).map(resolve);
        const vals = (obj["NS.objects"] || []).map(resolve);
        const d = {};
        keys.forEach((k, idx) => (d[k] = vals[idx]));
        return d;
      }
      if (clsName === "NSData" || clsName === "NSMutableData") return obj["NS.data"];
      const out = { __class: clsName || undefined };
      for (const [k, v] of Object.entries(obj)) {
        if (k === "$class") continue;
        out[k] = resolve(v);
      }
      return out;
    }
    return obj;
  }

  return resolve(root["$top"]);
}
