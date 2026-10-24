import React, { useEffect, useState } from "react";
import axios from "axios";
import PaginatedPopup from "../../components/common/unpopup";
import { FloatingInput, FloatingSelect1 } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";
import { INVOICE_API, apiError, dateLabel, money, todayInput } from "./invoiceShared";
import { DialogFooter } from "./invoiceUi";

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
  vendors: { id: number; name: string }[];
  onClose: () => void;
  onCreated: () => void;
}> = ({ isOpen, vendors, onClose, onCreated }) => {
  const [grns, setGrns] = useState<GrnSummary[]>([]);
  const [grnId, setGrnId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ vendorId: "", invoiceNumber: "", invoiceDate: todayInput(), dueDate: "", vendorInvoiceAmount: "", notes: "" });

  useEffect(() => {
    if (!isOpen) return;
    setGrnId("");
    setPreview(null);
    setForm({ vendorId: "", invoiceNumber: "", invoiceDate: todayInput(), dueDate: "", vendorInvoiceAmount: "", notes: "" });
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
        vendorId: res.data.suggestedVendorId ? String(res.data.suggestedVendorId) : current.vendorId,
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
    if (!form.vendorId) return ToasterService.error("Choose the vendor");
    if (!form.invoiceNumber.trim()) return ToasterService.error("Enter the vendor's invoice number");
    setBusy(true);
    try {
      await axios.post(`${API_URL}/from-grn`, {
        grnId: Number(grnId),
        vendorId: Number(form.vendorId),
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
      title="Bill from goods receipt"
      subtitle="The amount comes from what was accepted, at the purchase order prices"
      onClose={onClose}
      maxWidthClassName="max-w-3xl"
      content={
        <form onSubmit={submit} className="flex flex-col">
          <div className="space-y-4 px-4 py-4 sm:px-5">
            <FloatingSelect1
              label="Goods receipt"
              name="grnId"
              value={grnId}
              onChange={(event) => chooseGrn(event.target.value)}
              options={grns.map((grn) => ({
                id: String(grn.id),
                name: `${grn.receiptNumber} · ${grn.vendorName ?? "—"} · ${grn.poNumber ?? ""} · ${dateLabel(grn.receiptDate)}`,
              }))}
              required
            />
            {grns.length === 0 && <p className="text-xs text-slate-500">Every accepted goods receipt already has a bill.</p>}
            {loading && <p className="text-sm text-slate-500">Loading…</p>}

            {source && (
              <>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-right">Accepted</th>
                        <th className="px-3 py-2 text-right">Returned</th>
                        <th className="px-3 py-2 text-right">Billed</th>
                        <th className="px-3 py-2 text-right">Price</th>
                        <th className="px-3 py-2 text-right">Tax</th>
                        <th className="px-3 py-2 text-right">Total</th>
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
                          Subtotal {money(source.subtotal, source.currency)} · Discount {money(source.discountAmount, source.currency)} · Tax {money(source.taxAmount, source.currency)}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">{money(source.totalAmount, source.currency)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {source.nettedReturnNumbers && source.nettedReturnNumbers.length > 0 && (
                  <p className="text-xs text-amber-700">
                    Goods returned on {source.nettedReturnNumbers.join(", ")} are left out of this bill, so their debit notes are not applied again.
                  </p>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <FloatingSelect1
                    label="Vendor (finance)"
                    name="vendorId"
                    value={form.vendorId}
                    onChange={set("vendorId")}
                    options={vendors.map((vendor) => ({ id: String(vendor.id), name: vendor.name }))}
                    required
                  />
                  <FloatingInput label="Vendor's invoice number" name="invoiceNumber" value={form.invoiceNumber} onChange={set("invoiceNumber")} required />
                  <FloatingInput label="Invoice date" name="invoiceDate" type="date" value={form.invoiceDate} onChange={set("invoiceDate")} />
                  <FloatingInput label={`Due date${source.paymentTerms ? ` (${source.paymentTerms})` : ""}`} name="dueDate" type="date" value={form.dueDate} onChange={set("dueDate")} />
                  <FloatingInput label="Vendor's invoice total (to check)" name="vendorInvoiceAmount" type="number" value={form.vendorInvoiceAmount} onChange={set("vendorInvoiceAmount")} />
                  <FloatingInput label="Notes" name="notes" value={form.notes} onChange={set("notes")} />
                </div>
                {!form.vendorId && source.vendorName && (
                  <p className="text-xs text-amber-700">
                    {source.vendorName} was not found in the finance vendor list. Choose the vendor, or add it under Common → Invoice Vendors.
                  </p>
                )}
              </>
            )}
          </div>
          <DialogFooter onCancel={onClose} submitLabel="Record bill" busy={busy} disabled={!source} />
        </form>
      }
    />
  );
};

export default BillFromGrnDialog;
