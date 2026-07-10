import PurchaseResourcePage from "./PurchaseResourcePage";
import { requisitionLineItemConfig } from "./purchaseResourceConfigs";

export default function RequisitionLineItems() {
  return <PurchaseResourcePage config={requisitionLineItemConfig} />;
}
