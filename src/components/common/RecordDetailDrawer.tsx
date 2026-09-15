import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect } from "react";
import "./RecordDetailDrawer.css";

interface RecordDetailDrawerProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  drawerWidth?: number;
  isResizing?: boolean;
  resizeHandle?: React.ReactNode;
}

/** Reusable, non-navigating detail view for table rows. */
const RecordDetailDrawer: React.FC<RecordDetailDrawerProps> = ({ isOpen, title, subtitle, onClose, children, drawerWidth, isResizing = false, resizeHandle }) => {
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <div className={`record-detail-drawer ${isOpen ? "is-open" : ""}`} aria-hidden={!isOpen}>
      <button type="button" className="record-detail-drawer__backdrop" onClick={onClose} aria-label="Close details" tabIndex={isOpen ? 0 : -1} />
      <aside className={`record-detail-drawer__panel ${isResizing ? "is-resizing" : ""}`} style={drawerWidth ? { width: `${drawerWidth}px` } : undefined} aria-label={`${title} details`} aria-modal="true" role="dialog">
        {resizeHandle}
        <header>
          <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button type="button" onClick={onClose} aria-label="Close details"><XMarkIcon className="h-5 w-5" /></button>
        </header>
        <div className="record-detail-drawer__body">{children}</div>
      </aside>
    </div>
  );
};

export default RecordDetailDrawer;
