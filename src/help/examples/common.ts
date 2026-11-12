import type { HelpExample } from "../types";

// Examples for the Common module (topics/common.ts). Sample data: Gulf Electronics Trading LLC (tools/demo-data).
export const COMMON_EXAMPLES: Record<string, HelpExample> = {
  customers: {
    story: "Rahul Menon in sales adds a new retail customer that buys phones and laptops every month.",
    data: [
      { label: "Customer name", value: "Emirates IT Mart" },
      { label: "Customer type", value: "Retail" },
      { label: "TRN", value: "100392847500003" },
      { label: "Payment terms", value: "NET30 · 30 days" },
      { label: "Credit limit", value: "AED 60,000" },
      { label: "Billing address", value: "Shop 14, Computer Plaza, Al Ain Centre, Bur Dubai" },
    ],
    result: "Emirates IT Mart can now be picked on quotations, sales orders and invoices; orders over AED 60,000 outstanding go on credit hold.",
  },
  vendors: {
    story: "Purchase adds the distributor they buy Lenovo and HP laptops from.",
    data: [
      { label: "Vendor name", value: "Ingram Micro Gulf FZE" },
      { label: "TRN", value: "100211983400003" },
      { label: "Payment terms", value: "NET45" },
      { label: "Contact", value: "orders@ingram-gulf.test · +971 4 881 2200" },
    ],
    result: "Ingram Micro can be chosen on requisitions, RFQs, purchase orders and bills.",
  },
  "product-categories": {
    story: "The catalogue team groups products so reports and price lists can work by category.",
    data: [
      { label: "Code", value: "ACC" },
      { label: "Name", value: "Accessories" },
      { label: "Products in it", value: "MX Master 3S Mouse, Anker 65W Charger, JBL Flip 6" },
    ],
    result: "Sales Analysis can now show sales of Accessories as one line.",
  },
  products: {
    story: "The catalogue team adds a laptop model the company has started selling.",
    data: [
      { label: "Name", value: "Lenovo ThinkPad E14 i5/16GB" },
      { label: "Category", value: "Laptops & Computers (LAP)" },
      { label: "Unit", value: "PIECES" },
      { label: "Cost price", value: "AED 2,950" },
      { label: "Selling price", value: "AED 3,699" },
      { label: "Tax", value: "VAT5 · 5%" },
    ],
    result: "The ThinkPad appears on quotations at AED 3,699 + 5% VAT and can be received into stock.",
  },
  employees: {
    story: "HR adds a new warehouse executive who starts on 1 December.",
    data: [
      { label: "Name", value: "Joseph D'Souza" },
      { label: "Employee ID", value: "EMP-0059" },
      { label: "Department", value: "Warehouse" },
      { label: "Designation", value: "Inventory Executive" },
      { label: "Joining date", value: "01 Dec 2026" },
      { label: "Work email", value: "inventory.user6@gulf-electronics.test" },
    ],
    result: "Joseph can be given a login, a salary structure and a shift; he shows in Headcount from December.",
  },
  departments: {
    story: "The company opens a separate team for after-sales service.",
    data: [
      { label: "Department", value: "After-Sales Service" },
      { label: "Head", value: "Khalid Rahman" },
      { label: "Employees", value: "4" },
    ],
    result: "Payroll and attendance reports now show After-Sales Service as its own line.",
  },
  "payment-terms": {
    story: "Finance adds the terms agreed with large corporate customers.",
    data: [
      { label: "Code", value: "NET60" },
      { label: "Days", value: "60" },
      { label: "Used by", value: "Smart Office Solutions FZE" },
    ],
    result: "An invoice dated 1 Nov 2026 for Smart Office Solutions falls due on 31 Dec 2026.",
  },
  "tax-types": {
    story: "Finance sets up the UAE VAT rates the company charges.",
    data: [
      { label: "Code", value: "VAT5" },
      { label: "Rate", value: "5%" },
      { label: "Also", value: "VAT0 · 0% (exports), EXEMPT" },
    ],
    result: "Products carry VAT5; invoices to customers outside the UAE can use VAT0.",
  },
  "tax-details": {
    story: "Finance records which account VAT is posted to and how it shows on the return.",
    data: [
      { label: "Tax type", value: "VAT5" },
      { label: "Output VAT account", value: "2300 · VAT Payable" },
      { label: "Input VAT account", value: "1400 · VAT Recoverable" },
      { label: "Return box", value: "Box 1a – Standard rated supplies, Dubai" },
    ],
    result: "Each invoice's 5% VAT lands in 2300 and appears in box 1a of the VAT Return.",
  },
};
