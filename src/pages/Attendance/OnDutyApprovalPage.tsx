import { t } from "../../i18n/i18n";
import React from 'react';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import PageMeta from '../../components/common/PageMeta';
import ApprovalDesk from './ApprovalDesk';

const OnDutyApprovalPage: React.FC = () => (
  <>
    <PageMeta title={t("On-Duty Approvals")} description="Approve or reject on-duty and work-from-home requests" />
    <PageBreadcrumb pageTitle="On-Duty Approvals" />
    <div className="max-w-6xl mx-auto pb-6 animate-in fade-in duration-200">
      <ApprovalDesk kind="request" />
    </div>
  </>
);

export default OnDutyApprovalPage;
