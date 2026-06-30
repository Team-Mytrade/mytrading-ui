import PurchaseResourcePage from "./PurchaseResourcePage";
import { inventoryConfig } from "./purchaseResourceConfigs";

export default function Inventory() {
  return <PurchaseResourcePage config={inventoryConfig} />;
}
