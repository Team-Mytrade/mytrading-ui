import type { HelpRole, HelpTopic } from "../types";

// Who can do what on the Delivery pages (delivery-service SecurityConfig): every page needs the Delivery rights of its
// action (view, create, update, delete); confirming a delivery note and Driver Mode need DELIVERY:UPDATE. The demo
// Delivery Manager has every right; the Executive has view, create and update.
const DELIVERY_WHO: HelpRole[] = [
  { role: "Delivery Manager", can: "Everything, including deleting and exporting." },
  { role: "Delivery Executive", can: "Plan deliveries, make delivery notes and goods issues, confirm deliveries, post tracking updates and keep the fleet set-up. Not delete or export." },
];

// Delivery: getting goods to customers with your own vehicles or a transporter (menu: Delivery).
export const DELIVERY_TOPICS: HelpTopic[] = [
  {
    id: "delivery-orders",
    route: "/deliveryOrder",
    module: "Delivery",
    title: "Delivery Orders",
    summary: "Plan a delivery: what goes to which customer, when, from which warehouse, to which address, on which vehicle and with which transporter. Made from a sales order, it holds those quantities as a draft sales dispatch until its delivery note is confirmed.",
    who: DELIVERY_WHO,
    tasks: [
      {
        title: "Plan a delivery for a sales order",
        steps: [
          "Click Add Delivery Order.",
          "Choose the Customer and the Sales Order, then click Load lines: the lines fill with what is still left to dispatch on the order.",
          "Change the quantities or remove the lines that are not going on this trip.",
          "Set the Delivery Date & Time, Ship From Warehouse, Delivery Address (the customer's default delivery address is filled in), Vehicle and Transporter.",
          "Save. A draft sales dispatch now holds these quantities, so no other delivery order can take them.",
        ],
      },
      {
        title: "Deliver something without a sales order",
        steps: ["Leave Sales Order empty and add the products with Add Product.", "Save. Nothing changes in Sales or in stock: the order only plans the trip."],
      },
      {
        title: "Move it along",
        steps: ["Click Change status on the row.", "Choose the new status and add remarks if useful. The update shows on Delivery Status."],
      },
      {
        title: "Change or cancel it",
        steps: [
          "Pending and confirmed orders can still change: click Edit. Changing lines, quantities, the sales order, vehicle or transporter replaces the draft dispatch.",
          "To call it off, Change status to Cancelled: the goods stay in the warehouse and the quantities are free to dispatch again.",
          "Delete is for pending or cancelled orders (Delivery Manager).",
        ],
      },
    ],
    fields: [
      { name: "Sales Dispatch", meaning: "The dispatch holding the quantities: a draft until the delivery note is confirmed, then confirmed (stock out, ready to invoice)." },
      { name: "Delivery Address", meaning: "One of the customer's addresses from Customer Addresses." },
    ],
    statuses: [
      { name: "Pending", meaning: "Planned; can still change." },
      { name: "Confirmed", meaning: "Agreed with the customer; can still change." },
      { name: "In Transit", meaning: "On its way." },
      { name: "Partially Delivered", meaning: "Part of it was delivered; the rest can go on another delivery order." },
      { name: "Delivered", meaning: "Handed over. It can only be marked Returned after this." },
      { name: "Returned", meaning: "Came back undelivered. Final." },
      { name: "Cancelled", meaning: "Called off; its draft dispatch is cancelled. Final." },
    ],
    rules: [
      "Marking an order Delivered here does not take the goods out of stock. Confirm its delivery note: that confirms the sales dispatch at the delivered quantities.",
      "Once the dispatch is confirmed the order can't be cancelled: the goods have left. Record a return in Sales instead (Return Requests).",
      "Inactive vehicles and transporters can't be put on a new order.",
    ],
    related: [
      { route: "/delivery-note", label: "Delivery Notes", why: "Record what the customer received" },
      { route: "/deliveryStatus", label: "Delivery Status" },
      { route: "/sales-orders", label: "Sales Orders" },
      { route: "/customerAddress", label: "Customer Addresses" },
    ],
    flows: ["delivery-run", "order-to-cash"],
  },
  {
    id: "goods-issue",
    route: "/goodsIssue",
    module: "Delivery",
    title: "Goods Issue",
    summary: "A record of what left the warehouse against a delivery note: saved as a draft, then posted. It does not change stock: the goods go out of stock when the delivery note is confirmed.",
    who: DELIVERY_WHO,
    tasks: [
      {
        title: "Record goods leaving",
        steps: [
          "Click Add Goods Issue (or Issue goods on a delivery note).",
          "Choose the Delivery Note and the Issue Date: its lines load.",
          "Trim the lines to what is actually leaving (Add Line, Remove line). With no lines, everything still open on the note is issued.",
          "Save: the goods issue is a draft.",
        ],
      },
      { title: "Post it", steps: ["Click Post on the draft and confirm."] },
      {
        title: "Undo it",
        steps: ["Click Cancel on a draft or posted goods issue.", "Delete is for drafts and cancelled ones (Delivery Manager); a posted one is cancelled instead."],
      },
    ],
    statuses: [
      { name: "Draft", meaning: "Saved; can still be edited, posted, cancelled or deleted." },
      { name: "Posted", meaning: "Recorded as issued. Can only be cancelled." },
      { name: "Cancelled", meaning: "No longer counts; its quantities can be issued again." },
    ],
    rules: [
      "Quantities can never exceed what is still open on the delivery note (the delivered quantity once it is recorded, otherwise the ordered one), counting the note's other goods issues that are not cancelled.",
      "Only drafts can be edited.",
      "While a goods issue is open against a delivery note, the note's lines can't change and the note can't be deleted.",
    ],
    related: [
      { route: "/delivery-note", label: "Delivery Notes" },
      { route: "/stock-movement", label: "Stock Movements", why: "Where stock changes are recorded" },
    ],
    flows: ["delivery-run"],
  },
  {
    id: "delivery-notes",
    route: "/delivery-note",
    module: "Delivery",
    title: "Delivery Notes",
    summary: "What was handed over to the customer, line by line: ordered and delivered quantities. Confirming the note is what takes the goods out of stock and makes the dispatch ready to invoice.",
    who: DELIVERY_WHO,
    tasks: [
      {
        title: "Make the note",
        steps: [
          "Click Add Delivery Note.",
          "Choose the Delivery Order: the customer, sales order and lines are filled in, delivered in full.",
          "Set the Delivery Date and save (Status Pending).",
        ],
      },
      {
        title: "Print the challan",
        steps: ["Click Print delivery challan: the driver hands it over and the customer signs it. Vehicle, transporter and address come from the delivery order."],
      },
      {
        title: "Record what the customer received",
        steps: [
          "Click Edit and enter the Delivered quantity of each line (0 up to the ordered quantity).",
          "Click Confirm delivery (stock out) and confirm.",
          "Everything delivered: the note and its delivery order become Delivered. Less: Partially Delivered, and the rest can go on another delivery order.",
          "The sales dispatch is confirmed at the delivered quantities: the stock goes out and the dispatch can be invoiced.",
        ],
      },
      {
        title: "Raise a goods issue",
        steps: ["Click Issue goods: a draft goods issue for everything still open on the note.", "Post it on the Goods Issue page."],
      },
    ],
    fields: [
      { name: "Ordered quantity", meaning: "What the delivery order sent." },
      { name: "Delivered quantity", meaning: "What the customer accepted; this is what leaves stock." },
    ],
    statuses: [
      { name: "Pending", meaning: "Made; not confirmed yet." },
      { name: "Confirmed", meaning: "Set by hand (for example agreed with the customer); not delivered yet." },
      { name: "Partially Delivered", meaning: "Confirmed with less than ordered (the Partial card)." },
      { name: "Delivered", meaning: "Confirmed in full." },
      { name: "Cancelled", meaning: "Not going ahead; can't be confirmed." },
    ],
    rules: [
      "Delivered and Partially Delivered are set only by Confirm delivery, never by editing the note.",
      "A confirmed note can't be edited or deleted: the goods have left the warehouse.",
      "A note whose delivery order has no sales order is only marked delivered when confirmed; no stock moves.",
      "To change the lines or delete the note after goods were issued against it, cancel the goods issue first.",
    ],
    related: [
      { route: "/deliveryOrder", label: "Delivery Orders" },
      { route: "/goodsIssue", label: "Goods Issue" },
      { route: "/invoices", label: "Invoices", why: "Invoice the confirmed dispatch" },
    ],
    flows: ["delivery-run", "order-to-cash"],
  },
  {
    id: "delivery-shipments",
    route: "/shipment",
    module: "Delivery",
    title: "Shipments",
    summary: "Parcels sent with a carrier or courier: tracking number, carrier, the warehouse they leave from and what is in them, from picking to delivery.",
    who: DELIVERY_WHO,
    tasks: [
      {
        title: "Add a shipment",
        steps: [
          "Click Add Shipment.",
          "Enter the Tracking Number, Carrier and Shipment Date and choose the Warehouse; add the Sales Order ID or Reservation ID if it belongs to one.",
          "Click Add Item for each product and quantity, then save. The shipment number is given on saving; it starts as Draft.",
        ],
      },
      {
        title: "Follow it",
        steps: ["Click Change Status: Picked, Packed, Shipped, Delivered. Steps can be skipped; a shipment never moves back."],
      },
    ],
    statuses: [
      { name: "Draft", meaning: "Recorded; counted under Preparing." },
      { name: "Picked", meaning: "Picked from the shelves (Preparing)." },
      { name: "Packed", meaning: "Packed and ready (Preparing)." },
      { name: "Shipped", meaning: "Handed to the carrier; can no longer be edited." },
      { name: "Delivered", meaning: "Arrived. Final." },
      { name: "Cancelled", meaning: "Called off (possible until delivered). Final." },
    ],
    rules: [
      "Details and items can change until the shipment is shipped.",
      "Delete is for draft or cancelled shipments (Delivery Manager).",
      "A shipment is a record only: it does not take stock out or confirm a sales dispatch. Dispatch the sales order as usual.",
    ],
    related: [
      { route: "/sales-orders", label: "Sales Orders" },
      { route: "/inventory-reservation", label: "Reservations" },
    ],
  },
  {
    id: "delivery-status",
    route: "/deliveryStatus",
    module: "Delivery",
    title: "Delivery Status",
    summary: "The tracking board: every delivery still on its way and its latest update (who, when, remarks). Post an update to move a delivery along.",
    who: DELIVERY_WHO,
    tasks: [
      { title: "See what is on the road", steps: ["The list opens on Active deliveries (not delivered, returned or cancelled); Due Today counts the ones due today.", "Use Filters for other statuses or a date."] },
      {
        title: "Post an update",
        steps: [
          "Click Post an update on the delivery.",
          "Choose the New Status and add Remarks.",
          "For Returned or Cancelled, give the Reason (customer not available, damaged in transit…).",
        ],
      },
      { title: "See the latest update", steps: ["Click Tracking details: status, who updated it, when, remarks and any reason."] },
    ],
    rules: [
      "The same status rules as Delivery Orders: Returned and Cancelled are final, and a delivered order can only be marked Returned.",
      "Drivers' updates from Driver Mode show here too.",
      "An update doesn't take stock out; confirming the delivery note does.",
    ],
    related: [
      { route: "/deliveryOrder", label: "Delivery Orders" },
      { route: "/vehicle-tracking", label: "Live Tracking" },
    ],
    flows: ["delivery-run"],
  },
  {
    id: "live-tracking",
    route: "/vehicle-tracking",
    module: "Delivery",
    title: "Live Tracking",
    summary: "A live map of the vehicles whose drivers are on a trip in Driver Mode, and the routes of past trips.",
    who: [
      { role: "Delivery Manager / Executive", can: "Watch the map and trip history, and end a trip a driver forgot to end." },
      { role: "Anyone with Delivery view", can: "Watch the map and trip history." },
    ],
    tasks: [
      {
        title: "Get drivers started",
        steps: ["Drivers open Driver Mode on their phone, choose a vehicle and tap Start Trip.", "When no vehicle is on a trip the page shows the Driver Mode link: click Copy and send it to the drivers."],
      },
      {
        title: "Follow a vehicle",
        steps: [
          "On Live, click the vehicle in the list or on the map: its route so far, speed, GPS accuracy and open deliveries.",
          "The map refreshes every 15 seconds; click the Updated … button beside the counts to refresh it now.",
        ],
      },
      { title: "See where a vehicle went", steps: ["Click Trip history and choose the date and vehicle.", "Click a trip: its route from start (green) to end (red), duration and distance."] },
      { title: "End a forgotten trip", steps: ["Select the trip and click End trip: the driver's phone stops sharing its location."], who: "Delivery Manager / Executive" },
    ],
    statuses: [
      { name: "Moving", meaning: "Going at 3 km/h or more." },
      { name: "Stopped", meaning: "Standing still." },
      { name: "Signal lost", meaning: "No location for 5 minutes or more (phone off, page closed, no signal)." },
      { name: "Waiting for GPS", meaning: "Trip started, no position yet." },
      { name: "Ended", meaning: "A past trip (in Trip history)." },
    ],
    rules: [
      "A trip that sends nothing for 6 hours is ended by the system, where it was last heard from.",
      "Distance counts only precise GPS fixes, so it can be a little under the real distance.",
      "Map: OpenStreetMap.",
    ],
    related: [
      { route: "/driver", label: "Driver Mode" },
      { route: "/vehicle", label: "Vehicles" },
    ],
    flows: ["delivery-run"],
  },
  {
    id: "driver-mode",
    route: "/driver",
    module: "Delivery",
    title: "Driver Mode",
    summary: "For drivers, on their phone: share the vehicle's location during a trip and update the deliveries on that vehicle.",
    who: [
      { role: "Driver", can: "Driver Mode only: start a trip and update the deliveries on their vehicle. Needs just the Delivery update right." },
      { role: "Delivery Manager / Executive", can: "Driver Mode too, when they drive." },
    ],
    tasks: [
      {
        title: "Start the trip",
        steps: ["Open Driver Mode on the phone (Back to myTrading returns to the menu).", "Choose a vehicle and tap Start Trip.", "Keep the page open while driving."],
      },
      {
        title: "Deliver",
        steps: [
          "Deliveries lists what is on the vehicle: open ones first, then today's finished ones. Navigate opens directions to the address.",
          "Tap Start delivery when you set off for it.",
          "At the customer tap Delivered, Partly or Not delivered. Not delivered needs the reason; a note is optional.",
          "Your current location is saved with the update.",
        ],
      },
      { title: "End the trip", steps: ["Tap End Trip and confirm. Your location stops being shared."] },
    ],
    rules: [
      "Location sharing needs a secure (HTTPS) connection. Without it you can still update deliveries.",
      "Location is not shared while you use other apps or the screen is off: keep this page open.",
      "Without a connection, positions are kept on the phone and sent once it is back.",
      "One trip per driver and per vehicle. Opening Driver Mode again on the same vehicle carries on the same trip.",
      "Delivered here updates the delivery only; the office confirms the delivery note with the delivered quantities, which takes the goods out of stock.",
    ],
    related: [
      { route: "/vehicle-tracking", label: "Live Tracking" },
      { route: "/deliveryStatus", label: "Delivery Status" },
    ],
    flows: ["delivery-run"],
  },
  {
    id: "delivery-schedule",
    route: "/schedule",
    module: "Delivery",
    title: "Schedule",
    summary: "Plan which vehicle drives which route on which day, between which times.",
    who: DELIVERY_WHO,
    tasks: [
      {
        title: "Schedule a run",
        steps: ["Click Add Schedule.", "Choose the Route and Vehicle, the Scheduled Date, Start Time and End Time.", "Save: it starts as Scheduled."],
      },
      { title: "Close it", steps: ["Click Edit Schedule and set the Status to Completed or Cancelled."] },
      { title: "Find a day's runs", steps: ["Click the Today, Upcoming or Past card, or Filter by Date."] },
    ],
    statuses: [
      { name: "Scheduled", meaning: "Planned." },
      { name: "Completed", meaning: "Done." },
      { name: "Cancelled", meaning: "Not driven." },
    ],
    rules: ["End time must be after start time.", "A schedule is a plan for the vehicle; deliveries are put on a vehicle on the delivery order."],
    related: [
      { route: "/route", label: "Routes" },
      { route: "/vehicle", label: "Vehicles" },
    ],
  },
  {
    id: "delivery-routes",
    route: "/route",
    module: "Delivery",
    title: "Routes",
    summary: "The regular routes your vehicles drive, with where they start and end and how far they are.",
    who: DELIVERY_WHO,
    tasks: [{ title: "Add a route", steps: ["Click Add Route.", "Enter the Route Name, Start Location, End Location and Distance (Km), and save."] }],
    rules: ["Deleting a route keeps it on the schedules that already use it (Delivery Manager)."],
    related: [{ route: "/schedule", label: "Schedule" }],
  },
  {
    id: "customer-addresses",
    route: "/customerAddress",
    module: "Delivery",
    title: "Customer Addresses",
    summary: "Where each customer takes deliveries and gets bills. A new delivery order starts at the customer's default delivery address.",
    who: DELIVERY_WHO,
    tasks: [
      {
        title: "Add an address",
        steps: [
          "Click Add Address and choose the customer.",
          "Choose the Address Type and fill Address Line 1, City, State and Postal Code (Address Line 2, Country and Landmark if useful).",
          "Tick Default Delivery and/or Default Billing, and save.",
        ],
      },
      { title: "See one customer's addresses", steps: ["Use Filter by customer."] },
    ],
    fields: [
      { name: "Address Type", meaning: "Shipping, delivery, billing, office, home or other." },
      { name: "Default Delivery", meaning: "The address a new delivery order for this customer starts with." },
    ],
    rules: ["A customer has one default delivery and one default billing address: ticking it on a new address clears it on the old one."],
    related: [
      { route: "/deliveryOrder", label: "Delivery Orders" },
      { route: "/customer-management", label: "Customers" },
    ],
  },
  {
    id: "delivery-vehicles",
    route: "/vehicle",
    module: "Delivery",
    title: "Vehicles",
    summary: "Your delivery fleet: the vehicles put on delivery orders and schedules, and the ones drivers choose in Driver Mode.",
    who: DELIVERY_WHO,
    tasks: [
      {
        title: "Add a vehicle",
        steps: ["Click Add Vehicle.", "Enter the License Plate, Model, Vehicle Type, Capacity (Kg) and Owner; Status Active.", "Save."],
      },
      { title: "Take it off the road", steps: ["Edit it and set the Status to Maintenance or Inactive."] },
    ],
    statuses: [
      { name: "Active", meaning: "In use." },
      { name: "Maintenance", meaning: "In the workshop." },
      { name: "Inactive", meaning: "Not in use." },
    ],
    rules: ["Deleting a vehicle keeps it on old delivery orders and schedules, but it can't be put on new ones or chosen in Driver Mode (Delivery Manager)."],
    related: [
      { route: "/transporter", label: "Transporters" },
      { route: "/vehicle-tracking", label: "Live Tracking" },
    ],
  },
  {
    id: "delivery-transporters",
    route: "/transporter",
    module: "Delivery",
    title: "Transporters",
    summary: "The transport companies you hand deliveries to, with their contact details.",
    who: DELIVERY_WHO,
    tasks: [
      {
        title: "Add a transporter",
        steps: ["Click Add Transporter.", "Enter the Transporter Name, Contact Person, Contact Number, Email and Address; Status Active.", "Save."],
      },
    ],
    statuses: [
      { name: "Active", meaning: "Can be put on delivery orders." },
      { name: "Inactive", meaning: "Kept on old orders; can't be put on new ones." },
    ],
    rules: ["A transporter used by delivery orders or vehicles can't be deleted: mark it Inactive instead."],
    related: [
      { route: "/deliveryOrder", label: "Delivery Orders" },
      { route: "/vehicle", label: "Vehicles" },
    ],
  },
];
