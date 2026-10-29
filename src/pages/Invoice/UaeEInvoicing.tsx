import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { CheckCircleIcon, XCircleIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { INVOICE_API, UAE_STATUS_LABELS, apiError, dateLabel } from "./invoiceShared";
import { t } from "../../i18n/i18n";
import UaeReceived from "./UaeReceived";

interface Check {
  name: string;
  ok: boolean;
  message: string;
}

interface AccountStatus {
  connected: boolean;
  provider: string;
  mode: string;
  participantId?: string | null;
  accountRef?: string | null;
  connectedAt?: string | null;
  checks: Check[];
  documents: Record<string, number>;
}

const API = `${INVOICE_API}/uae-einvoices/account`;

const CHECK_LABELS: Record<string, string> = {
  TRN: "TRN",
  "Trade licence": "Trade licence",
  "Address and emirate": "Address and emirate",
  "Bank account for payments": "Bank account for payments",
};

/**
 * UAE e-invoicing: the company's connection to its accredited service provider (ASP), which delivers PINT AE
 * invoices to buyers and reports them to the FTA, the company details e-invoices need, and documents by status.
 */
const UaeEInvoicing: React.FC = () => {
  const { access } = useContext(AuthContext);
  const admin = hasPermission(access, "INVOICE:ADMIN");
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await axios.get<AccountStatus>(API);
      setStatus(res.data);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load the UAE e-invoicing settings"));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const connect = async () => {
    setBusy(true);
    try {
      const res = await axios.post<AccountStatus>(API, {});
      setStatus(res.data);
      ToasterService.success(t("Connected to the service provider"));
    } catch (err) {
      ToasterService.error(apiError(err, "Could not connect to the service provider"));
    } finally {
      setBusy(false);
    }
  };

  const card = "rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-[#191919]";
  const ready = status?.checks.every((c) => c.ok) ?? false;

  return (
    <>
      <PageMeta title={t("UAE e-invoicing")} description="UAE e-invoicing through an accredited service provider" />
      <PageBreadcrumb pageTitle="UAE e-invoicing" />

      <div className="w-full max-w-none space-y-4 py-4">
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-gray-800 dark:bg-[#191919] dark:text-gray-300">
          {t("For VAT-registered companies in the UAE, invoices and credit notes to VAT-registered businesses and to buyers abroad become PINT AE e-invoices when issued. The service provider delivers them to the buyer's provider and reports them to the FTA.")}
        </p>

        <section className={card}>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-gray-100">
            <ShieldCheckIcon className="h-5 w-5 text-cyan-600" /> {t("Service provider")}
          </div>
          {!status ? (
            <p className="text-sm text-slate-500">{t("Loading…")}</p>
          ) : (
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">{t("Connection")}</dt>
                <dd className={`font-medium ${status.connected ? "text-emerald-700" : "text-amber-700"}`}>
                  {t(status.connected ? "Connected" : "Not connected: e-invoices wait until the company is connected")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("Provider")}</dt>
                <dd className="font-medium text-slate-800 dark:text-gray-100">
                  {status.mode === "mock" ? t("Mock (local, nothing is sent outside)") : status.provider}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("Peppol participant ID")}</dt>
                <dd className="text-slate-700 dark:text-gray-300">{status.participantId ?? t("Needs the company's TRN")}</dd>
              </div>
              {status.connected && (
                <div>
                  <dt className="text-xs text-slate-500">{t("Connected on")}</dt>
                  <dd className="text-slate-700 dark:text-gray-300">
                    {status.connectedAt ? dateLabel(status.connectedAt) : "—"} {status.accountRef ? `· ${status.accountRef}` : ""}
                  </dd>
                </div>
              )}
            </dl>
          )}
          {admin && status && (
            <button type="button" onClick={connect} disabled={busy || !status.participantId}
              className="mt-3 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
              {t(busy ? "Connecting…" : status.connected ? "Reconnect" : "Connect")}
            </button>
          )}
          {!admin && <p className="mt-3 text-xs text-slate-500">{t("Only a finance administrator can connect the service provider.")}</p>}
        </section>

        {status && (
          <section className={card}>
            <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-gray-100">{t("Company details for e-invoices")}</div>
            <ul className="space-y-1.5 text-sm">
              {status.checks.map((check) => (
                <li key={check.name} className="flex items-start gap-2">
                  {check.ok ? <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                    : <XCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />}
                  <span>
                    <span className="font-medium text-slate-800 dark:text-gray-100">{t(CHECK_LABELS[check.name] ?? check.name)}</span>
                    <span className="text-slate-500"> — {check.ok ? check.message : t(check.message)}</span>
                  </span>
                </li>
              ))}
            </ul>
            {!ready && (
              <p className="mt-2 text-xs text-slate-500">
                {t("Each invoice is also checked for the buyer's TRN and address, HS codes and the 5% rate; the invoice screen lists what to fix.")}
              </p>
            )}
          </section>
        )}

        {status && (
          <section className={card}>
            <div className="mb-2 text-sm font-semibold text-slate-800 dark:text-gray-100">{t("E-invoices")}</div>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
              {Object.keys(UAE_STATUS_LABELS).map((key) => (
                <div key={key} className="rounded-lg border border-slate-100 px-3 py-2 dark:border-gray-800">
                  <dt className="text-xs text-slate-500">{t(UAE_STATUS_LABELS[key])}</dt>
                  <dd className="text-lg font-semibold text-slate-800 dark:text-gray-100">{status.documents[key] ?? 0}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {status?.connected && <UaeReceived admin={admin} mock={status.mode === "mock"} />}
      </div>
    </>
  );
};

export default UaeEInvoicing;
