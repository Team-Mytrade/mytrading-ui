// Shared look for Settings → Data Import: the business-records imports and the HR, payroll & attendance import use
// the same text colours, notices, chips and tables, light and dark.
import { CARD, TOOL_INPUT } from "../Payroll/hrmsUi";

/** A small dropdown beside the tool inputs: the forms plugin's padding is taken off so the text fits the 28px box. */
export const TOOL_SELECT = `${TOOL_INPUT} py-0 pr-7 leading-[26px]`;

/** Table header and body cells. */
export const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
export const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";
export const THEAD = "bg-slate-50 dark:bg-[#222222]";
export const TBODY = "divide-y divide-slate-100 dark:divide-gray-800";
/** A table inside a card, with its own border (scrolls when long). */
export const TABLE_BOX = "overflow-auto rounded-lg border border-slate-100 dark:border-gray-800";
/** A card's heading strip above a table. */
export const CARD_HEAD = "border-b border-slate-100 px-4 py-3 dark:border-gray-800";

/** Helper text under a heading or beside a control. */
export const NOTE = "text-xs text-slate-500 dark:text-gray-400";
/** Empty and loading lines. */
export const EMPTY = "text-sm text-slate-400 dark:text-gray-500";
/** The page's opening explanation. */
export const INTRO = `${CARD} p-4 text-sm text-slate-600 dark:text-gray-300`;

/** Coloured text: a problem, something to look at, all good. */
export const BAD_TEXT = "text-red-600 dark:text-red-400";
export const WARN_TEXT = "text-amber-700 dark:text-amber-300";
export const GOOD_TEXT = "text-emerald-700 dark:text-emerald-300";

/** Notices: problems found, all rows correct / imported, something to do first. */
export const ALERT_BAD = "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200";
export const ALERT_GOOD = "rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200";
export const ALERT_WARN = "rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200";

/** A panel inside a card (a choice of what to import, a fix-up box). */
export const PANEL = "rounded-lg border border-slate-200 bg-white p-3 dark:border-gray-700 dark:bg-[#1e1e1e]";

/** Status chips. */
const CHIP = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium";
export const CHIP_GOOD = `${CHIP} bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300`;
export const CHIP_WARN = `${CHIP} bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300`;
export const CHIP_BAD = `${CHIP} bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300`;
export const CHIP_NEUTRAL = `${CHIP} bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-300`;

/** The icon beside a kind of record. */
export const KIND_ICON = "h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-400";

export const saveBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
