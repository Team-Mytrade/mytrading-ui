import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Select from "react-select";
import getSymbolFromCurrency from "currency-symbol-map";
import {
  User,
  Briefcase,
  MapPin,
  CreditCard,
  CheckCircle,
  Home,
  DollarSign,
  X,
  ArrowRight,
  ArrowLeft,
  Mail,
  Users,
  AlertCircle,
  PlusIcon,
  TrashIcon,
  TrendingUp,
  TrendingDown,
  Building2,
  Shield,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { TOOL_BUTTON } from "./hrmsUi";
import { ToasterService } from "../../Services/ToasterService";
import { apiError, apiFieldErrors } from "../../utils/apiError";
import { toLocalIsoDate } from "../../utils/localDate";
import {
  Department,
  EmploymentType,
  MaritalStatus,
  Gender,
} from "../../shared/types/employee.types";
import { COUNTRY_OPTIONS, ALL_CURRENCIES } from "../../shared/utils/country-list";
import type { ICity, IState } from "country-state-city";
import { formatNumber, formatDate, companyCurrency } from "../../company/format";

import { t } from "../../i18n/i18n";
import GulfEmployeeFields from "./GulfEmployeeFields";
import {
  EMPTY_GULF,
  GULF_LABELS,
  GulfDetails,
  PAYROLL_COUNTRIES,
  defaultPayrollCountry,
  gulfErrors,
  gulfFromCountryData,
  gulfToCountryData,
  gulfValueLabel,
  isGcc,
  salaryCountry,
} from "./gulfPayroll";
// The city/state dataset is several MB, so it is downloaded after the page opens rather than with it
type GeoData = {
  State: { getStatesOfCountry: (countryCode: string) => IState[] };
  City: { getCitiesOfState: (countryCode: string, stateCode: string) => ICity[] };
};
const NO_GEO_DATA: GeoData = {
  State: { getStatesOfCountry: () => [] },
  City: { getCitiesOfState: () => [] },
};

const EMPLOYEE_API_URL = "/v1/api/payroll/employee";
const DEPARTMENT_API_URL = "/v1/api/payroll/department";
// Roles with a "grantable" flag for the signed-in user (needs Users access)
const ROLE_API_URL = "/v1/api/user/access/roles";

// Dates travel as plain yyyy-MM-dd: toISOString() turns a local midnight into the previous day east of UTC
const toApiDate = (date: Date | null) => (date ? toLocalIsoDate(date) : null);
const fromApiDate = (value?: string | null) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

// The stored Aadhaar comes back masked; sending it back unchanged keeps it
const MASKED_AADHAAR = /^XXXX-XXXX-\d{4}$/;
const PAN_FORMAT = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// Which form step shows a field, so a server-side field error can take the user there
const FIELD_STEPS: Record<string, number> = {
  firstName: 1, lastName: 1, personalEmail: 1, officialEmail: 1, dateOfBirth: 1,
  designation: 2, department: 2, joiningDate: 2, employmentType: 2, userType: 2, role: 2,
  aadhaarNumber: 4, panNumber: 4, "salary.ctc": 4, "salary.variablePay": 4,
  nationality: 4, iban: 4, emiratesId: 4, mohrePersonId: 4, bankRoutingCode: 4, pensionFund: 4,
  nationalId: 4, gosiNumber: 4, pensionRegistrationDate: 4,
};

// Pay components (Compensation page): basic is a % of CTC, HRA a % of basic
interface PayComponent {
  employeeRole: string;
  componentDetails: Record<string, number>;
}
// Older set-ups saved the names as "Basic" / "HRA"
const percentOf = (details: Record<string, number> | undefined, key: string): number | null => {
  const entry = Object.entries(details ?? {}).find(([name]) => name.trim().toLowerCase() === key);
  return entry && entry[1] != null ? Number(entry[1]) : null;
};

interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  designation: string;
  employeeCode: string;
}

interface Earning {
  name: string;
  amount: number;
}

interface AdditionalBenefit {
  name: string;
  amount: number;
}

// Shown in the CTC (fixed CTC + yearly targets); payroll runs do not pay it
interface VariablePay {
  name: string;
  targetAmount: number;
  frequency: string;
  payoutBasis: string;
}

const VARIABLE_FREQUENCIES = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
  { value: "HALF_YEARLY", label: "Half-yearly" },
  { value: "ANNUAL", label: "Annual" },
  { value: "AD_HOC", label: "Ad hoc" },
];
const VARIABLE_BASES = [
  { value: "FIXED_AMOUNT", label: "Fixed amount" },
  { value: "PERCENTAGE_OF_BASIC", label: "% of basic" },
  { value: "KPI_LINKED", label: "Linked to targets / KPIs" },
];

interface Role {
  id: number;
  roleName: string;
  roleCode: string;
  // False when the signed-in user may not hand out this role (the user service would refuse it)
  grantable?: boolean;
}

enum Regime {
  OLD = "OLD",
  NEW = "NEW",
}

enum UserType {
  ADMIN = "ADMIN",
  USER = "USER",
  EMPLOYEE = "EMPLOYEE",
}

const customClassNames = {
  control: (state: any) =>
    `!min-h-[42px] !rounded-lg !border !bg-white !transition-all ${
      state.isFocused
        ? '!border-cyan-500 !shadow-[0_0_0_2px_rgb(var(--brand-500,6_182_212)/0.2)]'
        : '!border-gray-300 hover:!border-cyan-500'
    } ${state.isDisabled ? '!bg-gray-100' : ''}`,
  valueContainer: () => '!px-3',
  input: () => '!m-0 !p-0',
  placeholder: () => '!m-0 !text-gray-500',
  option: (state: any) =>
    `!cursor-pointer !px-4 !py-2 ${
      state.isSelected
        ? '!bg-cyan-500 !text-white'
        : state.isFocused
        ? '!bg-cyan-100 !text-gray-900'
        : '!bg-white !text-gray-700'
    } hover:!bg-cyan-500 hover:!text-white !transition-colors active:!bg-cyan-500 active:!text-white`,
  menu: () => '!mt-1 !overflow-hidden !rounded-lg !border !border-gray-200 !bg-white !shadow-lg !z-50',
  menuList: () => '!p-0',
};

const AddEmployeePage: React.FC = () => {
  const [geoData, setGeoData] = useState<GeoData>(NO_GEO_DATA);
  useEffect(() => {
    let active = true;
    import("country-state-city")
      .then(({ State, City }) => {
        if (active) setGeoData({ State, City });
      })
      .catch(() => undefined); // address fields fall back to free text
    return () => {
      active = false;
    };
  }, []);
  const { State, City } = geoData;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("editId");
  const [currentStep, setCurrentStep] = useState(1);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [rolesUnavailable, setRolesUnavailable] = useState(false);
  const [payComponents, setPayComponents] = useState<PayComponent[]>([]);
  const [storedAadhaar, setStoredAadhaar] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sameAsPermanent, setSameAsPermanent] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showPAN, setShowPAN] = useState(false);
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [isOtherDepartment, setIsOtherDepartment] = useState(false);
  const [customDepartment, setCustomDepartment] = useState("");

  // Addresses start in the company's payroll country
  const defaultCountry = COUNTRY_OPTIONS.find(c => c.code === defaultPayrollCountry())
    || COUNTRY_OPTIONS.find(c => c.value === "India") || {
    value: "India",
    label: "India",
    code: "IN",
    currency: "INR",
    currencySymbol: "₹",
  };

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    personalEmail: "",
    officialEmail: "",
    userType: UserType.EMPLOYEE,
    maritalStatus: "SINGLE" as MaritalStatus,
    fatherName: "",
    phone: "",
    // The payroll country (which country's rules pay the employee), chosen on the Bank & Salary step
    countryCode: defaultPayrollCountry(),
    gulf: { ...EMPTY_GULF } as GulfDetails,
    gender: "MALE" as Gender,
    dateOfBirth: null as Date | null,
    employmentType: "FULL_TIME" as EmploymentType,
    designation: "",
    location: "",
    managerId: "",
    joiningDate: null as Date | null,
    exitDate: null as Date | null,
    bankAccountNumber: "",
    bankName: "",
    ifscCode: "",
    branch: "Main",
    isActive: true,
    taxRegime: "New Regime",
    esiApplicable: false,
    metroCity: false,
    panNumber: "",
    aadhaarNumber: "",
    pfNumber: "",
    uan: "",
    department: { id: 0, name: "" },
    // The login's role, by name (the user service grants one role)
    role: "",
    userDetails: {
      phoneNumber: "",
      country: "",
      city: "",
      address: "",
      postalCode: "",
      aboutMe: "",
    },
    permanentAddress: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      country: defaultCountry,
      postalCode: "",
    },
    currentAddress: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      country: defaultCountry,
      postalCode: "",
    },
    salary: {
      currency: companyCurrency(),
      ctc: 0,
      role: "",
      country: salaryCountry(defaultPayrollCountry()),
      earnings: [] as Earning[],
      additionalBenefits: [] as AdditionalBenefit[],
      variablePay: [] as VariablePay[],
    },
  });

  // The employee belongs to the signed-in user's company; the services take the tenant from the login
  useEffect(() => {
    fetchDepts();
    fetchManagers();
    fetchRoles();
    fetchPayComponents();
    if (editId) fetchEmployee(editId);
  }, [editId]);

  // Listing roles needs Users access; without it the login is created without a role
  const fetchRoles = async () => {
    try {
      const res = await axios.get(ROLE_API_URL);
      setAllRoles(Array.isArray(res.data) ? res.data : []);
    } catch {
      setRolesUnavailable(true);
    }
  };

  const fetchPayComponents = async () => {
    try {
      const res = await axios.get(`${EMPLOYEE_API_URL}/getPayroleComponents`);
      setPayComponents(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error(apiError(error, "Designations could not be loaded"));
    }
  };

  useEffect(() => {
    if (sameAsPermanent) {
      setForm((prev) => ({
        ...prev,
        currentAddress: { ...prev.permanentAddress },
      }));
    }
  }, [sameAsPermanent]);

  useEffect(() => {
    const country = form.permanentAddress.country;
    if (country && country.currency) {
      setForm((prev) => ({
        ...prev,
        salary: {
          ...prev.salary,
          currency: country.currency,
        },
      }));
    }
  }, [form.permanentAddress.country]);

  // Update CTC whenever earnings or grossSalary changes
  // useEffect(() => {
  //   const totalEarnings = form.salary.earnings.reduce((sum, e) => sum + e.amount, 0);
  //   const totalBenefits = form.salary.additionalBenefits.reduce((sum, b) => sum + b.amount, 0);
  //   const ctc = totalEarnings + totalBenefits;
  //   setForm((prev) => ({
  //     ...prev,
  //     salary: {
  //       ...prev.salary,
  //       ctc: ctc,
  //       role: prev.designation,
  //     },
  //   }));
  // }, [form.salary.earnings, form.salary.additionalBenefits, form.designation]);

  const fetchDepts = async () => {
    try {
      const res = await axios.get(`${DEPARTMENT_API_URL}/listAll`);
      setDepartments(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      ToasterService.error(apiError(error, "Departments could not be loaded"));
    }
  };

  const fetchManagers = async () => {
    try {
      const res = await axios.get(`${EMPLOYEE_API_URL}/all`);
      const managerList = (Array.isArray(res.data) ? res.data : []).filter(
        (emp: Employee) =>
          emp.designation?.toLowerCase().includes("manager") ||
          emp.designation?.toLowerCase().includes("lead") ||
          emp.designation?.toLowerCase().includes("head")
      );
      setManagers(managerList);
    } catch (error) {
      console.error("Error fetching managers:", error);
    }
  };

  const fetchEmployee = async (id: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`${EMPLOYEE_API_URL}/read/${id}`);
      const employeeData = res.data;
      employeeData.dateOfBirth = fromApiDate(employeeData.dateOfBirth);
      employeeData.joiningDate = fromApiDate(employeeData.joiningDate);
      employeeData.exitDate = fromApiDate(employeeData.exitDate);
      employeeData.managerId = employeeData.managerId ?? "";
      employeeData.branch = employeeData.branch ?? "";
      employeeData.userType = employeeData.userType || UserType.EMPLOYEE;
      employeeData.role = employeeData.userDto?.role || "";

      // Convert earnings object to array if needed
      if (employeeData.salary?.earnings && typeof employeeData.salary.earnings === 'object' && !Array.isArray(employeeData.salary.earnings)) {
        employeeData.salary.earnings = Object.entries(employeeData.salary.earnings).map(([name, amount]) => ({
          name,
          amount: amount as number
        }));
      }

      // Convert additionalBenefits object to array if needed
      if (employeeData.salary?.additionalBenefits && typeof employeeData.salary.additionalBenefits === 'object' && !Array.isArray(employeeData.salary.additionalBenefits)) {
        employeeData.salary.additionalBenefits = Object.entries(employeeData.salary.additionalBenefits).map(([name, amount]) => ({
          name,
          amount: amount as number
        }));
      }

      // Convert department if it's just an ID
      if (employeeData.department && typeof employeeData.department === 'number') {
        employeeData.department = { id: employeeData.department, name: "" };
      } else if (!employeeData.department) {
        employeeData.department = { id: 0, name: "" };
      }

      if (!employeeData.permanentAddress) {
        employeeData.permanentAddress = { line1: "", line2: "", city: "", state: "", country: defaultCountry, postalCode: "" };
      } else {
        const countryVal = typeof employeeData.permanentAddress.country === 'string'
          ? employeeData.permanentAddress.country
          : employeeData.permanentAddress.country?.value || employeeData.permanentAddress.country?.label;
        if (countryVal) {
          const matchedCountry = COUNTRY_OPTIONS.find(c =>
            c.value.toLowerCase() === countryVal.toLowerCase() ||
            c.label.toLowerCase() === countryVal.toLowerCase()
          );
          if (matchedCountry) {
            employeeData.permanentAddress.country = matchedCountry;
          } else {
            employeeData.permanentAddress.country = defaultCountry;
          }
        } else {
          employeeData.permanentAddress.country = defaultCountry;
        }
      }

      if (!employeeData.currentAddress) {
        employeeData.currentAddress = { line1: "", line2: "", city: "", state: "", country: defaultCountry, postalCode: "" };
      } else {
        const countryVal = typeof employeeData.currentAddress.country === 'string'
          ? employeeData.currentAddress.country
          : employeeData.currentAddress.country?.value || employeeData.currentAddress.country?.label;
        if (countryVal) {
          const matchedCountry = COUNTRY_OPTIONS.find(c =>
            c.value.toLowerCase() === countryVal.toLowerCase() ||
            c.label.toLowerCase() === countryVal.toLowerCase()
          );
          if (matchedCountry) {
            employeeData.currentAddress.country = matchedCountry;
          } else {
            employeeData.currentAddress.country = defaultCountry;
          }
        } else {
          employeeData.currentAddress.country = defaultCountry;
        }
      }

      if (!employeeData.userDetails) {
        employeeData.userDetails = { phoneNumber: "", country: "", city: "", address: "", postalCode: "", aboutMe: "" };
      }

      if (!employeeData.salary) {
        employeeData.salary = {
          currency: companyCurrency(),
          ctc: 0,
          role: "",
          country: "INDIA",
          earnings: [],
          additionalBenefits: [],
          variablePay: [],
        };
      } else {
        // Basic and HRA are worked out by the service from the CTC, so only the extra earnings are edited here
        if (!employeeData.salary.earnings) {
          employeeData.salary.earnings = [];
        }
        if (!employeeData.salary.additionalBenefits) {
          employeeData.salary.additionalBenefits = [];
        }
        // Saved as { name: { targetAmount, frequency, payoutBasis } }; edited as rows
        const variable = employeeData.salary.variablePayStructure;
        employeeData.salary.variablePay = variable && typeof variable === "object"
          ? Object.entries(variable as Record<string, Partial<VariablePay>>).map(([name, v]) => ({
              name,
              targetAmount: Number(v?.targetAmount) || 0,
              frequency: v?.frequency || "ANNUAL",
              payoutBasis: v?.payoutBasis || "FIXED_AMOUNT",
            }))
          : [];
      }

      // Map nested countrySpecificData (PAN, Aadhaar) to root level
      if (employeeData.countrySpecificData) {
        employeeData.panNumber = employeeData.countrySpecificData.pan || "";
        employeeData.aadhaarNumber = employeeData.countrySpecificData.aadhaar || "";
        setStoredAadhaar(MASKED_AADHAAR.test(employeeData.aadhaarNumber) ? employeeData.aadhaarNumber : "");
      } else {
        employeeData.panNumber = "";
        employeeData.aadhaarNumber = "";
      }
      employeeData.countryCode = (employeeData.countryCode || "IN").toUpperCase();
      employeeData.gulf = gulfFromCountryData(employeeData.countrySpecificData);

      // Map nested salary.countrySpecificData (PF, UAN, ESI, Metrocity, taxRegime) to root level
      if (employeeData.salary && employeeData.salary.countrySpecificData) {
        employeeData.pfNumber = employeeData.salary.countrySpecificData.pf_number || "";
        employeeData.uan = employeeData.salary.countrySpecificData.uan || "";
        employeeData.esiApplicable = !!employeeData.salary.countrySpecificData.esi_applicable;
        employeeData.metroCity = !!employeeData.salary.countrySpecificData.isMetrocity;
        employeeData.taxRegime = employeeData.salary.countrySpecificData.taxRegime === "NEW" ? "New Regime" : "Old Regime";
      } else {
        employeeData.pfNumber = "";
        employeeData.uan = "";
        employeeData.esiApplicable = false;
        employeeData.metroCity = false;
        employeeData.taxRegime = "New Regime";
      }

      setForm(employeeData);
    } catch (error) {
      ToasterService.error(apiError(error, "The employee could not be loaded"));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (path: string, value: any) => {
    if (path === "permanentAddress.postalCode" || path === "currentAddress.postalCode") {
      if (typeof value === "string") {
        // Indian PIN codes are 6 digits; other countries' codes can have letters (and the UAE has none)
        const address = path.startsWith("permanent") ? form.permanentAddress : form.currentAddress;
        value = address.country?.value === "India"
          ? value.replace(/\D/g, "").slice(0, 6)
          : value.replace(/[^A-Za-z0-9 -]/g, "").slice(0, 10);
      }
    }
    const keys = path.split(".");
    if (keys.length === 1) {
      setForm((prev) => ({ ...prev, [path]: value }));
      setErrors((prev) => ({ ...prev, [path]: "" }));
      return;
    }
    setForm((prev) => {
      const updated = { ...prev };
      let current: any = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {};
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return updated;
    });
    setErrors((prev) => ({ ...prev, [path]: "" }));
  };

  const handleEarningChange = (index: number, field: "name" | "amount", value: string | number) => {
    const updatedEarnings = [...form.salary.earnings];
    if (field === "name") {
      updatedEarnings[index].name = value as string;
    } else {
      updatedEarnings[index].amount = Number(value);
    }
    handleChange("salary.earnings", updatedEarnings);
  };

  const handleAdditionalBenefitsChange = (index: number, field: "name" | "amount", value: string | number) => {
    const updatedBenefits = [...form.salary.additionalBenefits];
    if (field === "name") {
      updatedBenefits[index].name = value as string;
    } else {
      updatedBenefits[index].amount = Number(value);
    }
    handleChange("salary.additionalBenefits", updatedBenefits);
  };

  const addAdditionalBenefits = () => {
    const lastBenefit = form.salary.additionalBenefits[form.salary.additionalBenefits.length - 1];
    if (form.salary.additionalBenefits.length > 0) {
      if (!lastBenefit.name.trim()) {
        ToasterService.error("Please fill the current benefit name before adding a new one");
        return;
      }
      if (lastBenefit.amount <= 0) {
        ToasterService.error("Please enter a valid amount for the current benefit");
        return;
      }
    }
    handleChange("salary.additionalBenefits", [...form.salary.additionalBenefits, { name: "", amount: 0 }]);
  };

  const addEarning = () => {
    const lastEarning = form.salary.earnings[form.salary.earnings.length - 1];
    if (form.salary.earnings.length > 0) {
      if (!lastEarning.name.trim()) {
        ToasterService.error("Please fill the current earning name before adding a new one");
        return;
      }
      if (lastEarning.amount <= 0) {
        ToasterService.error("Please enter a valid amount for the current earning");
        return;
      }
    }
    handleChange("salary.earnings", [...form.salary.earnings, { name: "", amount: 0 }]);
  };

  const removeEarning = (index: number) => {
    handleChange("salary.earnings", form.salary.earnings.filter((_, i) => i !== index));
  };

  const variablePayRows: VariablePay[] = form.salary.variablePay ?? [];
  const handleVariablePayChange = (index: number, field: keyof VariablePay, value: string | number) => {
    const rows = [...variablePayRows];
    rows[index] = { ...rows[index], [field]: field === "targetAmount" ? Number(value) || 0 : value };
    handleChange("salary.variablePay", rows);
  };
  const addVariablePay = () =>
    handleChange("salary.variablePay", [...variablePayRows, { name: "", targetAmount: 0, frequency: "ANNUAL", payoutBasis: "FIXED_AMOUNT" }]);
  const removeVariablePay = (index: number) =>
    handleChange("salary.variablePay", variablePayRows.filter((_, i) => i !== index));

  const removeAdditionalBenefits = (index: number) => {
    handleChange("salary.additionalBenefits", form.salary.additionalBenefits.filter((_, i) => i !== index));
  };

  const handleCountryChange = (addressType: "permanentAddress" | "currentAddress", country: any) => {
    handleChange(`${addressType}.country`, country);
    handleChange(`${addressType}.state`, "");
  };

  const handleDepartmentChange = (deptId: number) => {
    if (deptId === -1) {
      setIsOtherDepartment(true);
      handleChange("department", { id: -1, name: "" });
    } else {
      setIsOtherDepartment(false);
      const department = departments.find((d) => d.id === deptId);
      handleChange("department", department ? { id: department.id, name: department.name } : { id: 0, name: "" });
      setCustomDepartment("");
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: { [key: string]: string } = {};

    switch (step) {
      case 1:
        if (!(form.firstName || "").trim()) newErrors.firstName = "First name is required";
        if (!(form.lastName || "").trim()) newErrors.lastName = "Last name is required";
        if (!(form.fatherName || "").trim()) newErrors.fatherName = "Father's name is required";
        if (!(form.personalEmail || "").trim()) {
          newErrors.personalEmail = "Personal email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.personalEmail || "")) {
          newErrors.personalEmail = "Invalid email format";
        }
        if (!(form.officialEmail || "").trim()) {
          newErrors.officialEmail = "Official email is required";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.officialEmail || "")) {
          newErrors.officialEmail = "Invalid email format";
        }
        if (!form.phone) newErrors.phone = "Phone number is required";
        if (!form.dateOfBirth) newErrors.dateOfBirth = "Date of birth is required";
        if (!form.gender) newErrors.gender = "Gender is required";
        break;

      case 2:
        if (!(form.designation || "").trim()) newErrors.designation = "Designation is required";
        else if (designationMissingSetup) newErrors.designation = "This designation has no pay components; choose another or set it up first";
        if (!form.department.id || form.department.id === 0) newErrors.department = "Department is required";
        else if (isOtherDepartment && !customDepartment.trim()) newErrors.department = "Enter the new department's name";
        if (!(form.location || "").trim()) newErrors.location = "Location is required";
        if (!form.joiningDate) newErrors.joiningDate = "Joining date is required";
        if (!form.employmentType) newErrors.employmentType = "Employment type is required";
        break;

      case 3:
        if (!(form.permanentAddress.line1 || "").trim()) newErrors["permanentAddress.line1"] = "Address line 1 is required";
        if (!(form.permanentAddress.city || "").trim()) newErrors["permanentAddress.city"] = "City is required";
        if (!form.permanentAddress.state) newErrors["permanentAddress.state"] = "State is required";
        {
          // A 6-digit PIN code in India; elsewhere optional (the UAE has no postal codes)
          const postalProblem = (address: typeof form.permanentAddress) => {
            if (address.country?.value !== "India") return "";
            if (!(address.postalCode || "").trim()) return "Postal code is required";
            return address.postalCode.length !== 6 ? "Postal code must be exactly 6 digits" : "";
          };
          const permanentPostal = postalProblem(form.permanentAddress);
          if (permanentPostal) newErrors["permanentAddress.postalCode"] = permanentPostal;
          if (!sameAsPermanent) {
            if (!(form.currentAddress.line1 || "").trim()) newErrors["currentAddress.line1"] = "Address line 1 is required";
            if (!(form.currentAddress.city || "").trim()) newErrors["currentAddress.city"] = "City is required";
            if (!form.currentAddress.state) newErrors["currentAddress.state"] = "State is required";
            const currentPostal = postalProblem(form.currentAddress);
            if (currentPostal) newErrors["currentAddress.postalCode"] = currentPostal;
          }
        }
        break;

      case 4:
        if (!(form.bankName || "").trim()) newErrors.bankName = "Bank name is required";
        // In the Gulf salaries go to the IBAN; the account number is optional there
        if (!isGcc(form.countryCode) && !(form.bankAccountNumber || "").trim()) newErrors.bankAccountNumber = "Account number is required";
        Object.assign(newErrors, gulfErrors(form.countryCode, form.gulf));
        if (form.countryCode === "IN") {
          if (!(form.ifscCode || "").trim()) newErrors.ifscCode = "IFSC code is required";
          if (form.panNumber && !PAN_FORMAT.test(form.panNumber)) newErrors.panNumber = "PAN looks like ABCDE1234F";
          if (form.aadhaarNumber && !MASKED_AADHAAR.test(form.aadhaarNumber) && !/^\d{12}$/.test(form.aadhaarNumber)) {
            newErrors.aadhaarNumber = "Aadhaar has 12 digits";
          }
        }
        if (!(Number(form.salary.ctc) > 0)) newErrors["salary.ctc"] = "Enter the yearly CTC";
        {
          const names = new Set<string>();
          (form.salary.variablePay ?? []).forEach((row: VariablePay) => {
            const name = row.name.trim().toLowerCase();
            if (!name) newErrors["salary.variablePay"] = "Give each variable pay component a name";
            else if (names.has(name)) newErrors["salary.variablePay"] = `${row.name.trim()} is listed twice`;
            else if (!(row.targetAmount > 0)) newErrors["salary.variablePay"] = `Enter the yearly target for ${row.name.trim()}`;
            names.add(name);
          });
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // A department typed under "Other" is created first, so the employee can be filed under it
  const resolveDepartmentId = async (): Promise<number> => {
    if (!isOtherDepartment) return form.department.id;
    const res = await axios.post(`${DEPARTMENT_API_URL}/create`, { name: customDepartment.trim() });
    const created = res.data as Department;
    setDepartments((prev) => [...prev, created]);
    setIsOtherDepartment(false);
    setCustomDepartment("");
    handleChange("department", { id: created.id, name: created.name });
    return created.id;
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    setIsSubmitting(true);
    try {
      const departmentId = await resolveDepartmentId();
      // Convert earnings array to object
      const earningsObject: Record<string, number> = {};
      form.salary.earnings.forEach((earning) => {
        if (earning.name && earning.amount > 0) {
          earningsObject[earning.name] = earning.amount;
        }
      });

      // Convert additionalBenefits array to object
      const additionalBenefitsObject: Record<string, number> = {};
      form.salary.additionalBenefits.forEach((benefit) => {
        if (benefit.name && benefit.amount > 0) {
          additionalBenefitsObject[benefit.name] = benefit.amount;
        }
      });
      const variablePayObject: Record<string, { targetAmount: number; frequency: string; payoutBasis: string; taxable: boolean }> = {};
      (form.salary.variablePay ?? []).forEach((row: VariablePay) => {
        if (row.name.trim() && row.targetAmount > 0) {
          variablePayObject[row.name.trim()] = { targetAmount: row.targetAmount, frequency: row.frequency, payoutBasis: row.payoutBasis, taxable: true };
        }
      });
      // The service numbers the employee per department and creates the login (signed in with the official email)
      const submitData = {
        firstName: form.firstName,
        lastName: form.lastName,
        personalEmail: form.personalEmail,
        officialEmail: form.officialEmail,
        maritalStatus: form.maritalStatus,
        fatherName: form.fatherName,
        phone: form.phone,
        gender: form.gender,
        dateOfBirth: toApiDate(form.dateOfBirth),
        employmentType: form.employmentType,
        location: form.location,
        managerId: form.managerId || null,
        joiningDate: toApiDate(form.joiningDate),
        designation: form.designation,
        exitDate: toApiDate(form.exitDate),
        // Paid to the IBAN in the Gulf when no separate account number is given
        bankAccountNumber: form.bankAccountNumber || (isGcc(form.countryCode) ? form.gulf.iban.replace(/\s+/g, "").toUpperCase() : ""),
        bankName: form.bankName,
        ifscCode: form.ifscCode,
        branch: form.branch,
        countryCode: form.countryCode,
        userType: form.userType,
        department: { id: departmentId },
        // No role keeps the login's current role (a new login gets none until one is assigned)
        role: form.role || null,
        userDetails: {
          phoneNumber: form.userDetails.phoneNumber || form.phone,
          country: form.userDetails.country || form.permanentAddress.country?.label || "",
          city: form.userDetails.city || form.permanentAddress.city,
          address: form.userDetails.address || `${form.permanentAddress.line1} ${form.permanentAddress.line2 || ""}`.trim(),
          postalCode: form.userDetails.postalCode || form.permanentAddress.postalCode,
          aboutMe: form.userDetails.aboutMe || "",
        },
        isActive: form.isActive,
        permanentAddress: {
          line1: form.permanentAddress.line1,
          line2: form.permanentAddress.line2,
          city: form.permanentAddress.city,
          state: form.permanentAddress.state,
          country: form.permanentAddress.country?.label || form.permanentAddress.country,
          postalCode: form.permanentAddress.postalCode,
        },
        currentAddress: {
          line1: form.currentAddress.line1,
          line2: form.currentAddress.line2,
          city: form.currentAddress.city,
          state: form.currentAddress.state,
          country: form.currentAddress.country?.label || form.currentAddress.country,
          postalCode: form.currentAddress.postalCode,
        },
        countrySpecificData: {
          pan: form.panNumber,
          aadhaar: form.aadhaarNumber,
          ...gulfToCountryData(form.countryCode, form.gulf),
        },
        salary: {
          currency: form.salary.currency,
          ctc: form.salary.ctc,
          role: form.designation,
          country: salaryCountry(form.countryCode),
          countrySpecificData: {
            pf_number: form.pfNumber,
            uan: form.uan,
            esi_applicable: form.esiApplicable,
            isMetrocity: form.metroCity,
            taxRegime: form.taxRegime === "New Regime" ? "NEW" : "OLD"
          },
          earnings: earningsObject,
          additionalBenefits: additionalBenefitsObject,
          variablePay: variablePayObject,
        },
      };

      if (editId) {
        await axios.put(`${EMPLOYEE_API_URL}/update/${editId}`, submitData);
        ToasterService.success("Employee updated");
      } else {
        const res = await axios.post(`${EMPLOYEE_API_URL}/create`, submitData);
        ToasterService.success(
          res.data?.employeeCode ? `Employee ${res.data.employeeCode} added` : "Employee added",
          `They sign in as ${res.data?.userDto?.username ?? form.officialEmail.toLowerCase()}`
        );
      }
      navigate(-1);
    } catch (error) {
      // Show a field's error under the field, on its step
      const fieldErrors = apiFieldErrors(error);
      const field = Object.keys(fieldErrors)[0];
      if (field) {
        setErrors(fieldErrors);
        if (FIELD_STEPS[field]) setCurrentStep(FIELD_STEPS[field]);
      }
      ToasterService.error(apiError(error, editId ? "The employee could not be updated" : "The employee could not be added"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((s) => Math.min(s + 1, 5));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const prevStep = () => {
    setCurrentStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const maskString = (str: string, visibleChars: number = 4) => {
    if (!str || str.length <= visibleChars) return str;
    return str.slice(0, visibleChars) + "*".repeat(str.length - visibleChars);
  };

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-cyan-600 rounded-full animate-spin"></div>
          <div className="text-sm text-gray-500">{t("Loading employee data...")}</div>
        </div>
      </div>
    );

  const steps = [
    { num: 1, label: "Personal", icon: User },
    { num: 2, label: "Employment", icon: Briefcase },
    { num: 3, label: "Address", icon: MapPin },
    { num: 4, label: "Bank & Salary", icon: DollarSign },
    { num: 5, label: "Review", icon: CheckCircle },
  ];

  const ErrorMessage = ({ message }: { message?: string }) =>
    message ? (
      <div className="flex items-center gap-1 mt-1 text-xs text-red-600">
        <AlertCircle className="w-3 h-3 flex-shrink-0" />
        <span>{message}</span>
      </div>
    ) : null;

  // India's statutory fields (PAN, Aadhaar, PF, IFSC) follow the payroll country, not the address
  const isIndia = form.countryCode === "IN";
  const changePayrollCountry = (code: string) => {
    handleChange("countryCode", code);
    handleChange("salary.country", salaryCountry(code));
    const currency = PAYROLL_COUNTRIES.find((c) => c.code === code)?.currency;
    if (currency) handleChange("salary.currency", currency);
  };
  const changeGulf = (field: keyof GulfDetails, value: string) => {
    handleChange(`gulf.${field}`, value);
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };
  const currencySymbol = getSymbolFromCurrency(form.salary.currency) || form.salary.currency;

  // Calculate total earnings for display
  const totalEarnings = form.salary.earnings.reduce((sum, e) => sum + e.amount, 0);
  const totalBenefits = form.salary.additionalBenefits.reduce((sum, b) => sum + b.amount, 0);
  // const totalCTC = totalEarnings + totalBenefits;
  const totalCTC = Number(form.salary.ctc) || 0;
  // Variable pay sits on top of the fixed CTC (shown, not paid by payroll)
  const totalVariable = (form.salary.variablePay ?? []).reduce((sum: number, row: VariablePay) => sum + (Number(row.targetAmount) || 0), 0);

  // What the service will store for the designation: basic = CTC × basic %, HRA = basic × hra %
  const components = payComponents.find((c) => c.employeeRole === form.designation)?.componentDetails;
  const basicPercent = percentOf(components, "basic");
  const hraPercent = percentOf(components, "hra");
  const basicAmount = basicPercent != null ? Math.round(totalCTC * basicPercent) / 100 : null;
  const hraAmount = basicAmount != null && hraPercent != null ? Math.round(basicAmount * hraPercent) / 100 : null;
  // Monthly pay is (basic + HRA + earnings) / 12, so CTC left outside them is never paid
  const unallocated =
    basicAmount != null && hraAmount != null
      ? Math.round((totalCTC - basicAmount - hraAmount - totalEarnings - totalBenefits) * 100) / 100
      : null;
  // Only designations with pay components can be chosen: the service splits the salary by them
  const designationOptions = payComponents.map((c) => c.employeeRole).sort((a, b) => a.localeCompare(b));
  // An employee being edited may have a designation whose set-up was removed; keep it visible
  const designationMissingSetup = !!form.designation
    && !designationOptions.some((d) => d.toLowerCase() === form.designation.trim().toLowerCase());
  const roleOptions = allRoles.map((r) => ({ name: r.roleName, grantable: r.grantable !== false }));
  if (form.role && !roleOptions.some((r) => r.name === form.role)) roleOptions.unshift({ name: form.role, grantable: true });

  const addUnallocatedAsSpecialAllowance = () => {
    if (!unallocated || unallocated <= 0) return;
    const existing = form.salary.earnings.findIndex((e) => e.name === "Special Allowance");
    const earnings = [...form.salary.earnings];
    if (existing >= 0) earnings[existing] = { ...earnings[existing], amount: earnings[existing].amount + unallocated };
    else earnings.push({ name: "Special Allowance", amount: unallocated });
    handleChange("salary.earnings", earnings);
  };
  const money = (value: number) => `${currencySymbol} ${formatNumber(value, 2)}`;


  return (
    <>
      <PageMeta
        title={t(editId ? "Update Profile" : "Add Employee")}
        description="Employee onboarding and management"
      />

      <PageBreadcrumb
        pageTitle={editId ? "Edit Employee" : "Add Employee"}
        onBack={() => navigate(-1)}
        actions={
          <button type="button" onClick={() => navigate(-1)} className={TOOL_BUTTON}>
            <X className="h-3.5 w-3.5" />
            {t("Cancel")}
          </button>
        }
      />

      <div className="w-full max-w-none px-0 py-4">
        {/* Steps */}
        <div className="mb-2 sm:mb-2.5">
          {/* Step Indicators - Desktop */}
          <div className="hidden sm:block">
            <div className="flex items-center justify-between mb-0.5">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isComplete = currentStep > step.num;
                const isCurrent = currentStep === step.num;
                const isLast = index === steps.length - 1;
                return (
                  <React.Fragment key={step.num}>
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${isComplete
                          ? "bg-cyan-600 text-white"
                          : isCurrent
                            ? "bg-white dark:bg-[#191919] border-2 border-cyan-600 text-cyan-600"
                            : "bg-gray-100 dark:bg-[#222222] text-gray-400 dark:text-gray-500"
                          }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                    </div>
                    {!isLast && (
                      <div className="flex-1 h-0.5 bg-gray-200 dark:bg-[#2a2a2a] mx-2">
                        <div className={`h-full bg-cyan-600 transition-all duration-300 ${isComplete ? "w-full" : "w-0"}`} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 px-1">
              {steps.map((step) => (
                <span key={step.num} className={currentStep === step.num ? "text-gray-900 dark:text-gray-200 font-medium" : ""}>{step.label}</span>
              ))}
            </div>
          </div>

          {/* Step Indicator - Mobile */}
          <div className="sm:hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-cyan-600 text-white flex items-center justify-center text-xs font-semibold">
                  {currentStep}
                </div>
                <span className="text-xs font-medium text-gray-900 dark:text-white">
                  {steps[currentStep - 1].label}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400">{t("Step")} {currentStep} of {steps.length}</div>
            </div>
            <div className="mt-2 h-1 bg-gray-200 dark:bg-[#2a2a2a] rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-600 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / steps.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Form Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="bg-white dark:bg-[#191919] rounded-xl border border-gray-200/80 dark:!border-transparent p-3 sm:p-4 mb-3 shadow-2xs">

              {/* Step 1: Personal Information */}
              {currentStep === 1 && (
                <div className="space-y-3">
                  <div className="mb-2">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t("Personal Information")}</h2>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{t("Basic employee details")}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                          {t("First Name")} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.firstName}
                          onChange={(e) => handleChange("firstName", e.target.value)}
                          className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.firstName ? "border-red-500" : "border-gray-300"}`}
                        />
                        <ErrorMessage message={errors.firstName} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                          {t("Last Name")} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.lastName}
                          onChange={(e) => handleChange("lastName", e.target.value)}
                          className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.lastName ? "border-red-500" : "border-gray-300"}`}
                        />
                        <ErrorMessage message={errors.lastName} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                        {t("Father's Name")} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.fatherName}
                        onChange={(e) => handleChange("fatherName", e.target.value)}
                        className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.fatherName ? "border-red-500" : "border-gray-300"}`}
                      />
                      <ErrorMessage message={errors.fatherName} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                          {t("Gender")} <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={form.gender}
                          onChange={(e) => handleChange("gender", e.target.value)}
                          className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white ${errors.gender ? "border-red-500" : "border-gray-300"}`}
                        >
                          <option value="MALE">{t("Male")}</option>
                          <option value="FEMALE">{t("Female")}</option>
                          <option value="OTHER">{t("Other")}</option>
                        </select>
                        <ErrorMessage message={errors.gender} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                          {t("Date of Birth")} <span className="text-red-500">*</span>
                        </label>
                        <DatePicker
                          selected={form.dateOfBirth}
                          onChange={(date) => handleChange("dateOfBirth", date)}
                          dateFormat="dd/MM/yyyy"
                          maxDate={new Date(new Date().setFullYear(new Date().getFullYear() - 18))}
                          showYearDropdown
                          scrollableYearDropdown
                          yearDropdownItemNumber={100}
                          placeholderText="Select date of birth"
                          className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.dateOfBirth ? "border-red-500" : "border-gray-300"}`}
                        />
                        <ErrorMessage message={errors.dateOfBirth} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                          {t("Marital Status")}
                        </label>
                        <select
                          value={form.maritalStatus}
                          onChange={(e) => handleChange("maritalStatus", e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white"
                        >
                          <option value="SINGLE">{t("Single")}</option>
                          <option value="MARRIED">{t("Married")}</option>
                          <option value="DIVORCED">{t("Divorced")}</option>
                          <option value="WIDOWED">{t("Widowed")}</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                        {t("Phone Number")} <span className="text-red-500">*</span>
                      </label>
                      <style>{`
                        .react-tel-input .form-control {
                          padding-left: 48px !important;
                          height: 32px !important;
                          font-size: 12px !important;
                        }
                      `}</style>
                      <PhoneInput
                        country={form.countryCode.toLowerCase()}
                        value={form.phone}
                        onChange={(phone) => handleChange("phone", phone)}
                        inputClass={`w-full !py-1.5 !text-xs !border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.phone ? "!border-red-500" : "!border-gray-300"}`}
                        containerClass="!w-full"
                        buttonClass="!border !border-gray-300 !rounded-l-lg"
                        dropdownClass="!z-50"
                        enableSearch
                        searchPlaceholder={t("Search country...")}
                      />
                      <ErrorMessage message={errors.phone} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                          {t("Personal Email")} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                          <input
                            type="email"
                            value={form.personalEmail}
                            onChange={(e) => handleChange("personalEmail", e.target.value)}
                            className={`w-full pl-8 pr-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.personalEmail ? "border-red-500" : "border-gray-300"}`}
                          />
                        </div>
                        <ErrorMessage message={errors.personalEmail} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                          {t("Official Email")} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                          <input
                            type="email"
                            value={form.officialEmail}
                            onChange={(e) => handleChange("officialEmail", e.target.value)}
                            className={`w-full pl-8 pr-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.officialEmail ? "border-red-500" : "border-gray-300"}`}
                          />
                        </div>
                        <ErrorMessage message={errors.officialEmail} />
                        {!editId && !errors.officialEmail && (
                          <p className="mt-0.5 text-[11px] text-gray-500">{t("The employee signs in with this email")}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Employment Details */}
              {currentStep === 2 && (
                <div className="space-y-3">
                  <div className="mb-2">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white">{t("Employment Details")}</h2>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{t("Job role and department information")}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                          {t("Designation")} <span className="text-red-500">*</span>
                        </label>
                        {/* Pay is split by designation, so only designations with pay components can be chosen */}
                        <div className="flex gap-1.5">
                          <select
                            value={form.designation}
                            onChange={(e) => handleChange("designation", e.target.value)}
                            aria-label={t("Designation")}
                            className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white ${errors.designation ? "border-red-500" : "border-gray-300"}`}
                          >
                            <option value="">{t(designationOptions.length ? "Select designation" : "No designations set up yet")}</option>
                            {designationMissingSetup && (
                              <option value={form.designation}>{form.designation} (no pay set-up)</option>
                            )}
                            {designationOptions.map((designation) => (
                              <option key={designation} value={designation}>{designation}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={fetchPayComponents}
                            title={t("Reload designations (after adding one on the Compensation page)")}
                            className="shrink-0 rounded-lg border border-gray-300 px-2 text-xs text-gray-500 hover:bg-gray-50 hover:text-cyan-600"
                          >
                            ↻
                          </button>
                        </div>
                        <ErrorMessage message={errors.designation} />
                        {!errors.designation && (
                          <p className="mt-0.5 text-[11px] text-gray-500">
                            {designationMissingSetup
                              ? "This designation has no pay components any more. Choose another, or set it up on "
                              : designationOptions.length === 0
                                ? "Add designations and their pay split on "
                                : "Missing one? Add it with its pay split on "}
                            <Link to="/employeeCompensation" target="_blank" rel="noreferrer" className="font-medium text-cyan-600 hover:underline">
                              {t("the Compensation page")}
                            </Link>
                            {t(", then reload the list.")}
                          </p>
                        )}
                      </div>




                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                          {t("Login Role")}
                        </label>
                        <select
                          value={form.role}
                          onChange={(e) => handleChange("role", e.target.value)}
                          disabled={rolesUnavailable && !form.role}
                          className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white disabled:bg-gray-100 disabled:cursor-not-allowed ${errors.role ? "border-red-500" : "border-gray-300"}`}
                        >
                          <option value="">{t(editId ? "Keep the current role" : "No role yet")}</option>
                          {roleOptions.map((role) => (
                            <option key={role.name} value={role.name} disabled={!role.grantable}>
                              {role.grantable ? role.name : `${role.name} (you can't grant this)`}
                            </option>
                          ))}
                        </select>
                        <ErrorMessage message={errors.role} />
                        {!errors.role && (
                          <p className="mt-0.5 text-[11px] text-gray-500">
                            {rolesUnavailable
                              ? "Roles can be assigned later on the Users page"
                              : "What the employee can do after signing in"}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                          {t("Department")} <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={isOtherDepartment ? -1 : form.department.id || ""}
                          onChange={(e) => handleDepartmentChange(Number(e.target.value))}
                          className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white ${errors.department ? "border-red-500" : "border-gray-300"}`}
                        >
                          <option value="">{t("Select Department")}</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                          ))}
                          <option value="-1">{t("Other (new department)")}</option>
                        </select>
                        {isOtherDepartment && (
                          <input
                            type="text"
                            value={customDepartment}
                            onChange={(e) => {
                              setCustomDepartment(e.target.value);
                              handleChange("department", { id: -1, name: e.target.value });
                            }}
                            placeholder={t("New department name (created when you save)")}
                            className="mt-1.5 w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                          />
                        )}
                        <ErrorMessage message={errors.department} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                          {t("Employment Type")} <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={form.employmentType}
                          onChange={(e) => handleChange("employmentType", e.target.value)}
                          className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white ${errors.employmentType ? "border-red-500" : "border-gray-300"}`}
                        >
                          <option value="FULL_TIME">{t("Full Time")}</option>
                          <option value="PART_TIME">{t("Part Time")}</option>
                          <option value="CONTRACT">{t("Contract")}</option>
                          <option value="INTERN">{t("Intern")}</option>
                        </select>
                        <ErrorMessage message={errors.employmentType} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                          {t("Location")} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <MapPin className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                          <input
                            type="text"
                            value={form.location}
                            onChange={(e) => handleChange("location", e.target.value)}
                            className={`w-full pl-8 pr-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.location ? "border-red-500" : "border-gray-300"}`}
                            placeholder={t("Bangalore")}
                          />
                        </div>
                        <ErrorMessage message={errors.location} />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-0.5">
                          {t("Joining Date")} <span className="text-red-500">*</span>
                        </label>
                        <DatePicker
                          selected={form.joiningDate}
                          onChange={(date) => handleChange("joiningDate", date)}
                          dateFormat="dd/MM/yyyy"
                          placeholderText="Select joining date"
                          className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.joiningDate ? "border-red-500" : "border-gray-300"}`}
                        />
                        <ErrorMessage message={errors.joiningDate} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-0.5">{t("Manager")}</label>
                        <div className="relative">
                          <Users className="absolute left-2.5 top-2 w-3.5 h-3.5 text-gray-400" />
                          <select
                            value={form.managerId || ""}
                            onChange={(e) => handleChange("managerId", e.target.value || null)}
                            className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white"
                          >
                            <option value="">{t("Select Manager")}</option>
                            {managers.map((manager) => (
                              <option key={manager.id} value={manager.id}>
                                {manager.firstName} {manager.lastName} - {manager.designation}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-0.5">{t("Exit Date")}</label>
                        <DatePicker
                          selected={form.exitDate}
                          onChange={(date) => handleChange("exitDate", date)}
                          dateFormat="dd/MM/yyyy"
                          placeholderText="Select exit date (if applicable)"
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Address Information */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("Address Information")}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("Residential addresses")}</p>
                  </div>

                  {/* Permanent Address */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Home className="w-4 h-4 text-cyan-600 dark:text-gray-400" />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t("Permanent Address")}</h3>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {t("Country")} <span className="text-red-500">*</span>
                      </label>
                      <Select classNames={customClassNames}
                        options={COUNTRY_OPTIONS}
                        value={form.permanentAddress.country}
                        onChange={(option) => handleCountryChange("permanentAddress", option)}
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder={t("Select country")}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {t("Address Line 1")} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.permanentAddress.line1}
                        onChange={(e) => handleChange("permanentAddress.line1", e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors["permanentAddress.line1"] ? "border-red-500" : "border-gray-300"}`}
                      />
                      <ErrorMessage message={errors["permanentAddress.line1"]} />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("Address Line 2")}</label>
                      <input
                        type="text"
                        value={form.permanentAddress.line2}
                        onChange={(e) => handleChange("permanentAddress.line2", e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {t("State")} <span className="text-red-500">*</span>
                        </label>
                        {State.getStatesOfCountry(form.permanentAddress.country?.code || '').length > 0 ? (
                          <Select classNames={customClassNames}
                            options={State.getStatesOfCountry(form.permanentAddress.country?.code || '').map(state => ({ value: state.name, label: state.name }))}
                            value={form.permanentAddress.state ? { value: form.permanentAddress.state, label: form.permanentAddress.state } : null}
                            onChange={(option: any) => {
                                handleChange("permanentAddress.state", option ? option.value : "");
                                handleChange("permanentAddress.city", ""); // Reset city when state changes
                            }}
                            className={`react-select-container ${errors["permanentAddress.state"] ? "border-red-500 rounded border" : ""}`}
                            classNamePrefix="react-select"
                            placeholder={t("Select State")}
                          />
                        ) : (
                          <input
                            type="text"
                            value={form.permanentAddress.state}
                            onChange={(e) => handleChange("permanentAddress.state", e.target.value)}
                            placeholder={t("Enter state / province")}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors["permanentAddress.state"] ? "border-red-500" : "border-gray-300"}`}
                          />
                        )}
                        <ErrorMessage message={errors["permanentAddress.state"]} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {t("City")} <span className="text-red-500">*</span>
                        </label>
                        {(() => {
                            const cCode = form.permanentAddress.country?.code || '';
                            const stateObj = State.getStatesOfCountry(cCode).find(s => s.name === form.permanentAddress.state);
                            const cities = stateObj ? City.getCitiesOfState(cCode, stateObj.isoCode) : [];
                            return cities.length > 0 ? (
                              <Select classNames={customClassNames}
                                options={cities.map(city => ({ value: city.name, label: city.name }))}
                                value={form.permanentAddress.city ? { value: form.permanentAddress.city, label: form.permanentAddress.city } : null}
                                onChange={(option: any) => handleChange("permanentAddress.city", option ? option.value : "")}
                                className={`react-select-container ${errors["permanentAddress.city"] ? "border-red-500 rounded border" : ""}`}
                                classNamePrefix="react-select"
                                placeholder={t("Select City")}
                              />
                            ) : (
                              <input
                                type="text"
                                value={form.permanentAddress.city}
                                onChange={(e) => handleChange("permanentAddress.city", e.target.value)}
                                placeholder={t("Enter city")}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors["permanentAddress.city"] ? "border-red-500" : "border-gray-300"}`}
                              />
                            );
                        })()}
                        <ErrorMessage message={errors["permanentAddress.city"]} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {t("Postal Code")} {form.permanentAddress.country?.value === "India" && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="text"
                          value={form.permanentAddress.postalCode}
                          onChange={(e) => handleChange("permanentAddress.postalCode", e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors["permanentAddress.postalCode"] ? "border-red-500" : "border-gray-300"}`}
                        />
                        <ErrorMessage message={errors["permanentAddress.postalCode"]} />
                      </div>
                    </div>
                  </div>

                  {/* Current Address */}
                  <div className="space-y-4 pt-6 border-t border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-cyan-600" />
                        <h3 className="text-sm font-semibold text-gray-900">{t("Current Address")}</h3>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sameAsPermanent}
                          onChange={(e) => setSameAsPermanent(e.target.checked)}
                          className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                        />
                        <span className="text-sm text-gray-700">{t("Same as Permanent Address")}</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {t("Country")} <span className="text-red-500">*</span>
                      </label>
                      <Select classNames={customClassNames}
                        options={COUNTRY_OPTIONS}
                        value={form.currentAddress.country}
                        onChange={(option) => handleCountryChange("currentAddress", option)}
                        isDisabled={sameAsPermanent}
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder={t("Select country")}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {t("Address Line 1")} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.currentAddress.line1}
                        onChange={(e) => handleChange("currentAddress.line1", e.target.value)}
                        disabled={sameAsPermanent}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition disabled:bg-gray-100 disabled:cursor-not-allowed ${errors["currentAddress.line1"] ? "border-red-500" : "border-gray-300"}`}
                      />
                      <ErrorMessage message={errors["currentAddress.line1"]} />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("Address Line 2")}</label>
                      <input
                        type="text"
                        value={form.currentAddress.line2}
                        onChange={(e) => handleChange("currentAddress.line2", e.target.value)}
                        disabled={sameAsPermanent}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {t("State")} <span className="text-red-500">*</span>
                        </label>
                        {State.getStatesOfCountry(form.currentAddress.country?.code || '').length > 0 ? (
                          <Select classNames={customClassNames}
                            options={State.getStatesOfCountry(form.currentAddress.country?.code || '').map(state => ({ value: state.name, label: state.name }))}
                            value={form.currentAddress.state ? { value: form.currentAddress.state, label: form.currentAddress.state } : null}
                            onChange={(option: any) => {
                                handleChange("currentAddress.state", option ? option.value : "");
                                handleChange("currentAddress.city", ""); // Reset city
                            }}
                            isDisabled={sameAsPermanent}
                            className={`react-select-container ${errors["currentAddress.state"] ? "border-red-500 rounded border" : ""}`}
                            classNamePrefix="react-select"
                            placeholder={t("Select State")}
                          />
                        ) : (
                          <input
                            type="text"
                            value={form.currentAddress.state}
                            onChange={(e) => handleChange("currentAddress.state", e.target.value)}
                            disabled={sameAsPermanent}
                            placeholder={t("Enter state / province")}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition disabled:bg-gray-100 disabled:cursor-not-allowed ${errors["currentAddress.state"] ? "border-red-500" : "border-gray-300"}`}
                          />
                        )}
                        <ErrorMessage message={errors["currentAddress.state"]} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {t("City")} <span className="text-red-500">*</span>
                        </label>
                        {(() => {
                            const cCode = form.currentAddress.country?.code || '';
                            const stateObj = State.getStatesOfCountry(cCode).find(s => s.name === form.currentAddress.state);
                            const cities = stateObj ? City.getCitiesOfState(cCode, stateObj.isoCode) : [];
                            return cities.length > 0 ? (
                              <Select classNames={customClassNames}
                                options={cities.map(city => ({ value: city.name, label: city.name }))}
                                value={form.currentAddress.city ? { value: form.currentAddress.city, label: form.currentAddress.city } : null}
                                onChange={(option: any) => handleChange("currentAddress.city", option ? option.value : "")}
                                isDisabled={sameAsPermanent}
                                className={`react-select-container ${errors["currentAddress.city"] ? "border-red-500 rounded border" : ""}`}
                                classNamePrefix="react-select"
                                placeholder={t("Select City")}
                              />
                            ) : (
                              <input
                                type="text"
                                value={form.currentAddress.city}
                                onChange={(e) => handleChange("currentAddress.city", e.target.value)}
                                disabled={sameAsPermanent}
                                placeholder={t("Enter city")}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition disabled:bg-gray-100 disabled:cursor-not-allowed ${errors["currentAddress.city"] ? "border-red-500" : "border-gray-300"}`}
                              />
                            );
                        })()}
                        <ErrorMessage message={errors["currentAddress.city"]} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {t("Postal Code")} {form.currentAddress.country?.value === "India" && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="text"
                          value={form.currentAddress.postalCode}
                          onChange={(e) => handleChange("currentAddress.postalCode", e.target.value)}
                          disabled={sameAsPermanent}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition disabled:bg-gray-100 disabled:cursor-not-allowed ${errors["currentAddress.postalCode"] ? "border-red-500" : "border-gray-300"}`}
                        />
                        <ErrorMessage message={errors["currentAddress.postalCode"]} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Banking & Salary */}
              {currentStep === 4 && (
                <div className="space-y-8">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("Banking & Salary Details")}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("Compensation and bank information")}</p>
                  </div>

                  {/* Which country's payroll rules apply (tax, pension, statutory fields) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {t("Payroll country")} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={form.countryCode}
                        onChange={(e) => changePayrollCountry(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                        data-testid="payroll-country"
                      >
                        {PAYROLL_COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>{t(c.label)}</option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-gray-500">{t("The country whose payroll rules pay this employee, in")} {form.salary.currency}</p>
                    </div>
                  </div>

                  {/* Banking */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <CreditCard className="w-4 h-4 text-cyan-600 dark:text-gray-400" />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t("Bank Account Details")}</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {t("Bank Name")} <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.bankName}
                          onChange={(e) => handleChange("bankName", e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.bankName ? "border-red-500" : "border-gray-300"}`}
                          placeholder={t("HDFC Bank")}
                        />
                        <ErrorMessage message={errors.bankName} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {t("Account Number")} {!isGcc(form.countryCode) && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={form.bankAccountNumber}
                          onChange={(e) => handleChange("bankAccountNumber", e.target.value.replace(/\D/g, ''))}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.bankAccountNumber ? "border-red-500" : "border-gray-300"}`}
                        />
                        <ErrorMessage message={errors.bankAccountNumber} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {isIndia && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {t("IFSC Code")} <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={form.ifscCode}
                            onChange={(e) => handleChange("ifscCode", e.target.value.toUpperCase())}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.ifscCode ? "border-red-500" : "border-gray-300"}`}
                            placeholder={t("HDFC0001234")}
                          />
                          <ErrorMessage message={errors.ifscCode} />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("Branch")}</label>
                        <input
                          type="text"
                          value={form.branch}
                          onChange={(e) => handleChange("branch", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                        />
                      </div>
                    </div>
                  </div>

                  {isGcc(form.countryCode) && (
                    <GulfEmployeeFields country={form.countryCode} gulf={form.gulf} errors={errors} onChange={changeGulf} />
                  )}

                  {/* Statutory & Compliance Details */}
                  {isIndia && (
                    <div className="space-y-4 pt-6 border-t border-gray-100">
                      <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-4 h-4 text-cyan-600" />
                        <h3 className="text-sm font-semibold text-gray-900">{t("Statutory Details")}</h3>
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("Tax Regime")}</label>
                        <select
                          value={form.taxRegime}
                          onChange={(e) => handleChange("taxRegime", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                        >
                          <option value="New Regime">{t("New Regime")}</option>
                          <option value="Old Regime">{t("Old Regime")}</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                          <input
                            type="checkbox"
                            checked={form.esiApplicable}
                            onChange={(e) => handleChange("esiApplicable", e.target.checked)}
                            className="mt-1 w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{t("ESI Applicable")}</div>
                            <div className="text-xs text-gray-500">{t("Employee State Insurance Corporation")}</div>
                          </div>
                        </label>
                        <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition">
                          <input
                            type="checkbox"
                            checked={form.metroCity}
                            onChange={(e) => handleChange("metroCity", e.target.checked)}
                            className="mt-1 w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{t("Metro City")}</div>
                            <div className="text-xs text-gray-500">{t("Applicable for HRA calculations")}</div>
                          </div>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("PAN Number")}</label>
                          <input
                            type="text"
                            value={form.panNumber}
                            onChange={(e) => handleChange("panNumber", e.target.value.toUpperCase())}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${(errors as any).panNumber ? "border-red-500" : "border-gray-300"}`}
                            placeholder={t("ABCDE1234F")}
                          />
                          <ErrorMessage message={(errors as any).panNumber} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("Aadhaar Number")}</label>
                          <input
                            type="text"
                            value={form.aadhaarNumber}
                            onChange={(e) => handleChange("aadhaarNumber", e.target.value.replace(/\D/g, ''))}
                            onFocus={() => {
                              // The stored number is masked; typing replaces it with a new full number
                              if (MASKED_AADHAAR.test(form.aadhaarNumber)) handleChange("aadhaarNumber", "");
                            }}
                            onBlur={() => {
                              // Left empty: keep the stored number
                              if (!form.aadhaarNumber && storedAadhaar) handleChange("aadhaarNumber", storedAadhaar);
                            }}
                            maxLength={MASKED_AADHAAR.test(form.aadhaarNumber) ? 14 : 12}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${(errors as any).aadhaarNumber ? "border-red-500" : "border-gray-300"}`}
                            placeholder="123456789012"
                          />
                          <ErrorMessage message={(errors as any).aadhaarNumber} />
                          {storedAadhaar && !(errors as any).aadhaarNumber && (
                            <p className="mt-1 text-xs text-gray-500">{t("Saved as")} {storedAadhaar}. Type the full number only to change it.</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("PF Number")}</label>
                          <input
                            type="text"
                            value={form.pfNumber}
                            onChange={(e) => handleChange("pfNumber", e.target.value.toUpperCase())}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                            placeholder={t("KN1234567890")}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("UAN")}</label>
                          <input
                            type="text"
                            value={form.uan}
                            onChange={(e) => handleChange("uan", e.target.value.replace(/\D/g, ''))}
                            maxLength={12}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                            placeholder="100200300400"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* User Details Section */}
                  <div className="space-y-4 pt-6 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                      <Users className="w-4 h-4 text-cyan-600" />
                      <h3 className="text-sm font-semibold text-gray-900">{t("Additional User Details")}</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">{t("About Me")}</label>
                        <textarea
                          value={form.userDetails.aboutMe}
                          onChange={(e) => handleChange("userDetails.aboutMe", e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                          placeholder={t("Brief description about the employee")}
                        />
                      </div>
                    </div>
                  </div>

                  {/* CTC Summary */}
                  <div className="space-y-4 pt-6 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                      <DollarSign className="w-4 h-4 text-cyan-600" />
                      <h3 className="text-sm font-semibold text-gray-900">{t("CTC Details")}</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">


                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          {t("Yearly CTC")} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-gray-500">
                            {currencySymbol}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={form.salary.ctc === 0 ? "" : form.salary.ctc}
                            onChange={(e) => handleChange("salary.ctc", Number(e.target.value))}
                            className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors["salary.ctc"] ? "border-red-500" : "border-gray-300"}`}
                            placeholder={t("e.g. 1200000")}
                          />
                        </div>
                        <ErrorMessage message={errors["salary.ctc"]} />
                      </div>

                      {/* The split the service stores, from the designation's pay components */}
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs" data-testid="ctc-split">
                        {!form.designation ? (
                          <p className="text-gray-500">{t("Choose a designation (Employment step) to see the basic / HRA split.")}</p>
                        ) : basicAmount == null || hraAmount == null ? (
                          <p className="text-amber-700">
                            {form.designation} has no basic % and HRA % yet. Set them on the Compensation page.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            <div className="flex justify-between"><span className="text-gray-600">Basic ({basicPercent}% of CTC)</span><span className="font-medium text-gray-900">{money(basicAmount)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">HRA ({hraPercent}% of basic)</span><span className="font-medium text-gray-900">{money(hraAmount)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">{t("Earnings below")}</span><span className="font-medium text-gray-900">{money(totalEarnings)}</span></div>
                            <div className="flex justify-between"><span className="text-gray-600">{t("Benefits below")}</span><span className="font-medium text-gray-900">{money(totalBenefits)}</span></div>
                            {unallocated != null && totalCTC > 0 && unallocated !== 0 && (
                              <div className={`flex items-center justify-between gap-2 border-t border-gray-200 pt-1 ${unallocated > 0 ? "text-amber-700" : "text-red-600"}`}>
                                <span>
                                  {unallocated > 0
                                    ? `${money(unallocated)} of the CTC is not paid out yet`
                                    : `Over the CTC by ${money(-unallocated)}`}
                                </span>
                                {unallocated > 0 && (
                                  <button type="button" onClick={addUnallocatedAsSpecialAllowance} className="shrink-0 text-cyan-700 hover:underline">
                                    {t("Add as Special Allowance")}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Earnings */}
                  <div className="space-y-4 pt-6 border-t border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <h3 className="text-sm font-semibold text-gray-900">{t("Earnings")}</h3>
                      </div>
                      <button type="button" onClick={addEarning} className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1 w-fit">
                        <PlusIcon className="h-4 w-4" />
                        {t("Add Earning")}
                      </button>
                    </div>

                    {form.salary.earnings.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 text-sm">No earnings added. Click "Add Earning" to add.</div>
                    ) : (
                      <div className="space-y-3">
                        {form.salary.earnings.map((earning, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                            <div className="flex-1 w-full">
                              <input
                                type="text"
                                value={earning.name}
                                onChange={(e) => handleEarningChange(idx, "name", e.target.value)}
                                placeholder={t("Earning name (e.g., Bonus, Incentive)")}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                              />
                            </div>
                            <div className="flex-1 w-full">
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-500">{currencySymbol}</span>
                                <input
                                  type="number"
                                  value={earning.amount === 0 ? "" : earning.amount}
                                  onChange={(e) => handleEarningChange(idx, "amount", e.target.value)}
                                  placeholder={t("Yearly amount")}
                                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                                />
                              </div>
                            </div>
                            <button onClick={() => removeEarning(idx)} className="p-2 text-red-500 hover:text-red-700 w-fit">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Additional Benefits */}
                  <div className="space-y-4 pt-6 border-t border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <h3 className="text-sm font-semibold text-gray-900">{t("Additional Benefits")}</h3>
                      </div>
                      <button type="button" onClick={addAdditionalBenefits} className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1 w-fit">
                        <PlusIcon className="h-4 w-4" />
                        {t("Add Additional Benefit")}
                      </button>
                    </div>

                    {form.salary.additionalBenefits.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 text-sm">{t("No additional benefits added.")}</div>
                    ) : (
                      <div className="space-y-3">
                        {form.salary.additionalBenefits.map((benefit, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                            <div className="flex-1 w-full">
                              <input
                                type="text"
                                value={benefit.name}
                                onChange={(e) => handleAdditionalBenefitsChange(idx, "name", e.target.value)}
                                placeholder={t("Benefit name (e.g., Mobile, Internet)")}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                              />
                            </div>
                            <div className="flex-1 w-full">
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-gray-500">{currencySymbol}</span>
                                <input
                                  type="number"
                                  value={benefit.amount === 0 ? "" : benefit.amount}
                                  onChange={(e) => handleAdditionalBenefitsChange(idx, "amount", e.target.value)}
                                  placeholder={t("Yearly amount")}
                                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                                />
                              </div>
                            </div>
                            <button onClick={() => removeAdditionalBenefits(idx)} className="p-2 text-red-500 hover:text-red-700 w-fit">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Variable Pay: part of the CTC on top of the fixed CTC; payroll runs do not pay it */}
                  <div className="space-y-4 pt-6 border-t border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-1">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-violet-600" />
                        <h3 className="text-sm font-semibold text-gray-900">{t("Variable Pay")}</h3>
                      </div>
                      <button type="button" onClick={addVariablePay} className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1 w-fit">
                        <PlusIcon className="h-4 w-4" />
                        {t("Add Variable Pay")}
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500">
                      {t("Yearly targets such as commission or a performance bonus. They are shown in the CTC on top of the fixed CTC above, but are not paid through payroll runs.")}
                    </p>

                    {variablePayRows.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 text-sm">{t("No variable pay added.")}</div>
                    ) : (
                      <div className="space-y-3">
                        {variablePayRows.map((row, idx) => (
                          <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-2 items-center">
                            <input
                              type="text"
                              value={row.name}
                              onChange={(e) => handleVariablePayChange(idx, "name", e.target.value)}
                              placeholder={t("Component (e.g., Sales commission)")}
                              aria-label={t("Variable pay component")}
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                            />
                            <div className="relative">
                              <span className="absolute left-3 top-2.5 text-gray-500 text-sm">{currencySymbol}</span>
                              <input
                                type="number"
                                min={0}
                                value={row.targetAmount === 0 ? "" : row.targetAmount}
                                onChange={(e) => handleVariablePayChange(idx, "targetAmount", e.target.value)}
                                placeholder={t("Yearly target")}
                                aria-label={t("Yearly target")}
                                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                              />
                            </div>
                            <select
                              value={row.frequency}
                              onChange={(e) => handleVariablePayChange(idx, "frequency", e.target.value)}
                              aria-label={t("Payout frequency")}
                              className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-cyan-500"
                            >
                              {VARIABLE_FREQUENCIES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                            </select>
                            <select
                              value={row.payoutBasis}
                              onChange={(e) => handleVariablePayChange(idx, "payoutBasis", e.target.value)}
                              aria-label={t("Payout basis")}
                              className="w-full px-2.5 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-cyan-500"
                            >
                              {VARIABLE_BASES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                            </select>
                            <button type="button" onClick={() => removeVariablePay(idx)} className="p-2 text-red-500 hover:text-red-700 w-fit" title={t("Remove")}>
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 text-xs text-gray-600">
                          <span>{t("Variable target:")} <b className="text-gray-900">{money(totalVariable)}</b></span>
                          <span>{t("CTC incl. variable:")} <b className="text-gray-900">{money(totalCTC + totalVariable)}</b></span>
                        </div>
                      </div>
                    )}
                    <ErrorMessage message={errors["salary.variablePay"]} />
                  </div>


                </div>
              )}

              {/* Step 5: Review */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t("Review & Confirm")}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t("Verify all information before submitting")}</p>
                  </div>

                  <div className="bg-gray-50 dark:bg-[#222222] rounded-xl p-5 mb-6">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="w-12 h-12 rounded-full bg-cyan-600 text-white flex items-center justify-center text-base font-semibold">
                        {form.firstName.charAt(0)}{form.lastName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                          {form.firstName} {form.lastName}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{form.designation} • {form.department.name}</p>
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 block">{form.employmentType}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-gray-900">{t("Contact Details")}</h4>
                      <div className="space-y-3">
                        <div className="text-sm break-all">
                          <div className="text-gray-500">{t("Official Email")}</div>
                          <div className="text-gray-900">{form.officialEmail}</div>
                        </div>
                        <div className="text-sm">
                          <div className="text-gray-500">{t("Phone")}</div>
                          <div className="text-gray-900">+{form.phone}</div>
                        </div>
                        <div className="text-sm">
                          <div className="text-gray-500">{t("Location")}</div>
                          <div className="text-gray-900">{form.location}</div>
                        </div>
                        {!editId && (
                          <div className="text-sm break-all">
                            <div className="text-gray-500">{t("Signs in as")}</div>
                            <div className="text-gray-900">{(form.officialEmail || form.personalEmail).trim().toLowerCase()}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-gray-900">{t("Employment")}</h4>
                      <div className="space-y-3">
                        <div className="text-sm">
                          <div className="text-gray-500">{t("Joining Date")}</div>
                          <div className="text-gray-900">{formatDate(form.joiningDate)}</div>
                        </div>
                        <div className="text-sm">
                          <div className="text-gray-500">{t("Department")}</div>
                          <div className="text-gray-900">{form.department.name}</div>
                        </div>
                        {form.managerId && (
                          <div className="text-sm">
                            <div className="text-gray-500">{t("Manager")}</div>
                            <div className="text-gray-900">
                              {managers.find((m) => m.id.toString() === form.managerId)?.firstName}{" "}
                              {managers.find((m) => m.id.toString() === form.managerId)?.lastName}
                            </div>
                          </div>
                        )}
                        <div className="text-sm">
                          <div className="text-gray-500">{t("Login Role")}</div>
                          <div className="text-gray-900">
                            {form.role || (editId ? "Unchanged" : "None yet (assign on the Users page)")}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-gray-900">{t("Banking")}</h4>
                      <div className="space-y-3">
                        <div className="text-sm">
                          <div className="text-gray-500">{t("Bank")}</div>
                          <div className="text-gray-900">{form.bankName}</div>
                        </div>
                        <div className="text-sm break-all">
                          <div className="text-gray-500">{t("Account Number")}</div>
                          <div className="text-gray-900">
                            {form.bankAccountNumber || (isGcc(form.countryCode) ? t("Paid to the IBAN") : "")}
                          </div>
                        </div>
                        {isIndia && form.ifscCode && (
                          <div className="text-sm">
                            <div className="text-gray-500">{t("IFSC")}</div>
                            <div className="text-gray-900">{form.ifscCode}</div>
                          </div>
                        )}
                        <div className="text-sm">
                          <div className="text-gray-500">{t("Payroll country")}</div>
                          <div className="text-gray-900">{t(PAYROLL_COUNTRIES.find((c) => c.code === form.countryCode)?.label ?? form.countryCode)}</div>
                        </div>
                        {isGcc(form.countryCode) && (
                          <>
                            {Object.entries(gulfToCountryData(form.countryCode, form.gulf)).map(([key, value]) => (
                              <div key={key} className="text-sm break-all">
                                <div className="text-gray-500">{t(GULF_LABELS[key] ?? key)}</div>
                                <div className="text-gray-900" dir="ltr">{gulfValueLabel(key, value)}</div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-gray-900">{t("Salary Summary")}</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{t("Yearly CTC")}</span>
                          <span className="font-semibold text-gray-900">{money(totalCTC)}</span>
                        </div>
                        {basicAmount != null && hraAmount != null && (
                          <div className="text-sm">
                            <div className="flex justify-between text-xs"><span>{t("Basic")}</span><span>{money(basicAmount)}</span></div>
                            <div className="flex justify-between text-xs"><span>{t("HRA")}</span><span>{money(hraAmount)}</span></div>
                          </div>
                        )}
                        {unallocated != null && unallocated > 0 && (
                          <div className="text-xs text-amber-700">{money(unallocated)} of the CTC is not in basic, HRA, earnings or benefits</div>
                        )}
                        {form.salary.earnings.length > 0 && (
                          <div className="text-sm">
                            <div className="text-gray-500 mb-1">{t("Earnings:")}</div>
                            {form.salary.earnings.map((earning, idx) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span>{earning.name}</span>
                                <span>{money(earning.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {form.salary.additionalBenefits.length > 0 && (
                          <div className="text-sm">
                            <div className="text-gray-500 mb-1">{t("Additional Benefits:")}</div>
                            {form.salary.additionalBenefits.map((benefit, idx) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span>{benefit.name}</span>
                                <span>{money(benefit.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {variablePayRows.length > 0 && (
                          <div className="text-sm">
                            <div className="text-gray-500 mb-1">Variable Pay (yearly target, not paid by payroll):</div>
                            {variablePayRows.map((row, idx) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span>
                                  {row.name || "—"} · {VARIABLE_FREQUENCIES.find((f) => f.value === row.frequency)?.label ?? row.frequency}
                                </span>
                                <span>{money(row.targetAmount)}</span>
                              </div>
                            ))}
                            <div className="mt-1 flex justify-between border-t border-gray-100 pt-1 text-xs font-semibold">
                              <span>{t("CTC incl. variable")}</span>
                              <span>{money(totalCTC + totalVariable)}</span>
                            </div>
                          </div>
                        )}

                      </div>
                    </div>

                    {isIndia && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-900">{t("Statutory Details")}</h4>
                        <div className="space-y-3">
                          <div className="text-sm">
                            <div className="text-gray-500">{t("Tax Regime")}</div>
                            <div className="text-gray-900">{form.taxRegime}</div>
                          </div>
                          <div className="flex gap-4">
                            <div className="text-sm">
                              <div className="text-gray-500">{t("ESI Applicable")}</div>
                              <div className="text-gray-900">{t(form.esiApplicable ? "Yes" : "No")}</div>
                            </div>
                            <div className="text-sm">
                              <div className="text-gray-500">{t("Metro City")}</div>
                              <div className="text-gray-900">{t(form.metroCity ? "Yes" : "No")}</div>
                            </div>
                          </div>
                          {form.panNumber && (
                            <div className="text-sm break-all">
                              <div className="text-gray-500">{t("PAN Number")}</div>
                              <div className="text-gray-900">{form.panNumber}</div>
                            </div>
                          )}
                          {form.aadhaarNumber && (
                            <div className="text-sm break-all">
                              <div className="text-gray-500">{t("Aadhaar Number")}</div>
                              <div className="text-gray-900">{form.aadhaarNumber}</div>
                            </div>
                          )}
                          {form.pfNumber && (
                            <div className="text-sm break-all">
                              <div className="text-gray-500">{t("PF Number")}</div>
                              <div className="text-gray-900">{form.pfNumber}</div>
                            </div>
                          )}
                          {form.uan && (
                            <div className="text-sm break-all">
                              <div className="text-gray-500">{t("UAN")}</div>
                              <div className="text-gray-900">{form.uan}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 p-4 bg-cyan-50 dark:bg-[#222222] border border-cyan-100 dark:!border-transparent rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-cyan-900 dark:text-white">{t("Ready to submit")}</p>
                        <p className="text-sm text-cyan-700 dark:text-gray-300 mt-1">
                          {t("Verify all information is correct before creating employee record.")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition w-full sm:w-auto justify-center cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {t("Previous")}
          </button>

          {currentStep < 5 ? (
            <button
              onClick={nextStep}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-cyan-600 !text-white text-xs font-medium rounded-lg hover:bg-cyan-700 transition w-full sm:w-auto justify-center shadow-2xs cursor-pointer"
            >
              {t("Continue")}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-1.5 bg-cyan-600 !text-white text-xs font-medium rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5 w-full sm:w-auto justify-center shadow-2xs cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                editId ? "Update Employee" : "Create Employee"
              )}
            </button>
          )}
        </div>
      </div>

      <style>{`
        .react-select-container .react-select__control {
          border-color: #d1d5db;
          border-radius: 0.5rem;
          min-height: 32px;
          font-size: 0.75rem;
        }
        .react-select-container .react-select__control:hover {
          border-color: rgb(var(--brand-500, 6 182 212));
        }
        .react-select-container .react-select__control--is-focused {
          border-color: rgb(var(--brand-500, 6 182 212));
          box-shadow: 0 0 0 1px #06b6d4;
        }
        .react-select-container .react-select__placeholder {
          color: #9ca3af;
        }
        .react-select-container .react-select__indicator-separator {
          display: none;
        }
        .react-select-container .react-select__menu {
          z-index: 50;
        }
        .dark .react-select-container .react-select__control {
          background-color: #111827;
          border-color: #374151;
          color: #f9fafb;
        }
        .dark .react-select-container .react-select__single-value {
          color: #f9fafb;
        }
        .dark .react-select-container .react-select__menu {
          background-color: #191919;
          border-color: transparent;
        }
        .dark .react-select-container .react-select__option {
          background-color: #191919;
          color: #f9fafb;
        }
        .dark .react-select-container .react-select__option--is-focused {
          background-color: #222222;
        }
        .dark .react-select-container .react-select__option--is-selected {
          background-color: rgb(var(--brand-500, 6 182 212));
          color: #ffffff;
        }
        .dark .react-tel-input .country-list {
          background-color: #191919 !important;
          border-color: #374151 !important;
          color: #f9fafb !important;
        }
        .dark .react-tel-input .country-list .country:hover,
        .dark .react-tel-input .country-list .country.highlight {
          background-color: #222222 !important;
        }
        .dark .react-tel-input .country-list .country .country-name {
          color: #f9fafb !important;
        }
        .dark .react-tel-input .country-list .search {
          background-color: #111827 !important;
        }
        .dark .react-tel-input .country-list .search-box {
          background-color: #191919 !important;
          color: #f9fafb !important;
          border-color: #374151 !important;
        }
        @media (max-width: 640px) {
          .react-select-container .react-select__control {
            min-height: 32px;
          }
        }
      `}</style>
    </>
  );
};

export default AddEmployeePage;