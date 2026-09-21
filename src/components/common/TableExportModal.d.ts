import type { ComponentType } from "react";

declare const TableExportModal: ComponentType<{
  isOpen: boolean;
  onClose: () => void;
  data: object[];
  columns: Array<{ key: string; label: string; sortValueGetter?: (row: any) => unknown }>;
  title?: string;
}>;

export default TableExportModal;
