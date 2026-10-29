import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CreditCardIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import PaginatedPopup from "../../components/common/unpopup";
import { FloatingInput, FloatingSelect1 } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { INVOICE_API, Option, SOURCE_MODULE_OPTIONS, apiError, dateLabel, labelOf, money, todayInput } from "./invoiceShared";
import { DialogFooter, StatusBadge } from "./invoiceUi";

import { t } from "../../i18n/i18n";
const API_URL = `${INVOICE_API}/tax-record`;
const PAGE_SIZE = 10;

interface TaxType {
  id: number;
  taxName?: string;
  taxRate?: number;
  isActive?: boolean;
}

interface TaxRecord {
  id: number;
  transactionType?: string;
  sourceId?: number;
  sourceModule?: string;
  taxableAmount?: number;
  taxAmount?: number;
  transactionDate?: string;
  taxType?: TaxType | null;
}

interface Report {
  taxCollected: number;
  taxPaid: number;
}

const TRANSACTION_OPTIONS: Option[] = [
  { id: "SALE", name: "Sale (tax collected)" },
  { id: "PURCHASE", name: "Purchase (tax paid)" },
  { id: "OTHER", name: "Other" },
];

const TRANSACTION_TONES: Record<string, string> = {
  SALE: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  PURCHASE: "bg-blue-50 text-blue-700 border-blue-200/60",
};

const startOfYear = () => `${new Date().getFullYear()}-01-01`;

const emptyForm = () => ({
  transactionType: "SALE",
  sourceModule: "SALES_INVOICE",
  sourceId: "",
  taxTypeId: "",
  taxableAmount: "",
  transactionDate: todayInput(),
});

/** Tax collected on sales and paid on purchases. Records are an audit trail: they are added, never changed. */
const TaxRecords: React.FC = () => {
  const { canCreate } = usePermissions();
  const [records, setRecords] = useState<TaxRecord[]>([]);
  const [taxTypes, setTaxTypes] = useState<TaxType[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [from, setFrom] = useState(startOfYear);
  const [to, setTo] = useState(todayInput);
  const [report, setReport] = useState<Report | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const [recordRes, typeRes] = await Promise.all([
        axios.get<TaxRecord[]>(API_URL),
        axios.get<TaxType[]>(`${INVOICE_API}/tax-types`).catch(() => ({ data: [] as TaxType[] })),
      ]);
      setRecords(Array.isArray(recordRes.data) ? recordRes.data : []);
      setTaxTypes(Array.isArray(typeRes.data) ? typeRes.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to load tax records"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    if (!from || !to || from > to) return;
    axios
      .get<Report>(`${API_URL}/report`, { params: { from, to } })
      .then((res) => setReport(res.data))
      .catch((err) => ToasterService.error(apiError(err, "Could not load the tax summary")));
  }, [from, to, records]);

  const selectedType = taxTypes.find((type) => String(type.id) === form.taxTypeId);
  const previewTax = selectedType && Number(form.taxableAmount) > 0 ? (Number(form.taxableAmount) * Number(selectedType.taxRate || 0)) / 100 : null;

  const openCreate = () => {
    setForm(emptyForm());
    setFormOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.taxTypeId) return ToasterService.error("Choose the tax type");
    const taxable = Number(form.taxableAmount);
    if (!taxable || taxable <= 0) return ToasterService.error("Enter the taxable amount");
    setBusy(true);
    try {
      await axios.post(`${API_URL}/record`, {
        transactionType: form.transactionType,
        sourceModule: form.sourceModule,
        sourceId: form.sourceId ? Number(form.sourceId) : null,
        taxTypeId: Number(form.taxTypeId),
        taxableAmount: taxable,
        transactionDate: form.transactionDate || null,
      });
      ToasterService.success("Tax recorded");
      setFormOpen(false);
      await fetchRecords();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not record the tax"));
    } finally {
      setBusy(false);
    }
  };

  const inPeriod = useMemo(
    () => records.filter((record) => (!from || (record.transactionDate ?? "") >= from) && (!to || (record.transactionDate ?? "") <= to)),
    [records, from, to]
  );

  const filtered = useMemo(
    () => (typeFilter === "ALL" ? inPeriod : inPeriod.filter((record) => record.transactionType === typeFilter)),
    [inPeriod, typeFilter]
  );

  const collected = Number(report?.taxCollected ?? 0);
  const paid = Number(report?.taxPaid ?? 0);

  const columns: ColumnDef<TaxRecord>[] = [
    { key: "transactionDate", label: "Date", sortable: true, render: (row) => <span className="text-sm text-slate-600">{dateLabel(row.transactionDate)}</span> },
    { key: "transactionType", label: "Type", sortable: true, render: (row) => <StatusBadge status={row.transactionType} tones={TRANSACTION_TONES} /> },
    {
      key: "taxType",
      label: "Tax",
      sortable: true,
      sortValueGetter: (row) => row.taxType?.taxName ?? "",
      render: (row) => (
        <span className="text-sm text-slate-700">
          {row.taxType?.taxName ?? "—"}
          {row.taxType?.taxRate != null && <span className="ml-1 text-xs text-slate-400">{Number(row.taxType.taxRate)}%</span>}
        </span>
      ),
    },
    {
      key: "sourceModule",
      label: "Source",
      sortable: true,
      render: (row) => (
        <span className="text-sm text-slate-600">
          {labelOf(row.sourceModule)}
          {row.sourceId != null && <span className="block text-xs text-slate-400">#{row.sourceId}</span>}
        </span>
      ),
    },
    {
      key: "taxableAmount",
      label: "Taxable",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (row) => Number(row.taxableAmount || 0),
      render: (row) => <span className="text-sm text-slate-600">{money(row.taxableAmount)}</span>,
    },
    {
      key: "taxAmount",
      label: "Tax",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (row) => Number(row.taxAmount || 0),
      render: (row) => <span className="text-sm font-semibold text-slate-900">{money(row.taxAmount)}</span>,
    },
  ];

  return (
    <>
      <PageMeta title={t("Tax Records")} description="Tax collected on sales and paid on purchases" />
      <PageBreadcrumb pageTitle="Tax Records" actions={canCreate ? <AddButton onClick={openCreate} label={t("Record tax")} /> : undefined} />

      <div className="w-full max-w-none space-y-4 py-4">

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label={t("Tax collected")} value={money(collected)} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label={t("Tax paid")} value={money(paid)} gradient="from-blue-50 to-indigo-50" borderColor="border-blue-100" labelColor="text-blue-600" />
          <StatsCard label={collected >= paid ? "Net payable" : "Net credit"} value={money(Math.abs(collected - paid))} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label={t("Records")} value={inPeriod.length} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[{ id: "ALL", name: "All" }, ...TRANSACTION_OPTIONS.map((option) => ({ id: option.id, name: labelOf(option.id) }))].map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTypeFilter(option.id)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${typeFilter === option.id ? "border-cyan-500 bg-cyan-50 text-cyan-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
            >
              {option.name}
            </button>
          ))}
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <label className="flex items-center gap-1">
              {t("From")} <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
            </label>
            <label className="flex items-center gap-1">
              {t("To")} <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
            </label>
          </div>
        </div>
        {from && to && from > to && <p className="text-xs text-red-600">{t("The start date is after the end date.")}</p>}

        <ReusableTable
          data={filtered}
          columns={columns}
          pageSize={PAGE_SIZE}
          loading={loading}
          defaultSortKey="transactionDate"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <CreditCardIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("No tax records in this period")}</p>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={formOpen}
        title={t("Record tax")}
        subtitle={t("Tax records can't be edited or deleted afterwards")}
        onClose={() => setFormOpen(false)}
        maxWidthClassName="max-w-2xl"
        content={
          <form onSubmit={save} className="flex flex-col">
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 sm:px-5">
              <FloatingSelect1 label={t("Type")} name="transactionType" value={form.transactionType} options={TRANSACTION_OPTIONS} includeEmptyOption={false}
                onChange={(event) => {
                  const transactionType = event.target.value;
                  const sourceModule = transactionType === "SALE" ? "SALES_INVOICE" : transactionType === "PURCHASE" ? "PURCHASE_INVOICE" : "OTHER";
                  setForm((current) => ({ ...current, transactionType, sourceModule }));
                }} />
              <FloatingSelect1 label={t("Tax type")} name="taxTypeId" required value={form.taxTypeId}
                options={taxTypes
                  .filter((type) => type.isActive !== false || String(type.id) === form.taxTypeId)
                  .map((type) => ({ id: String(type.id), name: `${type.taxName ?? `Tax ${type.id}`} (${Number(type.taxRate ?? 0)}%)` }))}
                onChange={(event) => setForm((current) => ({ ...current, taxTypeId: event.target.value }))} />
              <FloatingInput label={t("Taxable amount")} name="taxableAmount" type="number" required value={form.taxableAmount}
                onChange={(event) => setForm((current) => ({ ...current, taxableAmount: event.target.value }))} />
              <FloatingInput label={t("Date")} name="transactionDate" type="date" value={form.transactionDate}
                onChange={(event) => setForm((current) => ({ ...current, transactionDate: event.target.value }))} />
              <FloatingSelect1 label={t("Source")} name="sourceModule" value={form.sourceModule} options={SOURCE_MODULE_OPTIONS} includeEmptyOption={false}
                onChange={(event) => setForm((current) => ({ ...current, sourceModule: event.target.value }))} />
              <FloatingInput label={t("Source document id (optional)")} name="sourceId" type="number" value={form.sourceId}
                onChange={(event) => setForm((current) => ({ ...current, sourceId: event.target.value }))} />
              {previewTax != null && (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:col-span-2">
                  {t("Tax:")} <span className="font-semibold">{money(previewTax)}</span> ({Number(selectedType?.taxRate ?? 0)}% of {money(form.taxableAmount)})
                </p>
              )}
            </div>
            <DialogFooter onCancel={() => setFormOpen(false)} submitLabel={t("Record tax")} busy={busy} />
          </form>
        }
      />
    </>
  );
};

export default TaxRecords;
