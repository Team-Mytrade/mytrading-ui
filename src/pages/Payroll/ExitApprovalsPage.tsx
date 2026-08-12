import React, { useState, useEffect, useContext } from 'react';
import { ExitManagementService, ExitRequest } from '../../Services/ExitManagementService';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { Check, X, AlertCircle } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import ExitManagementPage from './ExitManagementPage';
import ReusableTable, { ColumnDef } from '../../components/common/Table';

const ExitApprovalsPage: React.FC = () => {
    const { user } = useContext(AuthContext);
    const isAdmin = (user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN' || user?.roles?.includes('SUPER_ADMIN') || user?.roles?.includes('ADMIN')) && user?.userType !== 'USER' && user?.userType !== 'EMPLOYEE';

    if (!isAdmin) {
        return <ExitManagementPage />;
    }

    const [requests, setRequests] = useState<ExitRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [rejectingId, setRejectingId] = useState<number | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const data = await ExitManagementService.getAllExitRequests();
            setRequests(data || []);
        } catch (error) {
            console.error("Failed to fetch exit requests", error);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (id: number) => {
        try {
            await ExitManagementService.approveExitRequest(id);
            fetchRequests();
        } catch (error) {
            console.error("Failed to approve", error);
        }
    };

    const handleReject = async (employeeId: number) => {
        if (!rejectReason.trim()) return;
        try {
            await ExitManagementService.rejectResignation(employeeId, rejectReason);
            setRejectingId(null);
            setRejectReason("");
            fetchRequests();
        } catch (error) {
            console.error("Failed to reject", error);
        }
    };

    const handleApproveWithdrawal = async (req: ExitRequest) => {
        try {
            await ExitManagementService.revertResignation(req.employeeId, "Admin approved withdrawal");
            fetchRequests();
        } catch (error) {
            console.error("Failed to approve withdrawal", error);
        }
    };

    const handleRejectWithdrawal = async (req: ExitRequest) => {
        try {
            await ExitManagementService.updateExitDetails({
                id: req.id,
                employeeId: req.employeeId,
                status: 'APPROVED'
            });
            fetchRequests();
        } catch (error) {
            console.error("Failed to reject withdrawal", error);
        }
    };

    const columns: ColumnDef<ExitRequest>[] = [
        {
            key: "employeeName",
            label: "Employee",
            sortable: true,
            sortValueGetter: (row) => row.employeeName || `EMP-${row.employeeId}`,
            render: (row) => (
                <div className="flex flex-col">
                    <span className="font-semibold text-gray-900">{row.employeeName || `EMP-${row.employeeId}`}</span>
                    <span className="text-[10px] text-gray-500 font-medium">{row.designation || '—'} • {row.location || '—'}</span>
                </div>
            )
        },
        {
            key: "lastWorkingDay",
            label: "Dates",
            sortable: true,
            render: (row) => (
                <div className="flex flex-col">
                    <span className="text-xs font-semibold text-gray-700">LWD: {row.lastWorkingDay}</span>
                    <span className="text-[10px] text-gray-400">Resigned: {row.resignationDate}</span>
                </div>
            )
        },
        {
            key: "reason",
            label: "Reason",
            render: (row) => (
                <p className="text-xs text-gray-600 max-w-[200px] truncate" title={row.reason}>
                    {row.reason}
                </p>
            )
        },
        {
            key: "status",
            label: "Status",
            sortable: true,
            render: (row) => (
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide inline-block ${
                    row.status === 'SUBMITTED' ? 'bg-amber-50 text-amber-500 border border-amber-100' :
                    row.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-500 border border-emerald-100' :
                    row.status === 'REJECTED' ? 'bg-red-50 text-red-500 border border-red-100' :
                    row.status === 'WITHDRAW_REQUESTED' || (row.status as string) === 'WITHDRAWAL REQ.' ? 'bg-blue-50 text-blue-500 border border-blue-100' :
                    row.status === 'WITHDRAW_APPROVED' || (row.status as string) === 'REVERTED' ? 'bg-gray-100 text-gray-500 border border-gray-200 line-through' :
                    'bg-gray-50 text-gray-500 border border-gray-200'
                }`}>
                    {row.status === 'WITHDRAW_REQUESTED' || (row.status as string) === 'WITHDRAWAL REQ.'
                        ? 'Withdrawal Req.' 
                        : row.status === 'WITHDRAW_APPROVED' || (row.status as string) === 'REVERTED' 
                        ? 'Withdrawn' 
                        : row.status}
                </span>
            )
        },
        {
            key: "actions",
            label: "Actions",
            headerClassName: "text-right w-36",
            className: "text-right w-36",
            render: (row) => (
                <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                    {row.status === 'SUBMITTED' && (
                        <>
                            {rejectingId === row.employeeId ? (
                                <div className="flex items-center gap-1.5">
                                    <input 
                                        type="text" 
                                        placeholder="Reason..." 
                                        className="text-xs border border-gray-200 rounded px-2 py-1 outline-none focus:border-red-400 w-24 h-7"
                                        value={rejectReason}
                                        onChange={(e) => setRejectReason(e.target.value)}
                                    />
                                    <button 
                                        onClick={() => handleReject(row.employeeId)}
                                        className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                        title="Confirm Reject"
                                    >
                                        <Check size={14} />
                                    </button>
                                    <button 
                                        onClick={() => { setRejectingId(null); setRejectReason(""); }}
                                        className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                                        title="Cancel"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button 
                                        onClick={() => handleApprove(row.id!)}
                                        className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                        title="Approve"
                                    >
                                        <Check size={16} />
                                    </button>
                                    <button 
                                        onClick={() => setRejectingId(row.employeeId)}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                        title="Reject"
                                    >
                                        <X size={16} />
                                    </button>
                                </>
                            )}
                        </>
                    )}
                    {(row.status === 'WITHDRAW_REQUESTED' || (row.status as string) === 'WITHDRAWAL REQ.') && (
                        <>
                            <button 
                                onClick={() => handleApproveWithdrawal(row)}
                                className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                                title="Approve Withdrawal (Revert Resignation)"
                            >
                                <Check size={16} />
                            </button>
                            <button 
                                onClick={() => handleRejectWithdrawal(row)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Reject Withdrawal (Keep Resignation Active)"
                            >
                                <X size={16} />
                            </button>
                        </>
                    )}
                </div>
            )
        }
    ];

    return (
        <>
            <PageMeta title="Exit Approvals" description="Admin dashboard to manage exit requests" />
            <PageBreadcrumb pageTitle="Exit Approvals" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-0 pb-8 space-y-6">
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900">Exit Requests</h2>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Review and manage employee resignations
                            </p>
                        </div>
                        <div className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-lg">
                            Total Requests: {requests.length}
                        </div>
                    </div>

                    <ReusableTable
                        data={requests}
                        columns={columns}
                        loading={loading}
                        searchable={true}
                        searchPlaceholder="Search exit requests by employee or reason..."
                        searchFields={["employeeName", "reason", "status"]}
                        pageSize={10}
                        defaultSortKey="lastWorkingDay"
                        defaultSortOrder="desc"
                        emptyState={
                            <div className="text-center p-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                                <p className="text-gray-500 font-semibold text-sm">No exit requests found</p>
                            </div>
                        }
                    />
                </div>
            </div>
        </>
    );
};

export default ExitApprovalsPage;
