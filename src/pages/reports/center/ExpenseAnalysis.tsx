import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { ReceiptPercentIcon, XMarkIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../../components/common/PageMeta";
import PageBreadcrumb from "../../../components/common/PageBreadCrumb";
import ReusableTable, { ColumnDef } from "../../../components/common/Table";
import { ToasterService } from "../../../Services/ToasterService";
import { INVOICE_API, apiError, money, monthLabel } from "../../Invoice/invoiceShared";
import { BarList, ExportButtons, FilterBar, Period, PeriodPicker, ReportColumn, SelectField, TotalCard, initialPeriod, num, useSyncedParams } from "./reportKit";
import { BOOKS_API } from "./booksShared";
import { t } from "../../../i18n/i18n";

type GroupBy = "ACCOUNT" | "COST_CENTRE" | "MONTH";

const GROUPS: { value: GroupBy; label: string; column: string; parts: string }[] = [
  { value: "ACCOUNT", label: "By account", column: "Account", parts: "By cost centre" },
  { value: "COST_CENTRE", label: "By cost centre", column: "Cost centre", parts: "By account" },
  { value: "MONTH", label: "By month", column: "Month", parts: "By account" },
];

interface Part {
  key: string;
  label: string;
  amount: number;
}

interface ExpenseRow {
  key: string;
  code?: string | null;
  label: string;
  amount: number;
  share: number;
  lines: number;
  parts: Part[];
}

interface Expenses {
  rows: ExpenseRow[];
  total: number;
  withoutCostCentre: number;
}

type Row = ExpenseRow & { id: string };

const MODULES = ["INVOICE"];
// The service's own labels (keys ending "-"), never an account's or cost centre's name, are translated
const own = (key: string, label: string) => (key.endsWith("-") ? t(label) : label);
const partsText = (parts: Part[]) => parts.map((p) => `${own(p.key, p.label)} ${money(p.amount)}`).join(" · ");

/** What the expense accounts took in a period (backlog 8.2.1.5), by account, cost centre or month. */
const ExpenseAnalysis: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>(() => initialPeriod(params));
  const [groupBy, setGroupBy] = useState<GroupBy>(() => GROUPS.find((g) => g.value === params.get("groupBy"))?.value ?? "ACCOUNT");
  const [costCentreId, setCostCentreId] = useState(params.get("costCentreId") ?? "");
  const [account, setAccount] = useState<{ id: string; label: string } | null>(() =>
    params.get("accountId") ? { id: params.get("accountId") as string, label: params.get("accountName") ?? `#${params.get("accountId")}` } : null
  );
  const [centres, setCentres] = useState<{ value: string; label: string }[]>([]);
  const [report, setReport] = useState<Expenses | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios
      .get<{ id: number; code?: string; name: string }[]>(`${INVOICE_API}/cost-centres`, { skipSessionExpiredHandling: true } as object)
      .then((r) => setCentres([{ value: "0", label: t("No cost centre") }, ...(Array.isArray(r.data) ? r.data : []).map((c) => ({ value: String(c.id), label: c.code ? `${c.code} · ${c.name}` : c.name }))]))
      .catch(() => setCentres([]));
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<Expenses>(`${BOOKS_API}/expenses`, {
        params: { from: period.from, to: period.to, groupBy, costCentreId: costCentreId || undefined, accountId: account?.id },
        skipSessionExpiredHandling: true,
      } as object);
      setReport(res.data && Array.isArray(res.data.rows) ? res.data : null);
    } catch (err) {
      setReport(null);
      ToasterService.error(apiError(err, "Failed to load the expenses"));
    } finally {
      setLoading(false);
    }
  }, [period.from, period.to, groupBy, costCentreId, account?.id]);

  useEffect(() => {
    load();
  }, [load]);

  useSyncedParams(setParams, { from: period.from, to: period.to, groupBy, costCentreId, accountId: account?.id, accountName: account?.label });

  const group = GROUPS.find((g) => g.value === groupBy) ?? GROUPS[0];
  const label = (r: ExpenseRow) => (groupBy === "MONTH" ? monthLabel(r.label) : own(r.key, r.label));
  const rows: Row[] = useMemo(() => (report?.rows ?? []).map((r) => ({ ...r, id: r.key })), [report]);

  // An account shows its months; a cost centre its accounts; a month its accounts
  const open = (row: ExpenseRow) => {
    if (groupBy === "ACCOUNT" && /^A\d+$/.test(row.key)) {
      setAccount({ id: row.key.slice(1), label: row.label });
      setGroupBy("MONTH");
    } else if (groupBy === "COST_CENTRE") {
      setCostCentreId(row.key === "C-" ? "0" : row.key.slice(1));
      setGroupBy("ACCOUNT");
    }
  };

  const columns: ColumnDef<Row>[] = [
    {
      key: "label",
      label: group.column,
      sortable: true,
      sortValueGetter: (r) => (groupBy === "MONTH" ? r.key : label(r)),
      render: (r) => (
        <span className="text-sm">
          <span className="font-semibold text-slate-900">{label(r)}</span>
          {r.code && <span className="block text-xs text-slate-500">{r.code}</span>}
        </span>
      ),
    },
    {
      key: "parts",
      label: group.parts,
      render: (r) => (
        <span className="block max-w-md truncate text-xs text-slate-600" title={partsText(r.parts)}>
          {partsText(r.parts)}
        </span>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (r) => num(r.amount),
      render: (r) => <span className={`text-sm font-semibold ${num(r.amount) < 0 ? "text-red-600" : "text-slate-900"}`}>{money(r.amount)}</span>,
    },
    {
      key: "share",
      label: "Share",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (r) => num(r.share),
      render: (r) => <span className="text-sm text-slate-600">{num(r.share).toLocaleString(undefined, { maximumFractionDigits: 2 })}%</span>,
    },
  ];

  const exportColumns: ReportColumn<Row>[] = [
    { label: group.column, value: (r) => (r.key === "totals" ? r.label : label(r)) },
    { label: "Code", value: (r) => r.code ?? "" },
    { label: group.parts, value: (r) => partsText(r.parts) },
    { label: "Amount", value: (r) => num(r.amount), format: "money" },
    { label: "Share", value: (r) => num(r.share), format: "percent" },
  ];
  const totalsRow: Row | undefined = report
    ? { id: "totals", key: "totals", label: t("Total"), amount: report.total, share: num(report.total) === 0 ? 0 : 100, lines: 0, parts: [] }
    : undefined;
  const details = [
    { label: "Grouped", value: t(group.label) },
    ...(costCentreId ? [{ label: "Cost centre", value: centres.find((c) => c.value === costCentreId)?.label ?? `#${costCentreId}` }] : []),
    ...(account ? [{ label: "Account", value: account.label }] : []),
  ];
  const chart = useMemo(() => {
    const source = groupBy === "MONTH" ? rows : rows.slice(0, 10);
    return source.map((r) => ({ key: r.key, label: label(r), value: num(r.amount), display: money(r.amount) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, groupBy]);
  const top = rows[0];

  return (
    <>
      <PageMeta title={t("Expenses by Account")} description="Expenses by account, cost centre or month" />
      <PageBreadcrumb pageTitle="Expenses by Account" />

      <div className="w-full max-w-none space-y-4 py-4">
        <FilterBar
          actions={<ExportButtons modules={MODULES} disabled={loading || rows.length === 0} report={{ title: "Expenses by Account", period, columns: exportColumns, rows, totals: totalsRow, details }} />}
        >
          <PeriodPicker value={period} onChange={setPeriod} />
          {centres.length > 1 && <SelectField label="Cost centre" value={costCentreId} options={centres} allLabel="All cost centres" onChange={setCostCentreId} />}
          {account && (
            <span className="inline-flex h-10 items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-sm text-cyan-800">
              {`${t("Account")}: ${account.label}`}
              <button type="button" aria-label={t("Remove filter")} className="rounded p-0.5 hover:bg-cyan-100" onClick={() => setAccount(null)}>
                <XMarkIcon className="h-4 w-4" />
              </button>
            </span>
          )}
        </FilterBar>

        <div className="flex flex-wrap gap-2" role="tablist">
          {GROUPS.map((g) => (
            <button
              key={g.value}
              type="button"
              role="tab"
              aria-selected={g.value === groupBy}
              onClick={() => setGroupBy(g.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${g.value === groupBy ? "bg-cyan-600 text-white" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {t(g.label)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <TotalCard label="Expenses" tone="red" value={money(report?.total)} hint={t("Debits less credits on expense accounts")} />
          <TotalCard label="Largest" tone="cyan" value={top ? money(top.amount) : "—"} hint={top ? label(top) : undefined} />
          <TotalCard label="Without a cost centre" value={money(report?.withoutCostCentre)} hint={t("Lines not charged to one")} />
        </div>

        <BarList title={groupBy === "MONTH" ? "Expenses by month" : "Top 10 expenses"} rows={chart} empty={loading ? "Loading…" : "Nothing in this period"} />

        <p className="text-xs text-slate-500">
          {t("Every posting to an expense account in the period (year-end closing left out), in the company currency; refunds and corrections lower it. Click a row: an account shows its months, a cost centre its accounts.")}
        </p>

        <ReusableTable
          data={rows}
          columns={columns}
          pageSize={25}
          loading={loading}
          onRowClick={open}
          defaultSortKey={groupBy === "MONTH" ? "label" : "amount"}
          defaultSortOrder={groupBy === "MONTH" ? "asc" : "desc"}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <ReceiptPercentIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("Nothing in this period")}</p>
            </div>
          }
        />
      </div>
    </>
  );
};

export default ExpenseAnalysis;
