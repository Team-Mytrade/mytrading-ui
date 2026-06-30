import PurchaseResourcePage from "./PurchaseResourcePage";
import { deliveryConfig } from "./purchaseResourceConfigs";

export default function Deliveries() {
  return <PurchaseResourcePage config={deliveryConfig} />;
}
