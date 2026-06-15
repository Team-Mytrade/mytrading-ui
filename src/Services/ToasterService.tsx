import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";

interface ToastOptions {
  message: string;
  description?: string;
  type?: "success" | "error" | "warning" | "info";
  duration?: number;
}

let toastContainer: HTMLDivElement | null = null;

const Toast: React.FC<ToastOptions & { onClose: () => void }> = ({
  message,
  description,
  type = "info",
  duration = 3000,
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  const colorConfig = {
    success: {
      bg: "bg-white",
      border: "border-green-500",
      iconBg: "bg-green-100",
      icon: CheckCircleIcon,
      iconColor: "text-green-600",
      titleColor: "text-green-800",
      messageColor: "text-gray-600",
      progressBg: "bg-green-100",
      progressFill: "bg-green-500",
    },
    error: {
      bg: "bg-white",
      border: "border-red-500",
      iconBg: "bg-red-100",
      icon: XCircleIcon,
      iconColor: "text-red-600",
      titleColor: "text-red-800",
      messageColor: "text-gray-600",
      progressBg: "bg-red-100",
      progressFill: "bg-red-500",
    },
    warning: {
      bg: "bg-white",
      border: "border-amber-500",
      iconBg: "bg-amber-100",
      icon: ExclamationTriangleIcon,
      iconColor: "text-amber-600",
      titleColor: "text-amber-800",
      messageColor: "text-gray-600",
      progressBg: "bg-amber-100",
      progressFill: "bg-amber-500",
    },
    info: {
      bg: "bg-white",
      border: "border-blue-500",
      iconBg: "bg-blue-100",
      icon: InformationCircleIcon,
      iconColor: "text-blue-600",
      titleColor: "text-blue-800",
      messageColor: "text-gray-600",
      progressBg: "bg-blue-100",
      progressFill: "bg-blue-500",
    },
  };

  const config = colorConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 16);

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, duration);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`
        fixed top-5 right-5 z-[9999] w-96 max-w-[calc(100vw-2rem)]
        transform transition-all duration-300 ease-out
        ${isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
      `}
    >
      <div className={`
        relative overflow-hidden rounded-lg shadow-lg border-l-4 ${config.border}
        ${config.bg}
      `}>
        {/* Content */}
        <div className="flex items-start gap-3 p-4 pb-3">
          {/* Icon */}
          <div className={`flex-shrink-0 rounded-lg p-1.5 ${config.iconBg}`}>
            <Icon className={`h-5 w-5 ${config.iconColor}`} />
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0">
            <h4 className={`text-sm font-semibold ${config.titleColor} mb-0.5`}>
              {message}
            </h4>
            {description && (
              <p className={`text-sm ${config.messageColor}`}>
                {description}
              </p>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={handleClose}
            className="flex-shrink-0 rounded-lg p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar at the bottom */}
        <div className={`relative h-1 ${config.progressBg}`}>
          <div
            className={`absolute left-0 top-0 h-full ${config.progressFill} transition-all duration-75 ease-linear rounded-r-full`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export const ToasterService = {
  notify({ message, description, type = "info", duration = 3000 }: ToastOptions) {
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      document.body.appendChild(toastContainer);
    }

    const toastDiv = document.createElement("div");
    toastContainer.appendChild(toastDiv);

    const root = createRoot(toastDiv);
    const handleClose = () => {
      root.unmount();
      toastContainer?.removeChild(toastDiv);
    };
    root.render(
      <Toast 
        message={message} 
        description={description}
        type={type} 
        duration={duration} 
        onClose={handleClose} 
      />
    );
  },

  success(message: string, description?: string, duration?: number) {
    this.notify({ message, description, type: "success", duration });
  },
  
  error(message: string, description?: string, duration?: number) {
    this.notify({ message, description, type: "error", duration });
  },
  
  warning(message: string, description?: string, duration?: number) {
    this.notify({ message, description, type: "warning", duration });
  },
  
  info(message: string, description?: string, duration?: number) {
    this.notify({ message, description, type: "info", duration });
  },
};



// // Success toast with progress bar at bottom
// ToasterService.success("Success", "Activity created successfully.");

// // Error toast
// ToasterService.error("Error", "Failed to connect to server.");

// // Warning toast
// ToasterService.warning("Warning", "Your session will expire soon.");

// // Info toast
// ToasterService.info("Information", "New version is available.");

// // With custom duration
// ToasterService.success("Success", "File uploaded successfully.", 5000);