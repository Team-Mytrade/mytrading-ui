import React, { useEffect, useRef } from "react";
import CloseButton from "./CloseButton";

interface DynamicPopupProps {
  isPopupOpen: boolean;
  setIsPopupOpen: (value: boolean) => void;

  icon: React.ReactNode;
  innerText: string;
  subText?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  iconBg?: string;
  confirmBtnClass?: string;
}

const DynamicPopup: React.FC<DynamicPopupProps> = ({
  isPopupOpen,
  setIsPopupOpen,
  icon,
  innerText,
  subText,
  confirmLabel = "OK",
  cancelLabel,
  onConfirm,
  onCancel,
  iconBg = "bg-cyan-100 dark:bg-cyan-950/50",
  confirmBtnClass = "bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500 text-white",
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  const handleCancel = () => {
    setIsPopupOpen(false);
    onCancel?.();
  };

  const handleConfirm = () => {
    setIsPopupOpen(false);
    onConfirm?.();
  };

  // Keep the latest cancel handler for the Escape key (avoids an old copy being used).
  const cancelRef = useRef(handleCancel);
  cancelRef.current = handleCancel;

  // Focus the main button when the popup opens, so Enter confirms.
  useEffect(() => {
    if (!isPopupOpen) return undefined;
    const timer = window.setTimeout(() => confirmBtnRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [isPopupOpen]);

  // Escape closes the popup.
  useEffect(() => {
    if (!isPopupOpen) return undefined;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelRef.current();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isPopupOpen]);

  if (!isPopupOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dynamic-popup-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleCancel} />

      {/* Panel */}
      <div className="relative mx-4 w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl animate-fade-in dark:bg-gray-900 dark:ring-1 dark:ring-gray-700">
        {/* Close ✕ */}
        <CloseButton onClick={handleCancel} className="absolute right-3 top-3" />

        {/* Body */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* Icon bubble */}
            <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full ${iconBg}`}>
              {icon}
            </div>

            {/* Text */}
            <div className="min-w-0 flex-1 pr-6">
              <h3 id="dynamic-popup-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {innerText}
              </h3>
              {subText && (
                <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{subText}</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-800/60">
          {cancelLabel && (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:focus:ring-offset-gray-900"
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={handleConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${confirmBtnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DynamicPopup;
