import React, { useState, useEffect } from "react";
import axios from "axios";
import { FileText, X, Eye, Download } from "lucide-react";
import { motion } from "framer-motion";
import PayslipPreviewModal from "../../components/Payroll/PayslipPreviewModal";

interface MyPayslipsTabProps {
    employeeId: number;
}

const MyPayslipsTab: React.FC<MyPayslipsTabProps> = ({ employeeId }) => {
    const [loading, setLoading] = useState(false);
    const [availableMonths, setAvailableMonths] = useState<any[]>([]);
    
    const [previewMonth, setPreviewMonth] = useState<string | null>(null);
    const [previewData, setPreviewData] = useState<any | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    useEffect(() => {
        if (employeeId) {
            fetchMonths();
        }
    }, [employeeId]);

    const fetchMonths = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`/v1/api/payroll/payslips/employee/avilableMonths/${employeeId}`);
            setAvailableMonths(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error("Failed to load payslip months:", error);
            setAvailableMonths([]);
        } finally {
            setLoading(false);
        }
    };

    const handlePreview = async (month: string) => {
        setPreviewMonth(month);
        setPreviewLoading(true);
        setPreviewData(null);
        try {
            const res = await axios.get(`/v1/api/payroll/payslips/preview/${employeeId}?month=${month}`);
            setPreviewData(res.data);
        } catch (error) {
            console.error("Failed to load payslip preview:", error);
            alert("Failed to load payslip preview details.");
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleDownload = async (month: string) => {
        try {
            const response = await axios.get(`/v1/api/payroll/payslips/download`, {
                params: { employeeId, month },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Payslip_${month}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error downloading payslip:", error);
            alert("Failed to download payslip.");
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <FileText size={20} className="text-cyan-600" /> My Payslips
                </h2>
            </div>

            <div className="p-6">
                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600" />
                    </div>
                ) : availableMonths.length === 0 ? (
                    <div className="text-center py-12">
                        <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500 font-medium">No payslips available yet.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {availableMonths.map((item, idx) => (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                key={idx} 
                                className="flex flex-col p-5 rounded-xl border border-gray-100 hover:border-cyan-200 hover:bg-cyan-50/30 transition-colors shadow-sm"
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-3 bg-cyan-100 rounded-lg">
                                        <FileText size={24} className="text-cyan-600" />
                                    </div>
                                    <div>
                                        <p className="text-lg font-semibold text-gray-900">{item.payrollMonth}</p>
                                        <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Generated Payslip</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 mt-auto">
                                    <button
                                        onClick={() => handlePreview(item.payrollMonth)}
                                        className="w-full py-2 bg-white border border-cyan-200 hover:bg-cyan-50 text-cyan-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                    >
                                        <Eye size={16} /> Preview
                                    </button>
                                    <button
                                        onClick={() => handleDownload(item.payrollMonth)}
                                        className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                                    >
                                        <Download size={16} /> PDF
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>

            <PayslipPreviewModal
                isOpen={!!previewMonth}
                onClose={() => setPreviewMonth(null)}
                payslipData={previewData}
                month={previewMonth || ""}
                loading={previewLoading}
                onDownload={previewMonth ? () => handleDownload(previewMonth) : undefined}
            />
        </div>
    );
};

export default MyPayslipsTab;
