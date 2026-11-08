import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router";
import { CircleHelp } from "lucide-react";
import RecordDetailDrawer from "../components/common/RecordDetailDrawer";
import { t } from "../i18n/i18n";
import HelpContent from "./HelpContent";
import { findHelpTopic } from "./index";

// The header's Help button (backlog 8.1): the current page's help in a side panel, without leaving the page.
// F1 opens and closes it too.

const ICON_BUTTON_CLASS =
  "flex items-center justify-center w-10 h-10 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800";

const HelpButton = () => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const topic = findHelpTopic(pathname);
  const close = useCallback(() => setOpen(false), []);

  // Another page, another help: close the panel when the page changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "F1") {
        event.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t("Help for this page")} title={`${t("Help for this page")} (F1)`} className={ICON_BUTTON_CLASS}>
        <CircleHelp className="w-5 h-5" />
      </button>
      {/* In document.body: the header's styling would otherwise clip a fixed panel to the header's own box */}
      {createPortal(
      <RecordDetailDrawer
        isOpen={open}
        onClose={close}
        title={topic ? topic.title : t("Help")}
        subtitle={topic ? `${t("Help")} · ${topic.module}` : undefined}
      >
        {topic ? (
          <HelpContent topic={topic} onNavigate={close} />
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-300">{t("There is no help for this page yet.")}</p>
        )}
        <div className="mt-8 border-t border-gray-200 pt-4 dark:border-gray-700">
          <Link
            to={topic ? `/help/${topic.id}` : "/help"}
            onClick={close}
            className="text-sm font-medium text-brand-500 hover:underline dark:text-brand-400"
          >
            {t("Open the Help Center: user manual, flows and search")}
          </Link>
        </div>
      </RecordDetailDrawer>,
      document.body,
      )}
    </>
  );
};

export default HelpButton;
