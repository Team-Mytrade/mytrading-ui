import PurchaseResourcePage from "./PurchaseResourcePage";
import { vendorConfig } from "./purchaseResourceConfigs";

export default function Vendors() {
  return <PurchaseResourcePage config={vendorConfig} />;
}
