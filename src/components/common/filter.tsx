import React, { useEffect, useRef, useState } from "react";
import { FunnelIcon } from "@heroicons/react/24/outline";

export type FilterOption = {
  label: string;
  value: string;
};

type FilterPopoverProps = {
  title?: string;
  children?: React.ReactNode;
  onApply?: () => void;
  onReset?: () => void;
  buttonLabel?: string;
  resetLabel?: string;
  applyLabel?: string;
  className?: string;
  closeLabel?: string;
  widthClassName?: string;
  showFooter?: boolean;
  label?: string;
  value?: string;
  options?: FilterOption[];
  onChange?: (value: string) => void;
};

export const FilterPopover: React.FC<FilterPopoverProps> = ({
  title = "Filter Items",
  children,
  label = "Status",
  value = "",
  options = [],
  onChange,
  onApply,
  onReset,
  buttonLabel = "Filters",
  resetLabel = "Reset",
  applyLabel = "Apply",
  className = "",
  closeLabel = "Close",
  widthClassName = "w-64",
  showFooter = true,
}) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const hasCustomContent = children !== undefined;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`h-10 min-w-[88px] inline-flex items-center justify-center gap-2 rounded-lg border px-3 transition-colors ${
          open
            ? "border-cyan-300 bg-cyan-50 text-cyan-700"
            : "border-cyan-200 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
        }`}
      >
        <FunnelIcon className="h-4 w-4" />
        <span className="text-sm font-medium">{buttonLabel}</span>
      </button>

      {open && (
        <div className={`absolute right-0 top-12 z-40 rounded-2xl border border-gray-200 bg-white p-4 shadow-xl ${widthClassName}`}>
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-gray-400 hover:text-gray-600"
            >
              {closeLabel}
            </button>
          </div>

          {hasCustomContent ? (
            <div>{children}</div>
          ) : (
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>
              <select
                value={value}
                onChange={(event) => onChange?.(event.target.value)}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {showFooter && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  onReset?.();
                  setOpen(false);
                }}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                {resetLabel}
              </button>
              <button
                type="button"
                onClick={() => {
                  onApply?.();
                  setOpen(false);
                }}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700"
              >
                {applyLabel}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FilterPopover;
