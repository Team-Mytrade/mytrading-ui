import React from 'react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ApprovalDesk from './ApprovalDesk';

// Leave approvals (sidebar "Leave Approvals"); regularization and on-duty have their own desks
const AttendanceApprovalRequestPage: React.FC = () => (
  <>
    <PageMeta title="Leave Approvals" description="Approve or reject employees' leave requests" />
    <PageBreadcrumb pageTitle="Leave Approvals" />
    <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200">
      <ApprovalDesk kind="leave" />
    </div>
  </>
);

export default AttendanceApprovalRequestPage;
