// @ts-nocheck
// Browser port of the imessage-viewer CLI's typedstream decoder.
// Verbatim from src/lib/typedstream.js — relies on a global `Buffer`
// (provided by the node-polyfill Docusaurus plugin) so the byte-level
// reads (readInt16LE / toString('latin1') / subarray) work unchanged.
//
// Minimal, faithful decoder for Apple's "typedstream" (NSArchiver) binary format,
// ported from dgelessus/python-typedstream (LGPL) — the algorithm, not the code.
// We only need enough to pull an NSAttributedString body out of the
// `message.attributedBody` BLOB used by modern macOS Messages.

const TAG_INTEGER_2 = -127;
const TAG_INTEGER_4 = -126;
const TAG_FLOATING_POINT = -125;
const TAG_NEW = -124;
const TAG_NIL = -123;
const TAG_END_OF_OBJECT = -122;
const FIRST_TAG = -128;
const LAST_TAG = -111;
const FIRST_REFERENCE_NUMBER = LAST_TAG + 1; // -110

const decoder = new TextDecoder("utf-8");

function inTagRange(h) {
  return h >= FIRST_TAG && h <= LAST_TAG;
}
function decodeRef(encoded) {
  return encoded - FIRST_REFERENCE_NUMBER;
}

function splitEncodings(buf) {
  const out = [];
  let i = 0;
  const n = buf.length;
  const qualifiers = new Set("rnNoORV".split("").map((c) => c.charCodeAt(0)));
  while (i < n) {
    const start = i;
    while (i < n && (qualifiers.has(buf[i]) || buf[i] === 0x5e /* ^ */)) i++;
    const c = buf[i];
    if (c === 0x5b /* [ */) {
      let depth = 0;
      do {
        if (buf[i] === 0x5b) depth++;
        else if (buf[i] === 0x5d) depth--;
        i++;
      } while (i < n && depth > 0);
    } else if (c === 0x7b /* { */) {
      let depth = 0;
      do {
        if (buf[i] === 0x7b) depth++;
        else if (buf[i] === 0x7d) depth--;
        i++;
      } while (i < n && depth > 0);
    } else if (c === 0x28 /* ( */) {
      let depth = 0;
      do {
        if (buf[i] === 0x28) depth++;
        else if (buf[i] === 0x29) depth--;
        i++;
      } while (i < n && depth > 0);
    } else if (c === 0x62 /* b */) {
      i++;
      while (i < n && buf[i] >= 0x30 && buf[i] <= 0x39) i++;
    } else {
      i++;
    }
    out.push(buf.subarray(start, i));
  }
  return out;
}

function parseArrayEncoding(buf) {
  let i = 1;
  let len = 0;
  while (i < buf.length && buf[i] >= 0x30 && buf[i] <= 0x39) {
    len = len * 10 + (buf[i] - 0x30);
    i++;
  }
  const element = buf.subarray(i, buf.length - 1);
  return { len, element };
}

function parseStructEncoding(buf) {
  const inner = buf.subarray(1, buf.length - 1);
  const eq = inner.indexOf(0x3d);
  if (eq < 0) return { name: inner, fields: [] };
  const name = inner.subarray(0, eq);
  const fields = splitEncodings(inner.subarray(eq + 1));
  return { name, fields };
}

class Reader {
  constructor(buf) {
    this.buf = buf;
    this.pos = 0;
    this.byteOrder = "little";
    this.sharedStrings = [];
    this._readHeader();
  }
  _eof() {
    return this.pos >= this.buf.length;
  }
  _readExact(n) {
    if (this.pos + n > this.buf.length) throw new Error("typedstream: unexpected EOF");
    const out = this.buf.subarray(this.pos, this.pos + n);
    this.pos += n;
    return out;
  }
  _readHead(head) {
    if (head !== undefined && head !== null) return head;
    if (this._eof()) throw new Error("EOF");
    const b = this.buf[this.pos];
    this.pos += 1;
    return b > 127 ? b - 256 : b;
  }
  _readInteger(head, signed) {
    head = this._readHead(head);
    if (!inTagRange(head)) return signed ? head : head & 0xff;
    if (head === TAG_INTEGER_2) {
      const b = this._readExact(2);
      return signed ? b.readInt16LE(0) : b.readUInt16LE(0);
    }
    if (head === TAG_INTEGER_4) {
      const b = this._readExact(4);
      return signed ? b.readInt32LE(0) : b.readUInt32LE(0);
    }
    throw new Error(`typedstream: invalid head tag in integer context: ${head}`);
  }
  _readFloat(head, isDouble) {
    head = this._readHead(head);
    if (head === TAG_FLOATING_POINT) {
      const b = this._readExact(isDouble ? 8 : 4);
      return isDouble ? b.readDoubleLE(0) : b.readFloatLE(0);
    }
    return this._readInteger(head, true);
  }
  _readHeader() {
    const streamerVersion = this.buf[this.pos];
    const sigLen = this.buf[this.pos + 1];
    this.pos += 2;
    const sig = this._readExact(sigLen).toString("latin1");
    this.byteOrder = sig === "typedstream" ? "big" : "little";
    if (sig !== "streamtyped" && sig !== "typedstream") {
      throw new Error(`typedstream: bad signature ${JSON.stringify(sig)}`);
    }
    if (this.byteOrder === "big") throw new Error("typedstream: big-endian unsupported");
    this.systemVersion = this._readInteger(undefined, false);
    void streamerVersion;
  }
  _readUnsharedString(head) {
    head = this._readHead(head);
    if (head === TAG_NIL) return null;
    const len = this._readInteger(head, false);
    return Buffer.from(this._readExact(len));
  }
  _readSharedString(head) {
    head = this._readHead(head);
    if (head === TAG_NIL) return null;
    if (head === TAG_NEW) {
      const s = this._readUnsharedString();
      if (s === null) throw new Error("typedstream: nil literal shared string");
      this.sharedStrings.push(s);
      return s;
    }
    const ref = this._readInteger(head, true);
    return this.sharedStrings[decodeRef(ref)];
  }
}

function* readClass(r, head) {
  head = r._readHead(head);
  while (head === TAG_NEW) {
    const name = r._readSharedString();
    const version = r._readInteger(undefined, true);
    yield { type: "class", name: name ? name.toString("latin1") : null, version };
    head = r._readHead();
  }
  if (head === TAG_NIL) {
    yield { type: "classEnd" };
  } else {
    r._readInteger(head, true);
    yield { type: "classEnd" };
  }
}

function* readObject(r, head) {
  head = r._readHead(head);
  if (head === TAG_NIL) {
    yield { type: "nilObject" };
    return;
  }
  if (head === TAG_NEW) {
    yield { type: "beginObject" };
    yield* readClass(r);
    let next = r._readHead();
    while (next !== TAG_END_OF_OBJECT) {
      yield* readTypedValues(r, next);
      next = r._readHead();
    }
    yield { type: "endObject" };
  } else {
    yield { type: "objectRef", ref: decodeRef(r._readInteger(head, true)) };
  }
}

function* readValueWithEncoding(r, enc, head) {
  const c = enc.length ? String.fromCharCode(enc[enc.length === 1 ? 0 : enc.length - 1]) : "";
  const first = enc.length ? String.fromCharCode(enc[0]) : "";
  if (first === "B") {
    yield { type: "bool", value: r._readExact(1)[0] === 1 };
  } else if (first === "C") {
    yield { type: "int", value: r._readExact(1)[0] };
  } else if (first === "c") {
    const v = r._readExact(1)[0];
    yield { type: "int", value: v > 127 ? v - 256 : v };
  } else if ("SILQ".includes(first)) {
    yield { type: "int", value: r._readInteger(head, false) };
  } else if ("silq".includes(first)) {
    yield { type: "int", value: r._readInteger(head, true) };
  } else if (first === "f") {
    yield { type: "float", value: r._readFloat(head, false) };
  } else if (first === "d") {
    yield { type: "float", value: r._readFloat(head, true) };
  } else if (first === "*") {
    const h = r._readHead(head);
    if (h === TAG_NIL) yield { type: "string", value: null };
    else if (h === TAG_NEW) {
      const s = r._readSharedString();
      yield { type: "string", value: s ? s.toString("utf-8") : null, raw: s };
    } else {
      const ref = decodeRef(r._readInteger(h, true));
      const s = r.sharedStrings[ref];
      yield { type: "string", value: s ? s.toString("utf-8") : null, raw: s, fromRef: true };
    }
  } else if (first === "%") {
    const s = r._readSharedString(head);
    yield { type: "string", value: s ? s.toString("utf-8") : null, raw: s };
  } else if (first === ":") {
    const s = r._readSharedString(head);
    yield { type: "selector", value: s ? s.toString("latin1") : null };
  } else if (first === "+") {
    const s = r._readUnsharedString(head);
    yield { type: "string", value: s ? s.toString("utf-8") : null, raw: s };
  } else if (first === "#") {
    yield* readClass(r, head);
  } else if (first === "@") {
    yield* readObject(r, head);
  } else if (first === "!") {
    yield { type: "ignore" };
  } else if (first === "[") {
    const { len, element } = parseArrayEncoding(enc);
    const ec = String.fromCharCode(element[0]);
    if (ec === "C" || ec === "c") {
      yield { type: "bytes", value: Buffer.from(r._readExact(len)) };
    } else {
      yield { type: "beginArray", length: len };
      for (let i = 0; i < len; i++) yield* readValueWithEncoding(r, element);
      yield { type: "endArray" };
    }
  } else if (first === "{") {
    const { fields } = parseStructEncoding(enc);
    yield { type: "beginStruct" };
    for (const f of fields) yield* readValueWithEncoding(r, f);
    yield { type: "endStruct" };
  } else {
    throw new Error(`typedstream: unknown encoding ${JSON.stringify(String.fromCharCode(...enc))}`);
  }
  void c;
}

function* readTypedValues(r, head) {
  head = r._readHead(head);
  const encStr = r._readSharedString(head);
  if (!encStr || encStr.length === 0) throw new Error("typedstream: empty type encoding");
  const encs = splitEncodings(encStr);
  for (const enc of encs) yield* readValueWithEncoding(r, enc);
}

function* readAll(r) {
  let guard = 0;
  while (!r._eof()) {
    if (++guard > 2_000_000) throw new Error("typedstream: runaway");
    yield* readTypedValues(r);
  }
}

export function decodeEvents(buf) {
  if (!buf || buf.length < 14) return null;
  if (buf[1] !== 11) return null;
  const sig = buf.subarray(2, 13).toString("latin1");
  if (sig !== "streamtyped" && sig !== "typedstream") return null;
  const r = new Reader(buf);
  const events = [];
  for (const e of readAll(r)) {
    events.push(e);
    if (events.length > 5_000_000) break;
  }
  return events;
}

export function parseAttributedBody(buf) {
  let events;
  try {
    events = decodeEvents(buf);
  } catch {
    events = null;
  }
  if (!events) return null;

  let sawStringClass = false;
  let text = null;
  const allStrings = [];
  for (const e of events) {
    if (e.type === "class" && e.name && /^(NSMutableString|NSString)$/.test(e.name)) {
      sawStringClass = true;
    }
    if (e.type === "string" && e.value != null) {
      allStrings.push(e.value);
      if (text === null && sawStringClass) text = e.value;
    }
    if (e.type === "bytes" && e.value) {
      const s = decoder.decode(e.value);
      allStrings.push(s);
      if (text === null && sawStringClass) text = s;
    }
  }
  if (text === null) text = allStrings.length ? allStrings[0] : "";

  const attachmentGuids = [];
  let audioTranscription = "";
  const isAttrKey = (s) => /^(__kIM|IM[A-Z]|NS)/.test(s) || /^[0-9A-Fa-f-]{30,}$/.test(s);
  for (let i = 0; i < allStrings.length; i++) {
    if (allStrings[i] === "__kIMFileTransferGUIDAttributeName") {
      for (let j = i + 1; j < Math.min(i + 4, allStrings.length); j++) {
        if (/^[0-9A-Fa-f-]{30,}$/.test(allStrings[j])) {
          attachmentGuids.push(allStrings[j]);
          break;
        }
      }
    }
    if (!audioTranscription && allStrings[i] === "IMAudioTranscription") {
      for (let j = i + 1; j < Math.min(i + 4, allStrings.length); j++) {
        const v = allStrings[j];
        if (v && !isAttrKey(v)) {
          audioTranscription = v.trim();
          break;
        }
      }
    }
  }

  return { text: text ?? "", attachmentGuids, audioTranscription };
}
