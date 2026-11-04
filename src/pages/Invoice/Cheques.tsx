import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { BanknotesIcon, CheckCircleIcon, NoSymbolIcon, ArrowDownTrayIcon, XCircleIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import PaginatedPopup from "../../components/common/unpopup";
import { FloatingInput, FloatingSelect1 } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { usePermissions } from "../../access/usePermissions";
import { CHEQUE_STATUS_TONES, INVOICE_API, apiError, chequeStatusLabel, dateLabel, money, todayInput } from "./invoiceShared";
import { DialogFooter } from "./invoiceUi";
import { bankAccountName, useBankAccounts } from "./bankShared";
import BankAccountField from "./BankAccountField";

import { t } from "../../i18n/i18n";
type Direction = "RECEIVED" | "ISSUED";
type ActionKind = "deposit" | "clear" | "bounce" | "cancel";

interface Cheque {
  direction: Direction;
  // The receipt's id (received) or the vendor payment's (issued)
  id: number;
  documentNumber?: string | null;
  partyId?: number | null;
  partyName?: string | null;
  chequeNumber?: string | null;
  chequeDate?: string | null;
  bank?: string | null;
  amount: number;
  currency?: string | null;
  status: string;
  paymentDate?: string | null;
  bankAccountId?: number | null;
  depositedOn?: string | null;
  clearedOn?: string | null;
  // When it bounced or was cancelled, and why
  endedOn?: string | null;
  reason?: string | null;
}

const API = `${INVOICE_API}/cheques`;
const OPEN = ["IN_HAND", "DEPOSITED", "ISSUED"];
const FILTERS = [
  { id: "OPEN", name: "Not cleared yet" },
  { id: "ALL", name: "All" },
  { id: "CLEARED", name: "Cleared" },
  { id: "BOUNCED", name: "Bounced" },
  { id: "CANCELLED", name: "Cancelled" },
];

const plusDays = (days: number) => {
  const d = new Date(`${todayInput()}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const ACTION_TITLES: Record<ActionKind, string> = {
  deposit: "Deposit cheque",
  clear: "Cheque cleared",
  bounce: "Cheque bounced",
  cancel: "Cancel cheque",
};

/**
 * Post-dated cheques: customers' cheques held until they clear (deposit, clear, bounce) and cheques given to vendors
 * until the bank pays them (clear, cancel). A bounced or cancelled cheque makes its invoice or bill owed again.
 */
const Cheques: React.FC = () => {
  const { canCreate, canApprove } = usePermissions();
  const bankAccounts = useBankAccounts();
  const [direction, setDirection] = useState<Direction>("RECEIVED");
  const [filter, setFilter] = useState("OPEN");
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<{ kind: ActionKind; cheque: Cheque } | null>(null);
  const [form, setForm] = useState({ date: todayInput(), bankAccountId: "", reason: "", charge: "" });
  const [busy, setBusy] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await axios.get<Cheque[]>(API);
      setCheques(Array.isArray(data) ? data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load the cheques"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const shown = useMemo(
    () =>
      cheques.filter(
        (c) => c.direction === direction && (filter === "ALL" || (filter === "OPEN" ? OPEN.includes(c.status) : c.status === filter))
      ),
    [cheques, direction, filter]
  );

  const stats = useMemo(() => {
    const open = cheques.filter((c) => OPEN.includes(c.status));
    const week = plusDays(7);
    // Company currency only roughly: cheques are summed in their own amounts (most are in the company's)
    const sum = (list: Cheque[]) => list.reduce((total, c) => total + Number(c.amount || 0), 0);
    return {
      inHand: sum(open.filter((c) => c.direction === "RECEIVED")),
      issued: sum(open.filter((c) => c.direction === "ISSUED")),
      dueThisWeek: open.filter((c) => c.chequeDate && c.chequeDate <= week).length,
    };
  }, [cheques]);

  const open = (kind: ActionKind, cheque: Cheque) => {
    setForm({ date: todayInput(), bankAccountId: cheque.bankAccountId != null ? String(cheque.bankAccountId) : "", reason: "", charge: "" });
    setAction({ kind, cheque });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!action) return;
    const { kind, cheque } = action;
    const ending = kind === "bounce" || kind === "cancel";
    if (ending && !form.reason.trim()) return ToasterService.error(kind === "bounce" ? "Say why the cheque bounced" : "Say why the cheque is cancelled");
    const path = `${API}/${cheque.direction === "RECEIVED" ? "received" : "issued"}/${cheque.id}/${kind}`;
    setBusy(true);
    try {
      await axios.post(path, {
        date: ending ? null : form.date || null,
        bankAccountId: form.bankAccountId ? Number(form.bankAccountId) : null,
        reason: ending ? form.reason.trim() : null,
        charge: ending && form.charge ? Number(form.charge) : null,
      });
      ToasterService.success(
        kind === "deposit"
          ? `Cheque ${cheque.chequeNumber} deposited`
          : kind === "clear"
            ? `Cheque ${cheque.chequeNumber} cleared`
            : kind === "bounce"
              ? `Cheque ${cheque.chequeNumber} bounced; the invoices are owed again`
              : `Cheque ${cheque.chequeNumber} cancelled; the bill is owed again`
      );
      setAction(null);
      await fetchAll();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not update the cheque"));
    } finally {
      setBusy(false);
    }
  };

  const columns: ColumnDef<Cheque>[] = [
    {
      key: "chequeDate",
      label: "Cheque date",
      sortable: true,
      render: (c) => {
        const due = OPEN.includes(c.status) && c.chequeDate && c.chequeDate <= todayInput();
        return (
          <span className={`text-sm ${due ? "font-semibold text-amber-700" : "text-slate-600"}`}>
            {dateLabel(c.chequeDate)}
            {due ? <span className="block text-xs">{t("due")}</span> : null}
          </span>
        );
      },
    },
    { key: "chequeNumber", label: "Cheque no.", sortable: true, render: (c) => <span className="text-sm font-medium text-slate-800">{c.chequeNumber || "—"}</span> },
    {
      key: "partyName",
      label: direction === "RECEIVED" ? "Customer" : "Vendor",
      sortable: true,
      render: (c) => <span className="text-sm text-slate-700">{c.partyName || (c.partyId ? `#${c.partyId}` : "—")}</span>,
    },
    {
      key: "documentNumber",
      label: direction === "RECEIVED" ? "Receipt" : "Bill",
      sortable: true,
      render: (c) => (
        <span className="text-sm text-slate-600">
          {c.documentNumber || "—"}
          {c.bank ? <span className="block text-xs text-slate-400">{c.bank}</span> : null}
        </span>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      headerClassName: "text-right",
      className: "text-right",
      sortValueGetter: (c) => Number(c.amount || 0),
      render: (c) => <span className="text-sm font-semibold text-slate-900">{money(c.amount, c.currency)}</span>,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (c) => (
        <span className="text-sm">
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CHEQUE_STATUS_TONES[c.status] ?? ""}`}>
            {t(chequeStatusLabel(c.status))}
          </span>
          <span className="block text-xs text-slate-400">
            {c.status === "DEPOSITED" && `${dateLabel(c.depositedOn)} · ${bankAccountName(bankAccounts, c.bankAccountId) ?? ""}`}
            {c.status === "CLEARED" && dateLabel(c.clearedOn)}
            {(c.status === "BOUNCED" || c.status === "CANCELLED") && `${dateLabel(c.endedOn)}${c.reason ? ` · ${c.reason}` : ""}`}
          </span>
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (c) => (
        <div className="flex flex-wrap justify-end gap-1">
          {c.direction === "RECEIVED" && c.status === "IN_HAND" && canCreate && (
            <RowButton icon={ArrowDownTrayIcon} label="Deposit" onClick={() => open("deposit", c)} />
          )}
          {/* A bank pays a cheque only once its date has come */}
          {OPEN.includes(c.status) && canCreate && (!c.chequeDate || c.chequeDate <= todayInput()) && (
            <RowButton icon={CheckCircleIcon} label="Cleared" onClick={() => open("clear", c)} />
          )}
          {c.direction === "RECEIVED" && (c.status === "IN_HAND" || c.status === "DEPOSITED") && canApprove && (
            <RowButton icon={NoSymbolIcon} label="Bounced" danger onClick={() => open("bounce", c)} />
          )}
          {c.direction === "ISSUED" && c.status === "ISSUED" && canApprove && (
            <RowButton icon={XCircleIcon} label="Cancel" danger onClick={() => open("cancel", c)} />
          )}
        </div>
      ),
    },
  ];

  const kind = action?.kind;
  const ending = kind === "bounce" || kind === "cancel";

  return (
    <>
      <PageMeta title={t("Cheques")} description="Post-dated cheques received and issued" />
      <PageBreadcrumb pageTitle="Cheques" />

      <div className="w-full max-w-none space-y-4 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatsCard label={t("Customers' cheques in hand")} value={money(stats.inHand)} gradient="from-amber-50 to-orange-50" borderColor="border-amber-100" labelColor="text-amber-600" />
          <StatsCard label={t("Our cheques not yet cleared")} value={money(stats.issued)} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label={t("Due within 7 days")} value={stats.dueThisWeek} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
            {(["RECEIVED", "ISSUED"] as Direction[]).map((d) => (
              <button key={d} type="button" onClick={() => setDirection(d)}
                className={`rounded-md px-3 py-1.5 font-medium ${direction === d ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                {t(d === "RECEIVED" ? "From customers" : "To vendors")}
              </button>
            ))}
          </div>
          <div className="w-52">
            <FloatingSelect1 label={t("Show")} name="filter" value={filter} options={FILTERS} includeEmptyOption={false} onChange={(e) => setFilter(e.target.value)} />
          </div>
        </div>

        <ReusableTable
          data={shown}
          columns={columns}
          pageSize={10}
          searchable
          searchPlaceholder={t("Search cheques…")}
          searchFields={["chequeNumber", "partyName", "documentNumber", "bank"]}
          loading={loading}
          emptyState={
            <div className="flex flex-col items-center justify-center py-8">
              <BanknotesIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="text-sm text-gray-500">{t("No post-dated cheques here")}</p>
              <p className="mt-1 max-w-md text-center text-xs text-gray-400">
                {t("A cheque dated after its payment date is post-dated: record it on a receipt or vendor payment with its cheque date, and it shows here until it clears.")}
              </p>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={!!action}
        title={kind ? `${t(ACTION_TITLES[kind])} ${action?.cheque.chequeNumber ?? ""}` : ""}
        subtitle={action ? `${action.cheque.partyName ?? ""} · ${money(action.cheque.amount, action.cheque.currency)} · ${t("dated")} ${dateLabel(action.cheque.chequeDate)}` : ""}
        onClose={() => setAction(null)}
        maxWidthClassName="max-w-lg"
        content={
          <form onSubmit={submit} className="flex flex-col">
            <div className="space-y-3 px-4 py-4 sm:px-5">
              {!ending && (
                <FloatingInput label={t(kind === "deposit" ? "Deposited on" : "Cleared on")} name="date" type="date" value={form.date} max={todayInput()}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
              )}
              {kind !== "cancel" && (
                <BankAccountField accounts={bankAccounts} label={t(ending ? "Bank account charged" : kind === "deposit" ? "Paid into" : action?.cheque.direction === "ISSUED" ? "Paid from" : "Cleared into")}
                  value={form.bankAccountId} onChange={(bankAccountId) => setForm((f) => ({ ...f, bankAccountId }))} />
              )}
              {ending && (
                <>
                  <FloatingInput label={t(kind === "bounce" ? "Why did it bounce?" : "Why is it cancelled?")} name="reason" required value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
                  <FloatingInput label={t("Bank charge (optional)")} name="charge" type="number" value={form.charge}
                    onChange={(e) => setForm((f) => ({ ...f, charge: e.target.value }))} />
                </>
              )}
              <p className="text-xs text-slate-500">
                {t(
                  kind === "deposit"
                    ? "Marks the cheque as paid into the bank; nothing is posted until it clears."
                    : kind === "clear"
                      ? action?.cheque.direction === "RECEIVED"
                        ? "Moves the money from Post-dated cheques received into the bank account. A cheque can't clear before its date."
                        : "Clears Post-dated cheques issued against the bank account. A cheque can't clear before its date."
                      : kind === "bounce"
                        ? "Reverses the receipt: its invoices are owed again. A bank charge posts to Bank charges from the account chosen."
                        : "Takes the payment back out: the bill is owed again and the payment stays marked cancelled. A stop-payment charge posts to Bank charges."
                )}
              </p>
            </div>
            <DialogFooter onCancel={() => setAction(null)} submitLabel={kind ? ACTION_TITLES[kind] : "Save"} busy={busy} danger={ending} />
          </form>
        }
      />
    </>
  );
};

const RowButton = ({ icon: Icon, label, onClick, danger }: {
  icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; danger?: boolean;
}) => (
  <button type="button" onClick={onClick}
    className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${danger ? "text-red-600 hover:bg-red-50" : "text-cyan-700 hover:bg-cyan-50"}`}>
    <Icon className="h-3.5 w-3.5" /> {t(label)}
  </button>
);

export default Cheques;
