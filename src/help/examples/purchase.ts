import type { HelpExample } from "../types";

// Examples for Purchase (topics/purchase.ts). Sample data: Gulf Electronics Trading LLC (tools/demo-data). One case
// runs through several pages: 50 Galaxy A55 phones from Samsung Gulf, AED 52,500 + 5% VAT = AED 55,125.
export const PURCHASE_EXAMPLES: Record<string, HelpExample> = {
  "purchase-requisitions": {
    story: "The warehouse is running low on Galaxy A55 phones; Aisha Rahman asks for more.",
    data: [
      { label: "Requisition", value: "PR-2026-0031" },
      { label: "Item", value: "50 × Samsung Galaxy A55 128GB" },
      { label: "Needed by", value: "25 Nov 2026" },
      { label: "Status", value: "Submitted → Approved" },
    ],
    result: "Once the purchase manager approves, the requisition can be turned into a purchase order.",
  },
  "purchase-rfqs": {
    story: "Purchase asks two distributors for prices on the phones.",
    data: [
      { label: "RFQ", value: "RFQ-2026-0012 · 50 × Galaxy A55" },
      { label: "Samsung Gulf Electronics FZE", value: "AED 1,050 each · 5 days" },
      { label: "Redington Gulf FZE", value: "AED 1,072 each · 3 days" },
      { label: "Awarded to", value: "Samsung Gulf Electronics FZE" },
    ],
    result: "Awarding makes a purchase order to Samsung Gulf at AED 1,050.",
  },
  "purchase-orders": {
    story: "The order goes to Samsung Gulf after approval.",
    data: [
      { label: "PO", value: "PO-2026-0088" },
      { label: "Vendor", value: "Samsung Gulf Electronics FZE" },
      { label: "Line", value: "50 × Galaxy A55 @ AED 1,050" },
      { label: "Subtotal", value: "AED 52,500" },
      { label: "VAT 5%", value: "AED 2,625" },
      { label: "Total", value: "AED 55,125" },
    ],
    result: "Over the approval limit, so the manager approves it; then it is emailed to Samsung as a PDF.",
  },
  "purchase-reorder": {
    story: "The reorder list shows what has dropped below its reorder level.",
    data: [
      { label: "Anker 65W USB-C Charger", value: "12 on hand · reorder at 40 · suggest 60" },
      { label: "Samsung Galaxy A55 128GB", value: "8 on hand · reorder at 25 · suggest 50" },
    ],
    result: "Ticking both and clicking Order makes one purchase order per vendor.",
  },
  "purchase-shipments": {
    story: "A container of HP laptops is coming by sea from Singapore.",
    data: [
      { label: "Shipment", value: "IS-2026-0004 · PO-2026-0091" },
      { label: "Vendor", value: "Redington Gulf FZE" },
      { label: "Bill of lading", value: "MSCU7781204" },
      { label: "ETA Jebel Ali", value: "28 Nov 2026" },
      { label: "Status", value: "In transit" },
    ],
    result: "When it arrives and clears customs, the goods are received into Jebel Ali Main Warehouse.",
  },
  "purchase-customs": {
    story: "The shipment of 40 HP ProBooks is declared at Dubai Customs.",
    data: [
      { label: "Declaration", value: "DXB-IM-2026-445120" },
      { label: "Customs value", value: "AED 139,200" },
      { label: "Duty 5%", value: "AED 6,960" },
      { label: "Import VAT 5%", value: "AED 7,308" },
    ],
    result: "Posting it records the duty as a landed cost and the import VAT as recoverable.",
  },
  "goods-receipt-notes": {
    story: "Samsung delivers 48 of the 50 phones; Aisha receives them.",
    data: [
      { label: "GRN", value: "GRN-2026-0102 (PO-2026-0088)" },
      { label: "Ordered", value: "50 × Galaxy A55" },
      { label: "Received", value: "48" },
      { label: "Warehouse", value: "Jebel Ali Main Warehouse" },
    ],
    result: "48 phones go into stock at once; the PO stays open for the last 2.",
  },
  "purchase-returns": {
    story: "Two of the phones arrive with cracked screens.",
    data: [
      { label: "Return", value: "PRT-2026-0005 (GRN-2026-0102)" },
      { label: "Item", value: "2 × Galaxy A55" },
      { label: "Reason", value: "Damaged in transit" },
      { label: "Debit note", value: "AED 2,205 (2,100 + VAT 105)" },
    ],
    result: "The phones leave stock and the debit note reduces what is owed to Samsung.",
  },
  "purchase-landed-costs": {
    story: "Freight and duty are added to the cost of the 40 laptops.",
    data: [
      { label: "Receipt", value: "GRN-2026-0107 · 40 × HP ProBook 450 G10" },
      { label: "Freight", value: "AED 4,800" },
      { label: "Customs duty", value: "AED 6,960" },
      { label: "Cost per laptop", value: "AED 3,480 → 3,774" },
    ],
    result: "Gross margin now uses AED 3,774 per laptop, the true cost.",
  },
  "purchase-approval-limits": {
    story: "Finance sets who must approve larger orders.",
    data: [
      { label: "Up to AED 20,000", value: "Purchase Executive (no approval)" },
      { label: "Above AED 20,000", value: "Purchase Manager" },
      { label: "Above AED 100,000", value: "Finance Manager as well" },
    ],
    result: "PO-2026-0088 for AED 55,125 waits for the Purchase Manager.",
  },
};
