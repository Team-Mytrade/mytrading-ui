// Shared class names so every HRMS page matches the app's standard page layout
// (see Inventory / Sales: breadcrumb actions, stat-card row, shared table).

/** Page body under the breadcrumb. */
export const PAGE_BODY = "w-full max-w-none px-0 py-8";

/** Row of StatsCards above a table. */
export const STATS_ROW = "mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4";

/** Secondary button in the breadcrumb actions (export, refresh, month picker), next to the cyan AddButton. */
export const TOOL_BUTTON =
  "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-[#191919] dark:text-gray-300 dark:hover:bg-[#222222]";

/** Month / date input in the breadcrumb actions. */
export const TOOL_INPUT =
  "h-7 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#191919] dark:text-gray-300";

/** Content card (forms, summaries, charts). */
export const CARD = "rounded-xl border border-slate-200 bg-white shadow-sm dark:border-transparent dark:bg-[#191919]";

/** Card heading. */
export const CARD_TITLE = "text-sm font-semibold text-slate-900 dark:text-white";

/** Primary action inside a page (outside the breadcrumb). */
export const PRIMARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** Secondary action inside a page. */
export const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-[#222222] dark:text-gray-200 dark:hover:bg-[#2a2a2a]";

/** Row action icon buttons in a table (as on the Inventory / Sales pages). */
export const ROW_ICON_BUTTON =
  "rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600 dark:text-slate-500 dark:hover:bg-cyan-950/40 dark:hover:text-cyan-400";
export const ROW_ICON_BUTTON_DANGER =
  "rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/40 dark:hover:text-red-400";
