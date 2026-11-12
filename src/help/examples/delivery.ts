import type { HelpExample } from "../types";

// Examples for Delivery (topics/delivery.ts). Sample data: Gulf Electronics Trading LLC (tools/demo-data). One case:
// SO-2026-0117, 10 ThinkPads to Emirates IT Mart in Bur Dubai.
export const DELIVERY_EXAMPLES: Record<string, HelpExample> = {
  "delivery-orders": {
    story: "Logistics plans the delivery of Emirates IT Mart's 10 laptops.",
    data: [
      { label: "Delivery order", value: "DO-2026-0076 (SO-2026-0117)" },
      { label: "Deliver to", value: "Shop 14, Computer Plaza, Al Ain Centre, Bur Dubai" },
      { label: "Date", value: "15 Nov 2026, morning" },
      { label: "Vehicle", value: "Van D-48213 · driver Suresh Pillai" },
    ],
    result: "The delivery shows on the day's schedule and in the driver's app.",
  },
  "goods-issue": {
    story: "A replacement mouse is sent to a customer without a sales order.",
    data: [
      { label: "Goods issue", value: "GI-2026-0014" },
      { label: "Item", value: "1 × Logitech MX Master 3S Mouse" },
      { label: "Reason", value: "Warranty replacement · Smart Office Solutions" },
      { label: "From", value: "Deira Showroom Store" },
    ],
    result: "Posting it takes the mouse out of stock with a clear reason.",
  },
  "delivery-notes": {
    story: "The driver takes a delivery note (challan) for the customer to sign.",
    data: [
      { label: "Delivery note", value: "DN-2026-0081 (DO-2026-0076)" },
      { label: "Items", value: "10 × Lenovo ThinkPad E14 i5/16GB · 2 cartons" },
      { label: "Received by", value: "Imran Siddiqui, store manager" },
      { label: "Received", value: "10 of 10" },
    ],
    result: "The signed note confirms delivery and the order can be invoiced.",
  },
  "delivery-shipments": {
    story: "An order for Abu Dhabi goes by courier instead of the company van.",
    data: [
      { label: "Shipment", value: "SH-2026-0021" },
      { label: "Courier", value: "Aramex · AWB 4418820931" },
      { label: "To", value: "Bluewave Telecom LLC, Abu Dhabi" },
      { label: "Status", value: "Picked up → In transit → Delivered" },
    ],
    result: "Anyone can see where the parcel is without calling the courier.",
  },
  "delivery-status": {
    story: "The sales team checks what is on the road this afternoon.",
    data: [
      { label: "DO-2026-0076", value: "Delivered 11:20" },
      { label: "DO-2026-0078", value: "Out for delivery · van D-48213" },
      { label: "SH-2026-0021", value: "In transit (Aramex)" },
    ],
    result: "Rahul tells Bluewave their parcel arrives tomorrow.",
  },
  "live-tracking": {
    story: "Logistics follows van D-48213 on the map during the morning run.",
    data: [
      { label: "Vehicle", value: "D-48213 · Suresh Pillai" },
      { label: "Trip started", value: "08:05 from Jebel Ali" },
      { label: "Now", value: "Sheikh Zayed Road, near Al Barsha · 62 km/h" },
      { label: "Stops", value: "1 of 3 done" },
    ],
    result: "The dispatcher can tell the next customer the van is 20 minutes away.",
  },
  "driver-mode": {
    story: "Suresh runs the day's deliveries from his phone.",
    data: [
      { label: "Today", value: "3 stops" },
      { label: "Stop 1", value: "Emirates IT Mart · DN-2026-0081 · delivered, signature taken" },
      { label: "Trip", value: "Started 08:05 · ended 13:40 · 74 km" },
    ],
    result: "Each delivery is confirmed live; the trip and route are saved.",
  },
  "delivery-schedule": {
    story: "Logistics plans Saturday's runs.",
    data: [
      { label: "Date", value: "15 Nov 2026" },
      { label: "Run 1", value: "Bur Dubai route · van D-48213 · 3 drops" },
      { label: "Run 2", value: "Sharjah route · van D-51907 · 2 drops" },
    ],
    result: "Drivers see their runs; closing a run marks its drops done.",
  },
  "delivery-routes": {
    story: "Regular drop areas are set up as routes.",
    data: [
      { label: "Route", value: "Bur Dubai" },
      { label: "Areas", value: "Al Ain Centre, Karama, Mankhool" },
      { label: "Usual vehicle", value: "D-48213" },
    ],
    result: "Deliveries to these areas can be grouped on one run.",
  },
  "customer-addresses": {
    story: "Smart Office Solutions has a head office and a warehouse to deliver to.",
    data: [
      { label: "Customer", value: "Smart Office Solutions FZE" },
      { label: "Billing", value: "Office 805, Building 3, Dubai Internet City" },
      { label: "Delivery (default)", value: "Warehouse 12, Al Quoz Industrial Area 3" },
    ],
    result: "Delivery orders for them fill in the Al Quoz warehouse automatically.",
  },
  "delivery-vehicles": {
    story: "The company adds its new delivery van.",
    data: [
      { label: "Plate", value: "D-51907" },
      { label: "Type", value: "Toyota Hiace van" },
      { label: "Capacity", value: "1,200 kg" },
      { label: "Registration expires", value: "30 Sep 2027" },
    ],
    result: "The van can be assigned to delivery runs and tracked live.",
  },
  "delivery-transporters": {
    story: "Logistics records the courier used for out-of-town parcels.",
    data: [
      { label: "Transporter", value: "Aramex Emirates" },
      { label: "Account", value: "GE-77120" },
      { label: "Phone", value: "600 544 000" },
    ],
    result: "Aramex can be chosen on shipments with its tracking number.",
  },
};
