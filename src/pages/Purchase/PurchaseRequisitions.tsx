import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PurchaseResourcePage from "./PurchaseResourcePage";
import { purchaseRequisitionConfig } from "./purchaseResourceConfigs";

export default function PurchaseRequisitions() {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ requisitionId: string | number }>;
      const requisitionId = ce.detail?.requisitionId;
      if (!requisitionId) return;

      navigate("/purchase-orders", {
        state: { prefillRequisitionId: requisitionId },
      });
    };

    document.addEventListener("purchase:convert-requisition", handler);
    return () =>
      document.removeEventListener("purchase:convert-requisition", handler);
  }, [navigate]);

  return <PurchaseResourcePage config={purchaseRequisitionConfig} />;
}