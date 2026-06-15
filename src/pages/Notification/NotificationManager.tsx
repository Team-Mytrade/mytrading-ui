import React, { createContext, useContext, useState, useCallback } from "react";

type NotificationType = "success" | "error" | "info" | "warning";

interface Notification {
  id: number;
  type: NotificationType;
  message: string;
}

interface NotificationContextType {
  notify: (type: NotificationType, message: string) => void;
}

// Create context
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Hook
export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within NotificationProvider");
  }
  return context;
};

// Main component
export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Add new notification
  const notify = useCallback((type: NotificationType, message: string) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, type, message }]);

    // Auto-remove after 4 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  const remove = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Color styles
  const getStyles = (type: NotificationType) => {
    switch (type) {
      case "success":
        return "bg-green-500 text-white";
      case "error":
        return "bg-red-500 text-white";
      case "info":
        return "bg-blue-500 text-white";
      case "warning":
        return "bg-yellow-500 text-white";
      default:
        return "";
    }
  };

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}

      {/* Toast container */}
      <div className="fixed top-4 right-4 z-50 space-y-2 w-80">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`flex justify-between items-center px-4 py-3 rounded shadow ${getStyles(n.type)}`}
          >
            <span className="text-sm">{n.message}</span>
            <button onClick={() => remove(n.id)} className="ml-4 text-lg font-bold">
              ×
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
