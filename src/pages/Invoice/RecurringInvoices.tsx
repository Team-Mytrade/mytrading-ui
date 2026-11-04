import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArrowPathIcon, PauseIcon, PencilSquareIcon, PlayIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import PaginatedPopup from "../../components/common/unpopup";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import { FloatingInput, FloatingSelect1 } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { INVOICE_API, apiError, dateLabel, money, todayInput } from "./invoiceShared";
import { DialogFooter } from "./invoiceUi";

import { t } from "../../i18n/i18n";
interface Line {
  description: string;
  productCode?: string | null;
  quantity: number;
  unitPrice: number;
  taxCode?: string | null;
  taxRate?: number | null;
}

interface Template {
  id: number;
  name: string;
  customerId: number;
  customerName?: string;
  currencyCode?: string;
  paymentTerms?: string;
  creditDays?: number | null;
  frequency: string;
  startDate: string;
  endDate?: string | null;
  nextDate?: string | null;
  autoIssue: boolean;
  status: "ACTIVE" | "PAUSED" | "ENDED";
  remarks?: string | null;
  invoicesCreated: number;
  lastInvoiceNumber?: string | null;
  lastError?: string | null;
  lines: Line[];
}

interface Customer {
  id: number;
  customerName?: string;
  customerCode?: string;
  currencyCode?: string;
}

const API = `${INVOICE_API}/recurring-invoices`;
const FREQUENCIES = [
  { id: "MONTHLY", name: "Monthly" },
  { id: "QUARTERLY", name: "Quarterly" },
  { id: "HALF_YEARLY", name: "Half-yearly" },
  { id: "YEARLY", name: "Yearly" },
];
const STATUS_TONES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PAUSED: "bg-amber-50 text-amber-700 border-amber-200",
  ENDED: "bg-gray-100 text-gray-500 border-gray-200",
};

type LineForm = { description: string; productCode: string; quantity: string; unitPrice: string; taxRate: string };
const emptyLine = (): LineForm => ({ description: "", productCode: "", quantity: "1", unitPrice: "", taxRate: "" });
const emptyForm = () => ({
  name: "", customerId: "", currencyCode: "", creditDays: "", frequency: "MONTHLY", startDate: todayInput(), endDate: "",
  autoIssue: true, remarks: "", lines: [emptyLine()],
});

const lineTotal = (line: LineForm) => {
  const gross = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0);
  return gross + (gross * (Number(line.taxRate) || 0)) / 100;
};

/**
 * Recurring invoices: rent, maintenance contracts and other services billed again every month, quarter, half year
 * or year. Each template makes its invoice on its next date (checked every hour), issued or left as a draft.
 */
const RecurringInvoices: React.FC = () => {
  const { canCreate, canUpdate, canDelete, canApprove } = usePermissions();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<Template | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [templateRes, customerRes] = await Promise.all([
        axios.get<Template[]>(API),
        axios.get<Customer[]>("/v1/api/common/customers").catch(() => ({ data: [] as Customer[] })),
      ]);
      setTemplates(Array.isArray(templateRes.data) ? templateRes.data : []);
      setCustomers(Array.isArray(customerRes.data) ? customerRes.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load the recurring invoices"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const customerOptions = useMemo(
    () => customers.map((c) => ({ id: String(c.id), name: c.customerCode ? `${c.customerName} (${c.customerCode})` : c.customerName || `#${c.id}` })),
    [customers]
  );

  const stats = useMemo(() => {
    const active = templates.filter((tpl) => tpl.status === "ACTIVE");
    const month = todayInput().slice(0, 7);
    return {
      active: active.length,
      dueThisMonth: active.filter((tpl) => tpl.nextDate && tpl.nextDate.slice(0, 7) <= month).length,
      problems: templates.filter((tpl) => tpl.lastError).length,
    };
  }, [templates]);

  const openForm = (template?: Template) => {
    setEditing(template ?? null);
    setForm(template ? {
      name: template.name,
      customerId: String(template.customerId),
      currencyCode: template.currencyCode ?? "",
      creditDays: template.creditDays != null ? String(template.creditDays) : "",
      frequency: template.frequency,
      startDate: template.startDate,
      endDate: template.endDate ?? "",
      autoIssue: template.autoIssue,
      remarks: template.remarks ?? "",
      lines: template.lines.map((l) => ({ description: l.description, productCode: l.productCode ?? "", quantity: String(l.quantity),
        unitPrice: String(l.unitPrice), taxRate: l.taxRate != null ? String(l.taxRate) : "" })),
    } : emptyForm());
    setShowForm(true);
  };

  const setLine = (index: number, field: keyof LineForm, value: string) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, i) => (i === index ? { ...l, [field]: value } : l)) }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) return ToasterService.error("Name the recurring invoice");
    if (!form.customerId) return ToasterService.error("Choose the customer");
    const lines = form.lines.filter((l) => l.description.trim());
    if (lines.length === 0) return ToasterService.error("Add at least one line");
    const body = {
      name: form.name.trim(),
      customerId: Number(form.customerId),
      currencyCode: form.currencyCode.trim().toUpperCase() || null,
      creditDays: form.creditDays === "" ? null : Number(form.creditDays),
      frequency: form.frequency,
      startDate: form.startDate,
      endDate: form.endDate || null,
      autoIssue: form.autoIssue,
      remarks: form.remarks.trim() || null,
      lines: lines.map((l) => ({ description: l.description.trim(), productCode: l.productCode.trim() || null, quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice), taxRate: l.taxRate === "" ? null : Number(l.taxRate) })),
    };
    setBusy(true);
    try {
      if (editing) await axios.put(`${API}/${editing.id}`, body);
      else await axios.post(API, body);
      ToasterService.success(editing ? "Recurring invoice saved" : "Recurring invoice set up",
        editing ? undefined : `${t("The first invoice is made on")} ${dateLabel(form.startDate)}.`);
      setShowForm(false);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not save the recurring invoice"));
    } finally {
      setBusy(false);
    }
  };

  const act = async (template: Template, action: "pause" | "resume") => {
    try {
      await axios.post(`${API}/${template.id}/${action}`);
      ToasterService.success(`${template.name}: ${t(action === "pause" ? "paused" : "resumed")}`);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not change the recurring invoice"));
    }
  };

  const runNow = async () => {
    setBusy(true);
    try {
      const { data } = await axios.post<{ created: string[]; failed: string[] }>(`${API}/run`);
      if (data.created.length === 0 && data.failed.length === 0) ToasterService.success("Nothing is due");
      else if (data.created.length) ToasterService.success(`${data.created.length} ${t("invoice(s) made")}`, data.created.join(", "));
      if (data.failed.length) ToasterService.error("Some couldn't be made", data.failed.join("; "));
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not make the due invoices"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await axios.delete(`${API}/${deleting.id}`);
      ToasterService.success("Recurring invoice deleted; the invoices it made stay");
      setDeleting(null);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not delete the recurring invoice"));
    }
  };

  const columns: ColumnDef<Template>[] = [
    {
      key: "name", label: "Name", sortable: true,
      render: (row) => (
        <span className="text-sm">
          <span className="font-medium text-slate-800">{row.name}</span>
          <span className="block text-xs text-slate-500">{row.customerName}</span>
        </span>
      ),
    },
    { key: "frequency", label: "Every", sortable: true, render: (row) => <span className="text-sm text-slate-600">{t(FREQUENCIES.find((f) => f.id === row.frequency)?.name ?? row.frequency)}</span> },
    {
      key: "amount", label: "Amount", headerClassName: "text-right", className: "text-right",
      render: (row) => {
        const total = row.lines.reduce((sum, l) => sum + lineTotal({ description: "", productCode: "", quantity: String(l.quantity), unitPrice: String(l.unitPrice), taxRate: String(l.taxRate ?? "") }), 0);
        return <span className="text-sm font-semibold text-slate-900">{money(total, row.currencyCode)}</span>;
      },
    },
    {
      key: "nextDate", label: "Next invoice", sortable: true,
      render: (row) => (
        <span className="text-sm text-slate-600">
          {row.status === "ENDED" ? "—" : dateLabel(row.nextDate)}
          <span className="block text-xs text-slate-400">{t(row.autoIssue ? "Issued" : "As a draft")}{row.endDate ? ` · ${t("until")} ${dateLabel(row.endDate)}` : ""}</span>
        </span>
      ),
    },
    {
      key: "lastInvoiceNumber", label: "Made so far",
      render: (row) => (
        <span className="text-sm text-slate-600">
          {row.invoicesCreated} {row.lastInvoiceNumber ? `· ${row.lastInvoiceNumber}` : ""}
          {row.lastError && <span className="block max-w-[220px] truncate text-xs text-red-600" title={row.lastError}>{row.lastError}</span>}
        </span>
      ),
    },
    {
      key: "status", label: "Status", sortable: true,
      render: (row) => (
        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONES[row.status] ?? ""}`}>
          {t(row.status === "ACTIVE" ? "Active" : row.status === "PAUSED" ? "Paused" : "Ended")}
        </span>
      ),
    },
    {
      key: "actions", label: "Actions", headerClassName: "text-right", className: "text-right",
      render: (row) => (
        <div className="flex justify-end gap-0.5">
          {canUpdate && row.status === "ACTIVE" && (
            <button type="button" onClick={() => void act(row, "pause")} className="rounded-lg p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600"
              title={t("Pause")} aria-label={t("Pause")}><PauseIcon className="h-4 w-4" /></button>
          )}
          {canUpdate && row.status === "PAUSED" && (
            <button type="button" onClick={() => void act(row, "resume")} className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600"
              title={t("Resume")} aria-label={t("Resume")}><PlayIcon className="h-4 w-4" /></button>
          )}
          {canUpdate && (
            <button type="button" onClick={() => openForm(row)} className="rounded-lg p-1.5 text-slate-400 hover:bg-cyan-50 hover:text-cyan-600"
              title={t("Edit")} aria-label={t("Edit")}><PencilSquareIcon className="h-4 w-4" /></button>
          )}
          {canDelete && (
            <button type="button" onClick={() => setDeleting(row)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
              title={t("Delete")} aria-label={t("Delete")}><TrashIcon className="h-4 w-4" /></button>
          )}
        </div>
      ),
    },
  ];

  const formTotal = form.lines.reduce((sum, l) => sum + lineTotal(l), 0);

  return (
    <>
      <PageMeta title={t("Recurring Invoices")} description="Invoices made again every month, quarter or year" />
      <PageBreadcrumb
        pageTitle="Recurring Invoices"
        actions={
          <div className="flex gap-2">
            {canApprove && (
              <button type="button" onClick={() => void runNow()} disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                <ArrowPathIcon className="h-4 w-4" /> {t("Create due invoices now")}
              </button>
            )}
            {canCreate && <AddButton onClick={() => openForm()} label={t("New recurring invoice")} />}
          </div>
        }
      />

      <div className="w-full max-w-none space-y-4 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatsCard label={t("Active")} value={stats.active} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label={t("Due this month")} value={stats.dueThisMonth} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label={t("Last run failed")} value={stats.problems} gradient="from-rose-50 to-pink-50" borderColor="border-rose-100" labelColor="text-rose-600" />
        </div>
        <p className="text-xs text-slate-500">
          {t("Each one makes its invoice on its next date (checked every hour): issued straight away, or as a draft to check first. Missed periods are caught up. Services only: nothing leaves the stock.")}
        </p>
        <ReusableTable
          data={templates}
          columns={columns}
          pageSize={10}
          searchable
          searchPlaceholder={t("Search recurring invoices…")}
          searchFields={["name", "customerName"]}
          loading={loading}
          emptyState={<p className="py-8 text-center text-sm text-gray-500">{t("No recurring invoices yet")}</p>}
        />
      </div>

      <PaginatedPopup
        isOpen={showForm}
        title={editing ? `${t("Edit")} ${editing.name}` : t("New recurring invoice")}
        subtitle={t("The customer's details are taken now; invoices are made on schedule from them.")}
        onClose={() => setShowForm(false)}
        maxWidthClassName="max-w-3xl"
        content={
          <form onSubmit={save} className="flex flex-col">
            <div className="max-h-[65dvh] space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <FloatingInput label={t("Name (e.g. Office rent)")} name="name" required value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                <FloatingSelect1 label={t("Customer")} name="customerId" value={form.customerId} options={customerOptions}
                  onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))} />
                <FloatingSelect1 label={t("Every")} name="frequency" value={form.frequency} options={FREQUENCIES} includeEmptyOption={false}
                  onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))} />
                <FloatingInput label={t("Credit days")} name="creditDays" type="number" value={form.creditDays}
                  onChange={(e) => setForm((f) => ({ ...f, creditDays: e.target.value }))} />
                <FloatingInput label={t("First invoice on")} name="startDate" type="date" required value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                <FloatingInput label={t("Last invoice by (optional)")} name="endDate" type="date" value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                <FloatingInput label={t("Currency (blank: the customer's)")} name="currencyCode" value={form.currencyCode}
                  onChange={(e) => setForm((f) => ({ ...f, currencyCode: e.target.value.toUpperCase().slice(0, 3) }))} />
                <FloatingInput label={t("Remarks on the invoice")} name="remarks" value={form.remarks}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={form.autoIssue} onChange={(e) => setForm((f) => ({ ...f, autoIssue: e.target.checked }))} />
                {t("Issue each invoice straight away (otherwise it is made as a draft to check and issue)")}
              </label>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("Lines")}</p>
                <div className="space-y-2">
                  {form.lines.map((line, index) => (
                    <div key={index} className="grid grid-cols-12 items-end gap-2">
                      <div className="col-span-12 sm:col-span-5">
                        <FloatingInput label={t("Description")} name={`desc${index}`} value={line.description} onChange={(e) => setLine(index, "description", e.target.value)} />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <FloatingInput label={t("Qty")} name={`qty${index}`} type="number" value={line.quantity} onChange={(e) => setLine(index, "quantity", e.target.value)} />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <FloatingInput label={t("Price")} name={`price${index}`} type="number" value={line.unitPrice} onChange={(e) => setLine(index, "unitPrice", e.target.value)} />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <FloatingInput label={t("Tax %")} name={`tax${index}`} type="number" value={line.taxRate} onChange={(e) => setLine(index, "taxRate", e.target.value)} />
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex justify-end pb-2">
                        {form.lines.length > 1 && (
                          <button type="button" onClick={() => setForm((f) => ({ ...f, lines: f.lines.filter((_, i) => i !== index) }))}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={t("Remove line")}><TrashIcon className="h-4 w-4" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <button type="button" onClick={() => setForm((f) => ({ ...f, lines: [...f.lines, emptyLine()] }))}
                    className="inline-flex items-center gap-1 text-sm font-medium text-cyan-700 hover:underline"><PlusIcon className="h-4 w-4" /> {t("Add line")}</button>
                  <span className="text-sm text-slate-700">{t("Each invoice")}: <b>{money(formTotal, form.currencyCode || undefined)}</b></span>
                </div>
              </div>
            </div>
            <DialogFooter onCancel={() => setShowForm(false)} submitLabel={editing ? "Save" : "Set up"} busy={busy} />
          </form>
        }
      />

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title={t("Delete recurring invoice")}
        message={`${t("Delete")} ${deleting?.name ?? ""}? ${t("No more invoices are made from it; the ones it made stay.")}`}
        confirmLabel={t("Delete")}
        variant="danger"
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
};

export default RecurringInvoices;
