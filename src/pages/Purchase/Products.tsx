import PurchaseResourcePage from "./PurchaseResourcePage";
import { productConfig } from "./purchaseResourceConfigs";

export default function Products() {
  return <PurchaseResourcePage config={productConfig} />;
}
