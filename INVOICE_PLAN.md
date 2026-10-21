# Invoice Module Alignment Plan

Status: Planned, not implemented.

Align the existing React, Vite, and TypeScript invoice module with the MyTrade complete E2E test plan. Preserve existing architecture and reuse existing screens and shared components.

## Planned changes

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
- **Invoice handoff:** A confirmed dispatch is marked ready for invoicing. Actual invoice generation remains part of the invoice plan above; the Sales invoice-source endpoint does not create invoices.
- **Runtime verification:** Reservation/consumption, duplicate requests, tenant isolation, and tracking availability still require authenticated E2E testing. Swagger confirms contracts, not transaction behavior.
