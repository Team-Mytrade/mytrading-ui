import React, { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, PencilIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { apiError } from "../../utils/apiError";
import { t } from "../../i18n/i18n";

// Table cells that edit one value in place: a pencil on hover, Enter or the tick saves, Esc or the cross cancels.
// Clicks stay inside the cell so they never open the row.

const stop = (e: React.SyntheticEvent) => e.stopPropagation();
// h-7 keeps the global 32px field style off these compact cell fields
const FIELD = "h-7 w-full min-w-0 rounded-md border border-cyan-400 bg-white px-2 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-cyan-200 dark:bg-[#222222] dark:text-white";
const PENCIL = "shrink-0 rounded p-0.5 text-gray-400 opacity-0 transition group-hover/cell:opacity-100 hover:bg-gray-100 hover:text-cyan-700 focus:opacity-100 dark:hover:bg-[#2a2a2a]";

/** The error a save gave, under the field (the message without its "field:" prefix). */
const saveError = (err: unknown, fallback: string) => apiError(err, fallback).replace(/^[a-zA-Z.]+:\s*/, "");

export interface TextPart {
  key: string;
  value: string;
  placeholder: string;
  type?: "text" | "email" | "tel";
  required?: boolean;
}

/**
 * One or more text values edited together (first and last name side by side). {@code onSave} gets only the parts
 * that changed, and throws to keep the fields open with the error.
 */
export const InlineText: React.FC<{
  parts: TextPart[];
  canEdit: boolean;
  label: string;
  children: React.ReactNode;
  onSave: (changed: Record<string, string>) => Promise<void>;
}> = ({ parts, canEdit, label, children, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const first = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) first.current?.focus();
  }, [editing]);

  const open = () => {
    setDraft(Object.fromEntries(parts.map((p) => [p.key, p.value ?? ""])));
    setError("");
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setError("");
  };
  const save = async () => {
    const missing = parts.find((p) => p.required && !draft[p.key]?.trim());
    if (missing) {
      setError(`${t("Enter")} ${missing.placeholder.toLowerCase()}`);
      return;
    }
    const changed = Object.fromEntries(parts
      .filter((p) => (draft[p.key] ?? "").trim() !== (p.value ?? "").trim())
      .map((p) => [p.key, (draft[p.key] ?? "").trim()]));
    if (Object.keys(changed).length === 0) {
      cancel();
      return;
    }
    setSaving(true);
    try {
      await onSave(changed);
      setEditing(false);
      setError("");
    } catch (err) {
      setError(saveError(err, "The change was not saved"));
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="group/cell flex min-w-0 items-center gap-1">
        <div className="min-w-0">{children}</div>
        {canEdit && (
          <button type="button" className={PENCIL} onClick={(e) => { stop(e); open(); }} aria-label={`${t("Edit")} ${label}`} title={`${t("Edit")} ${label}`}>
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="min-w-0" onClick={stop} onKeyDown={(e) => {
      e.stopPropagation();
      if (e.key === "Enter") { e.preventDefault(); save(); }
      if (e.key === "Escape") { e.preventDefault(); cancel(); }
    }}>
      <div className="flex min-w-0 items-center gap-1">
        {parts.map((p, i) => (
          <input key={p.key} ref={i === 0 ? first : undefined} type={p.type ?? "text"} className={FIELD} disabled={saving}
            aria-label={p.placeholder} placeholder={p.placeholder} value={draft[p.key] ?? ""}
            onChange={(e) => { setDraft((d) => ({ ...d, [p.key]: e.target.value })); setError(""); }} />
        ))}
        <button type="button" onClick={save} disabled={saving} aria-label={t("Save")} title={t("Save (Enter)")}
          className="shrink-0 rounded p-0.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:hover:bg-emerald-950/40">
          <CheckIcon className="h-4 w-4" />
        </button>
        <button type="button" onClick={cancel} disabled={saving} aria-label={t("Cancel")} title={t("Cancel (Esc)")}
          className="shrink-0 rounded p-0.5 text-rose-500 hover:bg-rose-50 disabled:opacity-50 dark:hover:bg-rose-950/40">
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="mt-1 text-[10px] leading-snug text-rose-600">{error}</p>}
    </div>
  );
};

/**
 * A native dropdown laid invisibly over whatever {@code children} draws (a badge or pill), so the cell keeps its own
 * look while the browser's list opens on click, above the table's scroll area, with the current value picked. The
 * select gets none of the global field style (no height, padding or second arrow), since nothing of it is seen.
 */
export const OverlaySelect: React.FC<{
  value: string;
  options: { value: string; label: string }[];
  label: string;
  disabled?: boolean;
  children: React.ReactNode;
  onChange: (value: string) => void;
}> = ({ value, options, label, disabled, children, onChange }) => (
  <span className={`relative inline-flex max-w-full ${disabled ? "opacity-60" : "cursor-pointer"}`} onClick={stop}>
    {children}
    <select aria-label={label} title={label} value={value} disabled={disabled}
      onChange={(e) => onChange(e.target.value)} onKeyDown={stop}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer", fontSize: 14 }}
      className="h-5 appearance-none">
      {!options.some((o) => o.value === value) && <option value={value}>{t("Choose…")}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </span>
);

/** A value picked from a list (the department): click the badge, pick, and it is saved straight away. */
export const InlineSelect: React.FC<{
  value: string;
  options: { value: string; label: string }[];
  canEdit: boolean;
  label: string;
  children: React.ReactNode;
  onSave: (value: string) => Promise<void>;
}> = ({ value, options, canEdit, label, children, onSave }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const pick = async (next: string) => {
    if (!next || next === value) return;
    setSaving(true);
    setError("");
    try {
      await onSave(next);
    } catch (err) {
      setError(saveError(err, "The change was not saved"));
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) return <>{children}</>;
  return (
    <div className="min-w-0">
      <OverlaySelect value={value} options={options} label={`${t("Change")} ${label}`} disabled={saving} onChange={pick}>
        <span className="inline-flex max-w-full items-center gap-0.5">
          {children}
          <ChevronDownIcon className="h-3 w-3 shrink-0 text-gray-400" aria-hidden="true" />
        </span>
      </OverlaySelect>
      {error && <p className="mt-1 text-[10px] leading-snug text-rose-600">{error}</p>}
    </div>
  );
};
