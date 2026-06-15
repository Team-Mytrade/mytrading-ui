import { useState, useEffect, useRef, useCallback, type MouseEvent as ReactMouseEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ATTENDANCE_NOTIFICATIONS_UPDATED,
  formatNotificationTime,
  getStoredAttendanceNotifications,
  saveAttendanceNotifications,
  type AttendanceNotificationRecord,
} from "../../utils/attendanceNotifications";
import {
  Bell, Trash2, Clock, AlertCircle, CheckCircle,
  Calendar, Zap, TrendingUp, AlertTriangle, Eye, Inbox,
} from "lucide-react";

type HeaderNotification = {
  id: number;
  user: { name: string; avatar: string };
  title: string;
  message: string;
  type: string;
  time: string;
  read: boolean;
  priority?: "LOW" | "MEDIUM" | "HIGH";
};

const DEFAULT_AVATAR = "/images/user/user-01.jpg";

const getPriorityColor = (priority?: string) => {
  switch (priority) {
    case "HIGH": return "text-red-600 dark:text-red-400";
    case "MEDIUM": return "text-amber-600 dark:text-amber-400";
    case "LOW": return "text-emerald-600 dark:text-emerald-400";
    default: return "text-gray-500 dark:text-gray-400";
  }
};

const getTypeStyles = (type: string) => {
  switch (type) {
    case "attendance": return "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400";
    case "leave": return "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400";
    case "overtime": return "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400";
    case "payroll": return "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400";
    case "violation": return "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400";
    default: return "bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case "attendance": return <Clock className="w-4 h-4" />;
    case "leave": return <Calendar className="w-4 h-4" />;
    case "overtime": return <Zap className="w-4 h-4" />;
    case "payroll": return <TrendingUp className="w-4 h-4" />;
    case "violation": return <AlertTriangle className="w-4 h-4" />;
    default: return <Bell className="w-4 h-4" />;
  }
};

const mapNotificationToHeaderItem = (
  notification: AttendanceNotificationRecord,
  index: number
): HeaderNotification => ({
  id: notification.id ?? Date.parse(notification.createdAt) + index,
  user: {
    name: notification.employeeName || "Employee",
    avatar: DEFAULT_AVATAR,
  },
  title: notification.title,
  message: notification.message,
  type: notification.type.toLowerCase(),
  time: formatNotificationTime(notification.createdAt),
  read: notification.isRead,
  priority: notification.priority,
});

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const syncFromStore = useCallback(() => {
    const stored = getStoredAttendanceNotifications();
    const mapped = stored
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(mapNotificationToHeaderItem);
    setNotifications(mapped);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    syncFromStore();
  }, [syncFromStore]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleNotificationsUpdated = () => syncFromStore();
    window.addEventListener(ATTENDANCE_NOTIFICATIONS_UPDATED, handleNotificationsUpdated);
    return () => window.removeEventListener(ATTENDANCE_NOTIFICATIONS_UPDATED, handleNotificationsUpdated);
  }, [syncFromStore]);

  const updateStoredNotifications = useCallback(
    (updater: (items: AttendanceNotificationRecord[]) => AttendanceNotificationRecord[]) => {
      const next = updater(getStoredAttendanceNotifications());
      saveAttendanceNotifications(next);
      syncFromStore();
    },
    [syncFromStore]
  );

  const markAsRead = useCallback((id: number) => {
    updateStoredNotifications(prev =>
      prev.map(notification =>
        notification.id === id ? { ...notification, isRead: true } : notification
      )
    );
  }, [updateStoredNotifications]);

  const openNotification = useCallback((id: number) => {
    markAsRead(id);
    setIsOpen(false);
    navigate(`/notifications/${id}`);
  }, [markAsRead, navigate]);

  const markAllAsRead = useCallback(() => {
    updateStoredNotifications(prev =>
      prev.map(notification => ({ ...notification, isRead: true }))
    );
  }, [updateStoredNotifications]);

  const deleteNotification = useCallback((id: number, e?: ReactMouseEvent) => {
    if (e) e.stopPropagation();
    updateStoredNotifications(prev => prev.filter(notification => notification.id !== id));
  }, [updateStoredNotifications]);

  const markAsUnread = useCallback((id: number, e?: ReactMouseEvent) => {
    if (e) e.stopPropagation();
    updateStoredNotifications(prev =>
      prev.map(notification =>
        notification.id === id ? { ...notification, isRead: false } : notification
      )
    );
  }, [updateStoredNotifications]);

  const filteredNotifications = notifications.filter(notification => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !notification.read;
    return notification.type === activeTab;
  });

  const tabs = [
    { id: "all", label: "All", count: notifications.length },
    { id: "unread", label: "Unread", count: unreadCount },
    { id: "attendance", label: "Attendance" },
    { id: "leave", label: "Leave" },
    { id: "payroll", label: "Payroll" },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        className="relative flex items-center justify-center w-9 h-9 text-gray-500 transition-all rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-4 px-1 text-[10px] font-semibold !text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-[420px] max-w-[calc(100vw-2rem)] bg-white rounded-xl border border-gray-200 shadow-lg dark:bg-gray-900 dark:border-gray-700 overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:!text-white">Notifications</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{unreadCount} unread</p>
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-5 pt-3 pb-2 overflow-x-auto border-b border-gray-100 dark:border-gray-800 scrollbar-thin">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${activeTab === tab.id
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-300 dark:hover:bg-gray-800"
                  }`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-1.5 text-[10px] text-gray-400">{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Notifications List */}
          <div className="max-h-[460px] overflow-y-auto">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-3 mb-3 bg-gray-100 rounded-xl dark:bg-gray-800">
                  <Inbox className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`group p-4 transition-colors ${!notification.read ? "bg-blue-50/30 dark:bg-blue-900/10" : ""
                      }`}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div
                        className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer ${getTypeStyles(notification.type)}`}
                        onClick={() => openNotification(notification.id)}
                      >
                        {getTypeIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => openNotification(notification.id)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className="text-sm font-medium text-gray-900 dark:!text-white">
                            {notification.title}
                          </p>
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            {notification.time}
                          </span>
                        </div>

                        <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                          {notification.message}
                        </p>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 capitalize">
                            {notification.type}
                          </span>
                          {notification.priority && notification.priority !== "MEDIUM" && (
                            <span className={`text-xs font-medium ${getPriorityColor(notification.priority)}`}>
                              {notification.priority}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Inline Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notification.read ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            className="p-1.5 text-gray-400 rounded hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/20"
                            title="Mark as read"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsUnread(notification.id, e);
                            }}
                            className="p-1.5 text-gray-400 rounded hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-900/20"
                            title="Mark as unread"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id, e);
                          }}
                          className="p-1.5 text-gray-400 rounded hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50">
            <Link
              to="/notifications"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-2 w-full text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              <Eye className="w-4 h-4" />
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
