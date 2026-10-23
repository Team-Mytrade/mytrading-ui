import React from 'react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ApprovalDesk from './ApprovalDesk';

const OnDutyApprovalPage: React.FC = () => (
  <>
    <PageMeta title="On-Duty Approvals" description="Approve or reject on-duty and work-from-home requests" />
    <PageBreadcrumb pageTitle="On-Duty Approvals" />
    <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200 mt-1">
      <ApprovalDesk
        kind="request"
        title="On-Duty & Work-From-Home Desk"
        subtitle="Approved on-duty days count as present; work-from-home days are marked on attendance"
      />
    </div>
  </>
);

export default OnDutyApprovalPage;
