import React, { useEffect, useState } from "react";
import axios from "axios";
import PaginatedPopup from "../../components/common/unpopup";
import { FloatingInput, FloatingSelect1 } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { INVOICE_API, apiError, dateLabel, money, todayInput } from "./invoiceShared";
import { DialogFooter } from "./invoiceUi";

import { t } from "../../i18n/i18n";
interface GrnSummary {
  id: number;
  receiptNumber: string;
  poNumber?: string;
  receiptDate?: string;
  vendorName?: string;
}

interface BillingLine {
  grnItemId: number;
  productCode?: string;
  productName?: string;
  unitOfMeasure?: string;
  acceptedQuantity: number;
  returnedQuantity: number;
  billableQuantity: number;
  unitPrice: number;
  discountAmount: number;
  taxAmount: number;
  lineTotal: number;
}

interface Preview {
  source: {
    grnId: number;
    grnNumber: string;
    poNumber?: string;
    currency?: string;
    paymentTerms?: string;
    vendorName?: string;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    nettedReturnNumbers?: string[];
    lines: BillingLine[];
  };
  suggestedVendorId?: number | null;
  suggestedDueDate?: string;
}

const API_URL = `${INVOICE_API}/purchase-invoices`;

/**
 * A vendor bill made from a goods receipt: the amount is what was accepted (less goods already returned for a
 * debit note) at the PO prices. Entering the vendor's own total checks it against that.
 */
const BillFromGrnDialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}> = ({ isOpen, onClose, onCreated }) => {
  const [grns, setGrns] = useState<GrnSummary[]>([]);
  const [grnId, setGrnId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ invoiceNumber: "", invoiceDate: todayInput(), dueDate: "", vendorInvoiceAmount: "", notes: "" });

  useEffect(() => {
    if (!isOpen) return;
    setGrnId("");
    setPreview(null);
    setForm({ invoiceNumber: "", invoiceDate: todayInput(), dueDate: "", vendorInvoiceAmount: "", notes: "" });
    axios
      .get<GrnSummary[]>(`${API_URL}/pending-grns`)
      .then((res) => setGrns(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        setGrns([]);
        ToasterService.error(apiError(err, "Could not load goods receipts waiting for a bill"));
      });
  }, [isOpen]);

  const chooseGrn = async (value: string) => {
    setGrnId(value);
    setPreview(null);
    if (!value) return;
    setLoading(true);
    try {
      const res = await axios.get<Preview>(`${API_URL}/grn-source/${value}`);
      setPreview(res.data);
      setForm((current) => ({
        ...current,
        dueDate: res.data.suggestedDueDate ?? current.dueDate,
      }));
    } catch (err) {
      ToasterService.error(apiError(err, "Could not load the goods receipt"));
    } finally {
      setLoading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!preview) return ToasterService.error("Choose the goods receipt being billed");
    if (!form.invoiceNumber.trim()) return ToasterService.error("Enter the vendor's invoice number");
    setBusy(true);
    try {
      await axios.post(`${API_URL}/from-grn`, {
        grnId: Number(grnId),
        invoiceNumber: form.invoiceNumber.trim(),
        invoiceDate: form.invoiceDate || null,
        dueDate: form.dueDate || null,
        vendorInvoiceAmount: form.vendorInvoiceAmount ? Number(form.vendorInvoiceAmount) : null,
        notes: form.notes.trim() || null,
      });
      ToasterService.success(`Bill ${form.invoiceNumber.trim()} recorded for ${preview.source.grnNumber}; it is now in Accounts Payable`);
      onCreated();
      onClose();
    } catch (err) {
      ToasterService.error(apiError(err, "Could not record the bill"));
    } finally {
      setBusy(false);
    }
  };

  const source = preview?.source;
  const set = (name: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((current) => ({ ...current, [name]: event.target.value }));

  return (
    <PaginatedPopup
      isOpen={isOpen}
      title={t("Bill from goods receipt")}
      subtitle={t("The amount comes from what was accepted, at the purchase order prices")}
      onClose={onClose}
      maxWidthClassName="max-w-3xl"
      content={
        <form onSubmit={submit} className="flex flex-col">
          <div className="space-y-4 px-4 py-4 sm:px-5">
            <FloatingSelect1
              label={t("Goods receipt")}
              name="grnId"
              value={grnId}
              onChange={(event) => chooseGrn(event.target.value)}
              options={grns.map((grn) => ({
                id: String(grn.id),
                name: `${grn.receiptNumber} · ${grn.vendorName ?? "—"} · ${grn.poNumber ?? ""} · ${dateLabel(grn.receiptDate)}`,
              }))}
              required
            />
            {grns.length === 0 && <p className="text-xs text-slate-500">{t("Every accepted goods receipt already has a bill.")}</p>}
            {loading && <p className="text-sm text-slate-500">{t("Loading…")}</p>}

            {source && (
              <>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">{t("Item")}</th>
                        <th className="px-3 py-2 text-right">{t("Accepted")}</th>
                        <th className="px-3 py-2 text-right">{t("Returned")}</th>
                        <th className="px-3 py-2 text-right">{t("Billed")}</th>
                        <th className="px-3 py-2 text-right">{t("Price")}</th>
                        <th className="px-3 py-2 text-right">{t("Tax")}</th>
                        <th className="px-3 py-2 text-right">{t("Total")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {source.lines.map((line) => (
                        <tr key={line.grnItemId}>
                          <td className="px-3 py-2">
                            <span className="font-medium text-slate-800">{line.productName}</span>
                            <span className="block text-xs text-slate-400">{line.productCode}</span>
                          </td>
                          <td className="px-3 py-2 text-right">{line.acceptedQuantity} {line.unitOfMeasure}</td>
                          <td className="px-3 py-2 text-right text-amber-700">{line.returnedQuantity || "—"}</td>
                          <td className="px-3 py-2 text-right font-medium">{line.billableQuantity}</td>
                          <td className="px-3 py-2 text-right">{money(line.unitPrice, source.currency)}</td>
                          <td className="px-3 py-2 text-right">{money(line.taxAmount, source.currency)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{money(line.lineTotal, source.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 text-sm">
                      <tr>
                        <td colSpan={6} className="px-3 py-2 text-right text-slate-500">
                          {t("Subtotal")} {money(source.subtotal, source.currency)} · Discount {money(source.discountAmount, source.currency)} · Tax {money(source.taxAmount, source.currency)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">{money(source.totalAmount, source.currency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {source.nettedReturnNumbers && source.nettedReturnNumbers.length > 0 && (
                  <p className="text-xs text-amber-700">
                    {t("Goods returned on")} {source.nettedReturnNumbers.join(", ")} are left out of this bill, so their debit notes are not applied again.
                  </p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  {/* Purchase and Finance share the vendor list, so the bill is from the PO's vendor */}
                  <FloatingInput label={t("Vendor (from the purchase order)")} name="vendorName" value={source.vendorName ?? ""} disabled readOnly />
                  <FloatingInput label={t("Vendor's invoice number")} name="invoiceNumber" value={form.invoiceNumber} onChange={set("invoiceNumber")} required />
                  <FloatingInput label={t("Invoice date")} name="invoiceDate" type="date" value={form.invoiceDate} onChange={set("invoiceDate")} />
                  <FloatingInput label={`Due date${source.paymentTerms ? ` (${source.paymentTerms})` : ""}`} name="dueDate" type="date" value={form.dueDate} onChange={set("dueDate")} />
                  <FloatingInput label={t("Vendor's invoice total (to check)")} name="vendorInvoiceAmount" type="number" value={form.vendorInvoiceAmount} onChange={set("vendorInvoiceAmount")} />
                  <FloatingInput label={t("Notes")} name="notes" value={form.notes} onChange={set("notes")} />
                </div>
              </>
            )}
          </div>
          <DialogFooter onCancel={onClose} submitLabel={t("Record bill")} busy={busy} disabled={!source} />
        </form>
      }
    />
  );
};

export default BillFromGrnDialog;
