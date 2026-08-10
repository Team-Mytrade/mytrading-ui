import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/outline";

export type PaginatedPopupTab = {
  label: string;
  fields: React.ReactNode[];
};

type PaginatedPopupProps = {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  submitLabel?: string;
  submitting?: boolean;
  previousLabel?: string;
  nextLabel?: string;
  cancelLabel?: string;
  maxWidthClassName?: string;
  itemsPerPage?: number;
  fields?: React.ReactNode[];
  tabs?: PaginatedPopupTab[];
};

const PaginatedPopup: React.FC<PaginatedPopupProps> = ({
  isOpen,
  title,
  subtitle,
  onClose,
  onSubmit,
  submitLabel = "Save",
  submitting = false,
  previousLabel = "Previous",
  nextLabel = "Next",
  cancelLabel = "Cancel",
  maxWidthClassName = "max-w-3xl",
  itemsPerPage = 6,
  fields = [],
  tabs,
}) => {
  const [page, setPage] = useState(0);
  const formRef = useRef<HTMLFormElement | null>(null);
  const allowSubmitRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setPage(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const pages = useMemo<PaginatedPopupTab[]>(() => {
    if (tabs && tabs.length > 0) {
      return tabs;
    }

    const chunks: React.ReactNode[][] = [];
    for (let index = 0; index < fields.length; index += itemsPerPage) {
      chunks.push(fields.slice(index, index + itemsPerPage));
    }

    return (chunks.length > 0 ? chunks : [[]]).map((chunk, index) => ({
      label: `Step ${index + 1}`,
      fields: chunk,
    }));
  }, [fields, itemsPerPage, tabs]);

  if (!isOpen) return null;

  const isLastPage = page === pages.length - 1;
  const currentPage = pages[page] || { label: `Step ${page + 1}`, fields: [] };
  const currentPageFields = currentPage.fields;

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (!allowSubmitRef.current) {
      event.preventDefault();
      return;
    }

    allowSubmitRef.current = false;
    onSubmit?.(event);
  };

  const handleFinalSubmitClick = () => {
    if (submitting) return;

    allowSubmitRef.current = true;
    formRef.current?.requestSubmit();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 p-3 backdrop-blur-sm sm:items-center">
      <div
        className={`mx-auto my-6 flex w-full flex-col overflow-hidden rounded-xl bg-white shadow-xl ${maxWidthClassName}`}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {pages.length > 1 && (
          <div className="border-b border-gray-100 px-5 pt-3">
            <div className="flex flex-wrap gap-2">
              {pages.map((tab, index) => (
                <button
                  key={`${tab.label}-${index}`}
                  type="button"
                  onClick={() => setPage(index)}
                  className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                    index === page ? "bg-cyan-50 text-cyan-700" : "text-slate-400 hover:text-slate-600"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <form ref={formRef} onSubmit={handleFormSubmit} noValidate className="flex flex-col">
          <div className="px-5 py-4">
            <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2">
              {currentPageFields.map((field, index) => (
                <React.Fragment key={index}>{field}</React.Fragment>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs font-medium text-gray-500">
              {currentPage.label} • {page + 1} of {pages.length}
            </div>

            <div className="flex flex-col justify-end gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={page === 0}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {previousLabel}
              </button>
              {isLastPage ? (
                <button
                  type="button"
                  onClick={handleFinalSubmitClick}
                  disabled={submitting}
                  className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-cyan-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? "Saving..." : submitLabel}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pages.length - 1, current + 1))}
                  className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-cyan-700 hover:to-blue-700"
                >
                  {nextLabel}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default PaginatedPopup;
