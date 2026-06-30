import PurchaseResourcePage from "./PurchaseResourcePage";
import { approvalStatusConfig } from "./purchaseResourceConfigs";

export default function ApprovalStatus() {
  return <PurchaseResourcePage config={approvalStatusConfig} />;
}
