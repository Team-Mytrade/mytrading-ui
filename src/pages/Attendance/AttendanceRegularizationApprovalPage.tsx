import React from 'react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ApprovalDesk from './ApprovalDesk';

const AttendanceRegularizationApprovalPage: React.FC = () => (
  <>
    <PageMeta title="Regularization Approvals" description="Approve or reject attendance regularization requests" />
    <PageBreadcrumb pageTitle="Regularization Approvals" />
    <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200">
      <ApprovalDesk kind="regularization" />
    </div>
  </>
);

export default AttendanceRegularizationApprovalPage;
