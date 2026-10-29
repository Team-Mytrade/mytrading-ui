import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { ToasterService } from "../../Services/ToasterService";
import { INVOICE_API, apiError, dateLabel, money, saveBlob } from "./invoiceShared";
import { t } from "../../i18n/i18n";

interface Received {
  id: number;
  status: string;
  documentType?: string | null;
  documentNumber?: string | null;
  supplierName?: string | null;
  supplierTrn?: string | null;
  issueDate?: string | null;
  dueDate?: string | null;
  currency?: string | null;
  taxableAmount?: number | null;
  taxAmount?: number | null;
  totalAmount?: number | null;
  reverseCharge?: boolean | null;
  reverseChargeVat?: number | null;
  billingReference?: string | null;
  lines: string[];
  notes?: string | null;
  receivedAt?: string | null;
  purchaseInvoiceId?: number | null;
  vendorId?: number | null;
  vendorName?: string | null;
}

interface Vendor {
  id: number;
  name: string;
  gstNumber?: string | null;
  active?: boolean | null;
}

const API = `${INVOICE_API}/uae-einvoices/received`;

const RECEIVED_LABELS: Record<string, string> = {
  RECEIVED: "To review",
  BILL_CREATED: "Bill created",
  DUPLICATE: "Duplicate",
  UNREADABLE: "Unreadable",
  SET_ASIDE: "Set aside",
};

const RECEIVED_TONE: Record<string, string> = {
  RECEIVED: "bg-amber-50 text-amber-700",
  BILL_CREATED: "bg-emerald-50 text-emerald-700",
  DUPLICATE: "bg-slate-100 text-slate-600",
  UNREADABLE: "bg-rose-50 text-rose-700",
  SET_ASIDE: "bg-slate-100 text-slate-600",
};

/**
 * Suppliers' e-invoices received through the UAE service provider: each one is reviewed and made into a bill for
 * the vendor with the same TRN (or the vendor chosen), or set aside.
 */
const UaeReceived: React.FC<{ admin: boolean; mock: boolean }> = ({ admin, mock }) => {
  const [rows, setRows] = useState<Received[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await axios.get<Received[]>(API);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load the received e-invoices"));
    }
  };

  useEffect(() => {
    load();
    axios.get<Vendor[]>("/v1/api/common/vendors")
      .then((res) => setVendors((Array.isArray(res.data) ? res.data : []).filter((v) => v.active !== false)))
      .catch(() => setVendors([]));
  }, []);

  const run = async (work: () => Promise<unknown>, done: string, failed: string) => {
    setBusy(true);
    try {
      await work();
      ToasterService.success(t(done));
      await load();
    } catch (err) {
      ToasterService.error(apiError(err, failed));
    } finally {
      setBusy(false);
    }
  };

  const fetchInbox = async () => {
    setBusy(true);
    try {
      const res = await axios.post<{ received: number }>(`${API}/fetch`);
      ToasterService.success(`${t("New e-invoices")}: ${res.data.received}`);
      await load();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not check the inbox"));
    } finally {
      setBusy(false);
    }
  };

  const vendorFor = (row: Received) => chosen[row.id] ?? (row.vendorId ? String(row.vendorId) : "");

  const download = async (row: Received) => {
    try {
      const file = await axios.get(`${API}/${row.id}/xml`, { responseType: "blob" });
      saveBlob(file.data, `${row.documentNumber || "e-invoice-" + row.id}.xml`);
    } catch (err) {
      ToasterService.error(apiError(err, "Could not download the XML"));
    }
  };

  const button = "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";
  const link = "text-xs font-medium text-cyan-700 hover:underline disabled:opacity-50";

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-gray-800 dark:bg-[#191919]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-800 dark:text-gray-100">{t("Received from suppliers")}</div>
        <div className="flex gap-2">
          {admin && mock && (
            <button type="button" className={button} disabled={busy}
              onClick={() => run(() => axios.post(`${API}/sample`), "A sample supplier invoice arrived", "Could not receive a sample")}>
              {t("Receive a sample invoice")}
            </button>
          )}
          <button type="button" className={button} disabled={busy} onClick={fetchInbox}>{t("Check inbox")}</button>
        </div>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        {t("Suppliers' e-invoices arrive here from the service provider (checked every 10 minutes). Review each one and make the bill: it books the payable and the input VAT.")}
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">{t("Nothing received yet.")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 text-start">{t("Supplier")}</th>
                <th className="px-3 py-2 text-start">{t("Document")}</th>
                <th className="px-3 py-2 text-start">{t("Date")}</th>
                <th className="px-3 py-2 text-end">{t("VAT")}</th>
                <th className="px-3 py-2 text-end">{t("Total")}</th>
                <th className="px-3 py-2 text-start">{t("Status")}</th>
                <th className="px-3 py-2 text-start">{t("Bill")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <React.Fragment key={row.id}>
                  <tr className="align-top">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-800 dark:text-gray-100">{row.supplierName || "—"}</div>
                      <div className="text-xs text-slate-500">{row.supplierTrn ? `TRN ${row.supplierTrn}` : ""}</div>
                    </td>
                    <td className="px-3 py-2">
                      <button type="button" className={link} onClick={() => setOpen(open === row.id ? null : row.id)}>
                        {row.documentNumber || t("(no number)")}
                      </button>
                      <div className="text-xs text-slate-500">
                        {t(row.documentType === "CREDIT_NOTE" ? "Credit note" : "Tax invoice")}
                        {row.billingReference ? ` · ${row.billingReference}` : ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{row.issueDate ? dateLabel(row.issueDate) : "—"}</td>
                    <td className="px-3 py-2 text-end">
                      {row.reverseCharge ? <span title={t("Reverse charge: you account for the VAT")}>{money(row.reverseChargeVat, row.currency)} RC</span>
                        : money(row.taxAmount, row.currency)}
                    </td>
                    <td className="px-3 py-2 text-end font-medium">{money(row.totalAmount, row.currency)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${RECEIVED_TONE[row.status] ?? ""}`}>
                        {t(RECEIVED_LABELS[row.status] ?? row.status)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {row.status === "BILL_CREATED" && row.purchaseInvoiceId ? (
                        <Link to="/purchaseInvoices" className={link}>{t("Open bills")}</Link>
                      ) : row.status === "RECEIVED" && row.documentType === "INVOICE" ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <select className="h-8 rounded-lg border border-slate-300 px-2 text-xs" value={vendorFor(row)}
                            onChange={(e) => setChosen((c) => ({ ...c, [row.id]: e.target.value }))}>
                            <option value="">{t("Choose the vendor")}</option>
                            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                          <button type="button" className={link} disabled={busy || !vendorFor(row)}
                            onClick={() => run(() => axios.post(`${API}/${row.id}/bill`, { vendorId: Number(vendorFor(row)) }),
                              "Bill created", "Could not create the bill")}>
                            {t("Create bill")}
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                  {open === row.id && (
                    <tr>
                      <td colSpan={7} className="bg-slate-50/60 px-3 py-2 text-xs text-slate-600">
                        {row.lines.length > 0 && (
                          <ul className="mb-1 list-disc ps-4">{row.lines.map((line, i) => <li key={i}>{line}</li>)}</ul>
                        )}
                        <div>
                          {t("Taxable")}: {money(row.taxableAmount, row.currency)} · {t("Due")}: {row.dueDate ? dateLabel(row.dueDate) : "—"}
                          {row.vendorName ? ` · ${t("Matches vendor")}: ${row.vendorName}` : row.status === "RECEIVED" ? ` · ${t("No vendor with this TRN")}` : ""}
                        </div>
                        {row.notes && <p className="mt-1 whitespace-pre-line text-amber-700">{row.notes}</p>}
                        {row.documentType === "CREDIT_NOTE" && row.status === "RECEIVED" && (
                          <p className="mt-1">{t("Record a supplier's credit note as a debit note against its bill, then set it aside here.")}</p>
                        )}
                        <div className="mt-2 flex gap-3">
                          <button type="button" className={link} onClick={() => download(row)}>{t("XML")}</button>
                          {row.status !== "BILL_CREATED" && row.status !== "SET_ASIDE" && (
                            <button type="button" className={link} disabled={busy}
                              onClick={() => run(() => axios.post(`${API}/${row.id}/set-aside`, {}), "Set aside", "Could not set it aside")}>
                              {t("Set aside")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default UaeReceived;
