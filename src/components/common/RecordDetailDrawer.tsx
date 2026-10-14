import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect } from "react";
import "../../styles/RecordDetailDrawer.css";

interface RecordDetailDrawerProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  drawerWidth?: number;
  isResizing?: boolean;
  resizeHandle?: React.ReactNode;
  /** Buttons shown in the header, just before the close (✕) button — e.g. an Edit icon. */
  headerActions?: React.ReactNode;
}

/** Reusable, non-navigating detail view for table rows. */
const RecordDetailDrawer: React.FC<RecordDetailDrawerProps> = ({
  isOpen,
  title,
  subtitle,
  onClose,
  children,
  drawerWidth,
  isResizing = false,
  resizeHandle,
  headerActions,
}) => {
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
          <div className="flex items-center gap-1">
            {headerActions}
            <button type="button" onClick={onClose} aria-label="Close details" title="Close"><XMarkIcon className="h-5 w-5" /></button>
          </div>
        </header>
        <div className="record-detail-drawer__body">{children}</div>
      </aside>
    </div>
  );
};

export default RecordDetailDrawer;