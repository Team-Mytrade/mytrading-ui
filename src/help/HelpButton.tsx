import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router";
import { ArrowRight, BookOpen, CircleHelp } from "lucide-react";
import RecordDetailDrawer from "../components/common/RecordDetailDrawer";
import { t } from "../i18n/i18n";
import HelpContent from "./HelpContent";
import { findHelpTopic } from "./index";
import { localizeTopic, useHelpTranslation } from "./translations";

// The header's Help button (backlog 8.1): the current page's help in a side panel, without leaving the page.
// F1 opens and closes it too.

const ICON_BUTTON_CLASS =
  "flex items-center justify-center w-10 h-10 text-gray-500 transition-colors rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800";

const HelpButton = () => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const topic = findHelpTopic(pathname);
  const translation = useHelpTranslation();
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
        title={topic ? localizeTopic(topic, translation).topic.title : t("Help")}
        subtitle={topic ? `${t("Help")} · ${t(topic.module)}` : undefined}
      >
        {topic ? (
          <HelpContent topic={topic} onNavigate={close} />
        ) : (
          <p className="text-sm text-gray-700 dark:text-gray-300">{t("There is no help for this page yet.")}</p>
        )}
        <Link
          to={topic ? `/help/${topic.id}` : "/help"}
          onClick={close}
          className="group mt-8 flex items-center gap-3 rounded-xl border border-cyan-200 bg-cyan-50/60 p-4 transition hover:border-cyan-400 hover:bg-cyan-50 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:hover:bg-cyan-500/15"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500 text-white">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-800 dark:text-gray-100">{t("Help Center")}</span>
            <span className="block text-xs text-slate-500 dark:text-gray-400">{t("User manual, business flows and search")}</span>
          </span>
          <ArrowRight className="h-4 w-4 text-cyan-500 transition group-hover:translate-x-0.5 rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      </RecordDetailDrawer>,
      document.body,
      )}
    </>
  );
};

export default HelpButton;
