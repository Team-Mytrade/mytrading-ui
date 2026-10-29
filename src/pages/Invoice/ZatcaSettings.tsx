import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { CheckCircleIcon, XCircleIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { FloatingInput, FloatingSelect1 } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { INVOICE_API, apiError, dateLabel } from "./invoiceShared";
import { t } from "../../i18n/i18n";

interface CredentialStatus {
  configured: boolean;
  secretSet: boolean;
  kind?: string | null;
  environment?: string | null;
  subject?: string | null;
  issuer?: string | null;
  serialNumber?: string | null;
  expiresAt?: string | null;
  apiMode?: string | null;
}

interface Step {
  name: string;
  ok: boolean;
  message: string;
}

interface OnboardingResult {
  onboarded: boolean;
  environment: string;
  steps: Step[];
}

const API = `${INVOICE_API}/zatca`;

const KIND_LABELS: Record<string, string> = {
  LOCAL_TEST: "Local test certificate (not valid for ZATCA)",
  COMPLIANCE: "Compliance certificate",
  PRODUCTION: "Production certificate from ZATCA",
};

const INVOICE_TYPE_OPTIONS = [
  { id: "1100", name: "Standard and simplified invoices" },
  { id: "1000", name: "Standard (B2B) invoices only" },
  { id: "0100", name: "Simplified (B2C) invoices only" },
];

/**
 * ZATCA (Saudi Arabia) e-invoicing: the company's signing certificate and onboarding with ZATCA. Invoices and credit
 * notes of Saudi VAT sellers are turned into signed e-invoice XML when issued; onboarding gets the certificate.
 */
const ZatcaSettings: React.FC = () => {
  const { access } = useContext(AuthContext);
  const admin = hasPermission(access, "INVOICE:ADMIN");
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<OnboardingResult | null>(null);
  const [form, setForm] = useState({ otp: "", unitName: "", branch: "", location: "", industry: "", invoiceTypes: "1100" });

  const load = async () => {
    try {
      const res = await axios.get<CredentialStatus>(`${API}/credentials`);
      setStatus(res.data);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load the ZATCA settings"));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createTest = async () => {
    setBusy(true);
    try {
      const res = await axios.post<CredentialStatus>(`${API}/credentials/local-test`);
      setStatus(res.data);
      ToasterService.success(t("Test certificate created"));
    } catch (err) {
      ToasterService.error(apiError(err, "Could not create the test certificate"));
    } finally {
      setBusy(false);
    }
  };

  const onboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const res = await axios.post<OnboardingResult>(`${API}/onboarding`, form);
      setResult(res.data);
      if (res.data.onboarded) {
        ToasterService.success(t("Onboarded with ZATCA"));
        setForm((f) => ({ ...f, otp: "" }));
      } else {
        ToasterService.error(t("Onboarding stopped"), t("See the steps below; run it again with a new OTP."));
      }
      load();
    } catch (err) {
      ToasterService.error(apiError(err, "Onboarding failed"));
    } finally {
      setBusy(false);
    }
  };

  const set = (name: keyof typeof form, value: string) => setForm((f) => ({ ...f, [name]: value }));
  const card = "rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-[#191919]";

  return (
    <>
      <PageMeta title={t("ZATCA e-invoicing")} description="ZATCA e-invoicing for Saudi Arabia" />
      <PageBreadcrumb pageTitle="ZATCA e-invoicing" />

      <div className="w-full max-w-none space-y-4 py-4">
        <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-gray-800 dark:bg-[#191919] dark:text-gray-300">
          {t("For VAT-registered companies in Saudi Arabia, every issued invoice and credit note becomes a ZATCA e-invoice (XML) with its place in the invoice chain. With a certificate it is also signed and gets the ZATCA QR code, which the invoice PDF prints.")}
        </p>

        <section className={card}>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-gray-100">
            <ShieldCheckIcon className="h-5 w-5 text-cyan-600" /> {t("Signing certificate")}
          </div>
          {!status ? (
            <p className="text-sm text-slate-500">{t("Loading…")}</p>
          ) : (
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-slate-500">{t("Certificate")}</dt>
                <dd className="font-medium text-slate-800 dark:text-gray-100">
                  {status.configured ? t(KIND_LABELS[status.kind ?? ""] ?? status.kind ?? "") : t("None yet: issued invoices are not signed")}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">{t("ZATCA connection")}</dt>
                <dd className="font-medium text-slate-800 dark:text-gray-100">
                  {status.apiMode === "mock" ? t("Mock (local, nothing is sent to ZATCA)") : status.apiMode}
                </dd>
              </div>
              {status.configured && (
                <>
                  <div>
                    <dt className="text-xs text-slate-500">{t("Issued to")}</dt>
                    <dd className="break-all text-slate-700 dark:text-gray-300">{status.subject}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">{t("Issued by")}</dt>
                    <dd className="break-all text-slate-700 dark:text-gray-300">{status.issuer}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">{t("Environment")}</dt>
                    <dd className="text-slate-700 dark:text-gray-300">{status.environment ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">{t("Expires")}</dt>
                    <dd className="text-slate-700 dark:text-gray-300">{status.expiresAt ? dateLabel(status.expiresAt) : "—"}</dd>
                  </div>
                </>
              )}
            </dl>
          )}
          {status && !status.secretSet && (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t("The zatca.secret setting is missing on the invoice service; certificates can't be stored until it is set.")}
            </p>
          )}
          {admin && status && status.kind !== "PRODUCTION" && (
            <button type="button" onClick={createTest} disabled={busy || !status.secretSet}
              className="mt-3 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              {t("Create a local test certificate")}
            </button>
          )}
        </section>

        {admin ? (
          <form onSubmit={onboard} className={`${card} space-y-3`}>
            <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">{t("Onboard with ZATCA")}</div>
            <p className="text-xs text-slate-500">
              {t("Get an OTP for a new e-invoicing unit in the Fatoora portal, then enter it here. The system makes a key and certificate request, gets the compliance certificate, passes ZATCA's sample checks and receives the production certificate.")}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <FloatingInput label={t("OTP from the Fatoora portal")} name="otp" value={form.otp} required
                onChange={(e) => set("otp", e.target.value.replace(/\D/g, "").slice(0, 6))} />
              <FloatingInput label={t("E-invoicing unit name")} name="unitName" value={form.unitName} onChange={(e) => set("unitName", e.target.value)} />
              <FloatingSelect1 label={t("Invoices issued")} name="invoiceTypes" value={form.invoiceTypes} options={INVOICE_TYPE_OPTIONS}
                includeEmptyOption={false} onChange={(e) => set("invoiceTypes", e.target.value)} />
              <FloatingInput label={t("Branch (organisation unit)")} name="branch" value={form.branch} onChange={(e) => set("branch", e.target.value)} />
              <FloatingInput label={t("Branch location")} name="location" value={form.location} onChange={(e) => set("location", e.target.value)} />
              <FloatingInput label={t("Industry")} name="industry" value={form.industry} onChange={(e) => set("industry", e.target.value)} />
            </div>
            <button type="submit" disabled={busy || form.otp.length !== 6}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-50">
              {t(busy ? "Onboarding…" : "Start onboarding")}
            </button>

            {result && (
              <ol className="space-y-1.5 border-t border-slate-100 pt-3 text-sm dark:border-gray-800">
                {result.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2">
                    {step.ok ? <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                      : <XCircleIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600" />}
                    <span>
                      <span className="font-medium text-slate-800 dark:text-gray-100">{t(step.name)}</span>
                      <span className="text-slate-500"> — {step.message}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </form>
        ) : (
          <p className="text-xs text-slate-500">{t("Only a finance administrator can manage the certificate and onboarding.")}</p>
        )}
      </div>
    </>
  );
};

export default ZatcaSettings;
