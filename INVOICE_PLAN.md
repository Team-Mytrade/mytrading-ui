# Invoice Module Alignment Plan

Status: Partially implemented. Invoice Swagger and current frontend reviewed on 2026-10-21; remaining gaps are listed below.

Align the existing React, Vite, and TypeScript invoice module with the MyTrade complete E2E test plan. Preserve existing architecture and reuse existing screens and shared components.

## Target scope

1. Verify backend API paths, payloads, responses, and status enums. Resolve conflicting endpoints in the document before implementation.
2. Generate invoices from confirmed dispatches instead of manually entering invoice totals.
3. Show complete invoice details: customer, seller, addresses, products, taxes, batches, and serial numbers.
4. Add an Issue Invoice action that triggers backend Accounts Receivable creation.
5. Update payments to support invoice allocations, advances, overpayments, server-generated receipt numbers, and payment reversals.
6. Add credit notes and customer-credit application.
7. Add customer statements with date filters and opening, running, and closing balances.
8. Add invoice PDF generation, download, and explicit regeneration with version history.
9. Use backend-calculated balances and statuses, with actions restricted by invoice state and permissions.

## Existing files to reuse

- `src/pages/Invoice/Invoices.tsx`
- `src/pages/Invoice/PaymentReceipts.tsx`
- `src/pages/Invoice/AccountsReceivable.tsx`
- `src/pages/Invoice/invoiceEnums.ts`
- Existing shared tables, detail drawers, forms, and confirmation dialogs.

Request approval before creating any additional implementation files. Backend transaction correctness, tenant isolation, uniqueness, and idempotency require API/runtime verification.

## Verification

Use the corrected baseline: receive 10 batch units and 3 serialized laptops; dispatch 5 units and 2 laptops; verify 5 units and 1 laptop remain. Verify invoice traceability, issue and AR creation, payments and credits, statements, PDF versioning, and duplicate-request handling. Run relevant type/build checks after implementation.

## Sales API gaps and follow up

Checked against the Sales Swagger at `http://193.181.209.14:2210/swagger-ui/index.html` on 2026-10-21.

- **Dispatch history and retrieval:** Swagger exposes dispatch creation, confirmation, dispatchable order items, and invoice-source retrieval, but no dedicated list or detail endpoint for draft/existing dispatches. Backend must provide authenticated, tenant-scoped retrieval by order and by dispatch ID, including status, items, tracking details, and reservation reference. Exact paths must be supplied by the backend team; do not invent them.
- **Current UI limitation:** Newly created dispatches can be reviewed and confirmed during the Sales Orders page session. Navigating away or refreshing loses the local dispatch view, not the backend dispatch. Do not recreate a dispatch to recover it. Resume/history support remains pending the retrieval API, including recovery after an uncertain create response.
- **Tracking selection:** Dispatchable-item responses do not include tracking flags or available batches/serials. The form currently accepts batch/serial text; backend validates availability. Guided stock selection needs verified Product Catalogue/Inventory contracts and reservation-aware availability.
- **Invoice handoff:** A confirmed dispatch now links to the Invoice form with its dispatch ID prefilled. Manual dispatch ID entry remains available; the searchable dispatch selector remains blocked by the missing Sales retrieval API. The Sales invoice-source endpoint does not create invoices.
- **Runtime verification:** Reservation/consumption, duplicate requests, tenant isolation, and tracking availability still require authenticated E2E testing. Swagger confirms contracts, not transaction behavior.

## Invoice Swagger comparison

Source: [Invoice Swagger](http://193.181.209.14:2206/swagger-ui/index.html), checked against `/v3/api-docs` on 2026-10-21. This replaces the earlier assessment that the invoice screens only offered manual CRUD.

The current frontend wires invoice generation, draft updates, issue, cancel/delete, receipt allocations and reversal, read-only AR with aging, and PDF generation/download/regeneration. Endpoint availability does not establish successful backend transaction behavior.

### Confirmed contracts

Paths in this list start with `/v1/api/invoice` unless explicitly stated otherwise.

- `POST /invoices/from-dispatch`: required `salesDispatchId`; optional `invoiceDate`, `remarks`. Current create payload matches. This resolves the document's conflicting invoice base paths.
- `PUT /invoices/{invoiceId}`: `invoiceDate`, `remarks`; current update payload matches.
- `POST /invoices/{invoiceId}/issue`: no request body declared. Current code matches; the document's remarks body is unnecessary.
- `POST /invoices/{invoiceId}/cancel`: required `reason`, maximum 500 characters. Delete is separately exposed at `DELETE /invoices/{invoiceId}`.
- `POST /receipts`: required `customerId`, `paymentMethod`, `totalAmountReceived` (minimum 0.01); optional `paymentDate`, `referenceNumber`, `notes`, `allocations`. Each allocation requires `invoiceId` and `allocatedAmount` (minimum 0.01). Current allocation payload shape matches. Receipt number and receivedBy are not declared request fields.
- `POST /receipts/{receiptId}/reverse`: required `reason`, maximum 500 characters. Current reversal endpoint and payload match.
- `GET /accounts-receivable`, `/accounts-receivable/aging`, and `/accounts-receivable/customer/{customerId}/outstanding`: current read-only AR screen uses these endpoints. Swagger does not expose AR create/update/delete operations.
- `POST /invoices/{invoiceId}/documents/pdf`; `GET /invoices/{invoiceId}/documents`; `GET /invoices/{invoiceId}/documents/{documentId}/download`; `POST /invoices/{invoiceId}/documents/pdf/regenerate` with required `reason` (maximum 500 characters). Current methods match; the document's POST download method is incorrect.
- `POST /credit-notes`: requires `invoiceId`, `amount` (minimum 0.01), `creditNoteType`, and `reason` (maximum 500 characters). Types: SALES_RETURN, PRICE_ADJUSTMENT, DISCOUNT, BILLING_CORRECTION, TAX_ADJUSTMENT, OTHER. Issue separately through `POST /credit-notes/{creditNoteId}/issue`. The document omits required creditNoteType and includes remarks not declared by this request.
- `GET /customer-credits/customer/{customerId}/available`; `POST /customer-credits/{creditId}/apply` with required `invoiceId`, `amount`, and optional `remarks` (maximum 500 characters). Credit ID belongs in the path, not the document's customerCreditId body field. Credit detail and invoice-allocation retrieval endpoints also exist.
- `GET /v1/api/customer-financial/{customerId}/summary` and `GET /v1/api/customer-financial/{customerId}/statement?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD`. Both statement dates are required; these paths do not include the invoice prefix.

### Remaining frontend work

1. Add credit-note creation and issue actions. No credit-note integration was found in the current frontend. Swagger exposes create/issue but no credit-note list/detail route, so persistent browsing needs a backend contract.
2. Add available customer credits, credit application, and allocation history. Their APIs exist but frontend integrations were not found.
3. Backend must expose seller and billing/shipping snapshots in InvoiceResponse for guaranteed complete on-screen review: these fields are absent from the supplied Swagger response. Invoice credit totals are also absent there; the outstanding-invoice API separately exposes credit information.
4. Complete persistent dispatch browsing once Sales retrieval is available. The current confirmed-dispatch action already links to invoice creation without retyping IDs.

### Main invoice flow implemented

- Confirmed dispatch → prefilled invoice creation → saved invoice review → issue → customer payment allocation → customer statement.
- Review fetches invoice details and displays customer identity, dates, order/dispatch references, product quantities/prices/taxes, batches, serials, paid amount and outstanding balance from the API.
- Accounts Receivable now has a dated financial statement and current customer summary. Statement entries retain server order; only affectsBalance entries change the calculated running balance. A closing-balance mismatch is flagged. Current summary is labelled separately because it need not equal a historical statement.
- PDF download chooses a GENERATED version, or generates one if unavailable. PDF actions are limited to ISSUED, PARTIALLY_PAID, PAID and OVERDUE.
- Receipt payment method is required. Cancellation, reversal and regeneration reasons enforce the API's 500-character limit.

Seven isolated statement/PDF checks passed. Edited invoice/Sales files have no TypeScript diagnostics. The full build is blocked by existing syntax errors in DeliveryNote.tsx (lines 533 and 942). Authenticated create/issue/payment/PDF requests and end-to-end reconciliation remain to be tested. Optional credit-note/customer-credit screens are still separate outstanding work listed above.
