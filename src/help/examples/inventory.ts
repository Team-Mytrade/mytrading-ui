import type { HelpExample } from "../types";

// Examples for Inventory (topics/inventory.ts). Sample data: Gulf Electronics Trading LLC (tools/demo-data).
export const INVENTORY_EXAMPLES: Record<string, HelpExample> = {
  "stock-on-hand": {
    story: "Before promising 10 ThinkPads to Emirates IT Mart, Rahul checks stock.",
    data: [
      { label: "Product", value: "Lenovo ThinkPad E14 i5/16GB" },
      { label: "Jebel Ali Main Warehouse", value: "34 on hand · 10 reserved · 24 available" },
      { label: "Deira Showroom Store", value: "3 on hand · 3 available" },
      { label: "Reorder level", value: "15" },
    ],
    result: "27 are free across both warehouses, so the order can be met.",
  },
  "stock-levels": {
    story: "On go-live, the warehouse enters the opening stock counted on 31 October.",
    data: [
      { label: "Warehouse", value: "Jebel Ali Main Warehouse" },
      { label: "Samsung Galaxy A55 128GB", value: "60 @ AED 1,050" },
      { label: "Dell 27\" Monitor P2723D", value: "22 @ AED 980" },
      { label: "Logitech MX Master 3S Mouse", value: "85 @ AED 260" },
    ],
    result: "Stock on Hand shows these quantities and the stock value is AED 106,660.",
  },
  "inventory-reservations": {
    story: "A customer asks to hold 5 monitors until their payment clears.",
    data: [
      { label: "Product", value: "5 × Dell 27\" Monitor P2723D" },
      { label: "For", value: "Creek Side Computers" },
      { label: "Warehouse", value: "Deira Showroom Store" },
      { label: "Hold until", value: "20 Nov 2026" },
    ],
    result: "The 5 monitors can't be sold to anyone else until used or freed.",
  },
  "stock-movements": {
    story: "The showroom is short of iPads, so 10 are moved from Jebel Ali.",
    data: [
      { label: "Movement", value: "Transfer · SM-2026-0233" },
      { label: "Product", value: "10 × Apple iPad 10th Gen 64GB" },
      { label: "From", value: "Jebel Ali Main Warehouse (JAFZ)" },
      { label: "To", value: "Deira Showroom Store (DEIRA)" },
    ],
    result: "Jebel Ali drops by 10 and Deira rises by 10; the total stock is unchanged.",
  },
  "stock-adjustments": {
    story: "The month-end count finds 2 chargers fewer than the system says.",
    data: [
      { label: "Product", value: "Anker 65W USB-C Charger" },
      { label: "System", value: "14" },
      { label: "Counted", value: "12" },
      { label: "Adjustment", value: "−2 · reason: Damaged / missing" },
      { label: "Value", value: "AED −190" },
    ],
    result: "Stock becomes 12 and AED 190 is written off; the adjustment can't be edited afterwards.",
  },
  "bins-putaway": {
    story: "Received laptops are put on a shelf so pickers can find them.",
    data: [
      { label: "Bin", value: "JAFZ-A-03-02 (aisle A, rack 3, level 2)" },
      { label: "Put away", value: "40 × HP ProBook 450 G10" },
    ],
    result: "Pick lists for HP ProBook orders now point pickers to JAFZ-A-03-02.",
  },
  "pick-pack": {
    story: "The warehouse prepares Emirates IT Mart's order.",
    data: [
      { label: "Order", value: "SO-2026-0117" },
      { label: "Pick", value: "10 × ThinkPad E14 from JAFZ-A-02-01" },
      { label: "Pack", value: "2 cartons · 18.4 kg" },
      { label: "Packed by", value: "Joseph D'Souza" },
    ],
    result: "The order shows as packed and ready for the delivery run.",
  },
  consignment: {
    story: "Speakers are left at Al Noor's shop and paid for only when sold.",
    data: [
      { label: "Customer", value: "Al Noor Electronics Retail" },
      { label: "Sent", value: "20 × JBL Flip 6 Speaker" },
      { label: "Sold so far", value: "7" },
      { label: "Still ours at their shop", value: "13" },
    ],
    result: "The 7 sold are invoiced; the 13 remain company stock, held at the customer.",
  },
  "quality-inspection": {
    story: "Incoming monitors are checked before they go on sale.",
    data: [
      { label: "Receipt", value: "GRN-2026-0110 · 30 × Dell 27\" Monitor" },
      { label: "Passed", value: "29" },
      { label: "Failed", value: "1 (dead pixels)" },
    ],
    result: "29 become available to sell; the failed one is set aside for return to the vendor.",
  },
  batches: {
    story: "Chargers are tracked by production batch in case of a recall.",
    data: [
      { label: "Product", value: "Anker 65W USB-C Charger" },
      { label: "Batch", value: "ANK-2611-B" },
      { label: "Made", value: "Oct 2026" },
      { label: "Quantity", value: "60" },
    ],
    result: "If Anker recalls batch ANK-2611-B, you can see who bought every unit.",
  },
  "serial-numbers": {
    story: "A customer calls about a laptop's warranty; sales looks up its serial.",
    data: [
      { label: "Serial", value: "PF4X7K2Q" },
      { label: "Product", value: "Lenovo ThinkPad E14 i5/16GB" },
      { label: "Sold to", value: "Emirates IT Mart · INV-2026-00318 · 14 Nov 2026" },
    ],
    result: "The warranty runs from 14 Nov 2026.",
  },
  warehouses: {
    story: "The company runs one main store and a showroom.",
    data: [
      { label: "Main", value: "Jebel Ali Main Warehouse · JAFZ" },
      { label: "Showroom", value: "Deira Showroom Store · DEIRA" },
    ],
    result: "Every receipt, sale and transfer says which of the two the stock is in.",
  },
};
