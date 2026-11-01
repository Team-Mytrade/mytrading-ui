// Builds public/fonts/document-{Regular,Bold}.ttf: Noto Sans (Latin, Greek, Cyrillic, currency signs) plus the Arabic
// letters and joined forms of Noto Naskh Arabic, as one font. jsPDF prints each string with one font, and its Arabic
// support picks the joined forms (Presentation Forms) itself, so layout tables and hints are left out.
// Both fonts are 1000 units per em. SIL Open Font License: see public/fonts/OFL.txt.
// Usage: node scripts/merge-pdf-fonts.cjs <folder with the Noto fonts>
const fs = require("fs");
const path = require("path");

const parse = (file) => {
  const b = fs.readFileSync(file);
  const tables = {};
  for (let i = 0; i < b.readUInt16BE(4); i++) {
    const o = 12 + i * 16;
    tables[b.toString("latin1", o, o + 4)] = b.subarray(b.readUInt32BE(o + 8), b.readUInt32BE(o + 8) + b.readUInt32BE(o + 12));
  }
  const glyphs = tables.maxp.readUInt16BE(4);
  const longLoca = tables.head.readInt16BE(50) === 1;
  const offset = (g) => (longLoca ? tables.loca.readUInt32BE(g * 4) : tables.loca.readUInt16BE(g * 2) * 2);
  const longMetrics = tables.hhea.readUInt16BE(34);
  const metric = (g) => {
    if (g < longMetrics) return [tables.hmtx.readUInt16BE(g * 4), tables.hmtx.readInt16BE(g * 4 + 2)];
    return [tables.hmtx.readUInt16BE((longMetrics - 1) * 4), tables.hmtx.readInt16BE(longMetrics * 4 + (g - longMetrics) * 2)];
  };
  return { tables, glyphs, glyph: (g) => tables.glyf.subarray(offset(g), offset(g + 1)), metric, cmap: readCmap(tables.cmap) };
};

function readCmap(cmap) {
  const map = new Map();
  for (let i = 0; i < cmap.readUInt16BE(2); i++) {
    const sub = cmap.readUInt32BE(4 + i * 8 + 4);
    const format = cmap.readUInt16BE(sub);
    if (format === 12) {
      const groups = cmap.readUInt32BE(sub + 12);
      for (let g = 0; g < groups; g++) {
        const start = cmap.readUInt32BE(sub + 16 + g * 12), end = cmap.readUInt32BE(sub + 20 + g * 12), id = cmap.readUInt32BE(sub + 24 + g * 12);
        for (let c = start; c <= end; c++) map.set(c, id + c - start);
      }
    } else if (format === 4) {
      const seg = cmap.readUInt16BE(sub + 6) / 2;
      const ends = sub + 14, starts = ends + seg * 2 + 2, deltas = starts + seg * 2, ranges = deltas + seg * 2;
      for (let s = 0; s < seg; s++) {
        const end = cmap.readUInt16BE(ends + s * 2), start = cmap.readUInt16BE(starts + s * 2);
        const delta = cmap.readInt16BE(deltas + s * 2), range = cmap.readUInt16BE(ranges + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let id = range === 0 ? c : cmap.readUInt16BE(ranges + s * 2 + range + (c - start) * 2);
          if (id !== 0) id = (id + delta) & 0xffff;
          if (id) map.set(c, id);
        }
      }
    }
  }
  return map;
}

// Without hints: the two fonts' hinting programs can't share one font. Composite glyphs get their parts' new numbers.
function copyGlyph(data, renumber) {
  if (data.length === 0) return data;
  const contours = data.readInt16BE(0);
  if (contours >= 0) {
    const lengthAt = 10 + contours * 2;
    const instructions = data.readUInt16BE(lengthAt);
    const out = Buffer.concat([data.subarray(0, lengthAt), Buffer.from([0, 0]), data.subarray(lengthAt + 2 + instructions)]);
    return out;
  }
  const out = Buffer.from(data);
  let at = 10, flags;
  do {
    flags = out.readUInt16BE(at);
    out.writeUInt16BE(flags & ~0x0100, at);
    out.writeUInt16BE(renumber(out.readUInt16BE(at + 2)), at + 2);
    at += 4 + (flags & 1 ? 4 : 2) + (flags & 8 ? 2 : flags & 0x40 ? 4 : flags & 0x80 ? 8 : 0);
  } while (flags & 0x20);
  return out.subarray(0, at);
}

const partsOf = (data) => {
  const parts = [];
  if (data.length === 0 || data.readInt16BE(0) >= 0) return parts;
  let at = 10, flags;
  do {
    flags = data.readUInt16BE(at);
    parts.push(data.readUInt16BE(at + 2));
    at += 4 + (flags & 1 ? 4 : 2) + (flags & 8 ? 2 : flags & 0x40 ? 4 : flags & 0x80 ? 8 : 0);
  } while (flags & 0x20);
  return parts;
};

const isArabic = (c) => (c >= 0x600 && c <= 0x6ff) || (c >= 0x750 && c <= 0x77f) || (c >= 0xfb50 && c <= 0xfdff) || (c >= 0xfe70 && c <= 0xfefc);

function merge(latinFile, arabicFile, outFile, familyName) {
  const latin = parse(latinFile), arabic = parse(arabicFile);

  // Latin keeps its numbering; the Arabic glyphs needed (and their parts) follow
  const added = new Map();
  const add = (g) => {
    if (added.has(g)) return;
    added.set(g, latin.glyphs + added.size);
    partsOf(arabic.glyph(g)).forEach(add);
  };
  const cmap = new Map(latin.cmap);
  [...arabic.cmap.entries()].filter(([c]) => isArabic(c)).forEach(([c, g]) => add(g));
  [...arabic.cmap.entries()].filter(([c]) => isArabic(c)).forEach(([c, g]) => cmap.set(c, added.get(g)));

  const glyphs = [];
  const metrics = [];
  for (let g = 0; g < latin.glyphs; g++) {
    glyphs.push(copyGlyph(latin.glyph(g), (x) => x));
    metrics.push(latin.metric(g));
  }
  for (const g of added.keys()) {
    glyphs.push(copyGlyph(arabic.glyph(g), (x) => added.get(x)));
    metrics.push(arabic.metric(g));
  }

  const glyf = Buffer.concat(glyphs.map((d) => (d.length % 4 ? Buffer.concat([d, Buffer.alloc(4 - (d.length % 4))]) : d)));
  const loca = Buffer.alloc((glyphs.length + 1) * 4);
  let position = 0;
  glyphs.forEach((d, i) => {
    loca.writeUInt32BE(position, i * 4);
    position += d.length + (d.length % 4 ? 4 - (d.length % 4) : 0);
  });
  loca.writeUInt32BE(position, glyphs.length * 4);
  const hmtx = Buffer.alloc(glyphs.length * 4);
  metrics.forEach(([advance, bearing], i) => {
    hmtx.writeUInt16BE(advance, i * 4);
    hmtx.writeInt16BE(bearing, i * 4 + 2);
  });

  const head = Buffer.from(latin.tables.head);
  head.writeInt16BE(1, 50); // long loca
  head.writeUInt32BE(0, 8); // checksum adjustment, set below
  const hhea = Buffer.from(latin.tables.hhea);
  hhea.writeUInt16BE(glyphs.length, 34);
  hhea.writeInt16BE(Math.max(hhea.readInt16BE(4), arabic.tables.hhea.readInt16BE(4)), 4);
  hhea.writeInt16BE(Math.min(hhea.readInt16BE(6), arabic.tables.hhea.readInt16BE(6)), 6);
  const maxp = Buffer.from(latin.tables.maxp);
  maxp.writeUInt16BE(glyphs.length, 4);
  for (let at = 6; at < 32; at += 2) maxp.writeUInt16BE(Math.max(maxp.readUInt16BE(at), arabic.tables.maxp.readUInt16BE(at)), at);
  const post = Buffer.from(latin.tables.post.subarray(0, 32));
  post.writeUInt32BE(0x00030000, 0); // no glyph names

  const tables = { "OS/2": latin.tables["OS/2"], cmap: buildCmap(cmap), glyf, head, hhea, hmtx, loca, maxp, name: buildName(familyName), post };
  fs.writeFileSync(outFile, assemble(tables));
  return { glyphs: glyphs.length, bytes: fs.statSync(outFile).size };
}

function buildCmap(map) {
  const codes = [...map.keys()].filter((c) => c < 0xffff).sort((a, b) => a - b);
  const segs = [];
  for (const c of codes) {
    const last = segs[segs.length - 1];
    if (last && last.end === c - 1 && map.get(c) - c === last.delta) last.end = c;
    else segs.push({ start: c, end: c, delta: map.get(c) - c });
  }
  segs.push({ start: 0xffff, end: 0xffff, delta: 1 });
  const n = segs.length;
  const length = 16 + n * 8;
  const out = Buffer.alloc(12 + length);
  out.writeUInt16BE(0, 0);
  out.writeUInt16BE(1, 2);
  out.writeUInt16BE(3, 4); // Windows
  out.writeUInt16BE(1, 6); // Unicode BMP
  out.writeUInt32BE(12, 8);
  const s = 12;
  out.writeUInt16BE(4, s);
  out.writeUInt16BE(length, s + 2);
  out.writeUInt16BE(n * 2, s + 6);
  const power = Math.floor(Math.log2(n));
  out.writeUInt16BE(2 * 2 ** power, s + 8);
  out.writeUInt16BE(power, s + 10);
  out.writeUInt16BE(2 * n - 2 * 2 ** power, s + 12);
  segs.forEach((seg, i) => {
    out.writeUInt16BE(seg.end, s + 14 + i * 2);
    out.writeUInt16BE(seg.start, s + 16 + n * 2 + i * 2);
    out.writeUInt16BE(seg.delta & 0xffff, s + 16 + n * 4 + i * 2);
  });
  return out;
}

function buildName(family) {
  const records = [[1, family], [2, family.includes("Bold") ? "Bold" : "Regular"], [4, family], [6, family.replace(/\s+/g, "-")]];
  const strings = records.map(([, text]) => Buffer.from(text, "utf16le").swap16());
  const out = Buffer.alloc(6 + records.length * 12 + strings.reduce((t, x) => t + x.length, 0));
  out.writeUInt16BE(records.length, 2);
  out.writeUInt16BE(6 + records.length * 12, 4);
  let at = 0;
  records.forEach(([id], i) => {
    const o = 6 + i * 12;
    out.writeUInt16BE(3, o);
    out.writeUInt16BE(1, o + 2);
    out.writeUInt16BE(0x409, o + 4);
    out.writeUInt16BE(id, o + 6);
    out.writeUInt16BE(strings[i].length, o + 8);
    out.writeUInt16BE(at, o + 10);
    strings[i].copy(out, 6 + records.length * 12 + at);
    at += strings[i].length;
  });
  return out;
}

const checksum = (b) => {
  const padded = b.length % 4 ? Buffer.concat([b, Buffer.alloc(4 - (b.length % 4))]) : b;
  let sum = 0;
  for (let i = 0; i < padded.length; i += 4) sum = (sum + padded.readUInt32BE(i)) >>> 0;
  return sum;
};

function assemble(tables) {
  const tags = Object.keys(tables).sort();
  const n = tags.length;
  const power = Math.floor(Math.log2(n));
  const header = Buffer.alloc(12 + n * 16);
  header.writeUInt32BE(0x00010000, 0);
  header.writeUInt16BE(n, 4);
  header.writeUInt16BE(16 * 2 ** power, 6);
  header.writeUInt16BE(power, 8);
  header.writeUInt16BE(n * 16 - 16 * 2 ** power, 10);
  let offset = header.length;
  const bodies = [];
  let headOffset = 0;
  tags.forEach((tag, i) => {
    const data = tables[tag];
    const o = 12 + i * 16;
    header.write(tag, o, 4, "latin1");
    header.writeUInt32BE(checksum(data), o + 4);
    header.writeUInt32BE(offset, o + 8);
    header.writeUInt32BE(data.length, o + 12);
    if (tag === "head") headOffset = offset;
    const padded = data.length % 4 ? Buffer.concat([data, Buffer.alloc(4 - (data.length % 4))]) : data;
    bodies.push(padded);
    offset += padded.length;
  });
  const font = Buffer.concat([header, ...bodies]);
  font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, headOffset + 8);
  return font;
}

const [source] = process.argv.slice(2);
const out = path.join(__dirname, "..", "public", "fonts");
fs.mkdirSync(out, { recursive: true });
console.log(merge(path.join(source, "NotoSans-Regular.ttf"), path.join(source, "NotoNaskhArabic-Regular.ttf"), path.join(out, "document-Regular.ttf"), "MyTrade Document"));
console.log(merge(path.join(source, "NotoSans-Bold.ttf"), path.join(source, "NotoNaskhArabic-Bold.ttf"), path.join(out, "document-Bold.ttf"), "MyTrade Document Bold"));
