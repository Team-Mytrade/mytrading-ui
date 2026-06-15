import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeftIcon,
  BellIcon,
  CheckCircleIcon,
  ClockIcon,
  UserIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  TagIcon,
  HashtagIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import {
  ATTENDANCE_NOTIFICATIONS_UPDATED,
  getAttendanceNotificationById,
  markAttendanceNotificationAsRead,
  type AttendanceNotificationRecord,
} from "../../utils/attendanceNotifications";

const typeStyles: Record<AttendanceNotificationRecord["type"], string> = {
  ATTENDANCE: "bg-cyan-100 text-cyan-700",
  LEAVE: "bg-blue-100 text-blue-700",
  OVERTIME: "bg-indigo-100 text-indigo-700",
  PAYROLL: "bg-green-100 text-green-700",
  SYSTEM: "bg-purple-100 text-purple-700",
  VIOLATION: "bg-red-100 text-red-700",
};

const priorityStyles: Record<AttendanceNotificationRecord["priority"], string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  HIGH: "bg-red-100 text-red-700",
};

const channelIcons: Record<string, React.ReactNode> = {
  EMAIL: <EnvelopeIcon className="h-4 w-4" />,
  PUSH: <BellIcon className="h-4 w-4" />,
  SMS: <DevicePhoneMobileIcon className="h-4 w-4" />,
  IN_APP: <BellIcon className="h-4 w-4" />,
  WHATSAPP: <DevicePhoneMobileIcon className="h-4 w-4" />,
};

const typeIcons: Record<AttendanceNotificationRecord["type"], React.ReactNode> = {
  ATTENDANCE: <BellIcon className="h-5 w-5" />,
  LEAVE: <DocumentTextIcon className="h-5 w-5" />,
  OVERTIME: <ClockIcon className="h-5 w-5" />,
  PAYROLL: <CurrencyDollarIcon className="h-5 w-5" />,
  SYSTEM: <EnvelopeIcon className="h-5 w-5" />,
  VIOLATION: <ExclamationTriangleIcon className="h-5 w-5" />,
};

// Missing imports
import { CurrencyDollarIcon } from "@heroicons/react/24/outline";

const formatDateTime = (value: string) => new Date(value).toLocaleString();

const NotificationDetailPage: React.FC = () => {
  const params = useParams();
  const notificationId = Number(params.id);
  const [notification, setNotification] = useState<AttendanceNotificationRecord | null>(null);
  const [isMarkedRead, setIsMarkedRead] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(notificationId)) return;

    const syncNotification = () => {
      const notif = getAttendanceNotificationById(notificationId);
      setNotification(notif);
      if (notif && !notif.isRead && !isMarkedRead) {
        markAttendanceNotificationAsRead(notificationId);
        setIsMarkedRead(true);
      }
    };

    syncNotification();

    window.addEventListener(ATTENDANCE_NOTIFICATIONS_UPDATED, syncNotification);
    return () => {
      window.removeEventListener(ATTENDANCE_NOTIFICATIONS_UPDATED, syncNotification);
    };
  }, [notificationId, isMarkedRead]);

  return (
    <>
      <PageMeta title="Notification Details" description="View notification details" />
      <PageBreadcrumb pageTitle="Notification Details" />

      <div className="max-w-4xl mx-auto p-6">
        {/* Back Button */}
        <div className="mb-6">
          <Link
            to="/notifications"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to Notifications
          </Link>
        </div>

        {!notification ? (
          // Not Found State
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="h-20 w-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BellIcon className="h-10 w-10 text-gray-400" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900">Notification not found</h1>
            <p className="text-sm text-gray-500 mt-2">
              This notification may have been removed or is no longer available.
            </p>
            <Link
              to="/notifications"
              className="inline-flex items-center gap-2 mt-6 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
            >
              <BellIcon className="h-4 w-4" />
              View All Notifications
            </Link>
          </div>
        ) : (
          // Notification Details
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header Section */}
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-cyan-50 to-white">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-full bg-cyan-100 flex items-center justify-center">
                    {typeIcons[notification.type] || <BellIcon className="h-6 w-6 text-cyan-600" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${typeStyles[notification.type]}`}>
                        {notification.type}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${priorityStyles[notification.priority]}`}>
                        {notification.priority} Priority
                      </span>
                      {notification.isRead ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          <CheckCircleIcon className="h-3 w-3 inline mr-1" />
                          Read
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          <BellIcon className="h-3 w-3 inline mr-1" />
                          Unread
                        </span>
                      )}
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">{notification.title}</h1>
                  </div>
                </div>
              </div>
            </div>

            {/* Meta Information */}
            <div className="p-6 border-b border-gray-200 bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-gray-200">
                    <UserIcon className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Employee</p>
                    <p className="text-sm font-medium text-gray-900">{notification.employeeName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-gray-200">
                    <ClockIcon className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Sent Date</p>
                    <p className="text-sm font-medium text-gray-900">{formatDateTime(notification.createdAt)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-gray-200">
                    {channelIcons[notification.channel] || <EnvelopeIcon className="h-4 w-4 text-gray-500" />}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Channel</p>
                    <p className="text-sm font-medium text-gray-900 capitalize">{notification.channel}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-lg border border-gray-200">
                    <TagIcon className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Type</p>
                    <p className="text-sm font-medium text-gray-900">{notification.type}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Message Section */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                <DocumentTextIcon className="h-4 w-4" />
                Message
              </h2>
              <div className="rounded-lg bg-gray-50 p-5 text-sm leading-relaxed text-gray-700 whitespace-pre-wrap border border-gray-200">
                {notification.message}
              </div>
            </div>

            {/* Reference Information */}
            <div className="p-6">
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3 flex items-center gap-2">
                <HashtagIcon className="h-4 w-4" />
                Reference Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-gray-200 p-4 bg-white">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Reference Type
                  </p>
                  <div className="flex items-center gap-2">
                    <TagIcon className="h-4 w-4 text-gray-400" />
                    <p className="text-sm font-medium text-gray-800">
                      {notification.referenceType || "Not provided"}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 bg-white">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Reference ID
                  </p>
                  <div className="flex items-center gap-2">
                    <HashtagIcon className="h-4 w-4 text-gray-400" />
                    <p className="text-sm font-medium text-gray-800">
                      {notification.referenceId ?? "Not provided"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex flex-wrap gap-3">
              <Link
                to="/notifications"
                className="px-4 py-2 bg-gray-600 !text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Back to Inbox
              </Link>
              {!notification.isRead && (
                <button
                  onClick={() => {
                    markAttendanceNotificationAsRead(notification.id!);
                    setIsMarkedRead(true);
                    window.dispatchEvent(new Event(ATTENDANCE_NOTIFICATIONS_UPDATED));
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  Mark as Read
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default NotificationDetailPage;