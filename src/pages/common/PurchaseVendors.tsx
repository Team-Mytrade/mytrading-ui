import PurchaseResourcePage from "../Purchase/PurchaseResourcePage";
import { vendorConfig } from "../Purchase/purchaseResourceConfigs";

export default function Vendors() {
  return <PurchaseResourcePage config={vendorConfig} />;
}
