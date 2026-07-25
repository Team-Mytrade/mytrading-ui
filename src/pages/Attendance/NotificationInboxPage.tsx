import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BellIcon,
  CheckCircleIcon,
  EnvelopeIcon,
  EyeIcon,
  FunnelIcon,
  UserIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CurrencyDollarIcon,
  XCircleIcon,
  InboxIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import FilterPopover from "../../components/common/filter";
import {
  ATTENDANCE_NOTIFICATIONS_UPDATED,
  getStoredAttendanceNotifications,
  markAttendanceNotificationAsRead,
  type AttendanceNotificationRecord,
} from "../../utils/attendanceNotifications";

const typeStyles: Record<AttendanceNotificationRecord["type"], string> = {
  ATTENDANCE: "bg-blue-100 text-blue-700",
  LEAVE: "bg-emerald-100 text-emerald-700",
  OVERTIME: "bg-purple-100 text-purple-700",
  PAYROLL: "bg-green-100 text-green-700",
  SYSTEM: "bg-gray-100 text-gray-700",
  VIOLATION: "bg-red-100 text-red-700",
};

const priorityStyles: Record<AttendanceNotificationRecord["priority"], string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-red-100 text-red-700",
};

const typeIcons: Record<AttendanceNotificationRecord["type"], React.ReactNode> = {
  ATTENDANCE: <ClockIcon className="h-4 w-4" />,
  LEAVE: <CalendarIcon className="h-4 w-4" />,
  OVERTIME: <ClockIcon className="h-4 w-4" />,
  PAYROLL: <CurrencyDollarIcon className="h-4 w-4" />,
  SYSTEM: <EnvelopeIcon className="h-4 w-4" />,
  VIOLATION: <ExclamationTriangleIcon className="h-4 w-4" />,
};

const formatDateTime = (value: string) => new Date(value).toLocaleString();

const formatRelativeTime = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return `${diffDays}d ago`;
};

const NotificationInboxPage: React.FC = () => {
  const [notifications, setNotifications] = useState<AttendanceNotificationRecord[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [priorityFilter, setPriorityFilter] = useState("ALL");
  const [selectedNotifications, setSelectedNotifications] = useState<Set<number>>(new Set());

  useEffect(() => {
    const syncNotifications = () => {
      const stored = getStoredAttendanceNotifications().sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setNotifications(stored);
    };

    syncNotifications();
    window.addEventListener(ATTENDANCE_NOTIFICATIONS_UPDATED, syncNotifications);

    return () => {
      window.removeEventListener(ATTENDANCE_NOTIFICATIONS_UPDATED, syncNotifications);
    };
  }, []);

  const filteredNotifications = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return notifications.filter((notification) => {
      const matchesSearch =
        !searchTerm ||
        notification.title.toLowerCase().includes(searchTerm) ||
        notification.message.toLowerCase().includes(searchTerm) ||
        notification.employeeName.toLowerCase().includes(searchTerm);

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "READ" && notification.isRead) ||
        (statusFilter === "UNREAD" && !notification.isRead);

      const matchesType = typeFilter === "ALL" || notification.type === typeFilter;
      const matchesPriority = priorityFilter === "ALL" || notification.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesType && matchesPriority;
    });
  }, [notifications, search, statusFilter, typeFilter, priorityFilter]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const readCount = notifications.filter((n) => n.isRead).length;
  const highPriorityCount = notifications.filter((n) => n.priority === "HIGH" && !n.isRead).length;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setPriorityFilter("ALL");
    setSelectedNotifications(new Set());
  };

  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(n => !n.isRead && n.id);
    for (const notification of unreadNotifications) {
      await markAttendanceNotificationAsRead(notification.id!);
    }
    const stored = getStoredAttendanceNotifications();
    setNotifications(stored);
    setSelectedNotifications(new Set());
  };

  const markSelectedAsRead = async () => {
    for (const id of selectedNotifications) {
      await markAttendanceNotificationAsRead(id);
    }
    const stored = getStoredAttendanceNotifications();
    setNotifications(stored);
    setSelectedNotifications(new Set());
  };

  const toggleSelectNotification = (id: number) => {
    const newSelected = new Set(selectedNotifications);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedNotifications(newSelected);
  };

  const selectAllUnread = () => {
    const unreadIds = notifications.filter(n => !n.isRead && n.id).map(n => n.id!);
    setSelectedNotifications(new Set(unreadIds));
  };

  const hasActiveFilters = search !== "" || statusFilter !== "ALL" || typeFilter !== "ALL" || priorityFilter !== "ALL";
  const hasSelected = selectedNotifications.size > 0;

  // Get unique types and priorities for filters
  const uniqueTypes = [...new Set(notifications.map(n => n.type))];
  const uniquePriorities = [...new Set(notifications.map(n => n.priority))];

  return (
    <>
      <PageMeta title="Notification Inbox" description="View all attendance notifications" />
      <PageBreadcrumb pageTitle="Notification Inbox" />

      <div className="max-w-7xl mx-auto p-6">
        {/* Header Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl border border-blue-100 p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Total Notifications</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{notifications.length}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <BellIcon className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-white rounded-xl border border-amber-100 p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Unread</p>
                <p className="text-3xl font-bold text-amber-600 mt-1">{unreadCount}</p>
              </div>
              <div className="h-12 w-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <EnvelopeIcon className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-emerald-50 to-white rounded-xl border border-emerald-100 p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">Read</p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">{readCount}</p>
              </div>
              <div className="h-12 w-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <CheckCircleIcon className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-white rounded-xl border border-red-100 p-5 shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">High Priority</p>
                <p className="text-3xl font-bold text-red-600 mt-1">{highPriorityCount}</p>
              </div>
              <div className="h-12 w-12 bg-red-100 rounded-xl flex items-center justify-center">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search notifications..."
                className="pl-10 pr-4 py-2.5 w-full border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {hasSelected && (
              <button
                onClick={markSelectedAsRead}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-sm"
              >
                <CheckCircleIcon className="h-4 w-4" />
                <span className="text-sm font-medium">Mark Selected ({selectedNotifications.size})</span>
              </button>
            )}

            {unreadCount > 0 && !hasSelected && (
              <>
                <button
                  onClick={selectAllUnread}
                  className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all flex items-center gap-2"
                >
                  <InboxIcon className="h-4 w-4" />
                  <span className="text-sm font-medium">Select Unread</span>
                </button>
                <button
                  onClick={markAllAsRead}
                  className="px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-sm"
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  <span className="text-sm font-medium">Mark All Read</span>
                </button>
              </>
            )}

            <FilterPopover
              title="Filter Notifications"
              buttonLabel="Filter"
              onReset={() => {
                setStatusFilter("ALL");
                setTypeFilter("ALL");
                setPriorityFilter("ALL");
              }}
              showFooter={true}
            >
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="ALL">All Notifications</option>
                    <option value="UNREAD">Unread Only</option>
                    <option value="READ">Read Only</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="ALL">All Types</option>
                    {uniqueTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Priority</label>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="ALL">All Priorities</option>
                    {uniquePriorities.map(priority => (
                      <option key={priority} value={priority}>{priority}</option>
                    ))}
                  </select>
                </div>
              </div>
            </FilterPopover>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 rounded-xl border border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-1"
              >
                <ArrowPathIcon className="h-4 w-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {filteredNotifications.length === 0 ? (
            <div className="py-16 text-center">
              <div className="h-24 w-24 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <BellIcon className="h-12 w-12 text-gray-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No notifications found</h2>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                {search || hasActiveFilters
                  ? "Try adjusting your search or filter criteria to see more results"
                  : "You're all caught up! When new notifications arrive, they'll appear here."}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-6 text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-2"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Notification Items */}
              <div className="divide-y divide-gray-100">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`group relative transition-all duration-200 hover:bg-gray-50 ${notification.isRead ? "bg-white" : "bg-blue-50/30"
                      } ${selectedNotifications.has(notification.id!) ? "ring-2 ring-blue-400 ring-inset" : ""}`}
                  >
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        {/* Checkbox */}
                        <div className="flex-shrink-0 pt-0.5">
                          <input
                            type="checkbox"
                            checked={selectedNotifications.has(notification.id!)}
                            onChange={() => toggleSelectNotification(notification.id!)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </div>

                        {/* Icon */}
                        <div
                          className={`flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center transition-all ${notification.isRead
                            ? "bg-gray-100"
                            : "bg-blue-100 ring-2 ring-blue-200"
                            }`}
                        >
                          {typeIcons[notification.type] || <BellIcon className="h-5 w-5 text-gray-500" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="text-base font-semibold text-gray-900">
                              {notification.title}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${typeStyles[notification.type]}`}>
                              {notification.type}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${priorityStyles[notification.priority]}`}>
                              {notification.priority}
                            </span>
                            {!notification.isRead && (
                              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
                                New
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-2">
                            <span className="inline-flex items-center gap-1.5">
                              <UserIcon className="h-3.5 w-3.5" />
                              {notification.employeeName}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarIcon className="h-3.5 w-3.5" />
                              <span title={formatDateTime(notification.createdAt)}>
                                {formatRelativeTime(notification.createdAt)}
                              </span>
                            </span>
                          </div>

                          <p className="text-sm text-gray-600 line-clamp-2">{notification.message}</p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          {!notification.isRead && notification.id && (
                            <button
                              onClick={() => markAttendanceNotificationAsRead(notification.id!)}
                              className="opacity-0 group-hover:opacity-100 transition-all p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                              title="Mark as read"
                            >
                              <CheckCircleIcon className="h-5 w-5" />
                            </button>
                          )}
                          <Link
                            to={`/notifications/${notification.id}`}
                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="View details"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary Footer */}
              <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-500">
                  Showing <span className="font-medium text-gray-700">{filteredNotifications.length}</span> of{" "}
                  <span className="font-medium text-gray-700">{notifications.length}</span> notifications
                </p>
                {hasSelected && (
                  <button
                    onClick={() => setSelectedNotifications(new Set())}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Deselect All
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationInboxPage;