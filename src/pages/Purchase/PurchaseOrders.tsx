import PurchaseResourcePage from "./PurchaseResourcePage";
import { purchaseOrderConfig } from "./purchaseResourceConfigs";

export default function PurchaseOrders() {
  return <PurchaseResourcePage config={purchaseOrderConfig} />;
}
