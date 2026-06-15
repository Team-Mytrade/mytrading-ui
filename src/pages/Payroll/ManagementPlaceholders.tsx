import React from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => {
    return (
        <>
            <PageMeta title={title} description={`${title} Page`} />
            <PageBreadcrumb pageTitle={title} />
            <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100 min-h-[60vh] flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6 text-3xl">
                    <i className="fas fa-tools"></i>
                </div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">{title} Under Development</h1>
                <p className="text-gray-500 max-w-md">
                    We are working hard to bring you the best experience. This management module will be available soon.
                </p>
            </div>
        </>
    );
};

import LeaveManagementPage from "./LeaveManagementPage";
import DocumentManagementPage from "./DocumentManagementPage";
import PerformanceManagementPage from "./PerformanceManagementPage";
import ItDeclarationPage from "./ItDeclarationPage";
import ExitManagementPage from "./ExitManagementPage";

export { LeaveManagementPage, DocumentManagementPage, PerformanceManagementPage, ItDeclarationPage, ExitManagementPage };
export const AttendancePage = () => <PlaceholderPage title="Attendance Management" />;
