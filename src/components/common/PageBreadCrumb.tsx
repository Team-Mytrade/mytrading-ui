import { useContext } from "react";
import { CircleDot, ChevronRight, FolderClosed, ArrowLeft, House } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { filterNavItems, navItems } from "../../layout/AppSidebar";
import { AuthContext } from "../../context/AuthContext";
import { AddButton } from "./AddButton";
import "../../styles/PageBreadCrumb.css";

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
  actions?: React.ReactNode;
}

// `to`: where a parent crumb leads (the module's or group's first page the user may open)
type Crumb = { label: string; current?: boolean; to?: string };

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
  actions,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { access } = useContext(AuthContext);

  // Clicking a module (or group) crumb opens its first page this user may see, as the module rail does
  const firstPage = (moduleName: string, groupName?: string): string | undefined => {
    const module = filterNavItems(navItems, access).find((nav) => nav.name === moduleName);
    const items = groupName ? module?.subItems?.find((sub) => sub.name === groupName)?.subItems : module?.subItems;
    const first = items?.[0];
    if (!first) return undefined;
    return first.path || ("subItems" in first ? first.subItems?.[0]?.path : undefined);
  };

  const getTrail = (): Crumb[] => {
    for (const item of navItems) {
      if (item.path === location.pathname) return [{ label: pageTitle, current: true }];
      for (const subItem of item.subItems || []) {
        if (subItem.path === location.pathname) {
          return [{ label: item.name, to: firstPage(item.name) }, { label: subItem.name, current: true }];
        }
        const nestedItem = subItem.subItems?.find((nested) => nested.path === location.pathname);
        if (nestedItem) {
          return [
            { label: item.name, to: firstPage(item.name) },
            { label: subItem.name, to: firstPage(item.name, subItem.name) },
            { label: nestedItem.name, current: true },
          ];
        }
      }
    }
    return [{ label: pageTitle, current: true }];
  };

  const trail = getTrail();
  // On a page opened directly (after sign-in, a bookmark, a new tab) there is no earlier page in the app,
  // and navigate(-1) did nothing, so Back looked dead; it then goes to the Command Center instead.
  const handleBack = () => {
    if (onBack) return onBack();
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (historyIndex > 0) navigate(-1);
    else navigate("/");
  };

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
                <Link to="/" className="page-breadcrumb__home" aria-label="Go to dashboard" title="Go to dashboard">
                  <House size={17} />
                </Link>
              </li>
              {trail.map((crumb) => (
                <li key={`${crumb.label}-${crumb.current ? "current" : "parent"}`} className={crumb.current ? "is-current" : undefined}>
                  <ChevronRight className="page-breadcrumb__separator" size={16} />
                  {!crumb.current && crumb.to ? (
                    <Link to={crumb.to} className="page-breadcrumb__link" title={`Go to ${crumb.label}`}>
                      <FolderClosed size={17} />
                      <span className="page-breadcrumb__label">{crumb.label}</span>
                    </Link>
                  ) : (
                    <span className={crumb.current ? `page-breadcrumb__current ${titleClassName}`.trim() : "page-breadcrumb__link"} title={crumb.current ? undefined : crumb.label}>
                      {crumb.current ? <CircleDot size={16} /> : <FolderClosed size={17} />}
                      <span className="page-breadcrumb__label">{crumb.current ? pageTitle : crumb.label}</span>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </div>
        {(actions || showAddButton) && (
          <div className="page-breadcrumb__actions">
            {actions || <AddButton onClick={onAddClick} label={addButtonLabel} className={`h-9 ${addButtonClassName}`.trim()} />}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageBreadcrumb;
