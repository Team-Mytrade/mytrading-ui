import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  UserPlusIcon,
  TrashIcon,
  CheckIcon,
  EyeIcon,
} from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";

import { t } from "../../i18n/i18n";
/* ---------------- Types ---------------- */

export interface SegmentCustomer {
  customerId: number;
  customerName: string;
  customerCode: string;
  active: boolean;
  email?: string;
  phone?: string;
  assignedAt?: string;
}

export interface Customer {
  id: number;
  customerName?: string;
  customerCode?: string;
  email?: string;
  phone?: string;
  // Inactive customers are marked and can't be added to a segment
  active?: boolean;
  status?: string;
}

interface ManageCustomersDrawerProps {
  isOpen: boolean;
  segmentId: number | null;
  segmentName?: string;
  segmentDescription?: string;
  segmentCode?: string;
  // The segment's own active flag (shown as a badge)
  segmentActive?: boolean;
  assignedCustomers: SegmentCustomer[];
  allCustomers: Customer[];
  onClose: () => void;
  onRefresh: () => void | Promise<void>;
  onViewCustomer: (customerId: number) => void;
}

const API_URL = "/v1/api/crm/segments";

/* ---------------- Helpers ---------------- */

const formatDate = (iso?: string) => {
  if (!iso) return "--";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
};

/* ---------------- Component ---------------- */

const ManageCustomersDrawer: React.FC<ManageCustomersDrawerProps> = ({
  isOpen,
  segmentId,
  segmentName,
  segmentDescription,
  segmentCode,
  segmentActive,
  assignedCustomers,
  allCustomers,
  onClose,
  onRefresh,
  onViewCustomer,
}) => {
  const token = localStorage.getItem("accessToken");
  // Adding a customer to a segment is a create, removing one a delete
  const { canCreate, canDelete } = usePermissions();

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);

  const [width, setWidth] = useState(() =>
    Math.min(Math.max(520, window.innerWidth * 0.55), window.innerWidth - 60)
  );
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSelectedIds([]);
      setBusy(false);
      setShowAddPanel(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: PointerEvent) => {
      const next = Math.min(
        Math.max(400, window.innerWidth - e.clientX),
        window.innerWidth - 60
      );
      setWidth(next);
    };
    const onUp = () => setIsResizing(false);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
  }, [isResizing]);

  /* ------- Deduped assigned ------- */
  const assigned = useMemo(() => {
    const seen = new Set<number>();
    return assignedCustomers.filter((c) => {
      if (seen.has(c.customerId)) return false;
      seen.add(c.customerId);
      return true;
    });
  }, [assignedCustomers]);

  /* ------- Available for add ------- */
  const available = useMemo(() => {
    const existing = new Set(assigned.map((c) => c.customerId));
    return allCustomers.filter((c) => !existing.has(c.id));
  }, [allCustomers, assigned]);

  const sourceList: any[] = showAddPanel ? available : assigned;
  const isInactive = (c: any) => c.active === false || String(c.status ?? "").toUpperCase() === "INACTIVE";
  // Adding: an inactive customer is shown (marked) but can't be picked
  // Selecting only matters when the user may add (or remove) the selection
  const canSelect = showAddPanel ? canCreate : canDelete;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sourceList;
    return sourceList.filter((c: any) => {
      const name = (c.customerName || "").toLowerCase();
      const email = (c.email || "").toLowerCase();
      const phone = (c.phone || "").toLowerCase();
      const code = (c.customerCode || "").toLowerCase();
      return (
        name.includes(q) || email.includes(q) || phone.includes(q) || code.includes(q)
      );
    });
  }, [sourceList, search]);

  const toggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // "Select all" covers the rows shown after a search, never hidden ones (nor, when adding, inactive customers)
  const selectable = filtered.filter((c: any) => !(showAddPanel && isInactive(c)));
  const allSelected =
    selectable.length > 0 &&
    selectable.every((c: any) => selectedIds.includes(c.customerId ?? c.id));

  const toggleAll = () => {
    if (allSelected) {
      const visible = new Set(selectable.map((c: any) => c.customerId ?? c.id));
      setSelectedIds((prev) => prev.filter((id) => !visible.has(id)));
    } else {
      const merged = new Set([
        ...selectedIds,
        ...selectable.map((c: any) => c.customerId ?? c.id),
      ]);
      setSelectedIds(Array.from(merged));
    }
  };

  // One request at a time: each one saves the whole segment, so parallel saves could drop each other's customer
  const forEachSelected = async (send: (cid: number) => Promise<unknown>) => {
    const results: PromiseSettledResult<unknown>[] = [];
    for (const cid of selectedIds) {
      try {
        results.push({ status: "fulfilled", value: await send(cid) });
      } catch (reason) {
        results.push({ status: "rejected", reason });
      }
    }
    return results;
  };

  const handleAdd = async () => {
    if (!segmentId || selectedIds.length === 0) return;
    try {
      setBusy(true);
      const results = await forEachSelected((cid) =>
        axios.post(
          `${API_URL}/${segmentId}/customers/${cid}`,
          {},
          { headers: { Authorization: `Bearer ${token}` } }
        )
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      if (fail === 0) ToasterService.success(`${ok} customer(s) added`);
      else if (ok === 0) ToasterService.error(`All ${fail} failed`);
      else ToasterService.error(`${ok} added, ${fail} failed`);
      setSelectedIds([]);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!segmentId || selectedIds.length === 0) return;
    try {
      setBusy(true);
      const results = await forEachSelected((cid) =>
        axios.delete(`${API_URL}/${segmentId}/customers/${cid}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      if (fail === 0) ToasterService.success(`${ok} customer(s) removed`);
      else if (ok === 0) ToasterService.error(`All ${fail} failed`);
      else ToasterService.error(`${ok} removed, ${fail} failed`);
      setSelectedIds([]);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div data-overlay-dim data-overlay
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px]"
        style={{ zIndex: 60 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t("Manage customers")}
        className={[
          "fixed right-0 top-0 h-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col",
          isResizing ? "" : "transition-[width] duration-200 ease-out",
        ].join(" ")}
        style={{ width, zIndex: 61 }}
      >
        {/* Resize handle */}
        <button
          type="button"
          aria-label={t("Resize drawer")}
          onPointerDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
          className="absolute left-0 top-0 h-full w-1 cursor-col-resize bg-transparent hover:bg-cyan-100/60 dark:hover:bg-cyan-500/30 z-10"
        />

        {/* ============ HEADER ============ */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {segmentName || "Segment"}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              {t("Customer segment details")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 flex-shrink-0"
            aria-label={t("Close")}
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* ============ BODY ============ */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* ---------- The segment: name and description get the room, then count, code and status ---------- */}
          <section className="px-5 pt-5 pb-4">
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{t("Segment name")}</div>
                <div className="mt-1 break-words text-base font-semibold text-gray-900 dark:text-gray-100">{segmentName || "--"}</div>
              </div>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">{t("Description")}</div>
                <div className="mt-1 break-words text-sm text-gray-800 dark:text-gray-200">{segmentDescription || "--"}</div>
              </div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-gray-100 pt-3 text-sm dark:border-gray-800 sm:col-span-2">
                <span className="text-gray-500 dark:text-gray-400">{t("Customers")}: <b className="text-gray-900 dark:text-gray-100">{assigned.length}</b></span>
                <span className="text-gray-500 dark:text-gray-400">{t("Code")}: <b className="font-mono text-gray-900 dark:text-gray-100">{segmentCode || "--"}</b></span>
                {segmentActive !== undefined && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${segmentActive ? "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`}>
                    {t(segmentActive ? "Active" : "Inactive")}
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* ---------- The customers ---------- */}
          <section className="px-5 pb-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {t(showAddPanel ? "Add customers to this segment" : "Customers in this segment")}
              </h3>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAddPanel((v) => !v);
                    setSelectedIds([]);
                    setSearch("");
                  }}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-cyan-200 px-3 py-1.5 text-sm font-medium text-cyan-700 transition-colors hover:bg-cyan-50 dark:border-cyan-800/60 dark:text-cyan-400 dark:hover:bg-cyan-950/30"
                >
                  {showAddPanel ? t("← Back to segment") : t("+ Add customers")}
                </button>
              )}
            </div>

            {/* ---------- Search and select all: only when there is something to search ---------- */}
            {sourceList.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input
                    type="text"
                    placeholder={t("Search by name, email, phone, code...")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
                  />
                </div>
                <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                  {search.trim()
                    ? `${filtered.length} ${t("of")} ${sourceList.length}`
                    : `${sourceList.length} ${t(showAddPanel ? "available" : "in segment")}`}
                </span>
                {selectable.length > 0 && canSelect && (
                  <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 dark:border-gray-600"
                    />
                    {t(search.trim() ? "Select all shown" : "Select all")}
                  </label>
                )}
              </div>
            )}

            {/* ---------- Compact rows: checkbox, name, code, email, status ---------- */}
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center dark:border-gray-800">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {showAddPanel
                    ? available.length === 0
                      ? t("All customers are already in this segment")
                      : t("No customers match your search")
                    : sourceList.length === 0
                      ? t("No customers in this segment yet")
                      : t("No customers match your search")}
                </p>
                {!showAddPanel && sourceList.length === 0 && canCreate && (
                  <button
                    type="button"
                    onClick={() => { setShowAddPanel(true); setSelectedIds([]); setSearch(""); }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-cyan-700"
                  >
                    <UserPlusIcon className="h-4 w-4" />
                    {t("Add customers")}
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-[11px] uppercase tracking-wider text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
                    <tr>
                      {canSelect && <th className="w-9 px-3 py-2" aria-label={t("Select")} />}
                      <th className="px-3 py-2">{t("Customer")}</th>
                      <th className="px-3 py-2">{t("Email")}</th>
                      <th className="px-3 py-2">{t("Status")}</th>
                      <th className="w-10 px-3 py-2" aria-label={t("View")} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {filtered.map((c: any) => {
                      const id = c.customerId ?? c.id;
                      const selected = selectedIds.includes(id);
                      const inactive = isInactive(c);
                      const locked = showAddPanel && inactive;
                      const name = c.customerName || "Unnamed Customer";
                      return (
                        <tr key={id} className={`align-top ${selected ? "bg-cyan-50/60 dark:bg-cyan-950/20" : ""} ${inactive ? "text-gray-400" : ""}`}>
                          {canSelect && (
                            <td className="px-3 py-2.5">
                              <input
                                type="checkbox"
                                checked={selected}
                                disabled={locked}
                                onChange={() => toggle(id)}
                                aria-label={`${t("Select")} ${name}`}
                                title={locked ? t("Inactive customers can't be added to a segment") : undefined}
                                className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600"
                              />
                            </td>
                          )}
                          <td className="min-w-0 px-3 py-2.5">
                            <button type="button" onClick={() => onViewCustomer(id)}
                              className="break-words text-left font-semibold text-cyan-700 hover:underline dark:text-cyan-300" title={name}>
                              {name}
                            </button>
                            <div className="break-all font-mono text-xs text-gray-500 dark:text-gray-400">{c.customerCode || "--"}</div>
                            {c.assignedAt && !showAddPanel && (
                              <div className="text-[11px] text-gray-400">{t("Added")} {formatDate(c.assignedAt)}</div>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="break-all text-gray-700 dark:text-gray-300">{c.email || "--"}</div>
                            {c.phone && <div className="text-xs text-gray-500 dark:text-gray-400">{c.phone}</div>}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${inactive ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" : "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"}`}>
                              {t(inactive ? "Inactive" : "Active")}
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              type="button"
                              onClick={() => onViewCustomer(id)}
                              className="rounded p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/30 dark:hover:text-blue-400"
                              title={t("View customer profile")}
                              aria-label={`${t("View customer profile")}: ${name}`}
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        {/* ============ FOOTER ============ */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 px-5 py-3 flex-shrink-0 bg-white dark:bg-gray-900">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedIds.length > 0 ? (
              <span className="flex items-center gap-1.5">
                <CheckIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                {selectedIds.length} selected
              </span>
            ) : (
              <span className="text-gray-400 dark:text-gray-500">{t("None selected")}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {t("Close")}
            </button>

            {showAddPanel ? (
              <button
                onClick={handleAdd}
                disabled={selectedIds.length === 0 || busy}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all ${
                  selectedIds.length > 0 && !busy
                    ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-700 hover:to-blue-700"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                }`}
              >
                <UserPlusIcon className="h-4 w-4" />
                {busy
                  ? "Adding..."
                  : `Add${selectedIds.length ? ` (${selectedIds.length})` : ""}`}
              </button>
            ) : (
              canDelete && <button
                onClick={handleRemove}
                disabled={selectedIds.length === 0 || busy}
                className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all ${
                  selectedIds.length > 0 && !busy
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                }`}
              >
                <TrashIcon className="h-4 w-4" />
                {busy
                  ? "Removing..."
                  : `Remove${selectedIds.length ? ` (${selectedIds.length})` : ""}`}
              </button>
            )}
          </div>
        </div>
      </aside>
    </>,
    document.body
  );
};

export default ManageCustomersDrawer;