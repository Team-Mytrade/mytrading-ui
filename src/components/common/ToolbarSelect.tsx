import React from "react";
import { ChevronDown } from "lucide-react";

type ToolbarSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/**
 * A dropdown sized for the breadcrumb toolbar (same height as the toolbar buttons and the month switcher). The
 * browser's own arrow is replaced by an icon in its own space, so the text is never cut off or covered.
 */
const ToolbarSelect: React.FC<ToolbarSelectProps> = ({ className = "", children, ...props }) => (
  <div className={`relative inline-flex ${className}`}>
    <select
      {...props}
      className="h-8 w-full cursor-pointer appearance-none rounded-full border border-slate-200 bg-white/80 py-0 pl-3.5 pr-8 text-xs font-bold leading-8 tracking-wide text-slate-800 shadow-2xs outline-none transition hover:bg-white focus-visible:border-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-[#191919] dark:text-white"
    >
      {children}
    </select>
    <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500 dark:text-gray-400" />
  </div>
);

export default ToolbarSelect;
