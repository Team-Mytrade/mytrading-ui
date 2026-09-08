import { CircleDot, ChevronRight, FolderClosed, ArrowLeft } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { navItems } from "../../layout/AppSidebar";
import { AddButton } from "./AddButton";
import "./PageBreadCrumb.css";

interface BreadcrumbProps {
  pageTitle: string;
  onBack?: () => void;
  showBackButton?: boolean;
  showAddButton?: boolean;
  addButtonLabel?: string;
  onAddClick?: () => void;
  addButtonClassName?: string;
  className?: string;
  contentClassName?: string;
  titleClassName?: string;
  breadcrumbClassName?: string;
  inlineBreadcrumb?: boolean;
}

type Crumb = { label: string; current?: boolean };

const PageBreadcrumb: React.FC<BreadcrumbProps> = ({
  pageTitle,
  onBack,
  showBackButton = true,
  showAddButton = false,
  addButtonLabel = "Add",
  onAddClick,
  addButtonClassName = "",
  className = "",
  contentClassName = "",
  titleClassName = "",
  breadcrumbClassName = "",
  inlineBreadcrumb = true,
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const getTrail = (): Crumb[] => {
    for (const item of navItems) {
      if (item.path === location.pathname) return [{ label: pageTitle, current: true }];
      for (const subItem of item.subItems || []) {
        if (subItem.path === location.pathname) {
          return [{ label: item.name }, { label: subItem.name, current: true }];
        }
        const nestedItem = subItem.subItems?.find((nested) => nested.path === location.pathname);
        if (nestedItem) {
          return [{ label: item.name }, { label: subItem.name }, { label: nestedItem.name, current: true }];
        }
      }
    }
    return [{ label: pageTitle, current: true }];
  };

  const trail = getTrail();
  const handleBack = () => onBack ? onBack() : navigate(-1);

  return (
    <div className={`page-breadcrumb ${inlineBreadcrumb ? "is-inline" : "is-stacked"} ${className}`.trim()}>
      <div className={`page-breadcrumb__content ${contentClassName}`.trim()}>
        <div className="page-breadcrumb__trail-wrap">
          {showBackButton && (
            <button type="button" className="page-breadcrumb__back" onClick={handleBack} aria-label="Go back">
              <ArrowLeft size={18} strokeWidth={1.8} />
            </button>
          )}
          <nav className={`page-breadcrumb__trail ${breadcrumbClassName}`.trim()} aria-label="Breadcrumb">
            <ol>
              <li>
                <Link to="/" className="page-breadcrumb__link"><FolderClosed size={17} />Home</Link>
              </li>
              {trail.map((crumb) => (
                <li key={`${crumb.label}-${crumb.current ? "current" : "parent"}`}>
                  <ChevronRight className="page-breadcrumb__separator" size={16} />
                  <span className={crumb.current ? `page-breadcrumb__current ${titleClassName}`.trim() : "page-breadcrumb__link"}>
                    {crumb.current ? <CircleDot size={16} /> : <FolderClosed size={17} />}
                    {crumb.current ? pageTitle : crumb.label}
                  </span>
                </li>
              ))}
            </ol>
          </nav>
        </div>
        {showAddButton && <AddButton onClick={onAddClick} label={addButtonLabel} className={`h-9 ${addButtonClassName}`.trim()} />}
      </div>
    </div>
  );
};

export default PageBreadcrumb;
