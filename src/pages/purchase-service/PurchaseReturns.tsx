import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  EyeIcon,
  PaperAirplaneIcon,
  PencilSquareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import PaginatedPopup from "../../components/common/unpopup";
import { AddButton } from "../../components/common/AddButton";
import { FloatingInput, FloatingSelect1 } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { apiError, dateLabel, money, todayInput } from "../Invoice/invoiceShared";
import { DialogFooter } from "../Invoice/invoiceUi";

import { t } from "../../i18n/i18n";
const API = "/v1/api/purchase";
const PAGE_SIZE = 10;

type Status = "DRAFT" | "RETURNED" | "REPLACED" | "CANCELLED";
type Resolution = "DEBIT_NOTE" | "REPLACEMENT";

interface ReturnItem {
  id?: number;
  grnItemId: number;
  productCode?: string;
  productName?: string;
  unitOfMeasure?: string;
  quantity: number;
  unitPrice?: number;
  amount?: number;
  stockReturnedAt?: string | null;
  replacementReceivedAt?: string | null;
}

interface PurchaseReturn {
  id: number;
  returnNumber: string;
  grnId: number;
  grnNumber: string;
  poNumber?: string;
  vendorName?: string;
  warehouseId?: number;
  returnDate?: string;
  reason: string;
  resolution: Resolution;
  status: Status;
  notes?: string;
  totalAmount?: number;
  returnedAt?: string | null;
  replacedAt?: string | null;
  debitNoteStatus?: string | null;
  debitNoteNumber?: string | null;
  debitNoteError?: string | null;
  items: ReturnItem[];
}

interface Grn {
  id: number;
  receiptNumber: string;
  poNumber?: string;
  vendorName?: string;
  receiptDate?: string;
  status?: string;
  inventorySyncStatus?: string;
}

interface ReturnableLine {
  grnItemId: number;
  productCode?: string;
  productName?: string;
  unitOfMeasure?: string;
  acceptedQuantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
  unitPrice: number;
}

const REASONS = [
  { id: "DAMAGED", name: "Damaged" },
  { id: "DEFECTIVE", name: "Defective" },
  { id: "WRONG_ITEM", name: "Wrong item" },
  { id: "EXCESS_QUANTITY", name: "Excess quantity" },
  { id: "QUALITY_ISSUE", name: "Quality issue" },
  { id: "OTHER", name: "Other" },
];

const RESOLUTIONS = [
  { id: "DEBIT_NOTE", name: "Debit note (vendor credits the value)" },
  { id: "REPLACEMENT", name: "Replacement (vendor sends the goods again)" },
];

const STATUS_STYLE: Record<Status, { label: string; tone: string }> = {
  DRAFT: { label: "Draft", tone: "bg-slate-50 text-slate-700 border-slate-200" },
  RETURNED: { label: "Sent back", tone: "bg-amber-50 text-amber-700 border-amber-200" },
  REPLACED: { label: "Replaced", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CANCELLED: { label: "Cancelled", tone: "bg-red-50 text-red-700 border-red-200" },
};

const ICON_TONES = {
  cyan: "hover:bg-cyan-50 hover:text-cyan-600",
  amber: "hover:bg-amber-50 hover:text-amber-600",
  emerald: "hover:bg-emerald-50 hover:text-emerald-600",
  red: "hover:bg-red-50 hover:text-red-600",
};

const reasonLabel =(reason?: string) => REASONS.find((r) => r.id === reason)?.name ?? reason ?? "—";

type Confirm = { kind: "post" | "replace" | "cancel"; row: PurchaseReturn } | null;

/**
 * Goods sent back to vendors from a received GRN. Posting a return takes the goods out of stock; a debit note
 * return then reduces the vendor's bill in finance, a replacement return waits for the vendor's goods.
 */
const PurchaseReturns: React.FC = () => {
  const { canCreate, canUpdate, canDelete } = usePermissions("PURCHASE");
  const [rows, setRows] = useState<PurchaseReturn[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("OPEN");
  const [viewing, setViewing] = useState<PurchaseReturn | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);

  // Create / edit
  const [editing, setEditing] = useState<PurchaseReturn | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [grns, setGrns] = useState<Grn[]>([]);
  const [grnId, setGrnId] = useState("");
  const [lines, setLines] = useState<ReturnableLine[]>([]);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [form, setForm] = useState({ reason: "DAMAGED", resolution: "DEBIT_NOTE", returnDate: todayInput(), notes: "" });

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<PurchaseReturn[]>(`${API}/returns`);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to load purchase returns"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const loadLines = async (id: string, draft?: PurchaseReturn | null) => {
    setLines([]);
    if (!id) return;
    try {
      const res = await axios.get<ReturnableLine[]>(`${API}/grns/${id}/returnable`);
      const own = new Map((draft?.items ?? []).map((item) => [item.grnItemId, item.quantity]));
      // A draft being edited already holds its own units; they are still available to it
      setLines((res.data ?? []).map((line) => ({ ...line, returnableQuantity: line.returnableQuantity + (own.get(line.grnItemId) ?? 0) })));
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load the receipt's items"));
    }
  };

  const openCreate = async () => {
    setEditing(null);
    setGrnId("");
    setLines([]);
    setQuantities({});
    setForm({ reason: "DAMAGED", resolution: "DEBIT_NOTE", returnDate: todayInput(), notes: "" });
    setFormOpen(true);
    try {
      const res = await axios.get<Grn[]>(`${API}/grns`);
      // Receipts whose goods never reached stock cannot be returned (the server checks it too)
      setGrns((res.data ?? []).filter((grn) => grn.status === "ACCEPTED" && grn.inventorySyncStatus !== "FAILED" && grn.inventorySyncStatus !== "NON_SYNC"));
    } catch (err) {
      setGrns([]);
      ToasterService.error(apiError(err, "Could not load goods receipts"));
    }
  };

  const openEdit = async (row: PurchaseReturn) => {
    setEditing(row);
    setGrnId(String(row.grnId));
    setGrns([{ id: row.grnId, receiptNumber: row.grnNumber, poNumber: row.poNumber, vendorName: row.vendorName }]);
    setQuantities(Object.fromEntries(row.items.map((item) => [item.grnItemId, String(item.quantity)])));
    setForm({ reason: row.reason, resolution: row.resolution, returnDate: row.returnDate ?? todayInput(), notes: row.notes ?? "" });
    setFormOpen(true);
    await loadLines(String(row.grnId), row);
  };

  const formTotal = useMemo(
    () => lines.reduce((sum, line) => sum + (Number(quantities[line.grnItemId]) || 0) * Number(line.unitPrice || 0), 0),
    [lines, quantities],
  );

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!grnId) return ToasterService.error("Choose the goods receipt the items came in on");
    const items = lines
      .map((line) => ({ grnItemId: line.grnItemId, quantity: Number(quantities[line.grnItemId]) || 0, line }))
      .filter((item) => item.quantity > 0);
    if (items.length === 0) return ToasterService.error("Enter a quantity for at least one item");
    const tooMany = items.find((item) => item.quantity > Math.min(item.line.acceptedQuantity, item.line.returnableQuantity));
    if (tooMany) {
      const maximum = Math.min(tooMany.line.acceptedQuantity, tooMany.line.returnableQuantity);
      return ToasterService.error(`Only ${maximum} of ${tooMany.line.productName} can be returned`);
    }
    const payload = {
      grnId: Number(grnId),
      reason: form.reason,
      resolution: form.resolution,
      returnDate: form.returnDate || null,
      notes: form.notes.trim() || null,
      items: items.map(({ grnItemId, quantity }) => ({ grnItemId, quantity })),
    };
    setBusy(true);
    try {
      const res = editing
        ? await axios.put<PurchaseReturn>(`${API}/returns/${editing.id}`, payload)
        : await axios.post<PurchaseReturn>(`${API}/returns`, payload);
      ToasterService.success(`${res.data.returnNumber} saved as a draft. Send it back when the goods leave.`);
      setFormOpen(false);
      await fetchRows();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not save the return"));
    } finally {
      setBusy(false);
    }
  };

  const runConfirmed = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!confirm) return;
    const { kind, row } = confirm;
    setBusy(true);
    try {
      if (kind === "cancel") {
        await axios.delete(`${API}/returns/${row.id}`);
        ToasterService.success(`${row.returnNumber} cancelled`);
      } else if (kind === "post") {
        const res = await axios.put<PurchaseReturn>(`${API}/returns/${row.id}/post`);
        if (res.data.debitNoteStatus === "FAILED") {
          ToasterService.error(`${row.returnNumber}: goods taken out of stock, but finance did not record the debit note (${res.data.debitNoteError}). Use "Retry debit note".`);
        } else {
          ToasterService.success(res.data.resolution === "DEBIT_NOTE"
            ? `${row.returnNumber}: goods taken out of stock; debit note ${res.data.debitNoteNumber ?? ""} recorded`
            : `${row.returnNumber}: goods taken out of stock; receive the replacement when it arrives`);
        }
      } else {
        await axios.put(`${API}/returns/${row.id}/receive-replacement`);
        ToasterService.success(`${row.returnNumber}: replacement goods added to stock`);
      }
      setConfirm(null);
    } catch (err) {
      ToasterService.error(apiError(err, "The action did not go through"));
    } finally {
      setBusy(false);
      await fetchRows();
    }
  };

  const retryDebitNote = async (row: PurchaseReturn) => {
    try {
      const res = await axios.put<PurchaseReturn>(`${API}/returns/${row.id}/retry-debit-note`);
      if (res.data.debitNoteStatus === "RECORDED") ToasterService.success(`Debit note ${res.data.debitNoteNumber ?? ""} recorded`);
      else ToasterService.error(`Still not recorded: ${res.data.debitNoteError ?? "finance is not reachable"}`);
      await fetchRows();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not record the debit note"));
    }
  };

  const filtered = useMemo(() => {
    if (statusFilter === "ALL") return rows;
    if (statusFilter === "OPEN") return rows.filter((row) => row.status === "DRAFT" || (row.status === "RETURNED" && row.resolution === "REPLACEMENT"));
    return rows.filter((row) => row.status === statusFilter);
  }, [rows, statusFilter]);

  const stats = useMemo(() => ({
    drafts: rows.filter((row) => row.status === "DRAFT").length,
    awaiting: rows.filter((row) => row.status === "RETURNED" && row.resolution === "REPLACEMENT").length,
    credited: rows.filter((row) => row.status === "RETURNED" && row.resolution === "DEBIT_NOTE").reduce((sum, row) => sum + Number(row.totalAmount || 0), 0),
    failed: rows.filter((row) => row.debitNoteStatus === "FAILED").length,
  }), [rows]);

  const iconButton = (title: string, Icon: React.ComponentType<{ className?: string }>, onClick: () => void, tone: keyof typeof ICON_TONES = "cyan") => (
    <button type="button" title={title} onClick={onClick}
      className={`rounded-lg p-1.5 text-slate-400 transition-all ${ICON_TONES[tone]}`}>
      <Icon className="h-4 w-4" />
    </button>
  );

  const columns: ColumnDef<PurchaseReturn>[] = [
    {
      key: "returnNumber",
      label: "Return",
      sortable: true,
      render: (row) => (
        <span className="text-sm font-semibold text-slate-900">
          {row.returnNumber}
          <span className="block text-xs font-normal text-slate-400">{dateLabel(row.returnDate)} · {reasonLabel(row.reason)}</span>
        </span>
      ),
    },
    {
      key: "grnNumber",
      label: "Receipt",
      sortable: true,
      render: (row) => (
        <span className="text-sm text-slate-700">
          {row.grnNumber}
          <span className="block text-xs text-slate-400">{row.poNumber}</span>
        </span>
      ),
    },
    { key: "vendorName", label: "Vendor", sortable: true, render: (row) => <span className="text-sm text-slate-700">{row.vendorName ?? "—"}</span> },
    {
      key: "resolution",
      label: "Settled by",
      sortable: true,
      render: (row) => (
        <span className="text-sm text-slate-700">
          {row.resolution === "DEBIT_NOTE" ? "Debit note" : "Replacement"}
          {row.resolution === "DEBIT_NOTE" && row.debitNoteStatus && (
            <span className={`block text-xs ${row.debitNoteStatus === "FAILED" ? "font-semibold text-red-600" : "text-slate-400"}`}
              data-table-tooltip={row.debitNoteError ?? undefined}>
              {row.debitNoteStatus === "RECORDED" ? row.debitNoteNumber ?? "Recorded" : "Not recorded in finance"}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "totalAmount",
      label: "Value",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      render: (row) => <span className="text-sm font-semibold text-slate-800">{money(row.totalAmount)}</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (row) => (
        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[row.status]?.tone ?? ""}`}>
          {row.status === "RETURNED" && row.resolution === "REPLACEMENT" ? "Awaiting replacement" : STATUS_STYLE[row.status]?.label ?? row.status}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-0.5" onClick={(event) => event.stopPropagation()}>
          {iconButton("View", EyeIcon, () => setViewing(row))}
          {row.status === "DRAFT" && canUpdate && iconButton("Edit draft", PencilSquareIcon, () => openEdit(row))}
          {row.status === "DRAFT" && canUpdate && iconButton("Send back to vendor", PaperAirplaneIcon, () => setConfirm({ kind: "post", row }), "amber")}
          {row.status === "RETURNED" && row.resolution === "REPLACEMENT" && canUpdate &&
            iconButton("Receive replacement", ArrowDownTrayIcon, () => setConfirm({ kind: "replace", row }), "emerald")}
          {row.debitNoteStatus === "FAILED" && canUpdate && iconButton("Retry debit note", ArrowPathIcon, () => retryDebitNote(row), "amber")}
          {row.status === "DRAFT" && canDelete && !row.items.some((item) => item.stockReturnedAt) &&
            iconButton("Cancel draft", TrashIcon, () => setConfirm({ kind: "cancel", row }), "red")}
        </div>
      ),
    },
  ];

  const confirmText = (() => {
    if (!confirm) return { title: "", body: "", label: "" };
    const { kind, row } = confirm;
    const count = row.items.reduce((sum, item) => sum + item.quantity, 0);
    if (kind === "post") {
      return {
        title: `Send ${row.returnNumber} back to ${row.vendorName ?? "the vendor"}?`,
        body: `${count} unit${count === 1 ? "" : "s"} leave stock now. ${row.resolution === "DEBIT_NOTE"
          ? `A debit note of ${money(row.totalAmount)} is recorded against the vendor's bill.`
          : "Receive the replacement here when the vendor sends it."} This cannot be undone.`,
        label: "Send back",
      };
    }
    if (kind === "replace") {
      return { title: `Receive the replacement for ${row.returnNumber}?`, body: `${count} unit${count === 1 ? "" : "s"} are added back to stock in the warehouse they left.`, label: "Receive replacement" };
    }
    return { title: `Cancel ${row.returnNumber}?`, body: "The draft is dropped; nothing has moved.", label: "Cancel draft" };
  })();

  return (
    <>
      <PageMeta title={t("Purchase Returns")} description="Goods sent back to vendors for a debit note or a replacement" />
      <PageBreadcrumb pageTitle="Purchase Returns" actions={canCreate ? <AddButton onClick={openCreate} label={t("New Return")} /> : undefined} />

      <div className="w-full max-w-none space-y-4 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label={t("Drafts")} value={stats.drafts} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label={t("Awaiting replacement")} value={stats.awaiting} gradient="from-amber-50 to-yellow-50" borderColor="border-amber-100" labelColor="text-amber-600" />
          <StatsCard label={t("Credited by debit notes")} value={money(stats.credited)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label={t("Debit notes not recorded")} value={stats.failed} gradient="from-red-50 to-rose-50" borderColor="border-red-100" labelColor="text-red-600" />
        </div>

        <div className="flex flex-wrap gap-2">
          {[["OPEN", "Open"], ["DRAFT", "Drafts"], ["RETURNED", "Sent back"], ["REPLACED", "Replaced"], ["CANCELLED", "Cancelled"], ["ALL", "All"]].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setStatusFilter(value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${statusFilter === value ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
        </div>

        <ReusableTable
          data={filtered}
          columns={columns}
          pageSize={PAGE_SIZE}
          loading={loading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <ArrowUturnLeftIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-1 text-sm text-gray-500">{t("No purchase returns here")}</p>
              <p className="text-xs text-gray-400">{t("Returns are raised against a goods receipt whose goods are in stock.")}</p>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={formOpen}
        title={editing ? `${t("Edit")} ${editing.returnNumber}` : t("New purchase return")}
        subtitle={t("Saved as a draft; nothing leaves stock until you send it back")}
        onClose={() => setFormOpen(false)}
        maxWidthClassName="max-w-3xl"
        content={
          <form onSubmit={save} className="flex flex-col">
            <div className="space-y-4 px-4 py-4 sm:px-5">
              <FloatingSelect1
                label={t("Goods receipt")}
                name="grnId"
                value={grnId}
                disabled={Boolean(editing)}
                onChange={(event) => { setGrnId(event.target.value); setQuantities({}); loadLines(event.target.value); }}
                options={grns.map((grn) => ({ id: String(grn.id), name: `${grn.receiptNumber} · ${grn.vendorName ?? "—"} · ${grn.poNumber ?? ""}` }))}
                required
              />
              {!editing && grns.length === 0 && <p className="text-xs text-slate-500">{t("No goods receipt has goods in stock to return.")}</p>}

              {lines.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">{t("Item")}</th>
                        <th className="px-3 py-2 text-right">{t("Accepted")}</th>
                        <th className="px-3 py-2 text-right">{t("Can return")}</th>
                        <th className="px-3 py-2 text-right">{t("Unit value")}</th>
                        <th className="px-3 py-2 text-right">{t("Return qty")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lines.map((line) => {
                        const maximumReturn = Math.min(line.acceptedQuantity, line.returnableQuantity);
                        return (
                        <tr key={line.grnItemId}>
                          <td className="px-3 py-2">
                            <span className="font-medium text-slate-800">{line.productName}</span>
                            <span className="block text-xs text-slate-400">{line.productCode}</span>
                          </td>
                          <td className="px-3 py-2 text-right">{line.acceptedQuantity} {line.unitOfMeasure}</td>
                          <td className="px-3 py-2 text-right">{maximumReturn}</td>
                          <td className="px-3 py-2 text-right">{money(line.unitPrice)}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              max={maximumReturn}
                              disabled={maximumReturn === 0}
                              value={quantities[line.grnItemId] ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                const quantity = value === "" ? "" : String(Math.min(Math.max(0, Number(value) || 0), maximumReturn));
                                setQuantities((current) => ({ ...current, [line.grnItemId]: quantity }));
                              }}
                              className="w-20 rounded-md border border-slate-300 px-2 py-1 text-right text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50"
                              aria-label={`Quantity of ${line.productName} to return`}
                            />
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-right text-slate-500">{t("Value going back (PO price incl. tax)")}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">{money(formTotal)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <FloatingSelect1 label={t("Reason")} name="reason" value={form.reason} options={REASONS} includeEmptyOption={false}
                  onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} />
                <FloatingSelect1 label={t("Settled by")} name="resolution" value={form.resolution} options={RESOLUTIONS} includeEmptyOption={false}
                  onChange={(event) => setForm((current) => ({ ...current, resolution: event.target.value }))} />
                <FloatingInput label={t("Return date")} name="returnDate" type="date" value={form.returnDate}
                  onChange={(event) => setForm((current) => ({ ...current, returnDate: event.target.value }))} />
                <FloatingInput label={t("Notes")} name="notes" value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
              </div>
            </div>
            <DialogFooter onCancel={() => setFormOpen(false)} submitLabel={t(editing ? "Save draft" : "Create draft")} busy={busy} />
          </form>
        }
      />

      <PaginatedPopup
        isOpen={Boolean(confirm)}
        title={confirmText.title}
        onClose={() => setConfirm(null)}
        maxWidthClassName="max-w-lg"
        content={
          <form onSubmit={runConfirmed} className="flex flex-col">
            <p className="px-4 py-4 text-sm text-slate-600 sm:px-5">{confirmText.body}</p>
            <DialogFooter onCancel={() => setConfirm(null)} submitLabel={confirmText.label} busy={busy} danger={confirm?.kind === "cancel"} />
          </form>
        }
      />

      <PaginatedPopup
        isOpen={Boolean(viewing)}
        title={viewing ? `${viewing.returnNumber} · ${viewing.vendorName ?? ""}` : ""}
        subtitle={viewing ? `${viewing.grnNumber} · ${viewing.poNumber ?? ""} · ${reasonLabel(viewing.reason)}` : ""}
        onClose={() => setViewing(null)}
        maxWidthClassName="max-w-2xl"
        content={
          viewing && (
            <div className="space-y-3 px-4 py-4 text-sm sm:px-5">
              <div className="grid gap-2 sm:grid-cols-3">
                <div><span className="block text-xs text-slate-400">{t("Status")}</span>{STATUS_STYLE[viewing.status]?.label}</div>
                <div><span className="block text-xs text-slate-400">{t("Settled by")}</span>{viewing.resolution === "DEBIT_NOTE" ? `Debit note ${viewing.debitNoteNumber ?? ""}` : t("Replacement")}</div>
                <div><span className="block text-xs text-slate-400">{t("Value")}</span>{money(viewing.totalAmount)}</div>
                <div><span className="block text-xs text-slate-400">{t("Sent back")}</span>{viewing.returnedAt ? dateLabel(viewing.returnedAt.slice(0, 10)) : "—"}</div>
                <div><span className="block text-xs text-slate-400">{t("Replacement received")}</span>{viewing.replacedAt ? dateLabel(viewing.replacedAt.slice(0, 10)) : "—"}</div>
                <div><span className="block text-xs text-slate-400">{t("Warehouse")}</span>{viewing.warehouseId ?? "—"}</div>
              </div>
              {viewing.debitNoteError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{t("Debit note not recorded:")} {viewing.debitNoteError}</p>}
              {viewing.notes && <p className="text-slate-600">{viewing.notes}</p>}
              <table className="min-w-full">
                <thead className="text-xs uppercase text-slate-500">
                  <tr className="border-b border-slate-100">
                    <th className="py-2 text-left">{t("Item")}</th>
                    <th className="py-2 text-right">{t("Qty")}</th>
                    <th className="py-2 text-right">{t("Value")}</th>
                    <th className="py-2 pl-3 text-left">{t("Stock")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {viewing.items.map((item) => (
                    <tr key={item.id ?? item.grnItemId}>
                      <td className="py-2">{item.productName}<span className="block text-xs text-slate-400">{item.productCode}</span></td>
                      <td className="py-2 text-right">{item.quantity} {item.unitOfMeasure}</td>
                      <td className="py-2 text-right">{money(item.amount)}</td>
                      <td className="py-2 pl-3 text-xs text-slate-500">
                        {item.replacementReceivedAt ? "Replacement received" : item.stockReturnedAt ? "Left stock" : "Not moved yet"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      />
    </>
  );
};

export default PurchaseReturns;
