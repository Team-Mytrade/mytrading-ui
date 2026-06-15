import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
    Plus, Trash2, ChevronRight, Upload, CheckCircle2,
    AlertTriangle, Download, Lock, Unlock, Check, X,
    FileText, Shield, Clock, Info, Eye,
    ArrowLeft, HelpCircle, Save, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import PageMeta from '../../components/common/PageMeta';
import { ToasterService } from '../../Services/ToasterService';

// --- Types & Interfaces ---

type RegimeType = 'OLD' | 'NEW';
type DeclarationStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'LOCKED' | 'SUBMITTED';
type ItemStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROOF_REQUIRED' | 'MISSING_INFO';

interface Proof {
    id: number;
    name: string;
    size: string;
    type: string;
    url: string;
    uploadDate: string;
    verified: boolean;
    remarks?: string;
}

interface DeclarationItem {
    id: number;
    sectionCode: string;
    subType: string;
    description: string;
    declaredAmount: number;
    approvedAmount: number;
    maxLimit?: number;
    status: ItemStatus;
    proofs: Proof[];
    remarks?: string;
    hrRemarks?: string;
}

interface DeclarationData {
    id: number;
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    email: string;
    financialYear: string;
    regime: RegimeType;
    status: DeclarationStatus;
    lastSaved: string;
    items: DeclarationItem[];
}

// --- Section Configurations ---

interface SectionConfig {
    code: string;
    title: string;
    limit: number;
    description: string;
    subTypes: { value: string; label: string }[];
}

const OLD_REGIME_SECTIONS: SectionConfig[] = [
    {
        code: '80C',
        title: 'Section 80C - Investments & Payments',
        limit: 150000,
        description: 'Life Insurance, PPF, ELSS, Tuition Fees, Home Loan Principal',
        subTypes: [
            { value: 'LIC', label: 'Life Insurance Premium' },
            { value: 'PPF', label: 'Public Provident Fund (PPF)' },
            { value: 'ELSS', label: 'Equity Linked Savings Scheme (ELSS)' },
            { value: 'EPF', label: 'Employee Provident Fund (EPF)' },
            { value: 'Tuition', label: 'Tuition Fees (Children)' },
            { value: 'Principal', label: 'Housing Loan Principal' },
            { value: 'NSC', label: 'National Savings Certificate' },
            { value: 'FD', label: 'Tax Saving Fixed Deposit' },
        ]
    },
    {
        code: '80D',
        title: 'Section 80D - Health Insurance',
        limit: 25000,
        description: 'Medical insurance for self, family, and parents',
        subTypes: [
            { value: 'Self', label: 'Self & Family (Below 60 years)' },
            { value: 'Parents', label: 'Parents (Below 60 years)' },
            { value: 'SelfSenior', label: 'Self & Family (Senior Citizens)' },
            { value: 'ParentsSenior', label: 'Parents (Senior Citizens)' },
            { value: 'Preventive', label: 'Preventive Health Checkup' },
        ]
    },
    {
        code: '80E',
        title: 'Section 80E - Education Loan Interest',
        limit: 0,
        description: 'Interest paid on education loan',
        subTypes: [
            { value: 'EducationLoan', label: 'Education Loan Interest' },
        ]
    },
    {
        code: '80G',
        title: 'Section 80G - Donations',
        limit: 0,
        description: 'Donations to charitable institutions',
        subTypes: [
            { value: 'Donation100', label: 'Donation (100% Deduction)' },
            { value: 'Donation50', label: 'Donation (50% Deduction)' },
        ]
    },
    {
        code: '24B',
        title: 'Section 24(b) - Home Loan Interest',
        limit: 200000,
        description: 'Interest paid on home loan',
        subTypes: [
            { value: 'HomeLoanInterest', label: 'Home Loan Interest' },
        ]
    },
    {
        code: '10_13A',
        title: 'Section 10(13A) - House Rent Allowance (HRA)',
        limit: 0,
        description: 'HRA exemption based on rent paid',
        subTypes: [
            { value: 'HRA', label: 'House Rent Allowance' },
        ]
    },
    {
        code: '10_14',
        title: 'Section 10(14) - Leave Travel Allowance (LTA)',
        limit: 0,
        description: 'LTA for travel expenses',
        subTypes: [
            { value: 'LTA', label: 'Leave Travel Allowance' },
        ]
    },
    {
        code: '80CCD_1B',
        title: 'Section 80CCD(1B) - NPS Additional',
        limit: 50000,
        description: 'Additional NPS contribution (above 80C)',
        subTypes: [
            { value: 'NPS', label: 'National Pension System (NPS)' },
        ]
    },
];

const NEW_REGIME_SECTIONS: SectionConfig[] = [
    {
        code: 'STANDARD',
        title: 'Standard Deduction',
        limit: 50000,
        description: 'Auto-applied for all salaried employees',
        subTypes: [
            { value: 'StandardDeduction', label: 'Standard Deduction' },
        ]
    },
    {
        code: '80CCD_2',
        title: 'Section 80CCD(2) - Employer NPS Contribution',
        limit: 0,
        description: 'Employer contribution to NPS',
        subTypes: [
            { value: 'EmployerNPS', label: 'Employer NPS Contribution' },
        ]
    },
];

// --- Utility Functions ---

const getCurrentFinancialYear = (): string => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;

    if (currentMonth >= 4) {
        return `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
    } else {
        return `${currentYear - 1}-${currentYear.toString().slice(-2)}`;
    }
};

// --- Helper Components ---

const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
        DRAFT: 'bg-gray-100 text-gray-700 border-gray-200',
        PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
        SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200',
        APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        REJECTED: 'bg-red-50 text-red-700 border-red-200',
        LOCKED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        PROOF_REQUIRED: 'bg-orange-50 text-orange-700 border-orange-200',
        MISSING_INFO: 'bg-red-50 text-red-700 border-red-200'
    };

    const icons: Record<string, any> = {
        DRAFT: Clock,
        PENDING: Clock,
        SUBMITTED: CheckCircle2,
        APPROVED: CheckCircle2,
        REJECTED: X,
        LOCKED: Lock,
        PROOF_REQUIRED: AlertTriangle,
        MISSING_INFO: AlertTriangle
    };

    const Icon = icons[status] || Info;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || styles.DRAFT}`}>
            <Icon size={12} />
            {status?.replace('_', ' ')}
        </span>
    );
};

const SectionHeader = ({ title, limit, utilized, isExpanded, onToggle }: any) => (
    <div
        onClick={onToggle}
        className="flex items-center justify-between p-4 cursor-pointer bg-white hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
    >
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                {isExpanded ? <ChevronRight className="rotate-90 transition-transform" size={18} /> : <ChevronRight size={18} />}
            </div>
            <div>
                <h3 className="font-semibold text-gray-900">{title}</h3>
                {limit > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                        <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${utilized > limit ? 'bg-red-500' : 'bg-blue-500'}`}
                                style={{ width: `${Math.min((utilized / limit) * 100, 100)}%` }}
                            />
                        </div>
                        <span className="text-xs text-gray-500">₹{utilized.toLocaleString()} / ₹{limit.toLocaleString()}</span>
                    </div>
                )}
            </div>
        </div>
        <div className="text-right">
            {limit > 0 ? (
                <span className={`text-sm font-medium ${utilized > limit ? 'text-red-500' : 'text-gray-700'}`}>
                    {utilized > limit ? 'Limit Exceeded' : `${Math.round((utilized / limit) * 100)}% Used`}
                </span>
            ) : (
                <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-1 rounded">No Limit</span>
            )}
        </div>
    </div>
);

// --- Confirmation Popup Component ---

interface ConfirmationPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
}

const ConfirmationPopup: React.FC<ConfirmationPopupProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'warning'
}) => {
    const iconMap = {
        danger: <AlertTriangle className="text-red-600" size={32} />,
        warning: <AlertTriangle className="text-amber-600" size={32} />,
        info: <Info className="text-blue-600" size={32} />
    };

    const bgColorMap = {
        danger: 'bg-red-50',
        warning: 'bg-amber-50',
        info: 'bg-blue-50'
    };

    const buttonColorMap = {
        danger: 'bg-red-600 hover:bg-red-700',
        warning: 'bg-amber-600 hover:bg-amber-700',
        info: 'bg-blue-600 hover:bg-blue-700'
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl"
                    >
                        <div className={`p-6 ${bgColorMap[type]} flex flex-col items-center text-center`}>
                            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mb-4 shadow-sm">
                                {iconMap[type]}
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
                            <p className="text-gray-600 text-sm">{message}</p>
                        </div>
                        <div className="p-6">
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2.5 text-gray-700 font-medium bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={() => {
                                        onConfirm();
                                        onClose();
                                    }}
                                    className={`flex-1 px-4 py-2.5 text-white font-medium rounded-lg transition-colors ${buttonColorMap[type]}`}
                                >
                                    {confirmText}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

// --- Main Page Component ---

const ItDeclarationPage: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const searchParams = new URLSearchParams(location.search);

    // Query Params
    const queryId = searchParams.get('id');
    const queryName = searchParams.get('employeeName');
    const designation = searchParams.get('designation') || '';

    // Role State
    const isHR = designation?.toUpperCase() === 'HR' || designation?.toUpperCase() === 'ADMIN' || designation?.toUpperCase() === 'Human Resources';

    // Application State
    const [declaration, setDeclaration] = useState<DeclarationData>({
        id: 0,
        employeeId: queryId || '',
        employeeName: queryName || '',
        employeeCode: '',
        email: '',
        financialYear: getCurrentFinancialYear(),
        regime: 'OLD',
        status: 'DRAFT',
        lastSaved: '',
        items: []
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isFetching, setIsFetching] = useState(true);

    // Local UI State
    const [activeSection, setActiveSection] = useState<string | null>('80C');
    const [showComparison, setShowComparison] = useState(false);
    const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
    const [showAddModal, setShowAddModal] = useState<string | null>(null);
    const [selectedItemIdForUpload, setSelectedItemIdForUpload] = useState<number | null>(null);

    // Confirmation Popup State
    const [confirmationPopup, setConfirmationPopup] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
        type?: 'danger' | 'warning' | 'info';
        confirmText?: string;
        cancelText?: string;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
        type: 'warning'
    });

    // Form State for Adding Items
    const [newItem, setNewItem] = useState({ subType: '', description: '', amount: '' });
    const [itemToDelete, setItemToDelete] = useState<number | null>(null);
    const [itemToReject, setItemToReject] = useState<{ id: number; amount: number } | null>(null);

    // Refs
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Derived State
    const totalDeclared = declaration.items?.reduce((acc, item) => acc + item.declaredAmount, 0) || 0;
    const isOldRegime = declaration.regime === 'OLD';
    const isLocked = ['LOCKED', 'SUBMITTED', 'APPROVED'].includes(declaration.status);
    const canEdit = !isLocked || isHR;

    // Get current regime sections
    const currentSections = isOldRegime ? OLD_REGIME_SECTIONS : NEW_REGIME_SECTIONS;

    // Show confirmation popup
    const showConfirmation = (
        title: string,
        message: string,
        onConfirm: () => void,
        type: 'danger' | 'warning' | 'info' = 'warning',
        confirmText?: string,
        cancelText?: string
    ) => {
        setConfirmationPopup({
            isOpen: true,
            title,
            message,
            onConfirm,
            type,
            confirmText,
            cancelText
        });
    };

    // Fetch declaration on mount
    useEffect(() => {
        const fetchDeclaration = async () => {
            if (!queryId) {
                setIsFetching(false);
                return;
            }

            try {
                setIsFetching(true);
                const response = await axios.get(
                    `/api/it-declaration/fetchDeclarationByEmpId/${queryId}`
                );
                if (response.data) {
                    const data = response.data;
                    setDeclaration({
                        id: data.id || 0,
                        employeeId: data.employeeId || queryId,
                        employeeName: data.employeeName || queryName || '',
                        employeeCode: data.employeeCode || '',
                        email: data.email || '',
                        financialYear: data.financialYear || getCurrentFinancialYear(),
                        regime: data.regime || 'OLD',
                        status: data.status || 'DRAFT',
                        lastSaved: data.lastSaved || '',
                        items: data.items || []
                    });
                }
            } catch (error) {
                console.error('Error fetching declaration:', error);
                ToasterService.error('Failed to load declaration');
            } finally {
                setIsFetching(false);
            }
        };

        fetchDeclaration();
    }, [queryId]);

    // Cleanup blob URLs on unmount
    useEffect(() => {
        return () => {
            if (declaration.items) {
                declaration.items.forEach(item => {
                    if (item.proofs) {
                        item.proofs.forEach(proof => {
                            if (proof.url && proof.url.startsWith('blob:')) {
                                URL.revokeObjectURL(proof.url);
                            }
                        });
                    }
                });
            }
        };
    }, [declaration.items]);

    // --- API Handlers ---

    const saveDeclaration = async (status: DeclarationStatus) => {
        setIsLoading(true);
        try {
            const payload = {
                employeeId: Number(queryId) || 0,
                financialYear: declaration.financialYear,
                status: status,
                items: declaration.items.map(item => ({
                    sectionCode: item.sectionCode,
                    subType: item.subType,
                    declaredAmount: item.declaredAmount,
                    approvedAmount: item.approvedAmount,
                    description: item.description,
                    status: item.status,
                    remarks: item.remarks || ''
                }))
            };

            await axios.post('/api/it-declaration/submit', payload);

            setDeclaration(prev => ({
                ...prev,
                status: status,
                lastSaved: new Date().toLocaleString()
            }));

            setShowSubmitConfirm(false);
            ToasterService.success(`Declaration ${status === 'DRAFT' ? 'saved' : 'submitted'} successfully`);
        } catch (error) {
            console.error('Error saving declaration:', error);
            const errorMessage = axios.isAxiosError(error)
                ? error.response?.data?.message || 'Failed to save declaration'
                : 'An unexpected error occurred';
            ToasterService.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const uploadProof = async (itemId: number, file: File) => {
        setIsLoading(true);
        const formData = new FormData();
        formData.append('proof', file);

        try {
            await axios.post(`/api/it-declaration/item/${itemId}/link-proof`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Refetch declaration to get updated data
            await fetchDeclaration();

            setSelectedItemIdForUpload(null);
            if (fileInputRef.current) fileInputRef.current.value = '';

            ToasterService.success('Proof uploaded successfully');
        } catch (error) {
            console.error('Error uploading proof:', error);
            const errorMessage = axios.isAxiosError(error)
                ? error.response?.data?.message || 'Failed to upload proof'
                : 'An unexpected error occurred';
            ToasterService.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const verifyProof = async (proofId: number) => {
        showConfirmation(
            'Verify Proof',
            'Are you sure you want to mark this proof as verified? This action cannot be undone.',
            async () => {
                setIsLoading(true);
                try {
                    await axios.put(`/api/it-declaration/proof/${proofId}/verify`);

                    setDeclaration(prev => ({
                        ...prev,
                        items: prev.items.map(item => ({
                            ...item,
                            proofs: item.proofs.map(proof =>
                                proof.id === proofId ? { ...proof, verified: true } : proof
                            )
                        }))
                    }));

                    ToasterService.success('Proof verified successfully');
                } catch (error) {
                    console.error('Error verifying proof:', error);
                    ToasterService.error('Failed to verify proof');
                } finally {
                    setIsLoading(false);
                }
            },
            'info',
            'Verify',
            'Cancel'
        );
    };

    const approveItem = async (itemId: number, amount: number, remarks?: string) => {
        showConfirmation(
            'Approve Item',
            `Are you sure you want to approve this item for ₹${amount.toLocaleString()}?`,
            async () => {
                setIsLoading(true);
                try {
                    await axios.put(`/api/it-declaration/item/${itemId}/approve`, {
                        approvedAmount: amount,
                        remarks: remarks || 'Approved by HR'
                    });

                    setDeclaration(prev => ({
                        ...prev,
                        items: prev.items.map(item =>
                            item.id === itemId
                                ? {
                                    ...item,
                                    status: 'APPROVED',
                                    approvedAmount: amount,
                                    hrRemarks: remarks || item.hrRemarks
                                }
                                : item
                        )
                    }));

                    ToasterService.success('Item approved successfully');
                } catch (error) {
                    console.error('Error approving item:', error);
                    ToasterService.error('Failed to approve item');
                } finally {
                    setIsLoading(false);
                }
            },
            'info',
            'Approve',
            'Cancel'
        );
    };

    const rejectItem = async (itemId: number) => {
        showConfirmation(
            'Reject Item',
            'Are you sure you want to reject this item? The employee will need to resubmit with correct information.',
            async () => {
                setIsLoading(true);
                try {
                    await axios.put(`/api/it-declaration/item/${itemId}/reject`, {
                        remarks: 'Rejected by HR'
                    });

                    setDeclaration(prev => ({
                        ...prev,
                        items: prev.items.map(item =>
                            item.id === itemId
                                ? {
                                    ...item,
                                    status: 'REJECTED',
                                    hrRemarks: 'Rejected by HR'
                                }
                                : item
                        )
                    }));

                    ToasterService.success('Item rejected successfully');
                } catch (error) {
                    console.error('Error rejecting item:', error);
                    ToasterService.error('Failed to reject item');
                } finally {
                    setIsLoading(false);
                }
            },
            'danger',
            'Reject',
            'Cancel'
        );
    };

    const unlockDeclaration = async () => {
        showConfirmation(
            'Unlock Declaration',
            'Are you sure you want to unlock this declaration? The employee will be able to make changes.',
            async () => {
                setIsLoading(true);
                try {
                    await axios.post(`/api/it-declaration/${declaration.id}/unlock`);

                    setDeclaration(prev => ({
                        ...prev,
                        status: 'DRAFT'
                    }));

                    ToasterService.success('Declaration unlocked successfully');
                } catch (error) {
                    console.error('Error unlocking declaration:', error);
                    ToasterService.error('Failed to unlock declaration');
                } finally {
                    setIsLoading(false);
                }
            },
            'warning',
            'Unlock',
            'Cancel'
        );
    };

    const lockDeclaration = async () => {
        showConfirmation(
            'Lock Declaration',
            'Are you sure you want to lock this declaration? The employee will not be able to make further changes.',
            async () => {
                setIsLoading(true);
                try {
                    await axios.post(`/api/it-declaration/${declaration.id}/lock`);

                    setDeclaration(prev => ({
                        ...prev,
                        status: 'LOCKED'
                    }));

                    ToasterService.success('Declaration locked successfully');
                } catch (error) {
                    console.error('Error locking declaration:', error);
                    ToasterService.error('Failed to lock declaration');
                } finally {
                    setIsLoading(false);
                }
            },
            'warning',
            'Lock',
            'Cancel'
        );
    };

    const downloadProofs = async () => {
        if (!declaration.employeeId) return;

        setIsLoading(true);
        try {
            const response = await axios.get(
                `/api/it-declaration/it-proofs/download/${declaration.employeeId}`,
                { responseType: 'blob' }
            );

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `proofs-${declaration.employeeId}.zip`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            ToasterService.success('Proofs download started');
        } catch (error) {
            console.error('Error downloading proofs:', error);
            ToasterService.error('Failed to download proofs');
        } finally {
            setIsLoading(false);
        }
    };

    const fetchDeclaration = async () => {
        if (!queryId) return;

        try {
            const response = await axios.get(
                `/api/it-declaration/fetchDeclarationByEmpId/${queryId}`
            );

            if (response.data) {
                const data = response.data;
                setDeclaration({
                    id: data.id || 0,
                    employeeId: data.employeeId || queryId,
                    employeeName: data.employeeName || queryName || '',
                    employeeCode: data.employeeCode || '',
                    email: data.email || '',
                    financialYear: data.financialYear || getCurrentFinancialYear(),
                    regime: data.regime || 'OLD',
                    status: data.status || 'DRAFT',
                    lastSaved: data.lastSaved || '',
                    items: data.items || []
                });
            }
        } catch (error) {
            console.error('Error fetching declaration:', error);
        }
    };

    // --- Event Handlers ---

    const handleRegimeChange = (newRegime: RegimeType) => {
        if (!canEdit) {
            ToasterService.error('Cannot change regime when declaration is locked');
            return;
        }

        if (declaration.items && declaration.items.length > 0) {
            showConfirmation(
                'Change Tax Regime',
                'Changing regime will reset your current declarations. Are you sure you want to continue?',
                () => {
                    setDeclaration(prev => ({
                        ...prev,
                        regime: newRegime,
                        items: []
                    }));
                    ToasterService.success('Tax regime changed successfully');
                },
                'warning',
                'Change Regime',
                'Cancel'
            );
        } else {
            setDeclaration(prev => ({ ...prev, regime: newRegime }));
            ToasterService.success('Tax regime changed successfully');
        }
    };

    const toggleSection = (section: string) => {
        setActiveSection(activeSection === section ? null : section);
    };

    const handleAddItem = () => {
        if (!newItem.subType || !newItem.amount) {
            ToasterService.error('Please fill in all required fields');
            return;
        }

        const sectionConfig = currentSections.find(s => s.code === showAddModal);

        const item: DeclarationItem = {
            id: Date.now(),
            sectionCode: showAddModal || '80C',
            subType: newItem.subType,
            description: newItem.description || newItem.subType,
            declaredAmount: Number(newItem.amount),
            approvedAmount: 0,
            maxLimit: sectionConfig?.limit || 0,
            status: 'PENDING',
            proofs: [],
            remarks: ''
        };

        const updatedItems = [...(declaration.items || []), item];
        setDeclaration(prev => ({ ...prev, items: updatedItems }));

        setShowAddModal(null);
        setNewItem({ subType: '', description: '', amount: '' });

        ToasterService.success('Item added successfully');
    };

    const confirmDeleteItem = (id: number) => {
        setItemToDelete(id);
        showConfirmation(
            'Delete Item',
            'Are you sure you want to delete this item? This action cannot be undone.',
            () => {
                const updatedItems = (declaration.items || []).filter(i => i.id !== id);
                setDeclaration(prev => ({ ...prev, items: updatedItems }));
                ToasterService.success('Item deleted successfully');
                setItemToDelete(null);
            },
            'danger',
            'Delete',
            'Cancel'
        );
    };

    const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && selectedItemIdForUpload) {
            const file = e.target.files[0];

            // Validate file size (5MB)
            if (file.size > 5 * 1024 * 1024) {
                ToasterService.error('File size must be less than 5MB');
                return;
            }

            // Validate file type
            const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
            if (!allowedTypes.includes(file.type)) {
                ToasterService.error('Only PDF, JPG, and PNG files are allowed');
                return;
            }

            uploadProof(selectedItemIdForUpload, file);
        }
    };

    const triggerFileUpload = (itemId: number) => {
        setSelectedItemIdForUpload(itemId);
        fileInputRef.current?.click();
    };

    const validateDeclaration = (): { isValid: boolean; message: string } => {
        if (!declaration.items || declaration.items.length === 0) {
            if (isOldRegime) {
                return { isValid: false, message: 'Please add at least one declaration item' };
            }
        }

        // Check for items without proofs in old regime
        // if (isOldRegime && declaration.items) {
        //     const itemsWithoutProofs = declaration.items.filter(item =>
        //         item.proofs.length === 0 && item.declaredAmount > 0
        //     );

        //     if (itemsWithoutProofs.length > 0) {
        //         return {
        //             isValid: false,
        //             message: `${itemsWithoutProofs.length} item(s) missing proof documents`
        //         };
        //     }
        // }

        return { isValid: true, message: '' };
    };

    const handleSubmit = () => {
        const validation = validateDeclaration();
        if (!validation.isValid) {
            ToasterService.error(validation.message);
            return;
        }
        setShowSubmitConfirm(true);
    };

    // Calculate totals per section
    const getSectionTotal = (sectionCode: string) => {
        if (!declaration.items || declaration.items.length === 0) return 0;
        return declaration.items
            .filter(i => i.sectionCode === sectionCode)
            .reduce((sum, item) => sum + item.declaredAmount, 0);
    };

    // Calculate estimated tax saving (30% of deductions)
    const getEstimatedTaxSaving = () => {
        const totalDeductions = isOldRegime ? totalDeclared : totalDeclared + 50000;
        return Math.floor(totalDeductions * 0.3);
    };

    // Loading overlay
    if (isFetching) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-white rounded-xl p-8 shadow-2xl flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-medium text-gray-700">Loading declaration...</p>
                </div>
            </div>
        );
    }

    // Render Logic
    return (
        <div className="min-h-screen bg-gray-50/50 font-sans text-gray-900 pb-20">
            <PageMeta title="IT Declaration | Payroll" description="Manage your tax declarations" />

            {/* Loading Overlay */}
            {isLoading && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white rounded-xl p-6 shadow-2xl flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm font-medium text-gray-700">Processing...</p>
                    </div>
                </div>
            )}

            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={onFileSelected}
                accept=".pdf,.jpg,.jpeg,.png"
            />

            {/* Header Section */}
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 -ml-2 hover:bg-gray-100 rounded-full text-gray-500 transition-colors"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-xl font-bold text-gray-900">IT Declaration</h1>
                                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 flex items-center gap-1">
                                        <Calendar size={10} /> FY {declaration.financialYear}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                                    <span className="font-medium text-gray-900">{declaration.employeeName}</span>
                                    {declaration.employeeCode && (
                                        <>
                                            <span>•</span>
                                            <span>{declaration.employeeCode}</span>
                                        </>
                                    )}
                                    {isHR && <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-xs font-medium border border-blue-100">Viewing as HR</span>}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <StatusBadge status={declaration.status} />

                            {isHR && (
                                <>
                                    <button
                                        onClick={downloadProofs}
                                        disabled={isLoading}
                                        className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                                    >
                                        <Download size={16} />
                                        Download Proofs
                                    </button>
                                    {isLocked ? (
                                        <button
                                            onClick={unlockDeclaration}
                                            disabled={isLoading}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors disabled:opacity-50"
                                        >
                                            <Unlock size={16} />
                                            Unlock
                                        </button>
                                    ) : (
                                        <button
                                            onClick={lockDeclaration}
                                            disabled={isLoading}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-50"
                                        >
                                            <Lock size={16} />
                                            Lock
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* LEFT COLUMN: FORM */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Tax Regime Selection */}
                        <section className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Tax Regime</h2>
                                    <p className="text-sm text-gray-500">Select the tax regime that benefits you most</p>
                                </div>
                                <button
                                    onClick={() => setShowComparison(true)}
                                    className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                                >
                                    Compare Regimes
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* OLD REGIME CARD */}
                                <button
                                    onClick={() => handleRegimeChange('OLD')}
                                    disabled={!canEdit}
                                    className={`relative p-5 rounded-xl border-2 transition-all duration-200 text-left ${isOldRegime
                                        ? 'border-blue-600 bg-blue-50/30'
                                        : 'border-gray-200 hover:border-blue-200 bg-white'
                                        } ${!canEdit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isOldRegime
                                                ? 'border-blue-600 bg-blue-600'
                                                : 'border-gray-300'
                                                }`}>
                                                {isOldRegime && <Check size={12} className="text-white" />}
                                            </div>
                                            <span className={`font-bold ${isOldRegime ? 'text-blue-900' : 'text-gray-700'}`}>Old Regime</span>
                                        </div>
                                    </div>
                                    <ul className="text-xs space-y-2 text-gray-600">
                                        <li className="flex items-start gap-1.5"><CheckCircle2 size={12} className="text-green-600 mt-0.5 flex-shrink-0" /> Claim HRA, LTA, 80C, 80D</li>
                                        <li className="flex items-start gap-1.5"><CheckCircle2 size={12} className="text-green-600 mt-0.5 flex-shrink-0" /> Multiple deduction options</li>
                                        <li className="flex items-start gap-1.5"><CheckCircle2 size={12} className="text-green-600 mt-0.5 flex-shrink-0" /> Higher tax savings potential</li>
                                    </ul>
                                </button>

                                {/* NEW REGIME CARD */}
                                <button
                                    onClick={() => handleRegimeChange('NEW')}
                                    disabled={!canEdit}
                                    className={`relative p-5 rounded-xl border-2 transition-all duration-200 text-left ${!isOldRegime
                                        ? 'border-blue-600 bg-blue-50/30'
                                        : 'border-gray-200 hover:border-blue-200 bg-white'
                                        } ${!canEdit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${!isOldRegime
                                                ? 'border-blue-600 bg-blue-600'
                                                : 'border-gray-300'
                                                }`}>
                                                {!isOldRegime && <Check size={12} className="text-white" />}
                                            </div>
                                            <span className={`font-bold ${!isOldRegime ? 'text-blue-900' : 'text-gray-700'}`}>New Regime</span>
                                        </div>
                                    </div>
                                    <ul className="text-xs space-y-2 text-gray-600">
                                        <li className="flex items-start gap-1.5"><CheckCircle2 size={12} className="text-green-600 mt-0.5 flex-shrink-0" /> Lower Tax Rates</li>
                                        <li className="flex items-start gap-1.5"><CheckCircle2 size={12} className="text-green-600 mt-0.5 flex-shrink-0" /> Minimal documentation</li>
                                        <li className="flex items-start gap-1.5"><Info size={12} className="text-amber-600 mt-0.5 flex-shrink-0" /> Limited deductions available</li>
                                    </ul>
                                </button>
                            </div>
                        </section>

                        {/* Declaration Form Sections */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider px-1">
                                {isOldRegime ? 'Old Regime' : 'New Regime'} Declarations
                            </h3>

                            {currentSections.map((section) => {
                                const sectionTotal = getSectionTotal(section.code);
                                const sectionItems = (declaration.items || []).filter(i => i.sectionCode === section.code);

                                return (
                                    <div key={section.code} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                        <SectionHeader
                                            title={section.title}
                                            limit={section.limit}
                                            utilized={sectionTotal}
                                            isExpanded={activeSection === section.code}
                                            onToggle={() => toggleSection(section.code)}
                                        />
                                        <AnimatePresence>
                                            {activeSection === section.code && (
                                                <motion.div
                                                    initial={{ height: 0 }}
                                                    animate={{ height: 'auto' }}
                                                    exit={{ height: 0 }}
                                                    className="border-t border-gray-100 bg-gray-50/50"
                                                >
                                                    <div className="p-4 space-y-4">
                                                        {sectionItems.length > 0 ? (
                                                            sectionItems.map(item => (
                                                                <ItemRow
                                                                    key={item.id}
                                                                    item={item}
                                                                    isHR={isHR}
                                                                    canEdit={canEdit}
                                                                    onDelete={() => confirmDeleteItem(item.id)}
                                                                    onUpload={() => triggerFileUpload(item.id)}
                                                                    onApprove={(amount, remarks) => approveItem(item.id, amount, remarks)}
                                                                    onReject={() => rejectItem(item.id)}
                                                                    onVerifyProof={
                                                                        verifyProof}
                                                                />
                                                            ))
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
                                                                <Shield size={32} className="mb-2 opacity-50" />
                                                                <p className="text-sm">No declarations added yet</p>
                                                                <p className="text-xs text-gray-400 mt-1">{section.description}</p>
                                                            </div>
                                                        )}

                                                        {canEdit && section.code !== 'STANDARD' && (
                                                            <button
                                                                onClick={() => setShowAddModal(section.code)}
                                                                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center justify-center gap-2 group"
                                                            >
                                                                <div className="w-6 h-6 rounded-full bg-gray-200 group-hover:bg-blue-200 flex items-center justify-center text-gray-500 group-hover:text-blue-600 transition-colors">
                                                                    <Plus size={14} />
                                                                </div>
                                                                Add Item
                                                            </button>
                                                        )}

                                                        {section.code === 'STANDARD' && (
                                                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                                                                <div className="flex items-start gap-3">
                                                                    <Info size={16} className="text-blue-600 mt-0.5" />
                                                                    <div className="text-sm text-blue-700">
                                                                        <p className="font-medium">Auto-applied deduction</p>
                                                                        <p className="text-xs mt-1">This ₹50,000 standard deduction is automatically applied to all salaried employees under the new regime. No proof required.</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* RIGHT COLUMN: SUMMARY SIDEBAR */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="sticky top-24 space-y-6">
                            {/* Summary Card */}
                            <div className={`bg-white rounded-2xl border ${isLocked ? 'border-purple-200 bg-purple-50/50' : 'border-gray-200'} shadow-lg shadow-gray-100/50 p-6`}>
                                <h3 className="text-lg font-bold text-gray-900 mb-6">Declaration Summary</h3>

                                <div className="space-y-4 mb-6">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500">Regime</span>
                                        <span className="font-medium text-gray-900">{isOldRegime ? 'Old Regime' : 'New Regime'}</span>
                                    </div>

                                    {isOldRegime ? (
                                        <>
                                            {OLD_REGIME_SECTIONS.map(section => {
                                                const total = getSectionTotal(section.code);
                                                if (total === 0) return null;
                                                return (
                                                    <div key={section.code} className="flex justify-between items-center text-sm">
                                                        <span className="text-gray-500">{section.code}</span>
                                                        <span className="font-medium text-gray-900">₹{total.toLocaleString()}</span>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-gray-500">Standard Deduction</span>
                                                <span className="font-medium text-gray-900">₹50,000</span>
                                            </div>
                                            {getSectionTotal('80CCD_2') > 0 && (
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-500">Employer NPS</span>
                                                    <span className="font-medium text-gray-900">₹{getSectionTotal('80CCD_2').toLocaleString()}</span>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <div className="h-px bg-gray-100 my-2" />

                                    <div className="flex justify-between items-center">
                                        <span className="text-base font-semibold text-gray-700">Total Deductions</span>
                                        <span className="text-xl font-bold text-blue-600">
                                            ₹{(isOldRegime ? totalDeclared : totalDeclared + 50000).toLocaleString()}
                                        </span>
                                    </div>

                                    {totalDeclared > 0 && (
                                        <div className="bg-green-50 rounded-lg p-3 text-center border border-green-100">
                                            <p className="text-xs text-green-700 uppercase font-semibold">Estimated Tax Saving</p>
                                            <p className="text-lg font-bold text-green-700">
                                                ₹{getEstimatedTaxSaving().toLocaleString()}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {canEdit ? (
                                    <div className="space-y-3">
                                        <button
                                            onClick={() => saveDeclaration('DRAFT')}
                                            disabled={isLoading}
                                            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <Save size={16} /> Save as Draft
                                        </button>
                                        <button
                                            onClick={handleSubmit}
                                            disabled={isLoading}
                                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 !text-white font-medium rounded-xl shadow-lg shadow-blue-600/20 transition-all transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            Submit Declaration <ChevronRight size={18} />
                                        </button>
                                    </div>
                                ) : isLocked && (
                                    <div className="bg-purple-50 border border-purple-100 rounded-xl p-4 text-center">
                                        <Lock className="mx-auto text-purple-600 mb-2" size={24} />
                                        <p className="text-sm font-medium text-purple-900">Declaration Locked</p>
                                        <p className="text-xs text-purple-700 mt-1">Status: {declaration.status}</p>
                                    </div>
                                )}

                                {declaration.lastSaved && (
                                    <p className="text-xs text-center text-gray-400 mt-4">
                                        Last saved: {declaration.lastSaved}
                                    </p>
                                )}
                            </div>

                            {/* HR Quick Actions */}
                            {isHR && (
                                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                                    <h4 className="font-semibold text-gray-900 mb-4 text-sm uppercase tracking-wider">HR Actions</h4>
                                    <div className="space-y-2">
                                        <button
                                            onClick={downloadProofs}
                                            disabled={isLoading}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <Download size={16} className="text-blue-600" />
                                            Download All Proofs
                                        </button>
                                        <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2">
                                            <FileText size={16} className="text-blue-600" />
                                            Request Additional Proofs
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {/* Modals */}
            <AnimatePresence>
                {/* Confirmation Popup */}
                <ConfirmationPopup
                    isOpen={confirmationPopup.isOpen}
                    onClose={() => setConfirmationPopup(prev => ({ ...prev, isOpen: false }))}
                    onConfirm={confirmationPopup.onConfirm}
                    title={confirmationPopup.title}
                    message={confirmationPopup.message}
                    type={confirmationPopup.type}
                    confirmText={confirmationPopup.confirmText}
                    cancelText={confirmationPopup.cancelText}
                />

                {/* Add Item Modal */}
                {showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-xl w-full max-w-md overflow-hidden shadow-2xl"
                        >
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h3 className="font-bold text-gray-900">
                                    Add {currentSections.find(s => s.code === showAddModal)?.title}
                                </h3>
                                <button
                                    onClick={() => setShowAddModal(null)}
                                    className="p-1 hover:bg-gray-200 rounded-full text-gray-500"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                                    <select
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={newItem.subType}
                                        onChange={(e) => setNewItem({ ...newItem, subType: e.target.value })}
                                    >
                                        <option value="">Select Type</option>
                                        {currentSections
                                            .find(s => s.code === showAddModal)
                                            ?.subTypes.map(type => (
                                                <option key={type.value} value={type.value}>
                                                    {type.label}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Policy Number, Account Details"
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={newItem.description}
                                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        min="0"
                                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={newItem.amount}
                                        onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowAddModal(null)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddItem}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                                >
                                    Add Item
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Comparison Modal */}
                {showComparison && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
                        >
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-gray-900">Tax Regime Comparison</h3>
                                <button
                                    onClick={() => setShowComparison(false)}
                                    className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                                    <div className="flex items-start gap-3">
                                        <Info size={16} className="text-blue-600 mt-0.5" />
                                        <div className="text-sm text-blue-700">
                                            <p className="font-medium">Tax calculation is indicative</p>
                                            <p className="text-xs mt-1">Please consult with a tax advisor for accurate calculations based on your complete financial situation.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-8">
                                    <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                                        <h4 className="font-bold text-blue-900 mb-4">Old Regime</h4>
                                        <div className="space-y-2 text-sm text-blue-800 mb-4">
                                            <p>✓ Multiple deductions</p>
                                            <p>✓ HRA, LTA benefits</p>
                                            <p>✓ 80C up to ₹1.5L</p>
                                        </div>
                                        <p className="text-xs text-blue-600 mt-2">Best for: Tax planning with investments</p>
                                    </div>
                                    <div className="text-center p-6 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200">
                                        <h4 className="font-bold text-gray-900 mb-4">New Regime</h4>
                                        <div className="space-y-2 text-sm text-gray-700 mb-4">
                                            <p>✓ Lower tax rates</p>
                                            <p>✓ Simpler process</p>
                                            <p>✓ Minimal documentation</p>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">Best for: Fewer deductions</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                                <button
                                    onClick={() => setShowComparison(false)}
                                    className="px-5 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Submit Confirmation Modal */}
                {showSubmitConfirm && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
                        >
                            <div className="p-6">
                                <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 mb-4 mx-auto">
                                    <AlertTriangle size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Confirm Submission</h3>
                                <p className="text-gray-500 text-center text-sm mb-6">
                                    Are you sure you want to submit your declaration?
                                    <br />
                                    <span className="text-xs text-red-500 font-medium mt-1 block">You cannot edit details after submission.</span>
                                </p>

                                <div className="space-y-3 bg-gray-50 p-4 rounded-xl text-sm border border-gray-100">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Regime Selected:</span>
                                        <span className="font-semibold text-gray-900">{isOldRegime ? 'Old Regime' : 'New Regime'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Total Items:</span>
                                        <span className="font-semibold text-gray-900">{declaration.items?.length || 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Total Deductions:</span>
                                        <span className="font-semibold text-gray-900">
                                            ₹{(isOldRegime ? totalDeclared : totalDeclared + 50000).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3">
                                <button
                                    onClick={() => setShowSubmitConfirm(false)}
                                    className="flex-1 px-4 py-2.5 text-gray-700 font-medium hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => saveDeclaration('SUBMITTED')}
                                    disabled={isLoading}
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 !text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                                >
                                    Yes, Submit
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Mobile Bottom Bar */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-40">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div>
                        <p className="text-xs text-gray-500">Total Deductions</p>
                        <p className="text-lg font-bold text-blue-600">
                            ₹{(isOldRegime ? totalDeclared : totalDeclared + 50000).toLocaleString()}
                        </p>
                    </div>
                    {canEdit ? (
                        <button
                            onClick={handleSubmit}
                            disabled={isLoading}
                            className="px-6 py-2.5 bg-blue-600 active:bg-blue-700 text-white font-medium rounded-lg shadow-lg shadow-blue-600/20 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            Submit <ChevronRight size={18} />
                        </button>
                    ) : (
                        <div className="px-4 py-2 bg-gray-100 rounded-lg text-xs font-medium text-gray-600">
                            {declaration.status}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- ItemRow Component ---

const ItemRow = ({
    item,
    isHR,
    canEdit,
    onDelete,
    onUpload,
    onApprove,
    onReject,
    onVerifyProof
}: {
    item: DeclarationItem,
    isHR: boolean,
    canEdit: boolean,
    onDelete?: () => void,
    onUpload?: () => void,
    onApprove?: (amount: number, remarks?: string) => void,
    onReject?: () => void,
    onVerifyProof?: (proofId: number) => void
}) => {
    const [showRemarks, setShowRemarks] = useState(false);
    const [remarks, setRemarks] = useState('');

    const handleApprove = () => {
        if (onApprove) {
            onApprove(item.declaredAmount, remarks);
            setRemarks('');
            setShowRemarks(false);
        }
    };

    return (
        <div className="bg-white border text-gray-800 border-gray-200 rounded-lg p-4 transition-all hover:shadow-md hover:border-blue-100">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900">{item.subType}</h4>
                        <StatusBadge status={item.status} />
                    </div>
                    <p className="text-sm text-gray-500">{item.description}</p>

                    {/* Proofs */}
                    {item.proofs.length > 0 ? (
                        <div className="flex gap-2 mt-3 flex-wrap">
                            {item.proofs.map(proof => (
                                <div
                                    key={proof.id}
                                    className="flex items-center gap-2 bg-gray-50 border border-gray-200 text-xs px-2 py-1.5 rounded-md text-gray-600 hover:text-blue-600 cursor-pointer transition-colors"
                                    title={`${proof.name} - ${proof.verified ? 'Verified' : 'Not Verified'}`}
                                >
                                    <FileText size={12} />
                                    <span className="truncate max-w-[100px]">{proof.name}</span>
                                    {isHR && !proof.verified && (
                                        <button
                                            onClick={() => onVerifyProof?.(proof.id)}
                                            className="ml-1 text-green-600 hover:text-green-700"
                                            title="Verify proof"
                                        >
                                            <CheckCircle2 size={12} />
                                        </button>
                                    )}
                                    {proof.verified && (
                                        <CheckCircle2 size={12} className="ml-1 text-green-600" />
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-3">
                            {canEdit ? (
                                <button
                                    onClick={onUpload}
                                    className="text-xs flex items-center gap-1 text-blue-600 font-medium hover:underline"
                                >
                                    <Upload size={12} /> Upload Proof
                                </button>
                            ) : (
                                <span className="text-xs text-orange-500 flex items-center gap-1 font-medium">
                                    <AlertTriangle size={12} /> No proof attached
                                </span>
                            )}
                        </div>
                    )}
                </div>

                <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">₹{item.declaredAmount.toLocaleString()}</p>
                    {isHR && item.approvedAmount > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                            Approved: <span className="font-medium text-green-600">₹{item.approvedAmount.toLocaleString()}</span>
                        </p>
                    )}

                    <div className="flex items-center gap-2 mt-2 justify-end">
                        {canEdit && !isHR && (
                            <button
                                onClick={onDelete}
                                className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                        {isHR && item.status === 'PENDING' && (
                            <div className="flex flex-col gap-1">
                                {showRemarks ? (
                                    <div className="flex flex-col gap-2">
                                        <input
                                            type="text"
                                            placeholder="Enter remarks (optional)"
                                            className="text-xs p-1 border rounded"
                                            value={remarks}
                                            onChange={(e) => setRemarks(e.target.value)}
                                        />
                                        <div className="flex gap-1">
                                            <button
                                                onClick={handleApprove}
                                                className="px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded hover:bg-green-100 transition-colors"
                                            >
                                                Confirm
                                            </button>
                                            <button
                                                onClick={() => setShowRemarks(false)}
                                                className="px-2 py-1 bg-gray-50 text-gray-700 text-xs font-medium rounded hover:bg-gray-100 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => setShowRemarks(true)}
                                            className="px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded hover:bg-green-100 transition-colors"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={onReject}
                                            className="px-2 py-1 bg-red-50 text-red-700 text-xs font-medium rounded hover:bg-red-100 transition-colors"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {(item.remarks || item.hrRemarks) && (
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs space-y-1">
                    {item.remarks && (
                        <p className="text-gray-500">
                            <span className="font-medium text-gray-700">Remarks:</span> {item.remarks}
                        </p>
                    )}
                    {item.hrRemarks && (
                        <p className="text-blue-600 bg-blue-50 inline-block px-2 py-1 rounded">
                            <span className="font-medium">HR:</span> {item.hrRemarks}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default ItDeclarationPage;