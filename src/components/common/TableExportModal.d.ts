import type { ComponentType } from "react";

declare const TableExportModal: ComponentType<{
  isOpen: boolean;
  onClose: () => void;
  data: object[];
  columns: Array<{ key: string; label: string; sortValueGetter?: (row: any) => unknown }>;
  title?: string;
  /** "share": WhatsApp, email, copy or the device's share sheet instead of downloading. */
  mode?: "export" | "share";
}>;

export default TableExportModal;
