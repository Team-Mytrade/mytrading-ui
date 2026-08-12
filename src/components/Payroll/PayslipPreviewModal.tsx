import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileText, Building, Calendar, User, CreditCard } from 'lucide-react';

interface PayslipPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    payslipData: any | null;
    month: string;
    onDownload?: () => void;
    loading?: boolean;
}

const PayslipPreviewModal: React.FC<PayslipPreviewModalProps> = ({ 
    isOpen, 
    onClose, 
    payslipData, 
    month, 
    onDownload,
    loading 
}) => {
    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black bg-opacity-50 p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-cyan-100 text-cyan-600 rounded-lg">
                                <FileText size={20} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900">Payslip Preview</h3>
                                <p className="text-sm text-gray-500">For the month of {month}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {onDownload && (
                                <button 
                                    onClick={onDownload}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-lg transition-colors"
                                >
                                    <Download size={16} />
                                    Download
                                </button>
                            )}
                            <button 
                                onClick={onClose}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 overflow-y-auto flex-1 bg-white">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                                <p className="mt-4 text-gray-500">Loading payslip details...</p>
                            </div>
                        ) : !payslipData ? (
                            <div className="text-center py-12 text-gray-500">
                                No payslip data available for this month.
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Employee & Company Info Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Employee Details */}
                                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                            <User size={16} className="text-gray-400" />
                                            Employee Details
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Name:</span>
                                                <span className="font-medium text-gray-900">{payslipData.employeeName || 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Employee ID:</span>
                                                <span className="font-medium text-gray-900">{payslipData.employeeId || 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Designation:</span>
                                                <span className="font-medium text-gray-900">{payslipData.designation || 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Joining Date:</span>
                                                <span className="font-medium text-gray-900">{payslipData.joiningDate || 'N/A'}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-gray-500">Base Location:</span>
                                                <span className="font-medium text-gray-900">{payslipData.baseLocation || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bank & Attendance */}
                                    <div className="space-y-4">
                                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                                <Calendar size={16} className="text-gray-400" />
                                                Attendance Details
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Working Days:</span>
                                                    <span className="font-medium text-gray-900">{payslipData.workingDays || 0}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Loss of Pay (LOP) Days:</span>
                                                    <span className="font-medium text-gray-900">{payslipData.lossOfPayDays || 0}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                                            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                                <Building size={16} className="text-gray-400" />
                                                Bank Details
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Bank Name:</span>
                                                    <span className="font-medium text-gray-900">{payslipData.bankName || 'N/A'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">Account No:</span>
                                                    <span className="font-medium text-gray-900">{payslipData.accountNumber || 'N/A'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-500">IFSC Code:</span>
                                                    <span className="font-medium text-gray-900">{payslipData.ifscCode || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Salary Structure */}
                                <div className="border border-gray-200 rounded-xl overflow-hidden">
                                    <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                                        <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                                            <CreditCard size={18} className="text-gray-400" />
                                            Salary Breakdown
                                        </h4>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
                                        {/* Earnings */}
                                        <div className="p-4">
                                            <h5 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">Earnings</h5>
                                            <div className="space-y-3 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">Basic Salary</span>
                                                    <span className="font-medium">₹{payslipData.basic?.toLocaleString() || '0'}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-gray-600">HRA</span>
                                                    <span className="font-medium">₹{payslipData.hra?.toLocaleString() || '0'}</span>
                                                </div>
                                                {payslipData.earnings?.map((e: any, i: number) => (
                                                    <div key={i} className="flex justify-between">
                                                        <span className="text-gray-600">{e.componentName || e.name || e.earningName}</span>
                                                        <span className="font-medium">₹{e.amount?.toLocaleString() || '0'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between">
                                                <span className="font-bold text-gray-800">Gross Salary</span>
                                                <span className="font-bold text-gray-900">₹{payslipData.grossSalary?.toLocaleString() || '0'}</span>
                                            </div>
                                        </div>

                                        {/* Deductions */}
                                        <div className="p-4">
                                            <h5 className="text-sm font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">Deductions</h5>
                                            <div className="space-y-3 text-sm">
                                                {payslipData.deductions?.length > 0 ? (
                                                    payslipData.deductions.map((d: any, i: number) => (
                                                        <div key={i} className="flex justify-between">
                                                            <span className="text-gray-600">{d.componentName || d.name || d.deductionName}</span>
                                                            <span className="font-medium text-red-600">₹{d.amount?.toLocaleString() || '0'}</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="text-gray-400 italic">No deductions</div>
                                                )}
                                            </div>
                                            <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between">
                                                <span className="font-bold text-gray-800">Total Deductions</span>
                                                <span className="font-bold text-red-600">₹{payslipData.totalDeductions?.toLocaleString() || '0'}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-cyan-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
                                        <span className="font-bold text-gray-800 text-lg">Net Payable</span>
                                        <span className="font-bold text-cyan-700 text-2xl">₹{payslipData.netSalary?.toLocaleString() || '0'}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export default PayslipPreviewModal;
