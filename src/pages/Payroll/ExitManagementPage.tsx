import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ExitManagementService, ExitRequest } from '../../Services/ExitManagementService';
import { LogOut, CheckCircle2 } from 'lucide-react';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { AuthContext } from '../../context/AuthContext';
import { Employee } from '../../shared/types/employee.types';
import { ToasterService } from '../../Services/ToasterService';

interface OffboardingTask {
    id: number;
    title: string;
    description: string;
    status: 'Pending' | 'Completed';
    category: 'IT' | 'Admin' | 'HR' | 'Finance';
}

const EMPLOYEE_API_URL = "/v1/api/payroll/employee";

const ExitManagementPage: React.FC = () => {
    const { user } = useContext(AuthContext);
    const [resolvedEmployeeId, setResolvedEmployeeId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    const [resignation, setResignation] = useState<ExitRequest | null>(null);
    const [tasks, setTasks] = useState<OffboardingTask[]>([
        { id: 1, title: 'Asset Return', description: 'Return laptop, charger, and access cards to IT.', status: 'Pending', category: 'IT' },
        { id: 2, title: 'Knowledge Transfer', description: 'Complete documentation for current projects.', status: 'Pending', category: 'HR' },
        { id: 3, title: 'Finance Clearance', description: 'Settle all pending reimbursements.', status: 'Pending', category: 'Finance' },
        { id: 4, title: 'ID Deactivation', description: 'Disable company email and app access.', status: 'Pending', category: 'IT' },
    ]);

    const [isResigning, setIsResigning] = useState(false);
    const [formData, setFormData] = useState<{reason: string, lastWorkingDay: Date | null}>({
        reason: '',
        lastWorkingDay: null,
    });

    useEffect(() => {
        if (user) resolveEmployee();
    }, [user]);

    const resolveEmployee = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${EMPLOYEE_API_URL}/all`);
            const match = res.data.find((emp: any) =>
                emp.officialEmail?.toLowerCase() === user?.email?.toLowerCase() ||
                `${emp.firstName} ${emp.lastName}`.toLowerCase() === user?.fullName?.toLowerCase()
            );
            const empId = match?.id || null;
            setResolvedEmployeeId(empId);
            if (empId) {
                await fetchExitRequest(empId);
            }
        } catch (error) {
            console.error("Failed to resolve employee", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchExitRequest = async (empId: number) => {
        try {
            const data = await ExitManagementService.getExitRequestByEmployeeId(empId);
            if (data && data.length > 0) {
                // Find the active resignation (not REVERTED / rejected) or the most recent one
                const activeRes = data.find(r => r.status !== 'REJECTED' && (r.status as string) !== 'REVERTED' && r.status !== 'WITHDRAW_APPROVED') || data[data.length - 1];
                setResignation(activeRes);
            } else {
                setResignation(null);
            }
        } catch (error) {
            console.error("Failed to fetch exit request", error);
        }
    };

    const handleResignSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.reason.trim()) {
            ToasterService.error("Please provide a reason for leaving.");
            return;
        }
        if (!formData.lastWorkingDay) {
            ToasterService.error("Please select your proposed last working day.");
            return;
        }

        if (!resolvedEmployeeId) {
            ToasterService.error("No employee record found for your account.", "You cannot submit a resignation.");
            return;
        }
        setLoading(true);
        
        try {
            const payload = {
                resignationDate: new Date().toISOString().split('T')[0],
                lastWorkingDay: formData.lastWorkingDay ? formData.lastWorkingDay.toISOString().split('T')[0] : '',
                reason: formData.reason,
                status: 'SUBMITTED' as const,
                employeeId: resolvedEmployeeId,
            };
            const result = await ExitManagementService.submitExitRequest(payload);
            setResignation(result);
            setIsResigning(false);
            ToasterService.success("Resignation request submitted successfully");
        } catch (error) {
            console.error("Failed to submit exit request", error);
            ToasterService.error("Failed to submit resignation request", "Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleWithdraw = async () => {
        if (!resolvedEmployeeId || !resignation) return;
        setLoading(true);
        
        try {
            const updated = await ExitManagementService.updateExitDetails({
                id: resignation.id,
                employeeId: resolvedEmployeeId,
                status: 'WITHDRAW_REQUESTED' as any,
                resignationDate: resignation.resignationDate,
                lastWorkingDay: resignation.lastWorkingDay,
                reason: resignation.reason
            });
            setResignation(updated);
            ToasterService.success("Resignation withdrawal requested successfully");
        } catch (error) {
            console.error("Failed to withdraw resignation", error);
            ToasterService.error("Failed to request resignation withdrawal", "Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const toggleTask = (id: number) => {
        setTasks(tasks.map(t => t.id === id ? { ...t, status: t.status === 'Pending' ? 'Completed' : 'Pending' } : t));
    };

    return (
        <>
            <PageMeta title="Exit Management" description="Manage your resignation and offboarding" />
            <PageBreadcrumb pageTitle="Exit Management" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-8 space-y-6">

            {!resignation && !isResigning ? (
                <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm text-center">
                    <LogOut className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h2 className="text-2xl font-semibold text-gray-900">Initiate Resignation</h2>
                    <p className="text-gray-500 mt-2 max-w-md mx-auto">
                        Submit a request to begin your offboarding process.
                    </p>
                    <button
                        onClick={() => setIsResigning(true)}
                        className="mt-6 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-md font-medium transition-colors"
                    >
                        Start Process
                    </button>
                </div>
            ) : isResigning ? (
                <div className="bg-white p-8 rounded-lg border border-gray-200 shadow-sm max-w-2xl mx-auto">
                    <h3 className="text-xl font-semibold text-gray-900 mb-6">Resignation Form</h3>
                    <form onSubmit={handleResignSubmit} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Reason for leaving <span className="text-red-500">*</span></label>
                            <textarea
                                required
                                className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                rows={4}
                                value={formData.reason}
                                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Proposed Last Working Day <span className="text-red-500">*</span></label>
                            <DatePicker
                                selected={formData.lastWorkingDay}
                                onChange={(date: Date | null) => setFormData({ ...formData, lastWorkingDay: date })}
                                className="w-full border border-gray-300 rounded-md p-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                wrapperClassName="w-full"
                                dateFormat="dd-MM-yyyy"
                                placeholderText="Select a date"
                                minDate={new Date()}
                                required
                            />
                        </div>
                        
                        <div className="flex gap-4 pt-4">
                            <button
                                type="button"
                                onClick={() => setIsResigning(false)}
                                className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-6 py-2 bg-indigo-600 text-white rounded-md font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center min-w-[120px]"
                            >
                                {loading ? 'Submitting...' : 'Submit Request'}
                            </button>
                        </div>
                    </form>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Status & Summary */}
                    <div className="md:col-span-1 space-y-6">
                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Request Status</h3>
                            <div className="flex items-center gap-3 mb-6">
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                                    resignation?.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                                    resignation?.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                }`}>
                                    {resignation?.status}
                                </span>
                            </div>
                            
                            <div className="space-y-4 text-sm text-gray-600">
                                <div className="flex justify-between border-b border-gray-100 pb-2">
                                    <span className="font-medium text-gray-700">Applied On</span>
                                    <span>{(resignation as any)?.submissionDate || '-'}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 pb-2">
                                    <span className="font-medium text-gray-700">Notice Period</span>
                                    <span>{(resignation as any)?.noticePeriod || '-'}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-100 pb-2">
                                    <span className="font-medium text-gray-700">Last Working Day</span>
                                    <span>{resignation?.lastWorkingDay || '-'}</span>
                                </div>
                            </div>

                            <button 
                                onClick={handleWithdraw}
                                disabled={loading || (resignation as any)?.status === 'WITHDRAW_REQUESTED'}
                                className="w-full mt-6 px-4 py-2 border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {(resignation as any)?.status === 'WITHDRAW_REQUESTED' ? 'Pending Approval' : 'Withdraw Resignation'}
                            </button>
                        </div>
                    </div>

                    {/* Clearance Tasks */}
                    <div className="md:col-span-2">
                        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-semibold text-gray-900">Clearance Tasks</h3>
                                <span className="text-sm font-medium text-gray-500">
                                    {tasks.filter(t => t.status === 'Completed').length} of {tasks.length} Completed
                                </span>
                            </div>
                            
                            <div className="space-y-3">
                                {tasks.map(task => (
                                    <div
                                        key={task.id}
                                        onClick={() => toggleTask(task.id)}
                                        className="flex items-start gap-4 p-4 border border-gray-100 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                                    >
                                        <div className={`mt-0.5 ${task.status === 'Completed' ? 'text-green-500' : 'text-gray-300'}`}>
                                            <CheckCircle2 size={20} />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-center mb-1">
                                                <h4 className={`font-medium ${task.status === 'Completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                                                    {task.title}
                                                </h4>
                                                <span className="text-xs font-medium px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                                    {task.category}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-500">{task.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </>
    );
};

export default ExitManagementPage;
