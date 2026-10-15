import React from "react";
import { AR_STATUS_TONES, INVOICE_STATUS_TONES, labelOf } from "./invoiceShared";

export const StatusBadge = ({ status, tones = INVOICE_STATUS_TONES }: { status?: string; tones?: Record<string, string> }) => (
  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${(status && tones[status]) || "bg-gray-50 text-gray-700 border-gray-200"}`}>
    {labelOf(status)}
  </span>
);

export const ArStatusBadge = ({ status }: { status?: string }) => <StatusBadge status={status} tones={AR_STATUS_TONES} />;

export const ActionButton = ({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "primary" | "danger";
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
      tone === "primary"
        ? "bg-cyan-600 text-white hover:bg-cyan-700"
        : tone === "danger"
          ? "border border-red-200 bg-white text-red-600 hover:bg-red-50"
          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
    }`}
  >
    <Icon className="h-4 w-4" />
    {label}
  </button>
);

// Footer of a workflow form shown in PaginatedPopup's `content`
export const DialogFooter = ({
  onCancel,
  submitLabel,
  busy,
  disabled,
  danger,
}: {
  onCancel: () => void;
  submitLabel: string;
  busy?: boolean;
  disabled?: boolean;
  danger?: boolean;
}) => (
  <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3 sm:px-5">
    <button type="button" onClick={onCancel} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
      Close
    </button>
    <button
      type="submit"
      disabled={busy || disabled}
      className={`rounded-lg px-4 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${danger ? "bg-red-600 hover:bg-red-700" : "bg-cyan-600 hover:bg-cyan-700"}`}
    >
      {busy ? "Saving…" : submitLabel}
    </button>
  </div>
);
