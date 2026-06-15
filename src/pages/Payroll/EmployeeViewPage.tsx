import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Briefcase,
  MapPin,
  CreditCard,
  Mail,
  Phone,
  Calendar,
  Building2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Shield,
  FileText,
  Clock,
  Calculator,
  FileSignature,
  Star,
  DoorOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Copy,
  CheckCircle,
  XCircle,
  Printer,
  Edit,
  UserCheck,
  UserX,
  Globe,
  IndianRupee,
  Home,
  MapPinned,
  FileSpreadsheet,
  FolderOpen,
  Gift,
  HeartHandshake,
  LucideIcon
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";

const EMPLOYEE_API_URL = "/v1/api/payroll/employee";

interface EmployeeData {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  personalEmail: string;
  officialEmail: string;
  maritalStatus: string;
  fatherName: string | null;
  phone: string;
  gender: string;
  dateOfBirth: string;
  employmentType: string;
  department: { id: number; name: string };
  designation: string;
  location: string;
  managerId: string;
  joiningDate: string;
  exitDate: string | null;
  bankAccountNumber: string;
  bankName: string;
  ifscCode: string;
  countryCode: string;
  active: boolean;
  salary: {
    id: number;
    ctc: number;
    currency: string;
    country: string;
    basic: number;
    hra: number;
    grossSalary: number | null;
    earnings: Record<string, number>;
    additionalBenefits: Record<string, number>;
    countrySpecificData: {
      uan: string;
      pf_number: string;
      isMetrocity: boolean;
      esi_applicable: boolean;
    };
  };
  permanentAddress: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  currentAddress: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  countrySpecificData: {
    pan: string;
    aadhaar: string;
  };
  userDto: {
    userId: string;
    username: string;
    email: string;
    active: boolean;
    tenantId: string;
    roles: Array<{ id: number; role: { roleName: string } }>;
  };
}

const EmployeeViewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<EmployeeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSensitive, setShowSensitive] = useState({
    account: false,
    aadhaar: false,
    pan: false,
  });
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    personal: true,
    employment: true,
    permanentAddress: true,
    currentAddress: true,
    banking: true,
    compliance: true,
    salary: true,
    earnings: true,
    benefits: true,
  });

  useEffect(() => {
    if (id) {
      fetchEmployeeDetails();
    }
  }, [id]);

  const fetchEmployeeDetails = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${EMPLOYEE_API_URL}/read/${id}`);
      setEmployee(res.data);
    } catch (err: any) {
      console.error("Error fetching employee details:", err);
      setError("Failed to load employee details.");
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleSensitiveData = (field: 'account' | 'aadhaar' | 'pan') => {
    setShowSensitive(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleCopy = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    // You can add a toast notification here
    console.log(`${label} copied to clipboard!`);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const maskValue = (value: string, isVisible: boolean, visibleChars: number = 4) => {
    if (!value) return "N/A";
    if (isVisible) return value;
    if (value.length <= visibleChars) return "*".repeat(value.length);
    return "*".repeat(value.length - visibleChars) + value.slice(-visibleChars);
  };

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = {
      INR: "₹",
      USD: "$",
      EUR: "€",
      GBP: "£",
    };
    return symbols[currency] || currency;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-cyan-600 rounded-full animate-spin"></div>
          <div className="text-sm text-gray-500">Loading employee details...</div>
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="text-red-500 text-xl mb-4">{error || "Employee not found"}</div>
        <button onClick={() => navigate(-1)} className="px-6 py-2.5 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition">
          Go Back
        </button>
      </div>
    );
  }

  const currencySymbol = getCurrencySymbol(employee.salary?.currency || "INR");
  const totalEarnings = employee.salary?.earnings
    ? Object.values(employee.salary.earnings).reduce((a, b) => a + b, 0)
    : 0;
  const totalBenefits = employee.salary?.additionalBenefits
    ? Object.values(employee.salary.additionalBenefits).reduce((a, b) => a + b, 0)
    : 0;

  const SectionHeader = ({ icon: Icon, title, section, badge }: { icon: LucideIcon; title: string; section: string; badge?: string }) => (
    <button
      onClick={() => toggleSection(section)}
      className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl hover:bg-gray-50 transition-all duration-200 group"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-cyan-100 rounded-lg group-hover:bg-cyan-200 transition">
          <Icon className="w-5 h-5 text-cyan-600" />
        </div>
        <div className="text-left">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {badge && <p className="text-xs text-gray-500">{badge}</p>}
        </div>
      </div>
      <div className="text-gray-400 group-hover:text-cyan-600 transition">
        {expandedSections[section] ? <ChevronRight className="w-5 h-5 rotate-90" /> : <ChevronRight className="w-5 h-5" />}
      </div>
    </button>
  );

  interface InfoRowProps {
    label: string;
    value: string | undefined | null;
    copyable?: boolean;
    sensitive?: boolean;
    sensitiveField?: 'account' | 'aadhaar' | 'pan';
    onToggleSensitive?: (field: 'account' | 'aadhaar' | 'pan') => void;
  }

  const InfoRow = ({ label, value, copyable = false, sensitive = false, sensitiveField, onToggleSensitive }: InfoRowProps) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-gray-100 last:border-0 gap-2">
      <span className="text-sm text-gray-500 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        {sensitive && onToggleSensitive && sensitiveField ? (
          <>
            <span className="text-sm text-gray-900 font-medium">{maskValue(String(value), showSensitive[sensitiveField], 4)}</span>
            <button
              onClick={() => onToggleSensitive(sensitiveField)}
              className="p-1 text-gray-400 hover:text-cyan-600 transition rounded"
            >
              {showSensitive[sensitiveField] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            {copyable && (
              <button onClick={() => handleCopy(String(value), label)} className="p-1 text-gray-400 hover:text-cyan-600 transition rounded">
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        ) : (
          <>
            <span className="text-sm text-gray-900 font-medium">{value || "N/A"}</span>
            {copyable && value && (
              <button onClick={() => handleCopy(value, label)} className="p-1 text-gray-400 hover:text-cyan-600 transition rounded">
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  const AddressCard = ({ title, address }: { title: string; address: EmployeeData['permanentAddress'] }) => (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        {title === "Permanent Address" ? <Home className="w-4 h-4 text-cyan-600" /> : <MapPinned className="w-4 h-4 text-cyan-600" />}
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      </div>
      <div className="space-y-1 text-sm text-gray-600">
        <p>{address.line1}</p>
        {address.line2 && <p>{address.line2}</p>}
        <p>{address.city}, {address.state}</p>
        <p>Postal Code: {address.postalCode}</p>
        <p className="font-medium text-gray-700">{address.country}</p>
      </div>
    </div>
  );

  return (
    <>
      <PageMeta title={`${employee.firstName} ${employee.lastName} - Employee Profile`} description="Employee profile details" />
      <PageBreadcrumb pageTitle={`Employee Profile`} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {/* Header Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate("/employeeRecords")}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  {employee.firstName} {employee.lastName}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-sm text-gray-500">{employee.employeeCode}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${employee.active
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                    }`}>
                    {employee.active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {employee.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate(`/employeeRecords?editId=${employee.id}`)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition"
              >
                <Edit className="w-4 h-4" />
                Edit Employee
              </button>
              <button
                onClick={() => {/* Handle status toggle */ }}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${employee.active
                  ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
                  : "bg-green-50 text-green-600 hover:bg-green-100 border border-green-200"
                  }`}
              >
                {employee.active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                {employee.active ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Personal & Contact */}
          <div className="lg:col-span-1 space-y-4">
            {/* Personal Information */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader icon={User} title="Personal Information" section="personal" />
              <AnimatePresence>
                {expandedSections.personal && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 pb-4"
                  >
                    <InfoRow label="First Name" value={employee.firstName} />
                    <InfoRow label="Last Name" value={employee.lastName} />
                    <InfoRow label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
                    <InfoRow label="Gender" value={employee.gender} />
                    <InfoRow label="Marital Status" value={employee.maritalStatus} />
                    <InfoRow label="Father's Name" value={employee.fatherName || "N/A"} />
                    <InfoRow
                      label="Personal Email"
                      value={employee.personalEmail}
                      copyable
                    />
                    <InfoRow
                      label="Official Email"
                      value={employee.officialEmail}
                      copyable
                    />
                    <InfoRow
                      label="Phone Number"
                      value={employee.phone}
                      copyable
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Employment Information */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader icon={Briefcase} title="Employment Details" section="employment" />
              <AnimatePresence>
                {expandedSections.employment && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 pb-4"
                  >
                    <InfoRow label="Employee Code" value={employee.employeeCode} copyable />
                    <InfoRow label="Designation" value={employee.designation} />
                    <InfoRow label="Department" value={employee.department?.name} />
                    <InfoRow label="Employment Type" value={employee.employmentType} />
                    <InfoRow label="Location" value={employee.location} />
                    <InfoRow label="Joining Date" value={formatDate(employee.joiningDate)} />
                    {employee.exitDate && <InfoRow label="Exit Date" value={formatDate(employee.exitDate)} />}
                    {employee.userDto?.roles && employee.userDto.roles.length > 0 && (
                      <InfoRow
                        label="Roles"
                        value={employee.userDto.roles.map(r => r.role.roleName).join(", ")}
                      />
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Permanent Address */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader icon={Home} title="Permanent Address" section="permanentAddress" />
              <AnimatePresence>
                {expandedSections.permanentAddress && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 pb-4"
                  >
                    <AddressCard title="Permanent Address" address={employee.permanentAddress} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Current Address */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader icon={MapPinned} title="Current Address" section="currentAddress" />
              <AnimatePresence>
                {expandedSections.currentAddress && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 pb-4"
                  >
                    <AddressCard title="Current Address" address={employee.currentAddress} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Column - Banking, Salary, Compliance */}
          <div className="lg:col-span-2 space-y-4">
            {/* Banking Information */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader icon={CreditCard} title="Banking Information" section="banking" />
              <AnimatePresence>
                {expandedSections.banking && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 pb-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <InfoRow label="Bank Name" value={employee.bankName} />
                        <InfoRow
                          label="Account Number"
                          value={employee.bankAccountNumber}
                          sensitive
                          sensitiveField="account"
                          onToggleSensitive={toggleSensitiveData}
                          copyable
                        />
                      </div>
                      <div className="space-y-3">
                        <InfoRow label="IFSC Code" value={employee.ifscCode} copyable />
                        <InfoRow label="Branch" value="Main" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Compliance (India-specific) */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader icon={Shield} title="Statutory Compliance" section="compliance" badge="India-specific" />
              <AnimatePresence>
                {expandedSections.compliance && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 pb-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <InfoRow
                          label="PAN Number"
                          value={employee.countrySpecificData?.pan}
                          sensitive
                          sensitiveField="pan"
                          onToggleSensitive={toggleSensitiveData}
                          copyable
                        />
                        <InfoRow
                          label="Aadhaar Number"
                          value={employee.countrySpecificData?.aadhaar}
                          sensitive
                          sensitiveField="aadhaar"
                          onToggleSensitive={toggleSensitiveData}
                          copyable
                        />
                      </div>
                      <div className="space-y-3">
                        <InfoRow label="UAN" value={employee.salary?.countrySpecificData?.uan} copyable />
                        <InfoRow label="PF Number" value={employee.salary?.countrySpecificData?.pf_number} copyable />
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-gray-100">
                          <span className="text-sm text-gray-500">Metro City</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${employee.salary?.countrySpecificData?.isMetrocity
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                            }`}>
                            {employee.salary?.countrySpecificData?.isMetrocity ? "Yes" : "No"}
                          </span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 border-b border-gray-100">
                          <span className="text-sm text-gray-500">ESI Applicable</span>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${employee.salary?.countrySpecificData?.esi_applicable
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                            }`}>
                            {employee.salary?.countrySpecificData?.esi_applicable ? "Yes" : "No"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Salary Overview */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <SectionHeader icon={DollarSign} title="Salary Overview" section="salary" />
              <AnimatePresence>
                {expandedSections.salary && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 pb-4"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                      <div className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-xl p-4 text-center">
                        <span className="text-sm text-cyan-700">Total CTC</span>
                        <h2 className="text-2xl font-bold text-cyan-900">
                          {currencySymbol} {employee.salary?.ctc?.toLocaleString()}
                        </h2>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 text-center">
                        <span className="text-sm text-purple-700">Gross Salary (Annual)</span>
                        <h2 className="text-2xl font-bold text-purple-900">
                          {currencySymbol} {(totalEarnings + totalBenefits)?.toLocaleString()}
                        </h2>
                      </div>
                    </div>

                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <h4 className="text-sm font-semibold text-gray-900">Earnings Breakdown</h4>
                      </div>
                      <div className="space-y-2">
                        {employee.salary?.earnings && Object.entries(employee.salary.earnings).map(([name, amount]) => (
                          <div key={name} className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">{name}</span>
                            <span className="text-sm font-medium text-gray-900">{currencySymbol} {amount?.toLocaleString()}</span>
                          </div>
                        ))}
                        {(!employee.salary?.earnings || Object.keys(employee.salary.earnings).length === 0) && (
                          <div className="text-sm text-gray-500 italic">No earnings configured</div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Gift className="w-4 h-4 text-cyan-600" />
                        <h4 className="text-sm font-semibold text-gray-900">Additional Benefits</h4>
                      </div>
                      <div className="space-y-2">
                        {employee.salary?.additionalBenefits && Object.entries(employee.salary.additionalBenefits).map(([name, amount]) => (
                          <div key={name} className="flex justify-between py-2 border-b border-gray-100">
                            <span className="text-sm text-gray-600">{name}</span>
                            <span className="text-sm font-medium text-gray-900">{currencySymbol} {amount?.toLocaleString()}</span>
                          </div>
                        ))}
                        {(!employee.salary?.additionalBenefits || Object.keys(employee.salary.additionalBenefits).length === 0) && (
                          <div className="text-sm text-gray-500 italic">No additional benefits configured</div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Navigation Cards - Quick Links */}
        <div className="mt-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-cyan-600" />
              Management & Operations
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {[
                { icon: DollarSign, title: "Salary Management", link: "/employeePayroll" },
                { icon: Calendar, title: "Leave Management", link: "/leave-management" },
                { icon: Clock, title: "Attendance", link: "/attendance-management" },
                { icon: FileText, title: "Statutory Compliance", link: "/statutoryCompliances" },
                { icon: FolderOpen, title: "Documents", link: "/document-management" },
                { icon: Calculator, title: "Payroll Processing", link: "/payrollRuns" },
                { icon: FileSignature, title: "Payslips", link: "/employeePayroll" },
                { icon: FileSignature, title: "IT Declaration", link: "/it-declaration" },
                { icon: Star, title: "Performance", link: "/performance-management" },
                { icon: DoorOpen, title: "Exit Management", link: "/exit-management" },
              ].map((nav, idx) => {
                const Icon = nav.icon;
                const exportData = {
                  id: employee.id,
                  employeeCode: employee.employeeCode,
                  firstName: employee.firstName,
                  lastName: employee.lastName,
                  department: employee.department?.name,
                  designation: employee.designation,
                  countryCode: employee.countryCode
                };
                const params = new URLSearchParams({
                  id: exportData.id.toString(),
                  employeeCode: exportData.employeeCode,
                  employeeName: `${exportData.firstName} ${exportData.lastName}`,
                  department: exportData.department || '',
                  position: exportData.designation || '',
                  countryCode: exportData.countryCode
                });
                return (
                  <button
                    key={idx}
                    onClick={() => navigate(`${nav.link}?${params.toString()}`)}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-200 hover:border-cyan-300 hover:bg-cyan-50 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gray-100 group-hover:bg-cyan-100 flex items-center justify-center transition">
                      <Icon className="w-5 h-5 text-gray-600 group-hover:text-cyan-600" />
                    </div>
                    <span className="text-xs font-medium text-gray-700 group-hover:text-cyan-700 text-center">
                      {nav.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EmployeeViewPage;