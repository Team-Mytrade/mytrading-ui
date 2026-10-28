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
  Bell, Trash2, Clock, AlertCircle, CheckCircle, ClipboardCheck, Package, Receipt, Wallet,
  Calendar, Zap, TrendingUp, AlertTriangle, Eye, Inbox,
} from "lucide-react";
import { InboxItem, NOTIFICATIONS_CHANGED, notificationsApi } from "../../notifications/notificationsApi";
import { formatDateTime } from "../../company/format";

// Server items (approvals, stock, invoices) and the attendance module's own items kept in the browser
type HeaderNotification = {
  key: string;
  id: number;
  source: "server" | "attendance";
  title: string;
  message: string;
  type: string;
  time: string;
  sortTime: number;
  read: boolean;
  resolved?: boolean;
  priority?: "LOW" | "MEDIUM" | "HIGH";
  link?: string | null;
};

// The unread count is checked this often (and whenever the window regains focus)
const POLL_MS = 60_000;

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
    case "approval": return "bg-cyan-50 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-300";
    case "stock": return "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400";
    case "invoice": return "bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400";
    case "payment": return "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400";
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
    case "approval": return <ClipboardCheck className="w-4 h-4" />;
    case "stock": return <Package className="w-4 h-4" />;
    case "invoice": return <Receipt className="w-4 h-4" />;
    case "payment": return <Wallet className="w-4 h-4" />;
    case "attendance": return <Clock className="w-4 h-4" />;
    case "leave": return <Calendar className="w-4 h-4" />;
    case "overtime": return <Zap className="w-4 h-4" />;
    case "payroll": return <TrendingUp className="w-4 h-4" />;
    case "violation": return <AlertTriangle className="w-4 h-4" />;
    default: return <Bell className="w-4 h-4" />;
  }
};

const TYPE_LABELS: Record<string, string> = { approval: "Approval", stock: "Stock", invoice: "Invoice", payment: "Payment", system: "System" };

/** "Just now", "5m ago", "3h ago", then the date and time in the company's format. */
const timeAgo = (iso: string): string => {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "";
  const minutes = Math.floor((Date.now() - at) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ago`;
  return formatDateTime(iso);
};

const fromServer = (item: InboxItem): HeaderNotification => ({
  key: `s-${item.id}`,
  id: item.id,
  source: "server",
  title: item.title,
  message: item.message ?? "",
  type: item.category.toLowerCase(),
  time: timeAgo(item.raisedAt),
  sortTime: Date.parse(item.raisedAt) || 0,
  read: !!item.readAt,
  resolved: item.resolved,
  priority: item.priority ?? undefined,
  link: item.link,
});

const fromAttendance = (notification: AttendanceNotificationRecord, index: number): HeaderNotification => {
  const id = notification.id ?? Date.parse(notification.createdAt) + index;
  return {
    key: `a-${id}`,
    id,
    source: "attendance",
    title: notification.title,
    message: notification.message,
    type: notification.type.toLowerCase(),
    time: formatNotificationTime(notification.createdAt),
    sortTime: Date.parse(notification.createdAt) || 0,
    read: notification.isRead,
    priority: notification.priority,
  };
};

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [serverItems, setServerItems] = useState<HeaderNotification[]>([]);
  const [serverUnread, setServerUnread] = useState(0);
  const [localItems, setLocalItems] = useState<HeaderNotification[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const syncFromStore = useCallback(() => {
    setLocalItems(getStoredAttendanceNotifications().map(fromAttendance));
  }, []);

  // Count only: cheap enough to poll; the list loads when the bell opens
  const refreshCount = useCallback(() => {
    notificationsApi.unreadCount().then(setServerUnread, () => setServerUnread(0));
  }, []);

  const refreshList = useCallback(() => {
    notificationsApi.inbox(false, 30).then((items) => setServerItems(items.map(fromServer)), () => setServerItems([]));
    refreshCount();
  }, [refreshCount]);

  const notifications = [...serverItems, ...localItems].sort((a, b) => b.sortTime - a.sortTime);
  const unreadCount = serverUnread + localItems.filter((n) => !n.read).length;

  useEffect(() => {
    syncFromStore();
    refreshCount();
    const timer = window.setInterval(refreshCount, POLL_MS);
    window.addEventListener("focus", refreshCount);
    window.addEventListener(NOTIFICATIONS_CHANGED, refreshCount);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshCount);
      window.removeEventListener(NOTIFICATIONS_CHANGED, refreshCount);
    };
  }, [syncFromStore, refreshCount]);

  useEffect(() => {
    if (isOpen) refreshList();
  }, [isOpen, refreshList]);

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
      saveAttendanceNotifications(updater(getStoredAttendanceNotifications()));
      syncFromStore();
    },
    [syncFromStore]
  );

  const setServerRead = useCallback((id: number, read: boolean) => {
    setServerItems((items) => items.map((n) => (n.source === "server" && n.id === id ? { ...n, read } : n)));
    notificationsApi.markRead(id, read).then(refreshCount, refreshList);
  }, [refreshCount, refreshList]);

  const setRead = useCallback((n: HeaderNotification, read: boolean) => {
    if (n.source === "server") {
      setServerRead(n.id, read);
    } else {
      updateStoredNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, isRead: read } : item)));
    }
  }, [setServerRead, updateStoredNotifications]);

  const openNotification = useCallback((n: HeaderNotification) => {
    if (!n.read) setRead(n, true);
    setIsOpen(false);
    if (n.source === "server") navigate(n.link || "/");
    else navigate(`/notifications/${n.id}`);
  }, [navigate, setRead]);

  const markAllAsRead = useCallback(() => {
    setServerItems((items) => items.map((n) => ({ ...n, read: true })));
    notificationsApi.markAllRead().then(refreshCount, refreshList);
    updateStoredNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
  }, [refreshCount, refreshList, updateStoredNotifications]);

  const deleteNotification = useCallback((n: HeaderNotification, e?: ReactMouseEvent) => {
    if (e) e.stopPropagation();
    if (n.source === "server") {
      setServerItems((items) => items.filter((item) => item.key !== n.key));
      notificationsApi.dismiss(n.id).then(refreshCount, refreshList);
    } else {
      updateStoredNotifications((prev) => prev.filter((item) => item.id !== n.id));
    }
  }, [refreshCount, refreshList, updateStoredNotifications]);

  const filteredNotifications = notifications.filter((notification) => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !notification.read;
    if (activeTab === "attendance") return notification.source === "attendance";
    return notification.type === activeTab;
  });

  const tabs = [
    { id: "all", label: "All", count: notifications.length },
    { id: "unread", label: "Unread", count: unreadCount },
    { id: "approval", label: "Approvals" },
    { id: "stock", label: "Stock" },
    { id: "invoice", label: "Invoices" },
    { id: "attendance", label: "Attendance" },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        className="relative flex items-center justify-center w-9 h-9 text-gray-500 transition-all rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
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
                    key={notification.key}
                    className={`group p-4 transition-colors ${!notification.read ? "bg-blue-50/30 dark:bg-blue-900/10" : ""
                      }`}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div
                        className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer ${getTypeStyles(notification.type)}`}
                        onClick={() => openNotification(notification)}
                      >
                        {getTypeIcon(notification.type)}
                      </div>

                      {/* Content */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => openNotification(notification)}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p className={`text-sm font-medium ${notification.resolved ? "text-gray-500 dark:text-gray-400" : "text-gray-900 dark:!text-white"}`}>
                            {notification.title}
                          </p>
                          <span className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            {notification.time}
                          </span>
                        </div>

                        {notification.message && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                            {notification.message}
                          </p>
                        )}

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 capitalize">
                            {TYPE_LABELS[notification.type] ?? notification.type}
                          </span>
                          {notification.resolved && (
                            <span className="rounded-full bg-gray-100 px-1.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-800">Done</span>
                          )}
                          {!notification.resolved && notification.priority && notification.priority !== "MEDIUM" && (
                            <span className={`text-xs font-medium ${getPriorityColor(notification.priority)}`}>
                              {notification.priority}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Inline Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        {!notification.read ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRead(notification, true);
                            }}
                            className="p-1.5 text-gray-400 rounded hover:text-emerald-600 hover:bg-emerald-50 dark:hover:text-emerald-400 dark:hover:bg-emerald-900/20"
                            title="Mark as read"
                            aria-label="Mark as read"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRead(notification, false);
                            }}
                            className="p-1.5 text-gray-400 rounded hover:text-amber-600 hover:bg-amber-50 dark:hover:text-amber-400 dark:hover:bg-amber-900/20"
                            title="Mark as unread"
                            aria-label="Mark as unread"
                          >
                            <AlertCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => deleteNotification(notification, e)}
                          className="p-1.5 text-gray-400 rounded hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/20"
                          title="Delete"
                          aria-label="Delete"
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
              View all attendance notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
