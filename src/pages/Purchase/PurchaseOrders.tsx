import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import PurchaseResourcePage, { PurchaseResourceConfig } from "./PurchaseResourcePage";
import { purchaseOrderConfig } from "./purchaseResourceConfigs";
import { ToasterService } from "../../Services/ToasterService";

const PURCHASE = "/v1/api/purchase";

export default function PurchaseOrders() {
  const location = useLocation();
  const navigate = useNavigate();

  const [prefilledConfig, setPrefilledConfig] =
    useState<PurchaseResourceConfig>(purchaseOrderConfig);

  useEffect(() => {
    const prefillId = (location.state as any)?.prefillRequisitionId;
    if (!prefillId) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await axios.get(`${PURCHASE}/purchase-requisitions/${prefillId}`);
        if (cancelled) return;

        const requisition = res.data;
        const items = Array.isArray(requisition.items)
          ? requisition.items.map((item: any, index: number) => ({
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
            requisitionId: requisition.id,
            items,
            vendorId: requisition.vendorId ?? "",
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