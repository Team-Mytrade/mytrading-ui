import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/outline";

export type SearchableOption = {
  value: string | number;
  label: string;
  /** Extra words that also find this option, e.g. ["TN"] for Tamil Nadu. */
  keywords?: string[];
};

type SearchableSelectProps = {
  label: string;
  value: string | number | null | undefined;
  options: SearchableOption[];
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  /** Text shown when nothing matches. */
  noResultsText?: string;
  /**
   * For optional fields: a first row that clears the value, e.g. "None (main category)".
   * Also shown as the box text while nothing is selected, so "empty" is a clear choice.
   */
  emptyOptionLabel?: string;
};

/**
 * Ranks how well an option matches what the user typed.
 *   0 = label starts with it       ("ta"  → Tamil Nadu)
 *   1 = a word starts with it       ("pra" → Andhra Pradesh) or a keyword ("tn" → Tamil Nadu)
 *   2 = it appears anywhere         ("adu" → Tamil Nadu)  — only after 2+ letters
 *  -1 = no match
 */
const matchRank = (option: SearchableOption, term: string): number => {
  const label = option.label.toLowerCase();
  if (label.startsWith(term)) return 0;
  const words = label.split(/[\s-]+/);
  const keywords = (option.keywords || []).map((item) => item.toLowerCase());
  if (words.some((word) => word.startsWith(term)) || keywords.some((word) => word.startsWith(term))) return 1;
  if (term.length >= 2 && label.includes(term)) return 2;
  return -1;
};

/** Dropdown with a search box: type a few letters and only the matching options are shown. */
export default function SearchableSelect({
  label,
  value,
  options,
  onChange,
  required,
  placeholder = "Type to search",
  noResultsText = "No match found",
  emptyOptionLabel,
}: SearchableSelectProps) {
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selected = options.find((option) => String(option.value) === String(value ?? ""));
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  // -1 = nothing highlighted, so an accidental Enter never picks a value.
  const [highlight, setHighlight] = useState(-1);

  // Keep the box text in step when the value changes from outside (edit, reset).
  useEffect(() => {
    if (!open) setQuery(selected?.label ?? "");
  }, [selected?.label, open]);

  const term = query.trim().toLowerCase();
  const isShowingSelection = selected && query === selected.label;

  const filtered = useMemo(() => {
    // Opening the list on a selected value (or an empty box) shows everything.
    if (!term || isShowingSelection) return options;
    return options
      .map((option) => ({ option, rank: matchRank(option, term) }))
      .filter((item) => item.rank >= 0)
      .sort((a, b) => a.rank - b.rank || a.option.label.localeCompare(b.option.label))
      .map((item) => item.option);
  }, [options, term, isShowingSelection]);

  // The "None" row (optional fields only) is shown when nothing is being searched.
  const showEmptyRow = Boolean(emptyOptionLabel) && (!term || Boolean(isShowingSelection));
  const rowOffset = showEmptyRow ? 1 : 0;
  const rowCount = filtered.length + rowOffset;

  // Keep the highlighted row visible while using the arrow keys.
  useEffect(() => {
    if (highlight >= 0) listRef.current?.children[highlight]?.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const choose = (option: SearchableOption) => {
    onChange(String(option.value));
    setQuery(option.label);
    setOpen(false);
  };

  const clear = () => {
    onChange("");
    setQuery("");
    setOpen(false);
    setHighlight(-1);
  };

  /** Picks the row at a list position (the "None" row counts when shown). */
  const chooseRow = (index: number) => {
    if (showEmptyRow && index === 0) clear();
    else if (filtered[index - rowOffset]) choose(filtered[index - rowOffset]);
  };

  /** Leaving the box: accept an exact or single match, otherwise go back to the saved value. */
  const commitOnLeave = () => {
    setOpen(false);
    if (!term) {
      if (selected) onChange("");
      return;
    }
    const exact = options.find((option) => option.label.toLowerCase() === term);
    const pick = exact ?? (filtered.length === 1 ? filtered[0] : undefined);
    if (pick) choose(pick);
    else setQuery(selected?.label ?? "");
  };

  // Close when clicking anywhere outside.
  useEffect(() => {
    if (!open) return undefined;
    const onOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) commitOnLeave();
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, term, filtered, selected]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => Math.min(current + 1, rowCount - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      // Enter picks the highlighted option and must NOT submit the form.
      if (open && highlight >= 0 && highlight < rowCount) {
        event.preventDefault();
        chooseRow(highlight);
      } else if (open) {
        event.preventDefault(); // nothing highlighted: do nothing, and don't submit the form
      }
    } else if (event.key === "Escape") {
      if (open) {
        // Close only the list, not the whole form dialog.
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation();
        setOpen(false);
        setQuery(selected?.label ?? "");
      }
    } else if (event.key === "Tab") {
      if (open) commitOnLeave();
    }
  };

  const hasText = query.length > 0;

  return (
    <div ref={wrapperRef} className="relative">
      {/* Label above a 32px field, like the Create Employee form (it used to float inside a taller box) */}
      <label className="mb-0.5 block text-xs font-semibold text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-required={required}
        autoComplete="off"
        value={query}
        placeholder={open ? placeholder : emptyOptionLabel || " "}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          // While typing, the best match is highlighted so Enter picks it.
          setHighlight(event.target.value.trim() ? 0 : -1);
        }}
        onFocus={(event) => {
          setOpen(true);
          // Only the current value is highlighted; with no value, nothing is.
          const index = selected ? filtered.findIndex((option) => option === selected) : -1;
          setHighlight(index >= 0 ? index + rowOffset : -1);
          event.target.select();
        }}
        onKeyDown={onKeyDown}
        className="h-8 w-full rounded-lg border border-gray-300 bg-white px-2.5 pr-14 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
      />

      <div className="absolute inset-y-0 right-2.5 flex items-center gap-1">
        {hasText && (
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(event) => event.preventDefault()}
            onClick={clear}
            className="rounded p-0.5 text-slate-400 hover:text-slate-600 dark:text-gray-500 dark:hover:text-gray-300"
            aria-label={`Clear ${label}`}
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
        <ChevronDownIcon className={`h-4 w-4 text-slate-400 transition dark:text-gray-500 ${open ? "rotate-180" : ""}`} />
      </div>
      </div>

      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {showEmptyRow && (
            <li
              role="option"
              aria-selected={!selected}
              onMouseDown={(event) => event.preventDefault()}
              onClick={clear}
              onMouseEnter={() => setHighlight(0)}
              className={`flex cursor-pointer items-center justify-between border-b border-slate-100 px-4 py-2 italic dark:border-gray-800 ${
                highlight === 0 ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300" : "text-slate-500 dark:text-gray-400"
              }`}
            >
              {emptyOptionLabel}
              {!selected && <CheckIcon className="h-4 w-4 text-cyan-600" aria-hidden="true" />}
            </li>
          )}
          {filtered.length === 0 ? (
            <li className="px-4 py-2 text-slate-400 dark:text-gray-500">{noResultsText}</li>
          ) : (
            filtered.map((option, index) => {
              const isSelected = String(option.value) === String(value ?? "");
              const row = index + rowOffset;
              return (
                <li
                  key={String(option.value)}
                  role="option"
                  aria-selected={isSelected}
                  // preventDefault keeps focus in the input, so the click is not lost to a blur.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                  onMouseEnter={() => setHighlight(row)}
                  className={`flex cursor-pointer items-center justify-between px-4 py-2 ${
                    row === highlight ? "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300" : "text-slate-700 dark:text-gray-200"
                  } ${isSelected ? "font-semibold" : ""}`}
                >
                  {option.label}
                  {isSelected && <CheckIcon className="h-4 w-4 text-cyan-600" aria-hidden="true" />}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
