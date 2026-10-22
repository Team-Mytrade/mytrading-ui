import React, { useState, useEffect, useRef, useContext } from 'react';
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
import { AuthContext } from '../../context/AuthContext';
import { usePermissions } from '../../access/usePermissions';
import { apiError } from '../../utils/apiError';

const IT_API = '/v1/api/payroll/it-declaration';

// --- Types & Interfaces ---

type RegimeType = 'OLD' | 'NEW';
// DRAFT and SUBMITTED are the employee's; LOCKED is HR's (locked for payroll)
type DeclarationStatus = 'DRAFT' | 'SUBMITTED' | 'LOCKED';
type ItemStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ProofStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

interface Proof {
    id: number;
    name: string;
    status: ProofStatus;
    remarks?: string;
}

interface DeclarationItem {
    // Saved items carry the server's id; items added since the last save have a negative one
    id: number;
    sectionCode: string;
    subType: string;
    description: string;
    declaredAmount: number;
    approvedAmount: number;
    maxLimit?: number;
    status: ItemStatus;
    proofs: Proof[];
    // HR's note on the decision
    hrRemarks?: string;
}

interface DeclarationData {
    id: number;
    employeeId: string;
    employeeName: string;
    employeeCode: string;
    financialYear: string;
    regime: RegimeType;
    status: DeclarationStatus;
    lastSaved: string;
    items: DeclarationItem[];
}

// The declaration as the payroll service returns it
interface ServerProof { id: number; fileName: string; status?: ProofStatus | null; remarks?: string | null }
interface ServerItem {
    id: number; sectionCode: string; subType?: string | null; description?: string | null;
    declaredAmount?: number | null; approvedAmount?: number | null; status?: ItemStatus | null;
    remarks?: string | null; proofs?: ServerProof[] | null;
}
interface ServerDeclaration {
    id?: number; employeeId?: number; employeeCode?: string | null; employeeName?: string | null;
    financialYear?: string; regime?: RegimeType; status?: DeclarationStatus; items?: ServerItem[] | null;
}

const fromServer = (data: ServerDeclaration): Partial<DeclarationData> => ({
    id: data.id || 0,
    employeeId: data.employeeId ? String(data.employeeId) : '',
    employeeName: data.employeeName || '',
    employeeCode: data.employeeCode || '',
    financialYear: data.financialYear || getCurrentFinancialYear(),
    regime: data.regime || 'OLD',
    status: data.status || 'DRAFT',
    items: (data.items || []).map((item): DeclarationItem => ({
        id: item.id,
        sectionCode: item.sectionCode,
        subType: item.subType || item.sectionCode,
        description: item.description || '',
        declaredAmount: Number(item.declaredAmount) || 0,
        approvedAmount: Number(item.approvedAmount) || 0,
        status: item.status || 'PENDING',
        hrRemarks: item.remarks || undefined,
        proofs: (item.proofs || []).map((p): Proof => ({
            id: p.id, name: p.fileName, status: p.status || 'PENDING', remarks: p.remarks || undefined
        }))
    }))
});

const subTypeLabel = (item: DeclarationItem) =>
    ALL_HARDCODED_SECTIONS.find(s => s.code === item.sectionCode)?.subTypes.find(t => t.value === item.subType)?.label
    || item.subType || item.sectionCode;

// --- Section Configurations ---

interface SectionConfig {
    code: string;
    title: string;
    limit: number;
    description: string;
    subTypes: { value: string; label: string }[];
}

const ALL_HARDCODED_SECTIONS = [
    {
        code: '80C',
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
        description: 'Interest paid on education loan',
        subTypes: [
            { value: 'EducationLoan', label: 'Education Loan Interest' },
        ]
    },
    {
        code: '80G',
        description: 'Donations to eligible charitable institutions',
        subTypes: [
            { value: 'Donation100', label: 'Donation (100% Deduction)' },
            { value: 'Donation50', label: 'Donation (50% Deduction)' },
        ]
    },
    {
        code: '24B',
        description: 'Interest paid on home loan',
        subTypes: [
            { value: 'HomeLoanInterest', label: 'Home Loan Interest' },
        ]
    },
    {
        code: 'HRA',
        description: 'HRA exemption based on rent paid',
        subTypes: [
            { value: 'HRA', label: 'House Rent Allowance' },
        ]
    },
    {
        code: '80CCD_1B',
        description: 'Additional NPS contribution (above 80C)',
        subTypes: [
            { value: 'NPS', label: 'National Pension System (NPS)' },
        ]
    },
    {
        code: '80EE',
        description: 'Additional Interest on Home Loan (First Time Buyers)',
        subTypes: [
            { value: 'HomeLoanInterest80EE', label: 'Home Loan Interest 80EE' }
        ]
    },
    {
        code: '80EEA',
        description: 'Interest on Affordable Housing Loan',
        subTypes: [
            { value: 'AffordableHousingLoan', label: 'Affordable Housing Loan Interest' }
        ]
    },
    {
        code: '80EEB',
        description: 'Interest on Electric Vehicle Loan',
        subTypes: [
            { value: 'ElectricVehicleLoan', label: 'Electric Vehicle Loan Interest' }
        ]
    },
    {
        code: '80GG',
        description: 'Rent Paid Where HRA Is Not Received',
        subTypes: [
            { value: 'RentPaid80GG', label: 'Rent Paid (80GG)' }
        ]
    },
    {
        code: '80TTA',
        description: 'Interest on Savings Bank Account',
        subTypes: [
            { value: 'SavingsInterest', label: 'Savings Bank Account Interest' }
        ]
    },
    {
        code: '80TTB',
        description: 'Interest Income for Senior Citizens',
        subTypes: [
            { value: 'SeniorSavingsInterest', label: 'Senior Citizen Savings Interest' }
        ]
    }
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
        DRAFT: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-transparent dark:text-gray-400 dark:border-transparent',
        PENDING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent',
        SUBMITTED: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent',
        APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-transparent dark:text-gray-300 dark:border-transparent',
        REJECTED: 'bg-red-50 text-red-700 border-red-200 dark:bg-transparent dark:text-gray-400 dark:border-transparent',
        LOCKED: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-transparent dark:text-gray-400 dark:border-transparent',
        PROOF_REQUIRED: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-transparent dark:text-gray-400 dark:border-transparent',
        MISSING_INFO: 'bg-red-50 text-red-700 border-red-200 dark:bg-transparent dark:text-gray-400 dark:border-transparent'
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
        className="flex items-center justify-between p-4 cursor-pointer bg-white dark:bg-[#191919] hover:bg-gray-50 dark:hover:bg-[#222222] transition-colors border-b border-gray-100 dark:!border-transparent last:border-0"
    >
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-blue-50 dark:bg-[#222222] text-blue-600 dark:text-gray-300' : 'bg-gray-100 dark:bg-[#222222] text-gray-500 dark:text-gray-400'}`}>
                {isExpanded ? <ChevronRight className="rotate-90 transition-transform" size={18} /> : <ChevronRight size={18} />}
            </div>
            <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{title}</h3>
                {limit > 0 && (
                    <div className="flex items-center gap-2 mt-1">
                        <div className="w-24 h-1.5 bg-gray-100 dark:bg-[#2a2a2a] rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${utilized > limit ? 'bg-red-500 dark:bg-rose-500' : 'bg-blue-500 dark:bg-cyan-600'}`}
                                style={{ width: `${Math.min((utilized / limit) * 100, 100)}%` }}
                            />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">₹{utilized.toLocaleString()} / ₹{limit.toLocaleString()}</span>
                    </div>
                )}
            </div>
        </div>
        <div className="text-right">
            {limit > 0 ? (
                <span className={`text-sm font-medium ${utilized > limit ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
                    {utilized > limit ? 'Limit Exceeded' : `${Math.round((utilized / limit) * 100)}% Used`}
                </span>
            ) : (
                <span className="text-xs text-gray-400 font-medium bg-gray-100 dark:bg-[#222222] px-2 py-1 rounded">No Limit</span>
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
                        className="bg-white dark:bg-[#191919] rounded-xl w-full max-w-md overflow-hidden shadow-2xl border border-transparent dark:!border-transparent"
                    >
                        <div className={`p-6 ${bgColorMap[type]} dark:!bg-[#222222] flex flex-col items-center text-center`}>
                            <div className="w-16 h-16 rounded-full bg-white dark:bg-[#191919] flex items-center justify-center mb-4 shadow-sm">
                                {iconMap[type]}
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">{message}</p>
                        </div>
                        <div className="p-6 bg-white dark:bg-[#191919]">
                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 font-medium bg-gray-100 dark:bg-[#222222] hover:bg-gray-200 dark:hover:bg-[#2a2a2a] rounded-lg transition-colors"
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

    // HR view (verify, approve, lock): someone else's declaration (?id=) opened by a user with HRM:APPROVE
    const { canApprove } = usePermissions("HRM");
    const isHR = canApprove && Boolean(queryId);

    const { user } = useContext(AuthContext);
    // Someone else's declaration (?id=, HR) or the signed-in employee's own
    const viewedEmployeeId = queryId ? Number(queryId) : null;
    const [notLinked, setNotLinked] = useState<string | null>(null);

    // Application State
    const [declaration, setDeclaration] = useState<DeclarationData>({
        id: 0,
        employeeId: queryId || '',
        employeeName: queryName || '',
        employeeCode: '',
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
    // Locked for payroll: nobody changes it until HR unlocks. The employee may still correct a submitted one
    // (a changed amount goes back to HR); HR decides per item instead of editing
    const isLocked = declaration.status === 'LOCKED';
    const isSubmitted = declaration.status === 'SUBMITTED';
    const canEdit = !isLocked && !isHR;

    const [availableSections, setAvailableSections] = useState<SectionConfig[]>([]);

    // Fetch available sections from the backend
    useEffect(() => {
        const fetchSections = async () => {
            try {
                const res = await axios.get('/v1/api/payroll/it-declaration/fetchAvailableSections', {
                    params: { financialYear: declaration.financialYear }
                });
                if (res.data && Array.isArray(res.data)) {
                    // Map backend data to frontend SectionConfig structure
                    const mapped: SectionConfig[] = res.data
                        .filter((sec: any) => sec.active)
                        .map((sec: any) => {
                            const hardcoded = ALL_HARDCODED_SECTIONS.find((h: any) => h.code === sec.sectionCode);
                            return {
                                code: sec.sectionCode,
                                title: `Section ${sec.sectionCode} - ${sec.sectionName}`,
                                limit: sec.maxLimit || 0,
                                description: hardcoded?.description || sec.sectionName,
                                subTypes: hardcoded?.subTypes || [{ value: sec.sectionCode, label: sec.sectionName }]
                            };
                        });
                    setAvailableSections(mapped);
                }
            } catch (error) {
                ToasterService.error(apiError(error, "Could not load the tax sections"));
            }
        };
        fetchSections();
    }, [declaration.financialYear]);

    // Get current regime sections
    const currentSections = isOldRegime ? availableSections : [];

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

    // The employee's own declaration (/my), or the one HR opened (?id=); none yet is an empty draft
    const loadDeclaration = async () => {
        const empty: Partial<DeclarationData> = {
            id: 0, status: 'DRAFT', items: [],
            employeeId: queryId || '',
            employeeName: queryName || (viewedEmployeeId ? '' : user?.fullName || ''),
            employeeCode: searchParams.get('employeeCode') || ''
        };
        try {
            const response = viewedEmployeeId
                ? await axios.get(`${IT_API}/fetchDeclarationByEmpId/${viewedEmployeeId}`, {
                    params: { financialYear: declaration.financialYear }
                })
                : await axios.get(`${IT_API}/my`, { params: { financialYear: declaration.financialYear } });
            if (response.status === 204 || !response.data) {
                setDeclaration(prev => ({ ...prev, ...empty }));
            } else {
                setDeclaration(prev => ({
                    ...prev,
                    ...fromServer(response.data),
                    employeeName: response.data.employeeName || queryName || user?.fullName || ''
                }));
            }
            setNotLinked(null);
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 404) {
                setDeclaration(prev => ({ ...prev, ...empty }));
            } else if (axios.isAxiosError(error) && error.response?.status === 403 && !viewedEmployeeId) {
                // An account without an employee record has no declaration to make
                setNotLinked(apiError(error, 'No employee record is linked to your account.'));
            } else {
                ToasterService.error(apiError(error, 'Failed to load the declaration'));
            }
        } finally {
            setIsFetching(false);
        }
    };

    useEffect(() => {
        setIsFetching(true);
        loadDeclaration();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewedEmployeeId]);

    // Server answers that return the whole declaration replace what is shown
    const showServerCopy = (data: ServerDeclaration) => {
        setDeclaration(prev => ({ ...prev, ...fromServer(data), employeeName: data.employeeName || prev.employeeName }));
    };

    // --- API Handlers ---

    const saveDeclaration = async (status: DeclarationStatus) => {
        setIsLoading(true);
        try {
            // The whole list of items: saved ones by id, new ones without; HR's decisions are kept server-side
            const payload = {
                employeeId: viewedEmployeeId || 0,
                financialYear: declaration.financialYear,
                status: status,
                regime: declaration.regime,
                items: declaration.items.map(item => ({
                    id: item.id > 0 ? item.id : null,
                    sectionCode: item.sectionCode,
                    subType: item.subType,
                    description: item.description,
                    declaredAmount: item.declaredAmount
                }))
            };

            const response = await axios.post(`${IT_API}/submit`, payload);
            showServerCopy(response.data);
            setDeclaration(prev => ({ ...prev, lastSaved: new Date().toLocaleString() }));

            setShowSubmitConfirm(false);
            ToasterService.success(status === 'DRAFT' ? 'Declaration saved as a draft'
                : isSubmitted ? 'Changes saved' : 'Declaration submitted to HR');
        } catch (error) {
            ToasterService.error(apiError(error, 'Failed to save the declaration'));
        } finally {
            setIsLoading(false);
        }
    };

    const uploadProof = async (itemId: number, file: File) => {
        setIsLoading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(`${IT_API}/item/${itemId}/proof`, formData);
            showServerCopy(response.data);
            ToasterService.success('Proof uploaded');
        } catch (error) {
            ToasterService.error(apiError(error, 'Failed to upload the proof'));
        } finally {
            setSelectedItemIdForUpload(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            setIsLoading(false);
        }
    };

    const verifyProof = async (proofId: number) => {
        showConfirmation(
            'Verify Proof',
            'Mark this proof as verified? This cannot be undone.',
            async () => {
                setIsLoading(true);
                try {
                    await axios.put(`${IT_API}/proof/${proofId}/verify`, { status: 'VERIFIED' });
                    await loadDeclaration();
                    ToasterService.success('Proof verified');
                } catch (error) {
                    ToasterService.error(apiError(error, 'Failed to verify the proof'));
                } finally {
                    setIsLoading(false);
                }
            },
            'info',
            'Verify',
            'Cancel'
        );
    };

    // HR's decision on one item: approve (up to the declared amount) or reject, with a note for the employee
    const decideItem = async (itemId: number, decision: 'approve' | 'reject', amount: number, remarks?: string) => {
        setIsLoading(true);
        try {
            const response = await axios.put(`${IT_API}/item/${itemId}/${decision}`, {
                approvedAmount: decision === 'approve' ? amount : undefined,
                remarks: remarks?.trim() || undefined
            });
            showServerCopy(response.data);
            ToasterService.success(decision === 'approve' ? `Approved ₹${amount.toLocaleString()}` : 'Item rejected');
        } catch (error) {
            ToasterService.error(apiError(error, `Failed to ${decision} the item`));
        } finally {
            setIsLoading(false);
        }
    };

    const unlockDeclaration = async () => {
        showConfirmation(
            'Unlock Declaration',
            'Unlock this declaration? The employee can change it again and HR can review items.',
            async () => {
                setIsLoading(true);
                try {
                    await axios.post(`${IT_API}/${declaration.id}/unlock`);
                    await loadDeclaration();
                    ToasterService.success('Declaration unlocked');
                } catch (error) {
                    ToasterService.error(apiError(error, 'Failed to unlock the declaration'));
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
            'Lock this declaration for payroll? Nobody can change it until it is unlocked.',
            async () => {
                setIsLoading(true);
                try {
                    await axios.post(`${IT_API}/${declaration.id}/lock`);
                    await loadDeclaration();
                    ToasterService.success('Declaration locked for payroll');
                } catch (error) {
                    ToasterService.error(apiError(error, 'Failed to lock the declaration'));
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
                `${IT_API}/it-proofs/download/${declaration.employeeId}`,
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
            ToasterService.error(apiError(error, 'No proofs to download'));
        } finally {
            setIsLoading(false);
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

        const sectionCode = showAddModal || '80C';
        const sectionConfig = currentSections.find(s => s.code === sectionCode);
        const limit = sectionConfig?.limit || 0;
        const inputAmount = Number(newItem.amount);

        if (inputAmount <= 0) {
            ToasterService.error('Please enter a valid amount greater than 0');
            return;
        }

        if (limit > 0) {
            const currentTotal = (declaration.items || [])
                .filter(i => i.sectionCode === sectionCode)
                .reduce((sum, i) => sum + i.declaredAmount, 0);

            if (currentTotal + inputAmount > limit) {
                ToasterService.error(`Total declared amount for ${sectionConfig?.title || sectionCode} cannot exceed the maximum limit of ₹${limit.toLocaleString()}`);
                return;
            }
        }

        const item: DeclarationItem = {
            id: -Date.now(), // not saved yet
            sectionCode: sectionCode,
            subType: newItem.subType,
            description: newItem.description.trim(),
            declaredAmount: inputAmount,
            approvedAmount: 0,
            maxLimit: limit,
            status: 'PENDING',
            proofs: []
        };

        const updatedItems = [...(declaration.items || []), item];
        setDeclaration(prev => ({ ...prev, items: updatedItems }));

        setShowAddModal(null);
        setNewItem({ subType: '', description: '', amount: '' });

        ToasterService.success('Item added', 'Save the declaration to keep it.');
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
        // Proofs attach to a saved item
        if (itemId <= 0) {
            ToasterService.warning('Save the declaration first, then upload the proof');
            return;
        }
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
            <div className="min-h-screen bg-gray-50 dark:bg-transparent flex items-center justify-center">
                <div className="bg-white dark:bg-[#191919] rounded-xl p-8 shadow-2xl flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Loading declaration...</p>
                </div>
            </div>
        );
    }

    if (notLinked) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <PageMeta title="IT Declaration | Payroll" description="Manage your tax declarations" />
                {canApprove && <DeclarationReviewQueue />}
                <div className="bg-white dark:bg-[#191919] rounded-xl border border-gray-200 dark:!border-transparent p-8 text-center text-sm text-gray-600 dark:text-gray-300">
                    <Shield className="mx-auto mb-3 text-gray-400" size={32} />
                    {notLinked}
                </div>
            </div>
        );
    }

    // Render Logic
    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-transparent font-sans text-gray-900 dark:text-white pb-20">
            <PageMeta title="IT Declaration | Payroll" description="Manage your tax declarations" />

            {/* Loading Overlay */}
            {isLoading && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white dark:bg-[#191919] rounded-xl p-6 shadow-2xl flex flex-col items-center gap-3 border border-transparent dark:!border-transparent">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Processing...</p>
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
            <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#121212]/90 backdrop-blur-md border-b border-gray-200 dark:!border-transparent px-4 sm:px-6 lg:px-8 py-4">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-[#222222] rounded-full text-gray-500 dark:text-gray-400 transition-colors"
                            >
                                <ArrowLeft size={20} />
                            </button>
                            <div>
                                <div className="flex items-center gap-3">
                                    <h1 className="text-xl font-bold text-gray-900 dark:text-white">IT Declaration</h1>
                                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 dark:bg-[#222222] text-gray-600 dark:text-gray-300 border border-gray-200 dark:!border-transparent flex items-center gap-1">
                                        <Calendar size={10} /> FY {declaration.financialYear}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    <span className="font-medium text-gray-900 dark:text-white">{declaration.employeeName}</span>
                                    {declaration.employeeCode && (
                                        <>
                                            <span>•</span>
                                            <span>{declaration.employeeCode}</span>
                                        </>
                                    )}
                                    {isHR && <span className="text-blue-600 dark:text-gray-300 bg-blue-50 dark:bg-[#222222] px-2 py-0.5 rounded-full text-xs font-medium border border-blue-100 dark:!border-transparent">Viewing as HR</span>}
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
                                        className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#191919] border border-gray-300 dark:!border-transparent rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#222222] text-gray-700 dark:text-gray-300 transition-colors disabled:opacity-50"
                                    >
                                        <Download size={16} />
                                        Download Proofs
                                    </button>
                                    {isLocked ? (
                                        <button
                                            onClick={unlockDeclaration}
                                            disabled={isLoading}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 dark:bg-[#222222] text-amber-700 dark:text-amber-400 border border-amber-200 dark:!border-transparent rounded-lg text-sm font-medium hover:bg-amber-100 dark:hover:bg-[#282828] transition-colors disabled:opacity-50"
                                        >
                                            <Unlock size={16} />
                                            Unlock
                                        </button>
                                    ) : isSubmitted && (
                                        <button
                                            onClick={lockDeclaration}
                                            disabled={isLoading}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-[#222222] text-purple-700 dark:text-purple-400 border border-purple-200 dark:!border-transparent rounded-lg text-sm font-medium hover:bg-purple-100 dark:hover:bg-[#282828] transition-colors disabled:opacity-50"
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
                {/* HR: everyone's declarations, to open one and decide */}
                {canApprove && !queryId && <div className="mb-8"><DeclarationReviewQueue /></div>}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* LEFT COLUMN: FORM */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* Tax Regime Selection */}
                        <section className="bg-white dark:bg-[#191919] rounded-2xl p-6 border border-gray-200 dark:!border-transparent shadow-sm">
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Tax Regime</h2>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Select the tax regime that benefits you most</p>
                                </div>
                                <button
                                    onClick={() => setShowComparison(true)}
                                    className="text-sm font-medium text-blue-600 dark:text-cyan-400 hover:text-blue-700 dark:hover:text-cyan-300 flex items-center gap-1 bg-blue-50 dark:bg-[#222222] px-3 py-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-[#2a2a2a] transition-colors"
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
                                        ? 'border-blue-600 dark:border-cyan-600/50 bg-blue-50/30 dark:bg-[#222222]'
                                        : 'border-gray-200 dark:!border-transparent hover:border-blue-200 bg-white dark:bg-[#191919] dark:hover:bg-[#222222]'
                                        } ${!canEdit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isOldRegime
                                                ? 'border-blue-600 bg-blue-600'
                                                : 'border-gray-300 dark:border-gray-600'
                                                }`}>
                                                {isOldRegime && <Check size={12} className="text-white" />}
                                            </div>
                                            <span className={`font-bold ${isOldRegime ? 'text-blue-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>Old Regime</span>
                                        </div>
                                    </div>
                                    <ul className="text-xs space-y-2 text-gray-600 dark:text-gray-400">
                                        <li className="flex items-start gap-1.5"><CheckCircle2 size={12} className="text-green-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" /> Claim HRA, LTA, 80C, 80D</li>
                                        <li className="flex items-start gap-1.5"><CheckCircle2 size={12} className="text-green-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" /> Multiple deduction options</li>
                                        <li className="flex items-start gap-1.5"><CheckCircle2 size={12} className="text-green-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" /> Higher tax savings potential</li>
                                    </ul>
                                </button>

                                {/* NEW REGIME CARD */}
                                <button
                                    onClick={() => handleRegimeChange('NEW')}
                                    disabled={!canEdit}
                                    className={`relative p-5 rounded-xl border-2 transition-all duration-200 text-left ${!isOldRegime
                                        ? 'border-blue-600 dark:border-cyan-600/50 bg-blue-50/30 dark:bg-[#222222]'
                                        : 'border-gray-200 dark:!border-transparent hover:border-blue-200 bg-white dark:bg-[#191919] dark:hover:bg-[#222222]'
                                        } ${!canEdit ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${!isOldRegime
                                                ? 'border-blue-600 bg-blue-600'
                                                : 'border-gray-300 dark:border-gray-600'
                                                }`}>
                                                {!isOldRegime && <Check size={12} className="text-white" />}
                                            </div>
                                            <span className={`font-bold ${!isOldRegime ? 'text-blue-900 dark:text-white' : 'text-gray-700 dark:text-gray-300'}`}>New Regime</span>
                                        </div>
                                    </div>
                                    <ul className="text-xs space-y-2 text-gray-600 dark:text-gray-400">
                                        <li className="flex items-start gap-1.5"><CheckCircle2 size={12} className="text-green-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" /> Lower Tax Rates</li>
                                        <li className="flex items-start gap-1.5"><CheckCircle2 size={12} className="text-green-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" /> Minimal documentation</li>
                                        <li className="flex items-start gap-1.5"><Info size={12} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" /> Limited deductions available</li>
                                    </ul>
                                </button>
                            </div>
                        </section>

                        {/* Declaration Form Sections */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-1">
                                {isOldRegime ? 'Old Regime' : 'New Regime'} Declarations
                            </h3>

                            {currentSections.map((section) => {
                                const sectionTotal = getSectionTotal(section.code);
                                const sectionItems = (declaration.items || []).filter(i => i.sectionCode === section.code);

                                return (
                                    <div key={section.code} className="bg-white dark:bg-[#191919] rounded-xl border border-gray-200 dark:!border-transparent overflow-hidden shadow-sm">
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
                                                    className="border-t border-gray-100 dark:!border-transparent bg-gray-50/50 dark:bg-[#141414]"
                                                >
                                                    <div className="p-4 space-y-4">
                                                        {sectionItems.length > 0 ? (
                                                            sectionItems.map(item => (
                                                                <ItemRow
                                                                    key={item.id}
                                                                    item={item}
                                                                    title={subTypeLabel(item)}
                                                                    isHR={isHR}
                                                                    canEdit={canEdit}
                                                                    canDecide={isHR && isSubmitted}
                                                                    onDelete={() => confirmDeleteItem(item.id)}
                                                                    onUpload={() => triggerFileUpload(item.id)}
                                                                    onDecide={(decision, amount, remarks) => decideItem(item.id, decision, amount, remarks)}
                                                                    onVerifyProof={verifyProof}
                                                                />
                                                            ))
                                                        ) : (
                                                            <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-500">
                                                                <Shield size={32} className="mb-2 opacity-50" />
                                                                <p className="text-sm">No declarations added yet</p>
                                                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{section.description}</p>
                                                            </div>
                                                        )}

                                                        {canEdit && section.code !== 'STANDARD' && (
                                                            <button
                                                                onClick={() => setShowAddModal(section.code)}
                                                                className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-700/60 rounded-xl text-gray-500 dark:text-gray-400 font-medium hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-[#222222] dark:hover:text-gray-200 transition-all flex items-center justify-center gap-2 group"
                                                            >
                                                                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-[#222222] group-hover:bg-blue-200 dark:group-hover:bg-[#2a2a2a] flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-gray-200 transition-colors">
                                                                    <Plus size={14} />
                                                                </div>
                                                                Add Item
                              </button>
                                                        )}

                                                        {section.code === 'STANDARD' && (
                                                            <div className="bg-blue-50 dark:bg-[#222222] border border-blue-100 dark:!border-transparent rounded-lg p-4">
                                                                <div className="flex items-start gap-3">
                                                                    <Info size={16} className="text-blue-600 dark:text-cyan-400 mt-0.5" />
                                                                    <div className="text-sm text-blue-700 dark:text-gray-300">
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
                            <div className={`bg-white dark:bg-[#191919] rounded-2xl border ${isLocked ? 'border-purple-200 dark:!border-transparent bg-purple-50/50 dark:bg-[#191919]' : 'border-gray-200 dark:!border-transparent'} shadow-lg shadow-gray-100/50 dark:shadow-none p-6`}>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Declaration Summary</h3>

                                <div className="space-y-4 mb-6">
                                    <div className="flex justify-between items-center text-sm">
                                        <span className="text-gray-500 dark:text-gray-400">Regime</span>
                                        <span className="font-medium text-gray-900 dark:text-white">{isOldRegime ? 'Old Regime' : 'New Regime'}</span>
                                    </div>

                                    {isOldRegime ? (
                                        <>
                                            {availableSections.map(section => {
                                                const total = getSectionTotal(section.code);
                                                if (total === 0) return null;
                                                return (
                                                    <div key={section.code} className="flex justify-between items-center text-sm">
                                                        <span className="text-gray-500 dark:text-gray-400">{section.code}</span>
                                                        <span className="font-medium text-gray-900 dark:text-white">₹{total.toLocaleString()}</span>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-gray-500 dark:text-gray-400">Standard Deduction</span>
                                                <span className="font-medium text-gray-900 dark:text-white">₹50,000</span>
                                            </div>
                                            {getSectionTotal('80CCD_2') > 0 && (
                                                <div className="flex justify-between items-center text-sm">
                                                    <span className="text-gray-500 dark:text-gray-400">Employer NPS</span>
                                                    <span className="font-medium text-gray-900 dark:text-white">₹{getSectionTotal('80CCD_2').toLocaleString()}</span>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <div className="h-px bg-gray-100 dark:bg-[#282828] my-2" />

                                    <div className="flex justify-between items-center">
                                        <span className="text-base font-semibold text-gray-700 dark:text-gray-300">Total Deductions</span>
                                        <span className="text-xl font-bold text-blue-600 dark:text-cyan-400">
                                            ₹{(isOldRegime ? totalDeclared : totalDeclared + 50000).toLocaleString()}
                                        </span>
                                    </div>

                                    {totalDeclared > 0 && (
                                        <div className="bg-green-50 dark:bg-[#222222] rounded-lg p-3 text-center border border-green-100 dark:!border-transparent">
                                            <p className="text-xs text-green-700 dark:text-gray-400 uppercase font-semibold">Estimated Tax Saving</p>
                                            <p className="text-lg font-bold text-green-700 dark:text-emerald-400">
                                                ₹{getEstimatedTaxSaving().toLocaleString()}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {canEdit ? (
                                    <div className="space-y-3">
                                        {isSubmitted ? (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                                Submitted to HR. A changed amount goes back to HR for approval.
                                            </p>
                                        ) : (
                                            <button
                                                onClick={() => saveDeclaration('DRAFT')}
                                                disabled={isLoading}
                                                className="w-full py-2.5 bg-gray-100 dark:bg-[#222222] hover:bg-gray-200 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                <Save size={16} /> Save as Draft
                                            </button>
                                        )}
                                        <button
                                            onClick={isSubmitted ? () => saveDeclaration('SUBMITTED') : handleSubmit}
                                            disabled={isLoading}
                                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 !text-white font-medium rounded-xl shadow-lg shadow-blue-600/20 transition-all transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {isSubmitted ? 'Save Changes' : 'Submit Declaration'} <ChevronRight size={18} />
                                        </button>
                                    </div>
                                ) : isLocked ? (
                                    <div className="bg-purple-50 dark:bg-[#222222] border border-purple-100 dark:!border-transparent rounded-xl p-4 text-center">
                                        <Lock className="mx-auto text-purple-600 dark:text-purple-400 mb-2" size={24} />
                                        <p className="text-sm font-medium text-purple-900 dark:text-gray-200">Locked for payroll</p>
                                        <p className="text-xs text-purple-700 dark:text-gray-400 mt-1">Ask HR to unlock it to make changes.</p>
                                    </div>
                                ) : isHR && !isSubmitted && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                                        The employee hasn't submitted this declaration yet.
                                    </p>
                                )}

                                {declaration.lastSaved && (
                                    <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-4">
                                        Last saved: {declaration.lastSaved}
                                    </p>
                                )}
                            </div>

                            {/* HR Quick Actions */}
                            {isHR && (
                                <div className="bg-white dark:bg-[#191919] rounded-2xl border border-gray-200 dark:!border-transparent p-6">
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-4 text-sm uppercase tracking-wider">HR Actions</h4>
                                    <div className="space-y-2">
                                        <button
                                            onClick={downloadProofs}
                                            disabled={isLoading}
                                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#222222] rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                                        >
                                            <Download size={16} className="text-blue-600 dark:text-cyan-400" />
                                            Download All Proofs
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
                    key="confirm"
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
                    <div key="add-item" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-[#191919] rounded-xl w-full max-w-md overflow-hidden shadow-2xl border border-transparent dark:!border-transparent"
                        >
                            <div className="p-4 border-b border-gray-100 dark:!border-transparent flex justify-between items-center bg-gray-50 dark:bg-[#222222]">
                                <h3 className="font-bold text-gray-900 dark:text-white">
                                    Add {currentSections.find(s => s.code === showAddModal)?.title}
                                </h3>
                                <button
                                    onClick={() => setShowAddModal(null)}
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-[#282828] rounded-full text-gray-500 dark:text-gray-400"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4 bg-white dark:bg-[#191919]">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                                    <select
                                        className="w-full p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#222222] text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Policy Number, Account Details"
                                        className="w-full p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#222222] text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={newItem.description}
                                        onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount (₹)</label>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        min="0"
                                        className="w-full p-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#222222] text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={newItem.amount}
                                        onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })}
                                    />
                                    {showAddModal && (() => {
                                        const sectionCode = showAddModal;
                                        const sectionConfig = currentSections.find(s => s.code === sectionCode);
                                        const limit = sectionConfig?.limit || 0;
                                        if (limit > 0) {
                                            const currentTotal = (declaration.items || [])
                                                .filter(i => i.sectionCode === sectionCode)
                                                .reduce((sum, i) => sum + i.declaredAmount, 0);
                                            const remaining = Math.max(0, limit - currentTotal);
                                            return (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium">
                                                    Maximum limit: ₹{limit.toLocaleString()} | Remaining allowed: <span className="text-blue-600 dark:text-cyan-400 font-bold">₹{remaining.toLocaleString()}</span>
                                                </p>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-[#222222] border-t border-gray-100 dark:!border-transparent flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowAddModal(null)}
                                    className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2a2a2a] rounded-lg text-sm font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddItem}
                                    disabled={isLoading}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 !text-white rounded-lg text-sm font-medium disabled:opacity-50"
                                >
                                    Add Item
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Comparison Modal */}
                {showComparison && (
                    <div key="compare" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-[#191919] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl border border-transparent dark:!border-transparent"
                        >
                            <div className="p-6 border-b border-gray-100 dark:!border-transparent flex justify-between items-center bg-white dark:bg-[#191919]">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Tax Regime Comparison</h3>
                                <button
                                    onClick={() => setShowComparison(false)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-[#222222] rounded-full text-gray-500 dark:text-gray-400"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 bg-white dark:bg-[#191919]">
                                <div className="bg-blue-50 dark:bg-[#222222] border border-blue-100 dark:!border-transparent rounded-lg p-4 mb-6">
                                    <div className="flex items-start gap-3">
                                        <Info size={16} className="text-blue-600 dark:text-cyan-400 mt-0.5" />
                                        <div className="text-sm text-blue-700 dark:text-gray-300">
                                            <p className="font-medium">Tax calculation is indicative</p>
                                            <p className="text-xs mt-1">Please consult with a tax advisor for accurate calculations based on your complete financial situation.</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-8">
                                    <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-[#222222] dark:to-[#252525] rounded-xl border border-blue-200 dark:!border-transparent">
                                        <h4 className="font-bold text-blue-900 dark:text-white mb-4">Old Regime</h4>
                                        <div className="space-y-2 text-sm text-blue-800 dark:text-gray-300 mb-4">
                                            <p>✓ Multiple deductions</p>
                                            <p>✓ HRA, LTA benefits</p>
                                            <p>✓ 80C up to ₹1.5L</p>
                                        </div>
                                        <p className="text-xs text-blue-600 dark:text-cyan-400 mt-2">Best for: Tax planning with investments</p>
                                    </div>
                                    <div className="text-center p-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#222222] dark:to-[#252525] rounded-xl border border-gray-200 dark:!border-transparent">
                                        <h4 className="font-bold text-gray-900 dark:text-white mb-4">New Regime</h4>
                                        <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-4">
                                            <p>✓ Lower tax rates</p>
                                            <p>✓ Simpler process</p>
                                            <p>✓ Minimal documentation</p>
                                        </div>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Best for: Fewer deductions</p>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 bg-gray-50 dark:bg-[#222222] border-t border-gray-100 dark:!border-transparent flex justify-end gap-3">
                                <button
                                    onClick={() => setShowComparison(false)}
                                    className="px-5 py-2.5 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-[#2a2a2a] rounded-lg transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}

                {/* Submit Confirmation Modal */}
                {showSubmitConfirm && (
                    <div key="submit" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white dark:bg-[#191919] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-transparent dark:!border-transparent"
                        >
                            <div className="p-6 bg-white dark:bg-[#191919]">
                                <div className="w-12 h-12 bg-amber-100 dark:bg-[#222222] rounded-full flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 mx-auto">
                                    <AlertTriangle size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center mb-2">Confirm Submission</h3>
                                <p className="text-gray-500 dark:text-gray-400 text-center text-sm mb-6">
                                    Submit your declaration to HR for approval?
                                    <br />
                                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1 block">HR approves each item; only approved amounts reduce your tax.</span>
                                </p>

                                <div className="space-y-3 bg-gray-50 dark:bg-[#222222] p-4 rounded-xl text-sm border border-gray-100 dark:!border-transparent">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-gray-400">Regime Selected:</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">{isOldRegime ? 'Old Regime' : 'New Regime'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-gray-400">Total Items:</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">{declaration.items?.length || 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 dark:text-gray-400">Total Deductions:</span>
                                        <span className="font-semibold text-gray-900 dark:text-white">
                                            ₹{(isOldRegime ? totalDeclared : totalDeclared + 50000).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 bg-gray-50 dark:bg-[#222222] border-t border-gray-100 dark:!border-transparent flex gap-3">
                                <button
                                    onClick={() => setShowSubmitConfirm(false)}
                                    className="flex-1 px-4 py-2.5 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-[#2a2a2a] rounded-lg transition-colors"
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
            <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-[#191919] border-t border-gray-200 dark:!border-transparent p-4 shadow-lg z-40">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Deductions</p>
                        <p className="text-lg font-bold text-blue-600 dark:text-cyan-400">
                            ₹{(isOldRegime ? totalDeclared : totalDeclared + 50000).toLocaleString()}
                        </p>
                    </div>
                    {canEdit ? (
                        <button
                            onClick={isSubmitted ? () => saveDeclaration('SUBMITTED') : handleSubmit}
                            disabled={isLoading}
                            className="px-6 py-2.5 bg-blue-600 active:bg-blue-700 text-white font-medium rounded-lg shadow-lg shadow-blue-600/20 transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                            {isSubmitted ? 'Save' : 'Submit'} <ChevronRight size={18} />
                        </button>
                    ) : (
                        <div className="px-4 py-2 bg-gray-100 dark:bg-[#222222] rounded-lg text-xs font-medium text-gray-600 dark:text-gray-300">
                            {declaration.status}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- ItemRow Component ---

const proofStyle: Record<ProofStatus, string> = {
    PENDING: 'text-gray-600 dark:text-gray-300',
    VERIFIED: 'text-green-700 dark:text-emerald-400',
    REJECTED: 'text-red-600 dark:text-rose-400 line-through'
};

const ItemRow = ({
    item,
    title,
    isHR,
    canEdit,
    canDecide,
    onDelete,
    onUpload,
    onDecide,
    onVerifyProof
}: {
    item: DeclarationItem,
    title: string,
    isHR: boolean,
    canEdit: boolean,
    canDecide: boolean,
    onDelete?: () => void,
    onUpload?: () => void,
    onDecide?: (decision: 'approve' | 'reject', amount: number, remarks?: string) => void,
    onVerifyProof?: (proofId: number) => void
}) => {
    const [reviewing, setReviewing] = useState(false);
    const [remarks, setRemarks] = useState('');
    const [amount, setAmount] = useState(String(item.declaredAmount));
    const saved = item.id > 0;

    const decide = (decision: 'approve' | 'reject') => {
        const approved = Number(amount);
        if (decision === 'approve' && (!(approved >= 0) || approved > item.declaredAmount)) {
            ToasterService.error(`Approve between ₹0 and ₹${item.declaredAmount.toLocaleString()}`);
            return;
        }
        onDecide?.(decision, approved, remarks);
        setRemarks('');
        setReviewing(false);
    };

    return (
        <div className="bg-white dark:bg-[#191919] border text-gray-800 dark:text-gray-200 border-gray-200 dark:!border-transparent rounded-lg p-4 transition-all hover:shadow-md hover:border-blue-100 dark:hover:bg-[#202020]">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{title}</h4>
                        {saved ? <StatusBadge status={item.status} /> : <StatusBadge status="DRAFT" />}
                    </div>
                    {item.description && <p className="text-sm text-gray-500 dark:text-gray-400">{item.description}</p>}

                    {/* Proofs */}
                    <div className="flex gap-2 mt-3 flex-wrap items-center">
                        {item.proofs.map(proof => (
                            <div
                                key={proof.id}
                                className={`flex items-center gap-2 bg-gray-50 dark:bg-[#222222] border border-gray-200 dark:!border-transparent text-xs px-2 py-1.5 rounded-md ${proofStyle[proof.status] || proofStyle.PENDING}`}
                                title={`${proof.name} - ${proof.status === 'VERIFIED' ? 'Verified' : proof.status === 'REJECTED' ? 'Rejected' : 'Not verified yet'}${proof.remarks ? ` (${proof.remarks})` : ''}`}
                            >
                                <FileText size={12} />
                                <span className="truncate max-w-[140px]">{proof.name}</span>
                                {isHR && proof.status === 'PENDING' && (
                                    <button
                                        onClick={() => onVerifyProof?.(proof.id)}
                                        className="ml-1 text-green-600 dark:text-emerald-400 hover:text-green-700"
                                        title="Verify proof"
                                    >
                                        <CheckCircle2 size={12} />
                                    </button>
                                )}
                                {proof.status === 'VERIFIED' && (
                                    <CheckCircle2 size={12} className="ml-1 text-green-600 dark:text-emerald-400" />
                                )}
                            </div>
                        ))}
                        {canEdit ? (
                            <button
                                onClick={onUpload}
                                className="text-xs flex items-center gap-1 text-blue-600 dark:text-cyan-400 font-medium hover:underline"
                                title={saved ? 'PDF, JPG or PNG, up to 5 MB' : 'Save the declaration first'}
                            >
                                <Upload size={12} /> {item.proofs.length > 0 ? 'Add Proof' : 'Upload Proof'}
                            </button>
                        ) : item.proofs.length === 0 && (
                            <span className="text-xs text-orange-500 dark:text-amber-400/80 flex items-center gap-1 font-medium">
                                <AlertTriangle size={12} /> No proof attached
                            </span>
                        )}
                    </div>
                </div>

                <div className="text-right">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">₹{item.declaredAmount.toLocaleString()}</p>
                    {item.status === 'APPROVED' && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Approved: <span className="font-medium text-green-600 dark:text-emerald-400">₹{item.approvedAmount.toLocaleString()}</span>
                        </p>
                    )}

                    <div className="flex items-center gap-2 mt-2 justify-end">
                        {canEdit && (
                            <button
                                onClick={onDelete}
                                className="p-1.5 hover:bg-red-50 dark:hover:bg-[#282828] rounded text-gray-400 hover:text-red-600 dark:hover:text-rose-400 transition-colors"
                                title="Delete"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                        {canDecide && saved && (reviewing ? (
                            <div className="flex flex-col gap-2 items-end">
                                <input
                                    type="number"
                                    min={0}
                                    max={item.declaredAmount}
                                    className="text-xs p-1 w-32 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#222222] text-gray-900 dark:text-white rounded text-right"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    title="Amount to approve"
                                />
                                <input
                                    type="text"
                                    placeholder="Note for the employee"
                                    className="text-xs p-1 w-48 border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#222222] text-gray-900 dark:text-white rounded"
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                />
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => decide('approve')}
                                        className="px-2 py-1 bg-green-50 dark:bg-[#222222] text-green-700 dark:text-emerald-400 text-xs font-medium rounded hover:bg-green-100 dark:hover:bg-[#2a2a2a] transition-colors"
                                    >
                                        Approve
                                    </button>
                                    <button
                                        onClick={() => decide('reject')}
                                        className="px-2 py-1 bg-red-50 dark:bg-[#222222] text-red-700 dark:text-rose-400 text-xs font-medium rounded hover:bg-red-100 dark:hover:bg-[#2a2a2a] transition-colors"
                                    >
                                        Reject
                                    </button>
                                    <button
                                        onClick={() => setReviewing(false)}
                                        className="px-2 py-1 bg-gray-50 dark:bg-[#222222] text-gray-700 dark:text-gray-300 text-xs font-medium rounded hover:bg-gray-100 dark:hover:bg-[#2a2a2a] transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => { setAmount(String(item.declaredAmount)); setReviewing(true); }}
                                className="px-2 py-1 bg-blue-50 dark:bg-[#222222] text-blue-700 dark:text-cyan-400 text-xs font-medium rounded hover:bg-blue-100 dark:hover:bg-[#2a2a2a] transition-colors"
                            >
                                {item.status === 'PENDING' ? 'Review' : 'Change decision'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {item.hrRemarks && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:!border-transparent text-xs">
                    <p className="text-blue-600 dark:text-cyan-400 bg-blue-50 dark:bg-[#222222] inline-block px-2 py-1 rounded">
                        <span className="font-medium">HR:</span> {item.hrRemarks}
                    </p>
                </div>
            )}
        </div>
    );
};

// --- HR review queue: every declaration, newest first; opening one shows it with the HR actions ---

const DeclarationReviewQueue = () => {
    const navigate = useNavigate();
    const [rows, setRows] = useState<ServerDeclaration[]>([]);
    const [loading, setLoading] = useState(true);
    const [onlyWaiting, setOnlyWaiting] = useState(true);

    useEffect(() => {
        axios.get(`${IT_API}/fetchAllDeclarations`)
            .then(res => setRows(Array.isArray(res.data) ? res.data : []))
            .catch(error => ToasterService.error(apiError(error, 'Could not load the declarations')))
            .finally(() => setLoading(false));
    }, []);

    const pendingOf = (d: ServerDeclaration) => (d.items || []).filter(i => i.status === 'PENDING').length;
    const shown = onlyWaiting ? rows.filter(d => d.status === 'SUBMITTED' && pendingOf(d) > 0) : rows;

    return (
        <section className="bg-white dark:bg-[#191919] rounded-2xl border border-gray-200 dark:!border-transparent shadow-sm p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Declarations to review</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Open a declaration to approve or reject its items and verify proofs</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                    <input type="checkbox" checked={onlyWaiting} onChange={e => setOnlyWaiting(e.target.checked)} />
                    Only those waiting for HR
                </label>
            </div>
            {loading ? (
                <p className="text-sm text-gray-400 py-4">Loading...</p>
            ) : shown.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">{onlyWaiting ? 'Nothing is waiting for review.' : 'No declarations yet.'}</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-[#2a2a2a]">
                                <th className="py-2 pr-4">Employee</th>
                                <th className="py-2 pr-4">FY</th>
                                <th className="py-2 pr-4">Regime</th>
                                <th className="py-2 pr-4">Status</th>
                                <th className="py-2 pr-4 text-right">Declared</th>
                                <th className="py-2 pr-4 text-right">Waiting</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shown.map(d => {
                                const declared = (d.items || []).reduce((sum, i) => sum + (Number(i.declaredAmount) || 0), 0);
                                // The page reads the name and code from the declaration itself
                                const open = () => navigate(`/it-declaration?id=${d.employeeId}`);
                                return (
                                    <tr key={d.id} onClick={open}
                                        className="border-b border-gray-50 dark:border-[#222222] hover:bg-gray-50 dark:hover:bg-[#222222] cursor-pointer">
                                        <td className="py-2 pr-4">
                                            <span className="font-medium text-gray-900 dark:text-white">{d.employeeName || `Employee ${d.employeeId}`}</span>
                                            {d.employeeCode && <span className="ml-2 text-xs text-gray-400">{d.employeeCode}</span>}
                                        </td>
                                        <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{d.financialYear}</td>
                                        <td className="py-2 pr-4 text-gray-600 dark:text-gray-300">{d.regime}</td>
                                        <td className="py-2 pr-4"><StatusBadge status={d.status || 'DRAFT'} /></td>
                                        <td className="py-2 pr-4 text-right text-gray-900 dark:text-white">₹{declared.toLocaleString()}</td>
                                        <td className="py-2 pr-4 text-right text-gray-900 dark:text-white">{pendingOf(d)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </section>
    );
};

export default ItDeclarationPage;
