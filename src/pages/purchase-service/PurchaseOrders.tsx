import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import PurchaseResourcePage, { PurchaseResourceConfig } from "../Purchase/PurchaseResourcePage";
import { purchaseOrderConfig } from "../Purchase/purchaseResourceConfigs";
import { ToasterService } from "../../Services/ToasterService";

const PURCHASE = "/v1/api/purchase";

type RequisitionItem = {
  id?: string | number;
  productId?: string | number;
  productName?: string;
  categoryId?: string | number;
  quantity?: number;
  unitOfMeasure?: string;
  remarks?: string;
  product?: { id?: string | number; productName?: string };
  category?: { id?: string | number };
};

type RequisitionDetail = {
  id?: string | number;
  vendorId?: string | number;
  vendorCode?: string;
  name?: string;
  vendor?: { id?: string | number; vendorCode?: string; name?: string };
  items?: RequisitionItem[];
};

export default function PurchaseOrders() {
  const location = useLocation();
  const navigate = useNavigate();

  const [prefilledConfig, setPrefilledConfig] =
    useState<PurchaseResourceConfig>(purchaseOrderConfig);

  useEffect(() => {
    const prefillId = (location.state as { prefillRequisitionId?: string | number } | null)
      ?.prefillRequisitionId;
    if (!prefillId) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await axios.get(`${PURCHASE}/purchase-requisitions/${prefillId}`);
        if (cancelled) return;

        const requisition = res.data as RequisitionDetail;
        const items = Array.isArray(requisition.items)
          ? requisition.items.map((item, index) => ({
              id: item.id ?? `prefill-${index}`,
              productId: item.product?.id ?? item.productId ?? "",
              productName: item.product?.productName ?? "",
              categoryId: item.category?.id ?? item.categoryId ?? "",
              quantity: item.quantity ?? 1,
              unitOfMeasure: item.unitOfMeasure ?? "PIECES",
              remarks: item.remarks ?? "",
            }))
          : [];

        setPrefilledConfig({
          ...purchaseOrderConfig,
          initialFormState: {
            purchaseRequisitionId: requisition.id,
            items,
            vendorId: requisition.vendorId ?? requisition.vendor?.id ?? "",
            vendorCode: requisition.vendorCode ?? requisition.vendor?.vendorCode ?? "",
            name: requisition.name ?? requisition.vendor?.name ?? "",
          },
          autoOpenCreate: true,
        });

        ToasterService.success("Requisition loaded into new PO");
      } catch (error) {
        console.error("Failed to load requisition for PO conversion", error);
        ToasterService.error("Failed to load requisition");
      } finally {
        if (!cancelled) {
          navigate(location.pathname, { replace: true, state: null });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location, navigate]);

  return <PurchaseResourcePage config={prefilledConfig} />;
}
