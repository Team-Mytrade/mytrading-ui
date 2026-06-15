import React, { useEffect, useRef } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

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
  iconBg = "bg-cyan-100",
  confirmBtnClass = "bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500 text-white",
}) => {
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isPopupOpen) {
      setTimeout(() => confirmBtnRef.current?.focus(), 50);
    }
  }, [isPopupOpen]);

  useEffect(() => {
    if (!isPopupOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isPopupOpen]);

  if (!isPopupOpen) return null;

  const handleCancel = () => {
    setIsPopupOpen(false);
    onCancel?.();
  };

  const handleConfirm = () => {
    setIsPopupOpen(false);
    onConfirm?.();
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dynamic-popup-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-fade-in">

        {/* Close ✕ */}
        <button
          onClick={handleCancel}
          className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        {/* Body */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* Icon bubble */}
            <div
              className={`flex-shrink-0 w-12 h-12 rounded-full ${iconBg} flex items-center justify-center`}
            >
              {icon}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <h3
                id="dynamic-popup-title"
                className="text-lg font-semibold text-gray-900"
              >
                {innerText}
              </h3>
              {subText && (
                <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                  {subText}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
          {cancelLabel && (
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 transition-colors"
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={handleConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${confirmBtnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DynamicPopup;