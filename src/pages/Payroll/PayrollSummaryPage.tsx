import React from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import SalarySummaryTab from "./SalarySummaryTab";

const PayrollSummaryPage: React.FC = () => {
    return (
        <>
            <PageMeta title="Payroll Summary" description="Overview of company payroll metrics and department summaries" />
            <PageBreadcrumb pageTitle="Payroll Summary" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-8 space-y-6">
                <SalarySummaryTab />
            </div>
        </>
    );
};

export default PayrollSummaryPage;
