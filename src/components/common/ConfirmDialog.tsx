import React, { useEffect, useRef } from "react";
import {
    ExclamationTriangleIcon,
    TrashIcon,
    InformationCircleIcon,
    CheckCircleIcon,
    XMarkIcon,
} from "@heroicons/react/24/outline";

export type ConfirmDialogVariant = "danger" | "warning" | "info" | "success";

interface ConfirmDialogProps {
    isOpen: boolean;
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: ConfirmDialogVariant;
    onConfirm: () => void;
    onCancel: () => void;
}

const variantConfig: Record<
    ConfirmDialogVariant,
    {
        icon: React.ReactNode;
        iconBg: string;
        confirmBtn: string;
    }
> = {
    danger: {
        icon: <TrashIcon className="h-6 w-6 text-red-600" />,
        iconBg: "bg-red-100",
        confirmBtn:
            "bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white",
    },
    warning: {
        icon: <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />,
        iconBg: "bg-yellow-100",
        confirmBtn:
            "bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-400 text-white",
    },
    info: {
        icon: <InformationCircleIcon className="h-6 w-6 text-blue-600" />,
        iconBg: "bg-blue-100",
        confirmBtn:
            "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white",
    },
    success: {
        icon: <CheckCircleIcon className="h-6 w-6 text-green-600" />,
        iconBg: "bg-green-100",
        confirmBtn:
            "bg-green-600 hover:bg-green-700 focus:ring-green-500 text-white",
    },
};

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "danger",
    onConfirm,
    onCancel,
}) => {
    const cancelBtnRef = useRef<HTMLButtonElement>(null);

    // Focus cancel button when dialog opens (best practice for destructive dialogs)
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => cancelBtnRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCancel();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    const config = variantConfig[variant];

    const defaultTitle =
        variant === "danger"
            ? "Confirm Delete"
            : variant === "warning"
                ? "Are you sure?"
                : variant === "success"
                    ? "Confirm Action"
                    : "Confirm";

    return (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onCancel}
            />

            {/* Dialog Panel */}
            <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-fade-in">
                {/* Close button */}
                <button
                    onClick={onCancel}
                    className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                    aria-label="Close dialog"
                >
                    <XMarkIcon className="h-5 w-5" />
                </button>

                <div className="p-6">
                    {/* Icon + Title */}
                    <div className="flex items-start gap-4">
                        <div
                            className={`flex-shrink-0 w-12 h-12 rounded-full ${config.iconBg} flex items-center justify-center`}
                        >
                            {config.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3
                                id="confirm-dialog-title"
                                className="text-lg font-semibold text-gray-900"
                            >
                                {title || defaultTitle}
                            </h3>
                            <p className="mt-1 text-sm text-gray-600 leading-relaxed">
                                {message}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-200">
                    <button
                        ref={cancelBtnRef}
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-300 transition-colors"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${config.confirmBtn}`}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;
