import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { t } from "../../i18n/i18n";

/**
 * Gives every dropdown in the app a search box. Mounted once (App): opening any single-choice <select> on a
 * desktop shows a list with a filter above it instead of the browser's own list. Picking an option sets the
 * select's value and fires its normal change event, so each page's onChange works as before.
 *
 * Left alone: multiple / sized / disabled selects, touch screens (their native pickers are better) and any
 * select marked data-native-select.
 */

type Item = { value: string; label: string; disabled: boolean };
type Open = { select: HTMLSelectElement; items: Item[]; rect: DOMRect };

const LIST_HEIGHT = 288;

const enhanced = (target: EventTarget | null): target is HTMLSelectElement =>
  target instanceof HTMLSelectElement
  && !target.multiple
  && target.size <= 1
  && !target.disabled
  && !target.hasAttribute("data-native-select")
  && window.matchMedia("(pointer: fine)").matches;

const itemsOf = (select: HTMLSelectElement): Item[] =>
  Array.from(select.options).map((option) => ({
    value: option.value,
    label: option.textContent?.trim() || option.value,
    disabled: option.disabled || (option.parentElement instanceof HTMLOptGroupElement && option.parentElement.disabled),
  }));

/** Best matches first: the label starts with it, then a word does, then it appears anywhere. */
const rank = (label: string, term: string) => {
  const text = label.toLowerCase();
  if (text.startsWith(term)) return 0;
  if (text.split(/[\s\-/(),.]+/).some((word) => word.startsWith(term))) return 1;
  return text.includes(term) ? 2 : -1;
};

/** Sets the value the way a user's pick would, so React's onChange fires. */
const choose = (select: HTMLSelectElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
  if (setter) setter.call(select, value);
  else select.value = value;
  select.dispatchEvent(new Event("input", { bubbles: true }));
  select.dispatchEvent(new Event("change", { bubbles: true }));
};

export default function SelectSearch() {
  const [open, setOpen] = useState<Open | null>(null);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  // The open select, for the document listeners
  const openRef = useRef<Open | null>(null);
  openRef.current = open;

  const close = useCallback((refocus = true) => {
    const current = openRef.current;
    setOpen(null);
    if (current && refocus) current.select.focus({ preventScroll: true });
  }, []);

  const show = useCallback((select: HTMLSelectElement) => {
    const items = itemsOf(select);
    if (items.length === 0) return;
    setQuery("");
    setHighlight(Math.max(0, items.findIndex((item) => item.value === select.value)));
    setOpen({ select, items, rect: select.getBoundingClientRect() });
  }, []);

  // Open in place of the browser's list: on a click, or Enter / Space / Alt+Down / F4 on a focused select
  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (event.button !== 0 || !enhanced(event.target)) return;
      event.preventDefault();
      const select = event.target;
      // A second click on the same select closes its list
      if (openRef.current?.select === select) {
        close();
        return;
      }
      select.focus({ preventScroll: true });
      show(select);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!enhanced(event.target)) return;
      const opens = event.key === "Enter" || event.key === " " || event.key === "F4" || (event.altKey && event.key === "ArrowDown");
      if (!opens) return;
      event.preventDefault();
      show(event.target);
    };
    document.addEventListener("mousedown", onMouseDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [show, close]);

  // Close on a click outside, a resize, or when the page under it scrolls
  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node) && event.target !== open.select) close(false);
    };
    const onScroll = (event: Event) => {
      if (!panelRef.current?.contains(event.target as Node)) close(false);
    };
    const onResize = () => close(false);
    document.addEventListener("mousedown", onOutside, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onOutside, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, close]);

  const term = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!open) return [];
    if (!term) return open.items;
    return open.items
      .map((item) => ({ item, score: rank(item.label, term) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => a.score - b.score)
      .map((entry) => entry.item);
  }, [open, term]);

  useEffect(() => {
    if (highlight >= 0) listRef.current?.children[highlight]?.scrollIntoView({ block: "nearest" });
  }, [highlight, filtered]);

  if (!open) return null;

  const pick = (item: Item) => {
    if (item.disabled) return;
    if (item.value !== open.select.value) choose(open.select, item.value);
    close();
  };

  const move = (step: number) => {
    if (filtered.length === 0) return;
    let next = highlight;
    for (let i = 0; i < filtered.length; i++) {
      next = (next + step + filtered.length) % filtered.length;
      if (!filtered[next].disabled) break;
    }
    setHighlight(next);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // Keys stay in the list: Escape closes it, not the drawer or popup behind
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    if (event.key === "ArrowDown") { event.preventDefault(); move(1); }
    else if (event.key === "ArrowUp") { event.preventDefault(); move(-1); }
    else if (event.key === "Enter") { event.preventDefault(); if (filtered[highlight]) pick(filtered[highlight]); }
    else if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "Tab") { close(); }
  };

  // Below the select, or above it when there's no room; at least as wide as the select
  const { rect } = open;
  const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 16);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  const below = window.innerHeight - rect.bottom;
  const above = below < LIST_HEIGHT + 56 && rect.top > below;
  const position = above
    ? { bottom: window.innerHeight - rect.top + 4, left, width }
    : { top: rect.bottom + 4, left, width };

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t("Search options")}
      // Clicks inside never reach the page's own "click outside" handlers
      onMouseDown={(event) => { event.stopPropagation(); event.nativeEvent.stopImmediatePropagation(); }}
      style={{ position: "fixed", zIndex: 100000, ...position }}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-900"
    >
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/60">
        <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          autoFocus
          value={query}
          onChange={(event) => { setQuery(event.target.value); setHighlight(0); }}
          onKeyDown={onKeyDown}
          placeholder={t("Type to filter")}
          aria-label={t("Filter options")}
          className="w-full border-0 bg-transparent p-0 text-sm text-slate-800 shadow-none outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:outline-none focus:ring-0 dark:text-gray-100"
        />
        {open.items.length > 0 && (
          <span className="shrink-0 text-[11px] text-slate-400">{filtered.length}/{open.items.length}</span>
        )}
      </div>
      <ul ref={listRef} role="listbox" className="overflow-y-auto py-1" style={{ maxHeight: LIST_HEIGHT }}>
        {filtered.length === 0 && (
          <li className="px-3 py-3 text-center text-sm text-slate-500 dark:text-gray-400">{t("No match found")}</li>
        )}
        {filtered.map((item, index) => {
          const selected = item.value === open.select.value;
          return (
            <li
              key={`${item.value}-${index}`}
              role="option"
              aria-selected={selected}
              aria-disabled={item.disabled}
              onMouseEnter={() => !item.disabled && setHighlight(index)}
              onClick={() => pick(item)}
              className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-sm ${
                item.disabled
                  ? "cursor-not-allowed text-slate-300 dark:text-gray-600"
                  : index === highlight
                    ? "bg-cyan-50 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200"
                    : "text-slate-700 dark:text-gray-200"
              } ${item.value === "" ? "italic text-slate-500" : ""}`}
            >
              <span className="truncate">{item.label}</span>
              {selected && <CheckIcon className="h-4 w-4 shrink-0 text-cyan-600" />}
            </li>
          );
        })}
      </ul>
    </div>,
    document.body,
  );
}
