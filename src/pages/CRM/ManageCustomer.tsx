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
}

interface ManageCustomersDrawerProps {
  isOpen: boolean;
  segmentId: number | null;
  segmentName?: string;
  segmentDescription?: string;
  segmentCode?: string;
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
  assignedCustomers,
  allCustomers,
  onClose,
  onRefresh,
  onViewCustomer,
}) => {
  const token = localStorage.getItem("accessToken");

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

  const allSelected =
    filtered.length > 0 &&
    filtered.every((c: any) => selectedIds.includes(c.customerId ?? c.id));

  const toggleAll = () => {
    if (allSelected) {
      const visible = new Set(filtered.map((c: any) => c.customerId ?? c.id));
      setSelectedIds((prev) => prev.filter((id) => !visible.has(id)));
    } else {
      const merged = new Set([
        ...selectedIds,
        ...filtered.map((c: any) => c.customerId ?? c.id),
      ]);
      setSelectedIds(Array.from(merged));
    }
  };

  const handleAdd = async () => {
    if (!segmentId || selectedIds.length === 0) return;
    try {
      setBusy(true);
      const results = await Promise.allSettled(
        selectedIds.map((cid) =>
          axios.post(
            `${API_URL}/${segmentId}/customers/${cid}`,
            {},
            { headers: { Authorization: `Bearer ${token}` } }
          )
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
      const results = await Promise.allSettled(
        selectedIds.map((cid) =>
          axios.delete(`${API_URL}/${segmentId}/customers/${cid}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        )
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
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px]"
        style={{ zIndex: 60 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Manage customers"
        className={[
          "fixed right-0 top-0 h-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col",
          isResizing ? "" : "transition-[width] duration-200 ease-out",
        ].join(" ")}
        style={{ width, zIndex: 61 }}
      >
        {/* Resize handle */}
        <button
          type="button"
          aria-label="Resize drawer"
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
              Customer segment details
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 flex-shrink-0"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* ============ BODY ============ */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* ---------- Summary metrics ---------- */}
          <section className="px-5 pt-5 pb-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
              <div className="px-4 py-4 border-r border-gray-100 dark:border-gray-800">
                <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">
                  Segment Name
                </div>
                <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-1.5 truncate">
                  {segmentName || "--"}
                </div>
              </div>
              <div className="px-4 py-4 border-r border-gray-100 dark:border-gray-800">
                <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">
                  Description
                </div>
                <div className="text-sm text-gray-800 dark:text-gray-200 mt-1.5">
                  {segmentDescription || "--"}
                </div>
              </div>
              <div className="px-4 py-4 border-r border-gray-100 dark:border-gray-800">
                <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">
                  Customers
                </div>
                <div className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-1.5">
                  {assigned.length}
                </div>
              </div>
              <div className="px-4 py-4">
                <div className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">
                  Code
                </div>
                <div className="text-base font-mono text-gray-900 dark:text-gray-100 mt-1.5 truncate">
                  {segmentCode || "--"}
                </div>
              </div>
            </div>
          </section>

          {/* ---------- Record information heading ---------- */}
          <section className="px-5 pb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 font-semibold">
                  Record Information
                </p>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                  {showAddPanel ? "Add Customers" : "Details"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddPanel((v) => !v);
                  setSelectedIds([]);
                  setSearch("");
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800/60 rounded-lg hover:bg-cyan-50 dark:hover:bg-cyan-950/30 transition-colors"
              >
                {showAddPanel ? "← Back to Segment" : "+ Add Customers"}
              </button>
            </div>

            {/* ---------- Search + Select All ---------- */}
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  placeholder="Search by name, email, phone, code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>
              {filtered.length > 0 && (
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-cyan-600 focus:ring-cyan-500"
                  />
                  Select all
                </label>
              )}
            </div>

            {/* ---------- Count pill ---------- */}
            <div className="mb-4">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border border-cyan-100 dark:border-cyan-800/50 capitalize">
                {filtered.length} {showAddPanel ? "Available Customers" : "Segment Customers"}
              </span>
            </div>

            {/* ---------- Customer cards ---------- */}
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400 dark:text-gray-500">
                {showAddPanel
                  ? available.length === 0
                    ? "All customers are already in this segment"
                    : "No customers match your search"
                  : "No customers in this segment yet"}
              </div>
            ) : (
              <div className="space-y-4">
                {filtered.map((c: any, idx: number) => {
                  const id = c.customerId ?? c.id;
                  const selected = selectedIds.includes(id);
                  const name = c.customerName || "Unnamed Customer";
                  const code = c.customerCode || "--";
                  const email = c.email || "--";
                  const phone = c.phone || "--";
                  const assignedAt = c.assignedAt ? formatDate(c.assignedAt) : null;

                  return (
                    <div
                      key={id}
                      className={`rounded-xl border bg-white dark:bg-gray-900 p-4 shadow-sm space-y-3 transition-all ${
                        selected
                          ? "border-cyan-400 bg-cyan-50/40 dark:bg-cyan-950/20"
                          : "border-gray-200 dark:border-gray-800"
                      }`}
                    >
                      {/* Card heading */}
                      <div className="flex items-center justify-between pb-2.5 border-b border-gray-100 dark:border-gray-800">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggle(id)}
                            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-cyan-600 focus:ring-cyan-500"
                          />
                          <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 truncate">
                            {showAddPanel ? "Available Customer" : "Segment Customer"} #{idx + 1}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-400 dark:text-gray-500">
                            #{idx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => onViewCustomer(id)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded transition-colors"
                            title="View customer profile"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Field rows */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5">
                        {/* Customer Name */}
                        <div className="flex items-center justify-between py-2 px-3.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 gap-3">
                          <span className="font-semibold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wider whitespace-nowrap">
                            Customer Name
                          </span>
                          <button
                            onClick={() => onViewCustomer(id)}
                            className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 hover:underline truncate"
                          >
                            {name}
                          </button>
                        </div>

                        {/* Customer Code */}
                        <div className="flex items-center justify-between py-2 px-3.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 gap-3">
                          <span className="font-semibold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wider whitespace-nowrap">
                            Customer Code
                          </span>
                          <span className="text-sm font-mono text-gray-800 dark:text-gray-100 truncate">
                            {code}
                          </span>
                        </div>

                        {/* Active */}
                        <div className="flex items-center justify-between py-2 px-3.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 gap-3">
                          <span className="font-semibold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wider whitespace-nowrap">
                            Active
                          </span>
                          <span
                            className={`text-sm font-semibold ${
                              c.active
                                ? "text-green-600 dark:text-green-400"
                                : "text-gray-600 dark:text-gray-400"
                            }`}
                          >
                            {c.active ? "Yes" : "No"}
                          </span>
                        </div>

                        {/* Email */}
                        <div className="flex items-center justify-between py-2 px-3.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 gap-3">
                          <span className="font-semibold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wider whitespace-nowrap">
                            Email
                          </span>
                          <span className="text-sm text-cyan-700 dark:text-cyan-300 truncate">
                            {email}
                          </span>
                        </div>

                        {/* Phone */}
                        <div className="flex items-center justify-between py-2 px-3.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 gap-3">
                          <span className="font-semibold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wider whitespace-nowrap">
                            Phone
                          </span>
                          <span className="text-sm text-cyan-700 dark:text-cyan-300">
                            {phone}
                          </span>
                        </div>

                        {/* Assigned At */}
                        {assignedAt && (
                          <div className="flex items-center justify-between py-2 px-3.5 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 gap-3">
                            <span className="font-semibold text-gray-700 dark:text-gray-300 uppercase text-xs tracking-wider whitespace-nowrap">
                              Assigned At
                            </span>
                            <span className="text-sm text-cyan-700 dark:text-cyan-300">
                              {assignedAt}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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
              <span className="text-gray-400 dark:text-gray-500">None selected</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Close
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
              <button
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