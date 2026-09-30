import PurchaseResourcePage from "../Purchase/PurchaseResourcePage";
import { approvalStatusConfig } from "../Purchase/purchaseResourceConfigs";

export default function ApprovalStatus() {
  return <PurchaseResourcePage config={approvalStatusConfig} />;
}
