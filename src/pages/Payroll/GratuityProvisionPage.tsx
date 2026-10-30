import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { AlertCircle } from "lucide-react";
import { BanknotesIcon, DocumentArrowDownIcon, UsersIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import { usePermissions } from "../../access/usePermissions";
import { ToasterService } from "../../Services/ToasterService";
import { apiError } from "../../utils/apiError";
import { formatDate, formatMoney, formatNumber, todayIso } from "../../company/format";
import { t } from "../../i18n/i18n";
import { PAGE_BODY, STATS_ROW, TOOL_BUTTON, TOOL_INPUT } from "./hrmsUi";
import { PAYROLL_COUNTRIES } from "./gulfPayroll";
import { GratuityProvision, GratuityProvisionRow, loadGratuityProvision, serviceLength } from "./settlementStatement";

const countryName = (code: string) => t(PAYROLL_COUNTRIES.find((c) => c.code === code)?.label ?? code);

/**
 * End-of-service gratuity the company owes its Gulf employees at a date: what each would get if the company ended
 * their employment then (no minimum service, no resignation cut), for the books.
 */
export default function GratuityProvisionPage() {
  const { canExport } = usePermissions();
  const [asOf, setAsOf] = useState(todayIso());
  const [data, setData] = useState<GratuityProvision | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!asOf) return;
    let active = true;
    setLoading(true);
    loadGratuityProvision(asOf)
      .then((result) => active && setData(result))
      .catch((error) => active && ToasterService.error(apiError(error, "The gratuity provision could not be loaded")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [asOf]);

  // The table keys its rows by id
  const rows = (data?.rows ?? []).map((row) => ({ ...row, id: row.employeeId }));
  const totals = Object.entries(data?.totals ?? {});

  const exportExcel = () => {
    if (!rows.length) return ToasterService.warning("Nothing to export");
    const sheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
      "Employee code": row.employeeCode,
      Employee: row.employeeName,
      Department: row.department ?? "",
      Country: row.countryCode,
      Joined: row.joiningDate,
      "Years of service": Number(row.years),
      "Wage basis": row.wageBasis,
      "Monthly wage": Number(row.monthlyWage),
      Currency: row.currency,
      "Gratuity owed": Number(row.amount),
      Note: row.note ?? "",
    })));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Gratuity provision");
    XLSX.writeFile(book, `Gratuity_Provision_${asOf}.xlsx`);
  };

  const columns: ColumnDef<GratuityProvisionRow & { id: number }>[] = [
    {
      key: "employeeName",
      label: "Employee",
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-gray-900 dark:text-white">{row.employeeName}</span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400">{row.employeeCode} • {row.department || "—"}</span>
        </div>
      ),
    },
    { key: "countryCode", label: "Country", sortable: true, render: (row) => countryName(row.countryCode) },
    { key: "joiningDate", label: "Joined", sortable: true, render: (row) => formatDate(row.joiningDate) },
    {
      key: "years",
      label: "Service",
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span>{serviceLength(row.years, t)}</span>
          <span className="text-[10px] text-gray-500">{formatNumber(row.years, 2)} {t("years")}</span>
        </div>
      ),
    },
    {
      key: "monthlyWage",
      label: "Monthly wage",
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span dir="ltr">{formatMoney(row.monthlyWage, { currency: row.currency })}</span>
          <span className="text-[10px] text-gray-500">{t(row.wageBasis)}</span>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Gratuity owed",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      render: (row) => (
        <div className="flex flex-col items-end">
          <span className="font-semibold text-gray-900 dark:text-white" dir="ltr">{formatMoney(row.amount, { currency: row.currency })}</span>
          {row.approximate && <span className="text-[10px] text-amber-700" title={row.note ?? undefined}>{t("Approximate")}</span>}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title={t("Gratuity Provision")} description="End-of-service gratuity owed to Gulf employees" />
      <PageBreadcrumb
        pageTitle="Gratuity Provision"
        actions={
          <div className="flex items-center gap-2">
            <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className={TOOL_INPUT} aria-label={t("As of")} />
            {canExport && (
              <button type="button" onClick={exportExcel} className={TOOL_BUTTON}>
                <DocumentArrowDownIcon className="h-3.5 w-3.5" />
                {t("Export Excel")}
              </button>
            )}
          </div>
        }
      />
      <div className={PAGE_BODY}>
        <div className={STATS_ROW}>
          <StatsCard label={t("Employees")} value={rows.length} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100"
            labelColor="text-cyan-600" icon={<UsersIcon className="h-5 w-5" />} />
          {totals.slice(0, 3).map(([currency, amount]) => (
            <StatsCard key={currency} label={`${t("Gratuity owed")} (${currency})`} value={formatMoney(amount, { currency })}
              gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600"
              icon={<BanknotesIcon className="h-5 w-5" />} />
          ))}
        </div>
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          {t("What each Gulf employee would get if the company ended their employment on this date: counted from the first day, with no resignation cut. UAE: basic pay; Saudi Arabia: actual wage. National employees in a pension fund are left out.")}
        </p>
        <ReusableTable
          data={rows}
          columns={columns}
          loading={loading}
          pageSize={10}
          defaultSortKey="amount"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="mb-3 h-12 w-12 text-gray-400 dark:text-slate-500" />
              <p className="text-sm text-gray-500 dark:text-slate-400">{t("No Gulf employees are owed a gratuity on this date")}</p>
            </div>
          }
        />
      </div>
    </>
  );
}
