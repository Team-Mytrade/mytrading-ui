import { Link, useLocation, useNavigate } from "react-router";
import { navItems } from "../../layout/AppSidebar";
import { AddButton } from "./AddButton";

interface BreadcrumbProps {
  pageTitle: string;
  onBack?: () => void;
  showBackButton?: boolean;
  showAddButton?: boolean;
  addButtonLabel?: string;
  onAddClick?: () => void;
  addButtonClassName?: string;
}

const PageBreadcrumb: React.FC<BreadcrumbProps> = ({
  pageTitle,
  onBack,
  showBackButton = true,
  showAddButton = false,
  addButtonLabel = "Add",
  onAddClick,
  addButtonClassName = "",
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;

  const findBreadcrumb = () => {
    for (const item of navItems) {
      if (item.subItems) {
        const found = item.subItems.find((sub: { path: string }) => sub.path === pathname);
        if (found) {
          return { parent: item.name, child: found.name };
        }
      }

      if (item.path === pathname) {
        return { parent: item.name, child: null };
      }
    }

    return { parent: null, child: null };
  };

  const { parent, child } = findBreadcrumb();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    navigate(-1);
  };

  return (
    <div className="mb-6 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {showBackButton && (
            <button
              onClick={handleBack}
              className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white p-1.5 text-gray-800 shadow-sm transition-all hover:-translate-x-0.5 hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-cyan-800 dark:hover:bg-gray-800 dark:hover:text-cyan-300"
              aria-label="Go back"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
            </button>
          )}
          <h2 className="truncate text-[18px] font-semibold tracking-tight text-cyan-600 dark:text-white/90 sm:text-[20px]">
            {pageTitle}
          </h2>
        </div>

        {showAddButton && (
          <div className="ml-auto shrink-0">
            <AddButton
              onClick={onAddClick}
              label={addButtonLabel}
              className={addButtonClassName}
            />
          </div>
        )}
      </div>

      <nav className="max-w-full overflow-x-auto pl-11">
        <ol className="flex items-center gap-2 whitespace-nowrap text-sm font-medium text-gray-500 dark:text-gray-400">
          <li>
            <Link
              className="inline-flex items-center gap-1.5 transition-colors hover:text-cyan-600 dark:hover:text-cyan-400"
              to="/"
            >
              Home
            </Link>
          </li>

          <li className="text-gray-500 dark:text-gray-400">{">"}</li>

          {parent && (
            <>
              <li>{parent}</li>
              <li className="text-gray-500 dark:text-gray-400">{">"}</li>
            </>
          )}

          <li className="text-cyan-600 dark:text-white/90">
            {child || pageTitle}
          </li>
        </ol>
      </nav>
    </div>
  );
};

export default PageBreadcrumb;
