import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import PurchaseResourcePage, { PurchaseResourceConfig } from "../Purchase/PurchaseResourcePage";
import { purchaseOrderConfig } from "../Purchase/purchaseResourceConfigs";
import { ToasterService } from "../../Services/ToasterService";

const PURCHASE = "/v1/api/purchase";

/** PRs in these statuses cannot be turned into a purchase order. */
const PR_CLOSED_STATUSES = ["REJECTED", "CANCELLED", "CLOSED", "ORDERED", "CONVERTED"];

/** Item shape returned by GET /purchase-requisitions/{id}. */
type RequisitionItem = {
  id?: string | number;
  productId?: string | number;
  productCode?: string;
  productName?: string;
  quantity?: number;
  unitOfMeasure?: string;
  estimatedUnitCost?: number;
  remarks?: string;
};

type RequisitionDetail = {
  id?: string | number;
  requisitionNumber?: string;
  status?: string;
  notes?: string;
  requiredByDate?: string;
  items?: RequisitionItem[];
};

/** Today's date as YYYY-MM-DD in local time (toISOString() uses UTC). */
const todayLocal = () => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * Purchase Orders are created only from a requisition (the "Create PO" icon on the PR list),
 * so this page has no "Add" button. When opened from a PR, the create form opens pre-filled.
 */
export default function PurchaseOrders() {
  const location = useLocation();
  const navigate = useNavigate();

  const [config, setConfig] = useState<PurchaseResourceConfig>(purchaseOrderConfig);

  useEffect(() => {
    const prefillId = (location.state as { prefillRequisitionId?: string | number } | null)
      ?.prefillRequisitionId;
    if (prefillId === undefined || prefillId === null || prefillId === "") return;

    let cancelled = false;

    (async () => {
      try {
        const { data } = await axios.get<RequisitionDetail>(
          `${PURCHASE}/purchase-requisitions/${prefillId}`
        );
        if (cancelled) return;

        if (PR_CLOSED_STATUSES.includes(String(data.status || "").toUpperCase())) {
          ToasterService.error(`Requisition ${data.requisitionNumber || prefillId} is ${data.status}; a PO cannot be created from it.`);
          return;
        }

        // Standard cost of each product, used as the default unit price when the PR has no estimate.
        const productIds = (data.items || []).map((item) => Number(item.productId)).filter((id) => id > 0);
        const standardCost: Record<string, number> = {};
        if (productIds.length) {
          try {
            const { data: products } = await axios.post<{ id: number; standardCost?: number }[]>(
              "/v1/api/product/products/batch",
              { productIds }
            );
            (Array.isArray(products) ? products : []).forEach((product) => {
              standardCost[String(product.id)] = Number(product.standardCost) || 0;
            });
          } catch (error) {
            // Not critical: prices can still be typed in.
            console.warn("Could not load product costs for the PO", error);
          }
          if (cancelled) return;
        }

        const items = (Array.isArray(data.items) ? data.items : []).map((item, index) => ({
          // New PO lines get a temporary id, so the PR line id is never sent as a PO line id.
          id: `prefill-${index}`,
          productId: item.productId ?? "",
          productName: item.productName ?? "",
          quantity: item.quantity ?? 1,
          // Quantity requested in the PR; the PO line may not order more than this.
          prQuantity: item.quantity ?? 0,
          // PR estimate if given, otherwise the product's standard cost; the buyer can change it.
          unitPrice: Number(item.estimatedUnitCost) || standardCost[String(item.productId)] || 0,
          discountAmount: 0,
          taxAmount: 0,
          unitOfMeasure: item.unitOfMeasure ?? "PIECES",
          remarks: item.remarks ?? "",
        }));

        if (!items.length) {
          ToasterService.error("This requisition has no items, so a PO cannot be created from it.");
          return;
        }

        setConfig({
          ...purchaseOrderConfig,
          initialFormState: {
            ...purchaseOrderConfig.initialFormState,
            purchaseRequisitionId: data.id,
            orderDate: todayLocal(),
            // The PR's "required by" date is when the goods are needed, so it becomes the
            // expected delivery date (unless it is already in the past).
            expectedDeliveryDate:
              data.requiredByDate && String(data.requiredByDate).slice(0, 10) >= todayLocal()
                ? String(data.requiredByDate).slice(0, 10)
                : "",
            notes: data.notes ?? "",
            items,
          },
          formSubtitle: `Creating a purchase order from ${data.requisitionNumber || `requisition #${data.id}`}.`,
          autoOpenCreate: true,
          autoOpenCreateKey: `po-from-pr-${data.id}`,
        });

        ToasterService.success("Requisition loaded into new PO");
      } catch (error) {
        console.error("Failed to load requisition for PO conversion", error);
        ToasterService.error("Failed to load requisition");
      } finally {
        // Clear the router state so a page refresh doesn't load the requisition again.
        if (!cancelled) navigate(location.pathname, { replace: true, state: null });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location, navigate]);

  return <PurchaseResourcePage config={config} />;
}
