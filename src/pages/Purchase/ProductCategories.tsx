import PurchaseResourcePage from "./PurchaseResourcePage";
import { productCategoryConfig } from "./purchaseResourceConfigs";

export default function ProductCategories() {
  return <PurchaseResourcePage config={productCategoryConfig} />;
}
