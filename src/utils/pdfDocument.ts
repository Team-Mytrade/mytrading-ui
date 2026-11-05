import { jsPDF, type jsPDFOptions } from "jspdf";
import { setPdfUnicodeFont } from "../company/format";
import { publicAsset } from "./assets";

const FONTS = [
  { file: "document-Regular.ttf", style: "normal" },
  { file: "document-Bold.ttf", style: "bold" },
];

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

let loading: Promise<string[] | null> | null = null;

const loadFonts = (): Promise<string[] | null> => {
  loading ??= Promise.all(
    FONTS.map(async ({ file }) => {
      const response = await fetch(publicAsset(`fonts/${file}`));
      if (!response.ok) throw new Error(`${file}: ${response.status}`);
      return toBase64(await response.arrayBuffer());
    })
  ).catch((error) => {
    console.warn("PDF font not loaded, printing Latin text only", error);
    loading = null; // try again on the next document
    return null;
  });
  return loading;
};

const RTL = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/;
const MIRRORED: Record<string, string> = { "(": ")", ")": "(", "[": "]", "]": "[", "{": "}", "}": "{", "<": ">", ">": "<" };
const CLOSER: Record<string, string> = { "(": ")", "[": "]", "{": "}" };

/**
 * A line in display order: the Unicode bidi rules, without embedding marks. Numbers stay whole, with
 * their separators and signs (2026-11-01, 1,250.50, +971 50 123 4567, 15%). jsPDF's own engine swaps these.
 */
export const toDisplayOrder = (line: string): string => {
  const chars = Array.from(line);
  const isDigit = (c?: string) => c !== undefined && /\p{Nd}/u.test(c);
  const types = chars.map((c, i) => {
    const before = chars[i - 1];
    const after = chars[i + 1];
    if (isDigit(c)) return "N";
    if (RTL.test(c) && !/\p{P}|\p{S}/u.test(c)) return "R";
    if (/\p{L}/u.test(c)) return "L";
    if (isDigit(before) && isDigit(after) && /[\s,.\-/:\u060c\u066b\u066c]/.test(c)) return "N";
    if (isDigit(after) && !isDigit(before) && /[+\-$€£¥₹]/.test(c)) return "N";
    if (isDigit(before) && /[%$€£¥₹]/.test(c)) return "N";
    return "O";
  });
  const baseRtl = types.find((type) => type === "R" || type === "L") === "R";
  const base = baseRtl ? "R" : "L";

  // Which way each character runs: numbers go with the letters before them
  let strong = base;
  const sides = types.map((type) => {
    if (type === "R" || type === "L") strong = type;
    return type === "O" ? "" : type === "N" ? strong : type;
  });
  // Brackets pair up (the Unicode bracket rule): a pair holding text of the line's direction takes that direction;
  // holding only the other one, it follows the text before it. "Name (EMP-12) | Last day" in an Arabic line keeps
  // "(EMP-12)" whole instead of splitting its brackets.
  const opposite = base === "R" ? "L" : "R";
  const open: { closer: string; index: number }[] = [];
  const pairs: [number, number][] = [];
  chars.forEach((c, i) => {
    if (types[i] !== "O") return;
    if (CLOSER[c]) {
      open.push({ closer: CLOSER[c], index: i });
      return;
    }
    const at = open.map((bracket) => bracket.closer).lastIndexOf(c);
    if (at >= 0) {
      pairs.push([open[at].index, i]);
      open.length = at;
    }
  });
  pairs.sort((a, b) => a[0] - b[0]).forEach(([from, to]) => {
    const inside = sides.slice(from + 1, to).filter(Boolean);
    let side = "";
    if (inside.includes(base)) side = base;
    else if (inside.includes(opposite)) side = (sides.slice(0, from).reverse().find(Boolean) ?? base) === opposite ? opposite : base;
    if (side) sides[from] = sides[to] = side;
  });
  // Punctuation between two runs of the same side joins them, otherwise it takes the line's direction
  const levels = sides.map((side, i) => {
    let resolved = side;
    if (!resolved) {
      const before = sides.slice(0, i).reverse().find(Boolean) ?? base;
      const after = sides.slice(i + 1).find(Boolean) ?? base;
      resolved = before === after ? before : base;
    }
    if (resolved === "R" && types[i] !== "N") return 1;
    return baseRtl || resolved === "R" ? 2 : 0;
  });

  const ordered = chars.map((c, i) => (levels[i] % 2 ? MIRRORED[c] ?? c : c));
  for (let level = Math.max(...levels); level > 0; level--) {
    for (let i = 0; i < ordered.length; i++) {
      if (levels[i] < level) continue;
      let end = i;
      while (end + 1 < ordered.length && levels[end + 1] >= level) end++;
      const run = ordered.slice(i, end + 1).reverse();
      const runLevels = levels.slice(i, end + 1).reverse();
      ordered.splice(i, run.length, ...run);
      levels.splice(i, run.length, ...runLevels);
      i = end;
    }
  }
  return ordered.join("");
};

const hasRtl = (text: unknown): boolean => (Array.isArray(text) ? text.some(hasRtl) : typeof text === "string" && RTL.test(text));

type PdfEvents = {
  getTopics(): Record<string, Record<string, [unknown, boolean]>>;
  unsubscribe(token: string): boolean;
};

/**
 * Lines with Arabic are joined and put in display order before jsPDF gets them, and jsPDF told to leave the order
 * alone. Trailing spaces are dropped first: in a right-to-left line they would show as an indent on the left.
 */
const orderArabicText = (doc: jsPDF): void => {
  const api = doc as unknown as { processArabic(text: string): string };
  // jsPDF shapes Arabic again in every text() call; this text is already shaped and in display order, where its
  // ligature table would join a lam to the alef beside it (المالية would print as الملاية)
  const events = (doc.internal as unknown as { events: PdfEvents }).events;
  Object.entries(events.getTopics().preProcessText ?? {}).forEach(([token, [callback]]) => {
    if (callback === api.processArabic) events.unsubscribe(token);
  });
  const order = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(order);
    if (typeof value !== "string" || !RTL.test(value)) return value;
    return value.split("\n").map((line) => toDisplayOrder(api.processArabic(line.replace(/\s+$/u, "")))).join("\n");
  };
  const text = doc.text.bind(doc) as (...args: unknown[]) => jsPDF;
  (doc as unknown as { text: unknown }).text = (value: unknown, x: unknown, y: unknown, options: unknown, ...rest: unknown[]) =>
    hasRtl(value)
      ? text(order(value), x, y, { ...(options as object), isInputVisual: true, isOutputVisual: true }, ...rest)
      : text(value, x, y, options, ...rest);
};

/**
 * A new PDF that can print Arabic, Latin, Greek and Cyrillic text. The font takes over the "helvetica"
 * name, so setFont("helvetica", ...) and autoTable work unchanged.
 * Without the font (offline, say) the document still prints, with jsPDF's own Latin-only font.
 */
export async function createPdf(options?: jsPDFOptions): Promise<jsPDF> {
  const doc = new jsPDF({ compress: true, ...options });
  const fonts = await loadFonts();
  setPdfUnicodeFont(Boolean(fonts));
  if (fonts) {
    FONTS.forEach(({ file, style }, index) => {
      doc.addFileToVFS(file, fonts[index]);
      doc.addFont(file, "helvetica", style, "Identity-H");
    });
    doc.setFont("helvetica", "normal");
    orderArabicText(doc);
  }
  return doc;
}
