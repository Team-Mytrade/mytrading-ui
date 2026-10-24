/**
 * Page addresses used for links between modules (e.g. click a vendor name in a PO → Vendors page).
 * ⚠ Check these match the paths in your router (App routes). If one is different, change it here
 * and every link that uses it is fixed.
 */
export const APP_ROUTES = {
  vendors: "/common/vendors",
  productCategories: "/common/categories",
  products: "/common/products",
  purchaseRequisitions: "/purchase-service/purchase-requisitions",
  purchaseOrders: "/purchase-service/purchase-orders",
  goodsReceiptNotes: "/purchase-service/goods-receipt-notes",
} as const;

/**
 * Link to a page filtered to one record, e.g.
 *   recordLink(APP_ROUTES.vendors, "vendorId", 3, "vendorName", "MedLine Supplies")
 *   → /common/vendors?vendorId=3&vendorName=MedLine%20Supplies
 * The target page reads these with its `scope` setting and shows only that record.
 * Returns null when the id is missing, so the cell shows plain text instead of a broken link.
 */
export function recordLink(
  path: string,
  idParam: string,
  id: unknown,
  nameParam: string,
  name: unknown,
  title?: string
): { to: string; title: string } | null {
  const idText = String(id ?? "").trim();
  if (!idText || idText === "0") return null;
  const params = new URLSearchParams({ [idParam]: idText });
  const nameText = String(name ?? "").trim();
  if (nameText) params.set(nameParam, nameText);
  return { to: `${path}?${params.toString()}`, title: title || `Open ${nameText || "record"}` };
}
