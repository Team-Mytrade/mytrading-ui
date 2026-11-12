import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, BarChart3, Building2, ClipboardList, CreditCard, FileText, Globe, Hash, Landmark, Mail, MapPin,
  MessageSquare, Pencil, Phone, Receipt, Star, Tags, UserRound, Users, Wallet,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AuthContext } from "../../context/AuthContext";
import { canAccessPath } from "../../access/access";
import { usePermissions } from "../../access/usePermissions";
import { companyCurrency, formatDateTime, formatMoney } from "../../company/format";
import { addressStyle, regionalAddressLines } from "../../company/regionalAddress";
import { t } from "../../i18n/i18n";

// One customer at a glance (Common → Customers → view): who they are, what they owe against their credit, how
// to reach them, their addresses, and a way into their documents, reports and CRM history.

const API = "/v1/api/common/customers";

interface Address {
  id?: number;
  type?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  defaultAddress?: boolean;
}

interface Customer {
  id: number;
  customerCode?: string;
  customerName?: string;
  tradeName?: string | null;
  customerType?: string;
  status?: string;
  taxNumber?: string | null;
  registrationNumber?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  creditLimit?: number | null;
  outstandingBalance?: number | null;
  invoiceOutstanding?: number | null;
  manualAdjustment?: number | null;
  paymentTerms?: string | null;
  currencyCode?: string | null;
  salesPersonName?: string | null;
  addresses?: Address[];
  createdAt?: string;
  updatedAt?: string;
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  CREDIT_HOLD: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
  BLOCKED: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30",
  INACTIVE: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-white/10 dark:text-gray-300 dark:ring-white/15",
  LEAD: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
};
const STATUS_NOTE: Record<string, string> = {
  CREDIT_HOLD: "New orders wait for a manager to release them.",
  BLOCKED: "No new documents can be made for this customer.",
  INACTIVE: "No longer a customer; kept for history.",
};

const CARD = "rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-[#333] dark:bg-[#1f1f1f]";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400";

const words = (code?: string | null) =>
  (code ?? "").toLowerCase().split("_").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
const initials = (name?: string) =>
  (name ?? "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));

/** "NET30" → 30; other terms as they are. */
const termDays = (terms?: string | null) => {
  const m = /^NET\s*(\d+)$/i.exec((terms ?? "").trim());
  return m ? Number(m[1]) : null;
};

/** GSTIN in India, TRN in the UAE / Bahrain / Oman, VAT number in Saudi Arabia, else "Tax number". */
const taxLabel = (country?: string) => {
  const lower = (country ?? "").trim().toLowerCase();
  if (lower === "india" || lower === "in") return "GSTIN";
  const style = addressStyle(country);
  if (style === "AE" || lower === "bahrain" || lower === "oman") return "TRN";
  if (style === "SA") return "VAT number";
  return "Tax number";
};

const Section = ({ title, icon: Icon, action, children, className = "" }: {
  title: string; icon: React.ElementType; action?: React.ReactNode; children: React.ReactNode; className?: string;
}) => (
  <section className={`${CARD} ${className}`}>
    <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 dark:border-[#333]">
      <h2 className="flex items-center gap-2.5 text-sm font-semibold text-slate-900 dark:text-gray-50">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100 dark:bg-cyan-400/15 dark:text-cyan-300 dark:ring-cyan-400/25">
          <Icon className="h-4 w-4" />
        </span>
        {t(title)}
      </h2>
      {action}
    </header>
    <div className="p-5">{children}</div>
  </section>
);

const Row = ({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) => (
  <div className="flex items-start gap-3 py-2.5">
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-gray-500" />
    <div className="min-w-0 flex-1">
      <dt className="text-xs text-slate-500 dark:text-gray-400">{t(label)}</dt>
      <dd className="mt-0.5 break-words text-sm font-medium text-slate-900 dark:text-gray-100">{children}</dd>
    </div>
  </div>
);

const None = () => <span className="font-normal text-slate-400 dark:text-gray-500">{t("Not provided")}</span>;

export default function CustomerViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { access } = useContext(AuthContext);
  const { canUpdate } = usePermissions("CRM");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCustomer(null);
    setError(null);
    axios.get<Customer>(`${API}/${id}`)
      .then((res) => setCustomer(res.data))
      .catch((err) => {
        const status = err?.response?.status;
        setError(status === 404 ? "This customer doesn't exist or was deleted."
          : status === 403 ? "You don't have access to this customer."
          : err?.response?.data?.message || "The customer could not be loaded.");
      });
  }, [id]);

  const currency = customer?.currencyCode || companyCurrency();
  const money = (v: number | null) => formatMoney(v ?? 0, currency);
  const balance = num(customer?.outstandingBalance) ?? 0;
  const limit = num(customer?.creditLimit);
  const used = limit && limit > 0 ? Math.round((balance / limit) * 100) : null;
  const addresses = useMemo(
    () => [...(customer?.addresses ?? [])].sort((a, b) => Number(!!b.defaultAddress) - Number(!!a.defaultAddress)),
    [customer],
  );
  const mainCountry = addresses[0]?.country;

  // Ways into the customer's work, only those the reader can open
  const links = customer ? [
    { label: "Sales register", note: "Invoices and credit notes", icon: Receipt, to: `/reports/sales-register?customerId=${customer.id}` },
    { label: "Open orders", note: "Ordered, not yet delivered", icon: ClipboardList, to: `/reports/open-orders?customerId=${customer.id}` },
    { label: "Sales analysis", note: "What they buy", icon: BarChart3, to: `/reports/sales-analysis?customerId=${customer.id}` },
    { label: "Record a payment", note: "Payment receipts", icon: Wallet, to: `/paymentReceipts?customerId=${customer.id}` },
    { label: "Interactions", note: "Calls, emails and meetings", icon: MessageSquare,
      to: `/communication-history?customerId=${customer.id}&name=${encodeURIComponent(customer.customerName ?? "")}` },
    { label: "Key contacts", note: "The people you deal with", icon: Users, to: `/contactPerson?customerId=${customer.id}` },
    { label: "Segments", note: "Groups this customer is in", icon: Tags, to: `/customer-segment?customerId=${customer.id}` },
  ].filter((l) => canAccessPath(access, l.to.split("?")[0])) : [];

  const editButton = customer && canUpdate ? (
    <button type="button" onClick={() => navigate(`/customers/edit/${customer.id}`)}
      className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-cyan-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-cyan-700">
      <Pencil className="h-3.5 w-3.5" /> {t("Edit customer")}
    </button>
  ) : undefined;

  return (
    <>
      <PageMeta title={customer?.customerName ? `${customer.customerName} | ${t("Customers")}` : t("Customer")} description="Customer details" />
      <PageBreadcrumb pageTitle="Customer" actions={editButton} />

      <div className="mx-auto w-full max-w-7xl space-y-4 px-1 pb-8 pt-2">
        {error ? (
          <div className={`${CARD} p-10 text-center`}>
            <p className="text-sm text-slate-600 dark:text-gray-300">{t(error)}</p>
            <button type="button" onClick={() => navigate("/customer-management")}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-[#3a3a3a] dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
              <ArrowLeft className="h-4 w-4" /> {t("Back to customers")}
            </button>
          </div>
        ) : !customer ? (
          <div className="space-y-4">
            {[96, 88, 260].map((h, i) => <div key={i} className={`${CARD} animate-pulse`} style={{ height: h }} />)}
          </div>
        ) : (
          <>
            {/* Who they are */}
            <section className={`${CARD} relative overflow-hidden`}>
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500" aria-hidden />
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-sky-600 text-lg font-bold text-white shadow-sm">
                  {initials(customer.customerName)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 dark:text-white">{customer.customerName}</h1>
                    {customer.status && (
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${STATUS_STYLE[customer.status] ?? STATUS_STYLE.INACTIVE}`}>
                        {t(words(customer.status))}
                      </span>
                    )}
                  </div>
                  {customer.tradeName && customer.tradeName !== customer.customerName && (
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-gray-400">{t("Trading as")} {customer.tradeName}</p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-gray-300">
                    {customer.customerCode && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-700 dark:bg-[#2c2c2c] dark:text-gray-200">
                        <Hash className="h-3 w-3" />{customer.customerCode}
                      </span>
                    )}
                    {customer.customerType && <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-slate-400" />{t(words(customer.customerType))}</span>}
                    {customer.email && <a href={`mailto:${customer.email}`} className="inline-flex items-center gap-1 text-cyan-700 hover:underline dark:text-cyan-300"><Mail className="h-3.5 w-3.5" />{customer.email}</a>}
                    {customer.phone && <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 text-cyan-700 hover:underline dark:text-cyan-300" dir="ltr"><Phone className="h-3.5 w-3.5" />{customer.phone}</a>}
                  </div>
                </div>
              </div>
              {customer.status && STATUS_NOTE[customer.status] && (
                <p className="border-t border-amber-100 bg-amber-50/70 px-5 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                  {t(STATUS_NOTE[customer.status])}
                </p>
              )}
            </section>

            {/* Money: what they owe against their credit, and on what terms */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className={`${CARD} p-4`}>
                <p className={LABEL}>{t("Outstanding balance")}</p>
                <p className={`mt-1 text-xl font-bold tabular-nums ${balance > 0 ? "text-slate-900 dark:text-white" : "text-emerald-600 dark:text-emerald-400"}`}>{money(balance)}</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-gray-400">{t(balance > 0 ? "Owed to you" : "Nothing owed")}</p>
              </div>
              <div className={`${CARD} p-4`}>
                <p className={LABEL}>{t("Credit limit")}</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-white">{limit === null ? t("No limit") : money(limit)}</p>
                {limit === null ? (
                  <p className="mt-0.5 text-[11px] text-slate-500 dark:text-gray-400">{t("Orders aren't checked against credit")}</p>
                ) : limit === 0 ? (
                  <p className="mt-0.5 text-[11px] text-rose-600 dark:text-rose-400">{t("A limit of 0 blocks every order on credit.")}</p>
                ) : (
                  <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-[#333]">
                      <div className={`h-full rounded-full ${used! > 100 ? "bg-rose-500" : used! >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(used!, 100)}%` }} />
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-gray-400">{t("{percent}% used · {amount} available", { percent: used!, amount: money(Math.max(limit - balance, 0)) })}</p>
                  </div>
                )}
              </div>
              <div className={`${CARD} p-4`}>
                <p className={LABEL}>{t("Payment terms")}</p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{customer.paymentTerms || "—"}</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-gray-400">
                  {termDays(customer.paymentTerms) !== null ? t("{days} days from the invoice date", { days: termDays(customer.paymentTerms)! }) : t("Sets the due date on invoices")}
                </p>
              </div>
              <div className={`${CARD} p-4`}>
                <p className={LABEL}>{t("Currency")}</p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{currency}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-gray-400">
                  {customer.salesPersonName ? `${t("Sales person")}: ${customer.salesPersonName}` : t("No sales person")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Contact, tax and registration */}
              <Section title="Details" icon={UserRound}>
                <dl className="-my-2.5 divide-y divide-slate-100 dark:divide-[#2e2e2e]">
                  <Row icon={Mail} label="Email">{customer.email ? <a href={`mailto:${customer.email}`} className="text-cyan-700 hover:underline dark:text-cyan-300">{customer.email}</a> : <None />}</Row>
                  <Row icon={Phone} label="Phone">{customer.phone ? <a href={`tel:${customer.phone}`} dir="ltr" className="text-cyan-700 hover:underline dark:text-cyan-300">{customer.phone}</a> : <None />}</Row>
                  <Row icon={Globe} label="Website">
                    {customer.website ? (
                      <a href={customer.website.startsWith("http") ? customer.website : `https://${customer.website}`} target="_blank" rel="noopener noreferrer"
                        className="text-cyan-700 hover:underline dark:text-cyan-300">{customer.website.replace(/^https?:\/\//, "")}</a>
                    ) : <None />}
                  </Row>
                  <Row icon={Landmark} label={taxLabel(mainCountry)}>{customer.taxNumber ? <span className="font-mono">{customer.taxNumber}</span> : <span className="font-normal text-slate-400">{t("Not registered")}</span>}</Row>
                  <Row icon={FileText} label="Registration number">{customer.registrationNumber || <None />}</Row>
                  <Row icon={Building2} label="Customer type">{customer.customerType ? t(words(customer.customerType)) : <None />}</Row>
                </dl>
              </Section>

              {/* Addresses */}
              <Section title="Addresses" icon={MapPin} className="lg:col-span-2"
                action={<span className="text-xs text-slate-500 dark:text-gray-400">{addresses.length}</span>}>
                {addresses.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">{t("No addresses yet.")}</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {addresses.map((a, i) => (
                      <div key={a.id ?? i} className={`rounded-xl border p-4 ${a.defaultAddress ? "border-cyan-200 bg-cyan-50/40 dark:border-cyan-500/30 dark:bg-cyan-400/5" : "border-slate-200 dark:border-[#333]"}`}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-gray-300">{t(words(a.type) || "Address")}</span>
                          {a.defaultAddress && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                              <Star className="h-3 w-3" /> {t("Default")}
                            </span>
                          )}
                        </div>
                        <address className="space-y-0.5 text-sm not-italic leading-relaxed text-slate-700 dark:text-gray-200">
                          {regionalAddressLines({
                            addressLine1: a.addressLine1 ?? "", addressLine2: a.addressLine2 ?? "", city: a.city ?? "",
                            state: a.state ?? "", postalCode: a.postalCode ?? "", country: a.country,
                          }).map((line, j) => <div key={j}>{line}</div>)}
                        </address>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {/* Where the balance comes from */}
              <Section title="Balance" icon={CreditCard}>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-gray-400">{t("Open invoices")}</dt>
                    <dd className="font-medium tabular-nums text-slate-900 dark:text-gray-100">{money(num(customer.invoiceOutstanding))}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-500 dark:text-gray-400">{t("Manual adjustment")}</dt>
                    <dd className="font-medium tabular-nums text-slate-900 dark:text-gray-100">{money(num(customer.manualAdjustment))}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-100 pt-2.5 dark:border-[#333]">
                    <dt className="font-semibold text-slate-700 dark:text-gray-200">{t("Outstanding balance")}</dt>
                    <dd className="font-bold tabular-nums text-slate-900 dark:text-white">{money(balance)}</dd>
                  </div>
                </dl>
                {(customer.createdAt || customer.updatedAt) && (
                  <p className="mt-4 text-[11px] text-slate-400 dark:text-gray-500">
                    {customer.createdAt && <>{t("Added")} {formatDateTime(customer.createdAt)}</>}
                    {customer.updatedAt && <> · {t("Updated")} {formatDateTime(customer.updatedAt)}</>}
                  </p>
                )}
              </Section>

              {/* Into the customer's documents, reports and history */}
              {links.length > 0 && (
                <Section title="Work with this customer" icon={ClipboardList} className="lg:col-span-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {links.map((l) => (
                      <Link key={l.label} to={l.to}
                        className="group flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition hover:-translate-y-px hover:border-cyan-300 hover:shadow-sm dark:border-[#333] dark:hover:border-cyan-500/50">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600 transition group-hover:bg-cyan-50 group-hover:text-cyan-700 dark:bg-[#2a2a2a] dark:text-gray-300 dark:group-hover:bg-cyan-400/15 dark:group-hover:text-cyan-300">
                          <l.icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-800 dark:text-gray-100">{t(l.label)}</span>
                          <span className="block truncate text-xs text-slate-500 dark:text-gray-400">{t(l.note)}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
