import React, { useEffect, useRef } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl" | "full";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    subtitle?: string;
    icon?: React.ReactNode;
    size?: ModalSize;
    children: React.ReactNode;
    footer?: React.ReactNode;
    /** Whether clicking the backdrop closes the modal (default: true) */
    closeOnBackdrop?: boolean;
    /** Custom class for the modal panel */
    className?: string;
}

const sizeClasses: Record<ModalSize, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
    full: "max-w-full mx-4",
};

const Modal: React.FC<ModalProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    icon,
    size = "lg",
    children,
    footer,
    closeOnBackdrop = true,
    className = "",
}) => {
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[999] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? "modal-title" : undefined}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={closeOnBackdrop ? onClose : undefined}
            />

            {/* Modal Panel */}
            <div
                ref={panelRef}
                className={`
          relative bg-white rounded-xl shadow-2xl w-full ${sizeClasses[size]}
          flex flex-col max-h-[90vh] overflow-hidden
          animate-modal-slide-in
          ${className}
        `}
            >
                {/* Header */}
                {(title || icon) && (
                    <div className="flex items-start justify-between px-6 py-5 border-b border-gray-200 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            {icon && (
                                <div className="flex-shrink-0 p-2 bg-cyan-50 rounded-lg">
                                    {icon}
                                </div>
                            )}
                            <div>
                                {title && (
                                    <h2
                                        id="modal-title"
                                        className="text-lg font-semibold text-gray-900"
                                    >
                                        {title}
                                    </h2>
                                )}
                                {subtitle && (
                                    <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors ml-4"
                            aria-label="Close modal"
                        >
                            <XMarkIcon className="h-5 w-5" />
                        </button>
                    </div>
                )}

                {/* If no header, still show close button */}
                {!title && !icon && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors z-10"
                        aria-label="Close modal"
                    >
                        <XMarkIcon className="h-5 w-5" />
                    </button>
                )}

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="flex-shrink-0 border-t border-gray-200 bg-gray-50 px-6 py-4">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;
