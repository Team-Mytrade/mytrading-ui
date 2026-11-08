import type { HelpRole, HelpTopic } from "../types";

const INVENTORY_WHO: HelpRole[] = [
  { role: "Inventory Manager", can: "Everything on the page, including delete and export." },
  { role: "Inventory Executive", can: "Record and update stock work; not delete or export." },
];

// Inventory: what is in stock, where, and every change to it (menu: Inventory).
export const INVENTORY_TOPICS: HelpTopic[] = [
  {
    id: "stock-on-hand",
    route: "/inventory",
    module: "Inventory",
    title: "Stock on Hand",
    summary: "Stock on hand per product and warehouse: what is on hand, reserved and free, and what is low or out. Stock changes only through receipts, movements, adjustments and sales.",
    who: INVENTORY_WHO,
    tasks: [
      { title: "See what is low", steps: ["Click Low Stock, or the Low / Out of Stock card."] },
      { title: "Set a reorder level", steps: ["Click Set reorder level on the row.", "Enter the level (empty = no alert) and save. Below it the product shows as low, and Reorder Suggestions use it."] },
      { title: "Check if an order can be met", steps: ["Click Check Availability.", "Choose the product and warehouse and enter the required quantity: it says whether enough free stock is there."] },
      { title: "See one product everywhere", steps: ["Click Product Summary and select the product: its stock in every warehouse."] },
      { title: "See what changed", steps: ["Click View stock movements on a row."] },
    ],
    fields: [
      { name: "On Hand", meaning: "Physically in the warehouse." },
      { name: "Reserved", meaning: "Held for confirmed sales orders; can't be sold to anyone else." },
      { name: "Available", meaning: "On hand minus reserved." },
    ],
    rules: ["Receive Stock takes you to Stock Movements: stock is never typed in directly here."],
    related: [
      { route: "/stock-movement", label: "Stock Movements" },
      { route: "/purchase-service/reorder", label: "Reorder Suggestions" },
    ],
  },
  {
    id: "stock-levels",
    route: "/stock-level",
    module: "Inventory",
    title: "Stock Levels & Reorder",
    summary: "The stock record of each product in each warehouse: total, available and reserved, with the stock's cost. Add opening stock here.",
    who: INVENTORY_WHO,
    tasks: [
      {
        title: "Add opening stock",
        steps: ["Click Add Stock.", "Choose the product and warehouse, Operation Type Add Stock, the quantity and the unit cost.", "Save."],
      },
      { title: "Correct a stock level", steps: ["Click Adjust Stock on the row and choose the operation: Add Stock, Remove Stock, Reserve, Release or Complete Sale.", "Enter the quantity and save."] },
    ],
    fields: [{ name: "Unit cost", meaning: "What one unit cost, for opening stock; the stock's value comes from it." }],
    rules: ["Prefer Stock Adjustments for counted differences: they keep a reason for each change."],
    related: [
      { route: "/inventory", label: "Stock on Hand" },
      { route: "/stock-adjustment", label: "Stock Adjustments" },
    ],
  },
  {
    id: "inventory-reservations",
    route: "/inventory-reservation",
    module: "Inventory",
    title: "Reservations",
    summary: "Stock held for customer orders. Confirming a sales order reserves its stock; dispatching uses it up, and cancelling releases it.",
    who: INVENTORY_WHO,
    tasks: [
      { title: "Reserve stock by hand", steps: ["Click Add Reservation.", "Select the sales order, warehouse and product and enter the reserved quantity.", "Save."] },
      { title: "Free the stock", steps: ["Click Release: the stock is available again."] },
      { title: "Use the stock", steps: ["Click Consume when the goods leave."] },
    ],
    statuses: [
      { name: "Reserved", meaning: "Held for the order." },
      { name: "Partially consumed", meaning: "Part of it left with a dispatch; the rest is still held." },
      { name: "Consumed", meaning: "The goods left with the order." },
      { name: "Released", meaning: "Given back to available stock." },
      { name: "Cancelled", meaning: "No longer held." },
    ],
    rules: ["Reservations from Sales Orders are made and released by the order itself; you rarely need to add one here."],
    related: [
      { route: "/sales-orders", label: "Sales Orders" },
      { route: "/inventory", label: "Stock on Hand" },
    ],
    flows: ["order-to-cash"],
  },
  {
    id: "stock-movements",
    route: "/stock-movement",
    module: "Inventory",
    title: "Stock Movements",
    summary: "Every receipt, issue and transfer of stock, and the place to receive stock or move it between warehouses.",
    who: INVENTORY_WHO,
    tasks: [
      { title: "Receive stock", steps: ["Click Add Stock Movement.", "Choose an incoming movement type (such as a receipt or customer return), the product, the warehouse and the quantity (with batch or serial if tracked).", "Save."] },
      { title: "Move stock between warehouses", steps: ["Click Add Stock Movement and choose a transfer.", "Choose From Warehouse and To Warehouse (not the same one), the product and quantity.", "Save."] },
      { title: "Look up a movement", steps: ["Click View Details on a row: date, type, reference, locations, batch and serial."] },
    ],
    rules: [
      "Only products in stock are shown for issues and transfers: receive a product first to move it.",
      "Movements can't be deleted: correct a mistake with another movement or an adjustment.",
      "Goods receipts, dispatches and returns make their movements on their own.",
    ],
    related: [
      { route: "/stock-adjustment", label: "Stock Adjustments" },
      { route: "/inventory", label: "Stock on Hand" },
    ],
  },
  {
    id: "stock-adjustments",
    route: "/stock-adjustment",
    module: "Inventory",
    title: "Stock Adjustments",
    summary: "Corrections to stock with a reason: count differences, damage, loss, found goods. Each adjustment is kept as a record.",
    who: INVENTORY_WHO,
    tasks: [
      {
        title: "Adjust stock",
        steps: [
          "Click Add Adjustment.",
          "Choose the date, the adjustment type (in or out), the product, warehouse and quantity.",
          "Pick the reason, and the batch or a serial number (quantity 1) if the product is tracked.",
          "Save.",
        ],
      },
    ],
    fields: [{ name: "Net Change", meaning: "Stock in minus stock out across the adjustments shown." }],
    rules: ["Adjustments can't be changed or deleted afterwards: make another adjustment to correct one."],
    related: [
      { route: "/stock-movement", label: "Stock Movements" },
      { route: "/quality-inspection", label: "Quality Inspection" },
    ],
  },
  {
    id: "bins-putaway",
    route: "/bins",
    module: "Inventory",
    title: "Bins & Putaway",
    summary: "Shelves and bins inside a warehouse: what each holds, putting received stock away, and moving it between bins.",
    who: INVENTORY_WHO,
    tasks: [
      { title: "Add bins", steps: ["Choose the warehouse and open the Bins tab.", "Add a bin with its code (e.g. A-01-03), zone, type, capacity (or no limit) and pick order."] },
      { title: "Put stock away", steps: ["On the Putaway tab, under Waiting to be put away, choose the product, quantity and the bin it goes to, and move it."] },
      { title: "Move stock between bins", steps: ["Click Move stock, choose the bin it goes to and the quantity."] },
    ],
    rules: [
      "Received stock is unassigned until it is put into a bin; goods leaving come out of unassigned first.",
      "Picking goes through bins in pick order, lowest first; quarantine bins are never suggested.",
      "An inactive warehouse's stock can be seen but not moved.",
    ],
    related: [
      { route: "/pick-pack", label: "Pick & Pack" },
      { route: "/warehouse", label: "Warehouses" },
    ],
  },
  {
    id: "pick-pack",
    route: "/pick-pack",
    module: "Inventory",
    title: "Pick & Pack",
    summary: "Pick lists for draft dispatches: pick each product from its bins, pack it into packages, then the dispatch can be confirmed in Sales.",
    who: INVENTORY_WHO,
    tasks: [
      { title: "Start picking", steps: ["Choose the warehouse: its draft dispatches to pick are listed.", "Click Make pick list on a dispatch: the bins to pick from are suggested. Print pick list prints it."] },
      { title: "Pick", steps: ["Enter what was picked from each bin. Every product must be picked in full; if a bin runs short, take the rest from another line's bin."] },
      { title: "Pack", steps: ["Add packages and what each contains; Print packing list prints it.", "The goods ship when the dispatch is confirmed in Sales."] },
    ],
    statuses: [
      { name: "To pick", meaning: "Still being picked." },
      { name: "Picked", meaning: "Everything picked; the dispatch can be confirmed." },
      { name: "Packed", meaning: "Packed into packages." },
      { name: "Shipped", meaning: "The dispatch was confirmed in Sales and the goods left." },
      { name: "Cancelled", meaning: "Stopped; a reason is asked. Picked goods go back to unassigned stock." },
    ],
    rules: ["A dispatch with a pick list can be confirmed only once it is picked; one without ships as before."],
    related: [
      { route: "/sales-orders", label: "Sales Orders", why: "Where the dispatch is confirmed." },
      { route: "/bins", label: "Bins & Putaway" },
    ],
    flows: ["order-to-cash"],
  },
  {
    id: "consignment",
    route: "/consignment",
    module: "Inventory",
    title: "Consignment",
    summary: "Your goods at customers' sites (sold when the customer reports usage) and vendors' goods held in your warehouse (off your books until you take them over).",
    who: INVENTORY_WHO,
    tasks: [
      {
        title: "Keep stock at a customer",
        steps: [
          "On At customers, click Add a customer site: the customer and a location code.",
          "Send stock to it; Take back what comes back.",
          "Report usage: an order and dispatch are made for what was used. Confirm the dispatch, then invoice it. Take-overs lists the vendor take-overs.",
        ],
      },
      {
        title: "Hold a vendor's stock",
        steps: [
          "On Vendors' stock, click Add a vendor's stock location for the vendor in your warehouse.",
          "Set the Agreed price, then Receive their goods (or Return to vendor).",
          "Take over what you use: it comes into your stock at the agreed price and the vendor is billed (their bill number, or the take-over number if blank). It shows under Take-overs.",
        ],
      },
    ],
    rules: ["Customer-site stock is valued at your cost; vendor-owned stock at the agreed prices."],
    related: [
      { route: "/sales-orders", label: "Sales Orders" },
      { route: "/accountsPayable", label: "Accounts Payable" },
    ],
  },
  {
    id: "quality-inspection",
    route: "/quality-inspection",
    module: "Inventory",
    title: "Quality Inspection",
    summary: "Records of quality checks on products: who checked, when, and whether they passed.",
    who: INVENTORY_WHO,
    tasks: [
      { title: "Record an inspection", steps: ["Click Add Inspection.", "Choose the product, enter the inspector name and inspection date.", "Choose the inspection type and result (pass or fail), add remarks, and save."] },
    ],
    fields: [{ name: "Pass Rate", meaning: "The share of inspections that passed." }],
    statuses: [
      { name: "Pass", meaning: "Fit to use or sell." },
      { name: "Fail", meaning: "Not fit: adjust it out, or return it to the vendor." },
    ],
    related: [
      { route: "/stock-adjustment", label: "Stock Adjustments" },
      { route: "/purchase-service/returns", label: "Purchase Returns" },
    ],
  },
  {
    id: "batches",
    route: "/batch",
    module: "Inventory",
    title: "Batches",
    summary: "Batches (lots) of batch-tracked products, with manufacturing and expiry dates, so the oldest or soonest-expiring stock goes first.",
    who: INVENTORY_WHO,
    tasks: [
      { title: "Add a batch", steps: ["Click Add Batch.", "Enter the batch number, product, warehouse, supplier, manufacturing and expiry dates, and quantity.", "Save."] },
    ],
    fields: [{ name: "FIFO / FEFO Rank", meaning: "The order batches are used in: first in, or first to expire." }],
    statuses: [
      { name: "Expired", meaning: "Past its expiry date." },
      { name: "Empty", meaning: "No quantity left." },
    ],
    rules: ["Batches are usually made by goods receipts; the expiry date must be after the manufacturing date."],
    related: [{ route: "/purchase-service/goods-receipt-notes", label: "Goods Receipts (GRN)" }],
  },
  {
    id: "serial-numbers",
    route: "/serial-number",
    module: "Inventory",
    title: "Serial Numbers",
    summary: "Each unit of a serial-tracked product: where it is, its status and its warranty.",
    who: INVENTORY_WHO,
    tasks: [
      { title: "Add a serial number", steps: ["Click Add Serial Number.", "Enter the serial, product, warehouse, batch, current status and warranty start and end.", "Save."] },
      { title: "Look up a unit", steps: ["Search the serial and click View: status, warranty and its inspections."] },
    ],
    rules: ["Serials are usually made by goods receipts; the warranty end must be after the start."],
    related: [{ route: "/quality-inspection", label: "Quality Inspection" }],
  },
  {
    id: "warehouses",
    route: "/warehouse",
    module: "Inventory",
    title: "Warehouses",
    summary: "The places stock is kept. Active warehouses can receive and issue stock.",
    who: INVENTORY_WHO,
    tasks: [
      { title: "Add a warehouse", steps: ["Click Add Warehouse.", "Enter the code, name (at least 2 characters, not used before) and location type.", "Save."] },
      { title: "Stop using a warehouse", steps: ["Set its status to Inactive: its stock can still be seen but nothing comes in or goes out."] },
    ],
    statuses: [
      { name: "Active", meaning: "Receives and issues stock." },
      { name: "Inactive", meaning: "Closed for stock movements." },
    ],
    related: [
      { route: "/bins", label: "Bins & Putaway" },
      { route: "/inventory", label: "Stock on Hand" },
    ],
  },
];
