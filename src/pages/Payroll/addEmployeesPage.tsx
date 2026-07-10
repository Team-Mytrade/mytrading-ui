import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import PhoneInput, { CountryData } from "react-phone-input-2";
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
  ChevronLeft,
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
import {
  Department,
  EmploymentType,
  MaritalStatus,
  Gender,
} from "../../shared/types/employee.types";
import { COUNTRY_OPTIONS, ALL_CURRENCIES } from "../../shared/utils/country-list";
import { State, City } from "country-state-city";

const EMPLOYEE_API_URL = "/v1/api/payroll/employee";
const DEPARTMENT_API_URL = "/v1/api/payroll/department";
const TENANT_API_URL = "/v1/api/user/tenants";
const DOMAIN_API_URL = "/v1/api/user/domains";
const ROLE_API_URL = "/v1/api/user/roles";


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

interface Domain {
  id: number;
  domainName: string;
  domainCode: string;
  tenantId?: string; // Add tenantId to Domain interface if available
}

interface Role {
  id: number;
  roleName: string;
  roleCode: string;
  permissions: any[];
  department: Department;
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

type Tenant = {
  tenantId: string;
  tenantName: string;
  active: boolean;
};

const customClassNames = {
  control: (state: any) =>
    `!min-h-[42px] !rounded-lg !border !bg-white !transition-all ${
      state.isFocused
        ? '!border-cyan-500 !shadow-[0_0_0_2px_rgba(6,182,212,0.2)]'
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("editId");
  const [currentStep, setCurrentStep] = useState(1);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<Employee[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [allDomains, setAllDomains] = useState<Domain[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [filteredDomains, setFilteredDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sameAsPermanent, setSameAsPermanent] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showPAN, setShowPAN] = useState(false);
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [isOtherDepartment, setIsOtherDepartment] = useState(false);
  const [customDepartment, setCustomDepartment] = useState("");

  const defaultCountry = COUNTRY_OPTIONS.find(c => c.value === "India") || {
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
    tenantId: "",
    maritalStatus: "SINGLE" as MaritalStatus,
    fatherName: "",
    phone: "",
    countryCode: "IN",
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
    domain: null as Domain | null,
    roleNames: [] as Role[],
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
      currency: "INR",
      ctc: 0,
      role: "",
      country: "INDIA",
      earnings: [] as Earning[],
      additionalBenefits: [] as AdditionalBenefit[],
    },
  });

  const ToasterService = {
    error: (msg: string) => console.error(msg),
    success: (msg: string) => console.log(msg),
    warning: (msg: string) => console.warn(msg),
  };

  useEffect(() => {
    fetchDepts();
    fetchManagers();
    fetchTenants();
    fetchDomains();
    fetchRoles();
    if (editId) fetchEmployee(editId);
  }, [editId]);

  // Filter domains when tenantId changes
  useEffect(() => {
    if (form.tenantId) {
      // Filter domains based on selected tenantId
      const filtered = allDomains.filter(domain => domain.tenantId === form.tenantId);
      setFilteredDomains(filtered);

      // Reset selected domain if it doesn't belong to the new tenant
      if (form.domain && form.domain.tenantId !== form.tenantId) {
        handleChange("domain", null);
      }
    } else {
      setFilteredDomains([]);
      // Clear selected domain when no tenant is selected
      if (form.domain) {
        handleChange("domain", null);
      }
    }
  }, [form.tenantId, allDomains]);

  const fetchTenants = async () => {
    try {
      const res = await axios.get(`${TENANT_API_URL}`);
      setTenants(res.data);
    } catch (error) {
      console.error("Error fetching tenants:", error);
    }
  };

  const fetchDomains = async () => {
    try {
      const res = await axios.get(`${DOMAIN_API_URL}`);
      setAllDomains(res.data);
    } catch (error) {
      console.error("Error fetching domains:", error);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await axios.get(`${ROLE_API_URL}/getAll`);
      setAllRoles(res.data);
    } catch (error) {
      console.error("Error fetching roles:", error);
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
      setDepartments(res.data);
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const fetchManagers = async () => {
    try {
      const res = await axios.get(`${EMPLOYEE_API_URL}/listAll`);
      const managerList = res.data.filter(
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
      if (employeeData.dateOfBirth) employeeData.dateOfBirth = new Date(employeeData.dateOfBirth);
      if (employeeData.joiningDate) employeeData.joiningDate = new Date(employeeData.joiningDate);
      if (employeeData.exitDate) employeeData.exitDate = new Date(employeeData.exitDate);

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

      if (!employeeData.roleNames) {
        employeeData.roleNames = [];
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
          currency: "INR",
          ctc: 0,
          role: "",
          country: "INDIA",
          earnings: [],
          additionalBenefits: [],
        };
      } else {
        const earnings: any[] = [];
        if (employeeData.salary.basic) {
          earnings.push({ name: "Basic", amount: employeeData.salary.basic });
        }
        if (employeeData.salary.hra) {
          earnings.push({ name: "HRA", amount: employeeData.salary.hra });
        }
        if (employeeData.salary.allowances) {
          earnings.push({ name: "Allowances", amount: employeeData.salary.allowances });
        }
        if (employeeData.salary.specialAllowance) {
          earnings.push({ name: "Special Allowance", amount: employeeData.salary.specialAllowance });
        }

        if (earnings.length > 0) {
          employeeData.salary.earnings = earnings;
        } else if (!employeeData.salary.earnings) {
          employeeData.salary.earnings = [];
        }

        if (!employeeData.salary.additionalBenefits) {
          employeeData.salary.additionalBenefits = [];
        }
      }

      // Map nested countrySpecificData (PAN, Aadhaar) to root level
      if (employeeData.countrySpecificData) {
        employeeData.panNumber = employeeData.countrySpecificData.pan || "";
        employeeData.aadhaarNumber = employeeData.countrySpecificData.aadhaar || "";
      } else {
        employeeData.panNumber = "";
        employeeData.aadhaarNumber = "";
      }

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

      // Extract tenantId if tenant is returned as an object
      if (employeeData.tenant && typeof employeeData.tenant === 'object') {
        employeeData.tenantId = employeeData.tenant.tenantId || employeeData.tenant.id;
      }

      setForm(employeeData);
    } catch (error) {
      console.error("Error fetching employee:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (path: string, value: any) => {
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

  const handleTenantChange = (tenantId: string) => {
    handleChange("tenantId", tenantId);
    handleChange("domain", null);
  };

  const handleRoleNamesChange = (selectedOptions: any) => {
    const roles = selectedOptions ? selectedOptions.map((opt: any) => {
      const foundRole = allRoles.find(role => role.id === opt.value);
      return foundRole;
    }).filter(Boolean) : [];
    handleChange("roleNames", roles);
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

  const roleOptions = [
    { value: "Super Administrator", label: "Super Administrator" },
    { value: "Human Resources Manager", label: "Human Resources Manager" },
    { value: "Payroll Manager", label: "Payroll Manager" },
    { value: "Team Lead", label: "Team Lead" },
    { value: "Employee", label: "Employee" },
  ];

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
        if (!form.tenantId) newErrors.tenantId = "Tenant is required";
        break;

      case 2:
        if (!(form.designation || "").trim()) newErrors.designation = "Designation is required";
        if (!form.department.id || form.department.id === 0) newErrors.department = "Department is required";
        if (!(form.location || "").trim()) newErrors.location = "Location is required";
        if (!form.joiningDate) newErrors.joiningDate = "Joining date is required";
        if (!form.employmentType) newErrors.employmentType = "Employment type is required";
        break;

      case 3:
        if (!(form.permanentAddress.line1 || "").trim()) newErrors["permanentAddress.line1"] = "Address line 1 is required";
        if (!(form.permanentAddress.city || "").trim()) newErrors["permanentAddress.city"] = "City is required";
        if (!form.permanentAddress.state) newErrors["permanentAddress.state"] = "State is required";
        if (!(form.permanentAddress.postalCode || "").trim()) newErrors["permanentAddress.postalCode"] = "Postal code is required";
        if (!sameAsPermanent) {
          if (!(form.currentAddress.line1 || "").trim()) newErrors["currentAddress.line1"] = "Address line 1 is required";
          if (!(form.currentAddress.city || "").trim()) newErrors["currentAddress.city"] = "City is required";
          if (!form.currentAddress.state) newErrors["currentAddress.state"] = "State is required";
          if (!(form.currentAddress.postalCode || "").trim()) newErrors["currentAddress.postalCode"] = "Postal code is required";
        }
        break;

      case 4:
        if (!(form.bankName || "").trim()) newErrors.bankName = "Bank name is required";
        if (!(form.bankAccountNumber || "").trim()) newErrors.bankAccountNumber = "Account number is required";
        if (form.permanentAddress.country?.value === "India") {
          if (!(form.ifscCode || "").trim()) newErrors.ifscCode = "IFSC code is required";
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    setIsSubmitting(true);
    try {
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
      const submitData = {
        employeeCode: `EMP${Math.floor(1000 + Math.random() * 9000)}`,
        password: "DefaultPassword@123",
        firstName: form.firstName,
        lastName: form.lastName,
        personalEmail: form.personalEmail,
        officialEmail: form.officialEmail,
        maritalStatus: form.maritalStatus,
        fatherName: form.fatherName,
        phone: form.phone,
        gender: form.gender,
        dateOfBirth: form.dateOfBirth?.toISOString().split("T")[0],
        employmentType: form.employmentType,
        location: form.location,
        managerId: form.managerId || null,
        joiningDate: form.joiningDate?.toISOString().split("T")[0],
        designation: form.designation,
        exitDate: form.exitDate?.toISOString().split("T")[0] || null,
        bankAccountNumber: form.bankAccountNumber,
        bankName: form.bankName,
        ifscCode: form.ifscCode,
        branch: form.branch,
        countryCode: form.countryCode,
        tenant: { tenantId: form.tenantId },
        userType: form.userType,
        department: { id: form.department.id },
        domain: form.domain ? { id: form.domain.id, name: form.domain.domainName, domainCode: form.domain.domainCode } : null,
        role: form.roleNames.length > 0 ? form.roleNames.map(r => r.roleCode).join(",") : "SUPER_ADMIN",
        
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
        },
        salary: {
          currency: form.salary.currency,
          ctc: form.salary.ctc,
          role: form.designation,
          country: form.salary.country,
          countrySpecificData: {
            pf_number: form.pfNumber,
            uan: form.uan,
            esi_applicable: form.esiApplicable,
            isMetrocity: form.metroCity,
            taxRegime: form.taxRegime === "New Regime" ? "NEW" : "OLD"
          },
          earnings: earningsObject,
          additionalBenefits: additionalBenefitsObject,
        },
      };

      if (editId) {
        await axios.put(`${EMPLOYEE_API_URL}/update/${editId}`, submitData);
        ToasterService.success("Employee updated successfully");
      } else {
        await axios.post(`${EMPLOYEE_API_URL}/create`, submitData);
        ToasterService.success("Employee created successfully");
      }
      navigate(-1);
    } catch (error) {
      console.error("Submission error:", error);
      ToasterService.error("Submission failed. Please review your data and try again.");
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
          <div className="text-sm text-gray-500">Loading employee data...</div>
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

  const isIndia = form.permanentAddress.country?.value === "India";
  const currencySymbol = getSymbolFromCurrency(form.salary.currency) || form.salary.currency;

  // Calculate total earnings for display
  const totalEarnings = form.salary.earnings.reduce((sum, e) => sum + e.amount, 0);
  const totalBenefits = form.salary.additionalBenefits.reduce((sum, b) => sum + b.amount, 0);
  // const totalCTC = totalEarnings + totalBenefits;
  const totalCTC = form.salary.ctc;


  return (
    <>
      <PageMeta
        title={editId ? "Update Profile" : "Add Employee"}
        description="Employee onboarding and management"
      />

      <div className="mx-auto px-4 sm:px-6 py-4 sm:py-6 max-w-7xl">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
                  {editId ? "Edit Employee" : "Add New Employee"}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                  Complete all sections to onboard employee
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors w-fit"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Step Indicators - Desktop */}
          <div className="hidden sm:block">
            <div className="flex items-center justify-between mb-2">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isComplete = currentStep > step.num;
                const isCurrent = currentStep === step.num;
                const isLast = index === steps.length - 1;
                return (
                  <React.Fragment key={step.num}>
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isComplete
                          ? "bg-cyan-600 text-white"
                          : isCurrent
                            ? "bg-white border-2 border-cyan-600 text-cyan-600"
                            : "bg-gray-100 text-gray-400"
                          }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                    </div>
                    {!isLast && (
                      <div className="flex-1 h-0.5 bg-gray-200 mx-2">
                        <div className={`h-full bg-cyan-600 transition-all duration-300 ${isComplete ? "w-full" : "w-0"}`} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-gray-500 px-2">
              {steps.map((step) => (
                <span key={step.num}>{step.label}</span>
              ))}
            </div>
          </div>

          {/* Step Indicator - Mobile */}
          <div className="sm:hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-cyan-600 text-white flex items-center justify-center text-sm font-semibold">
                  {currentStep}
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {steps[currentStep - 1].label}
                </span>
              </div>
              <div className="text-xs text-gray-500">Step {currentStep} of {steps.length}</div>
            </div>
            <div className="mt-3 h-1.5 bg-gray-200 rounded-full overflow-hidden">
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
            <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-6">

              {/* Step 1: Personal Information */}
              {currentStep === 1 && (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">Personal Information</h2>
                    <p className="text-sm text-gray-500 mt-1">Basic employee details</p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.firstName}
                          onChange={(e) => handleChange("firstName", e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.firstName ? "border-red-500" : "border-gray-300"}`}
                        />
                        <ErrorMessage message={errors.firstName} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.lastName}
                          onChange={(e) => handleChange("lastName", e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.lastName ? "border-red-500" : "border-gray-300"}`}
                        />
                        <ErrorMessage message={errors.lastName} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Father's Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.fatherName}
                        onChange={(e) => handleChange("fatherName", e.target.value)}
                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.fatherName ? "border-red-500" : "border-gray-300"}`}
                      />
                      <ErrorMessage message={errors.fatherName} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Gender <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={form.gender}
                          onChange={(e) => handleChange("gender", e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white ${errors.gender ? "border-red-500" : "border-gray-300"}`}
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                        <ErrorMessage message={errors.gender} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Date of Birth <span className="text-red-500">*</span>
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
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.dateOfBirth ? "border-red-500" : "border-gray-300"}`}
                        />
                        <ErrorMessage message={errors.dateOfBirth} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Marital Status
                        </label>
                        <select
                          value={form.maritalStatus}
                          onChange={(e) => handleChange("maritalStatus", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white"
                        >
                          <option value="SINGLE">Single</option>
                          <option value="MARRIED">Married</option>
                          <option value="DIVORCED">Divorced</option>
                          <option value="WIDOWED">Widowed</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Tenant <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={form.tenantId}
                          onChange={(e) => handleTenantChange(e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white ${errors.tenantId ? "border-red-500" : "border-gray-300"}`}
                        >
                          <option value="">Select Tenant</option>
                          {tenants.map((tenant) => (
                            <option key={tenant.tenantId} value={tenant.tenantId}>
                              {tenant.tenantName}
                            </option>
                          ))}
                        </select>
                        <ErrorMessage message={errors.tenantId} />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Phone Number <span className="text-red-500">*</span>
                      </label>
                      <style>{`
                        .react-tel-input .form-control {
                          padding-left: 48px !important;
                        }
                      `}</style>
                      <PhoneInput
                        country={form.countryCode.toLowerCase()}
                        value={form.phone}
                        onChange={(phone, countryData: CountryData) => {
                          handleChange("phone", phone);
                          if (countryData?.countryCode) {
                            handleChange("countryCode", countryData.countryCode.toUpperCase());
                          }
                        }}
                        inputClass={`w-full !py-2 !border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${errors.phone ? "!border-red-500" : "!border-gray-300"}`}
                        containerClass="!w-full"
                        buttonClass="!border !border-gray-300 !rounded-l-lg"
                        dropdownClass="!z-50"
                        enableSearch
                        searchPlaceholder="Search country..."
                      />
                      <ErrorMessage message={errors.phone} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Personal Email <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <input
                            type="email"
                            value={form.personalEmail}
                            onChange={(e) => handleChange("personalEmail", e.target.value)}
                            className={`w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.personalEmail ? "border-red-500" : "border-gray-300"}`}
                          />
                        </div>
                        <ErrorMessage message={errors.personalEmail} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Official Email <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <input
                            type="email"
                            value={form.officialEmail}
                            onChange={(e) => handleChange("officialEmail", e.target.value)}
                            className={`w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.officialEmail ? "border-red-500" : "border-gray-300"}`}
                          />
                        </div>
                        <ErrorMessage message={errors.officialEmail} />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Employment Details */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">Employment Details</h2>
                    <p className="text-sm text-gray-500 mt-1">Job role and department information</p>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Designation <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.designation}
                          onChange={(e) => handleChange("designation", e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.designation ? "border-red-500" : "border-gray-300"}`}
                          placeholder="e.g., Software Engineer, Product Manager"
                        />
                        <ErrorMessage message={errors.designation} />
                      </div>


                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Domain
                        </label>
                        <select
                          value={form.domain?.id || ""}
                          onChange={(e) => {
                            const domain = filteredDomains.find(d => d.id === Number(e.target.value));
                            handleChange("domain", domain || null);
                          }}
                          disabled={!form.tenantId || filteredDomains.length === 0}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                        >
                          <option value="">
                            {!form.tenantId
                              ? "Select a tenant first"
                              : filteredDomains.length === 0
                                ? "No domains available for this tenant"
                                : "Select Domain"}
                          </option>
                          {filteredDomains.map((domain) => (
                            <option key={domain.id} value={domain.id}>
                              {domain.domainName} ({domain.domainCode})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Department <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={isOtherDepartment ? -1 : form.department.id}
                          onChange={(e) => handleDepartmentChange(Number(e.target.value))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white"
                        >
                          <option value="">Select Department</option>
                          {departments.map((dept) => (
                            <option key={dept.id} value={dept.id}>{dept.name}</option>
                          ))}
                          <option value="-1">Other</option>
                        </select>
                        {isOtherDepartment && (
                          <input
                            type="text"
                            value={customDepartment}
                            onChange={(e) => {
                              setCustomDepartment(e.target.value);
                              handleChange("department", { id: -1, name: e.target.value });
                            }}
                            placeholder="Enter custom department"
                            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                          />
                        )}
                        <ErrorMessage message={errors.department} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Employment Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={form.employmentType}
                          onChange={(e) => handleChange("employmentType", e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white ${errors.employmentType ? "border-red-500" : "border-gray-300"}`}
                        >
                          <option value="FULL_TIME">Full Time</option>
                          <option value="PART_TIME">Part Time</option>
                          <option value="CONTRACT">Contract</option>
                          <option value="INTERN">Intern</option>
                        </select>
                        <ErrorMessage message={errors.employmentType} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Location <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={form.location}
                            onChange={(e) => handleChange("location", e.target.value)}
                            className={`w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.location ? "border-red-500" : "border-gray-300"}`}
                            placeholder="Bangalore"
                          />
                        </div>
                        <ErrorMessage message={errors.location} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Joining Date <span className="text-red-500">*</span>
                        </label>
                        <DatePicker
                          selected={form.joiningDate}
                          onChange={(date) => handleChange("joiningDate", date)}
                          dateFormat="dd/MM/yyyy"
                          placeholderText="Select joining date"
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.joiningDate ? "border-red-500" : "border-gray-300"}`}
                        />
                        <ErrorMessage message={errors.joiningDate} />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Manager</label>
                        <div className="relative">
                          <Users className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                          <select
                            value={form.managerId || ""}
                            onChange={(e) => handleChange("managerId", e.target.value || null)}
                            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition bg-white"
                          >
                            <option value="">Select Manager</option>
                            {managers.map((manager) => (
                              <option key={manager.id} value={manager.id}>
                                {manager.firstName} {manager.lastName} - {manager.designation}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Exit Date</label>
                        <DatePicker
                          selected={form.exitDate}
                          onChange={(date) => handleChange("exitDate", date)}
                          dateFormat="dd/MM/yyyy"
                          placeholderText="Select exit date (if applicable)"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Roles
                      </label>
                      <Select classNames={customClassNames}
                        isMulti
                        options={allRoles.map(role => ({ value: role.id, label: role.roleName }))}
                        value={form.roleNames.map(role => ({ value: role.id, label: role.roleName }))}
                        onChange={handleRoleNamesChange}
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder="Select roles..."
                        getOptionLabel={(option) => option.label}
                        getOptionValue={(option) => option.value.toString()}
                      />

                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Address Information */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">Address Information</h2>
                    <p className="text-sm text-gray-500 mt-1">Residential addresses</p>
                  </div>

                  {/* Permanent Address */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Home className="w-4 h-4 text-cyan-600" />
                      <h3 className="text-sm font-semibold text-gray-900">Permanent Address</h3>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Country <span className="text-red-500">*</span>
                      </label>
                      <Select classNames={customClassNames}
                        options={COUNTRY_OPTIONS}
                        value={form.permanentAddress.country}
                        onChange={(option) => handleCountryChange("permanentAddress", option)}
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder="Select country"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Address Line 1 <span className="text-red-500">*</span>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Address Line 2</label>
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
                          State <span className="text-red-500">*</span>
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
                            placeholder="Select State"
                          />
                        ) : (
                          <input
                            type="text"
                            value={form.permanentAddress.state}
                            onChange={(e) => handleChange("permanentAddress.state", e.target.value)}
                            placeholder="Enter state / province"
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors["permanentAddress.state"] ? "border-red-500" : "border-gray-300"}`}
                          />
                        )}
                        <ErrorMessage message={errors["permanentAddress.state"]} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          City <span className="text-red-500">*</span>
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
                                placeholder="Select City"
                              />
                            ) : (
                              <input
                                type="text"
                                value={form.permanentAddress.city}
                                onChange={(e) => handleChange("permanentAddress.city", e.target.value)}
                                placeholder="Enter city"
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors["permanentAddress.city"] ? "border-red-500" : "border-gray-300"}`}
                              />
                            );
                        })()}
                        <ErrorMessage message={errors["permanentAddress.city"]} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Postal Code <span className="text-red-500">*</span>
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
                        <h3 className="text-sm font-semibold text-gray-900">Current Address</h3>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sameAsPermanent}
                          onChange={(e) => setSameAsPermanent(e.target.checked)}
                          className="w-4 h-4 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                        />
                        <span className="text-sm text-gray-700">Same as Permanent Address</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Country <span className="text-red-500">*</span>
                      </label>
                      <Select classNames={customClassNames}
                        options={COUNTRY_OPTIONS}
                        value={form.currentAddress.country}
                        onChange={(option) => handleCountryChange("currentAddress", option)}
                        isDisabled={sameAsPermanent}
                        className="react-select-container"
                        classNamePrefix="react-select"
                        placeholder="Select country"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Address Line 1 <span className="text-red-500">*</span>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Address Line 2</label>
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
                          State <span className="text-red-500">*</span>
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
                            placeholder="Select State"
                          />
                        ) : (
                          <input
                            type="text"
                            value={form.currentAddress.state}
                            onChange={(e) => handleChange("currentAddress.state", e.target.value)}
                            disabled={sameAsPermanent}
                            placeholder="Enter state / province"
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition disabled:bg-gray-100 disabled:cursor-not-allowed ${errors["currentAddress.state"] ? "border-red-500" : "border-gray-300"}`}
                          />
                        )}
                        <ErrorMessage message={errors["currentAddress.state"]} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          City <span className="text-red-500">*</span>
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
                                placeholder="Select City"
                              />
                            ) : (
                              <input
                                type="text"
                                value={form.currentAddress.city}
                                onChange={(e) => handleChange("currentAddress.city", e.target.value)}
                                disabled={sameAsPermanent}
                                placeholder="Enter city"
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition disabled:bg-gray-100 disabled:cursor-not-allowed ${errors["currentAddress.city"] ? "border-red-500" : "border-gray-300"}`}
                              />
                            );
                        })()}
                        <ErrorMessage message={errors["currentAddress.city"]} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Postal Code <span className="text-red-500">*</span>
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
                    <h2 className="text-lg font-semibold text-gray-900">Banking & Salary Details</h2>
                    <p className="text-sm text-gray-500 mt-1">Compensation and bank information</p>
                  </div>

                  {/* Banking */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                      <CreditCard className="w-4 h-4 text-cyan-600" />
                      <h3 className="text-sm font-semibold text-gray-900">Bank Account Details</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Bank Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.bankName}
                          onChange={(e) => handleChange("bankName", e.target.value)}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.bankName ? "border-red-500" : "border-gray-300"}`}
                          placeholder="HDFC Bank"
                        />
                        <ErrorMessage message={errors.bankName} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Account Number <span className="text-red-500">*</span>
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
                            IFSC Code <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={form.ifscCode}
                            onChange={(e) => handleChange("ifscCode", e.target.value.toUpperCase())}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${errors.ifscCode ? "border-red-500" : "border-gray-300"}`}
                            placeholder="HDFC0001234"
                          />
                          <ErrorMessage message={errors.ifscCode} />
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Branch</label>
                        <input
                          type="text"
                          value={form.branch}
                          onChange={(e) => handleChange("branch", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Statutory & Compliance Details */}
                  {isIndia && (
                    <div className="space-y-4 pt-6 border-t border-gray-100">
                      <div className="flex items-center gap-2 mb-4">
                        <Shield className="w-4 h-4 text-cyan-600" />
                        <h3 className="text-sm font-semibold text-gray-900">Statutory Details</h3>
                      </div>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Tax Regime</label>
                        <select
                          value={form.taxRegime}
                          onChange={(e) => handleChange("taxRegime", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                        >
                          <option value="New Regime">New Regime</option>
                          <option value="Old Regime">Old Regime</option>
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
                            <div className="text-sm font-medium text-gray-900">ESI Applicable</div>
                            <div className="text-xs text-gray-500">Employee State Insurance Corporation</div>
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
                            <div className="text-sm font-medium text-gray-900">Metro City</div>
                            <div className="text-xs text-gray-500">Applicable for HRA calculations</div>
                          </div>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">PAN Number <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={form.panNumber}
                            onChange={(e) => handleChange("panNumber", e.target.value.toUpperCase())}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${(errors as any).panNumber ? "border-red-500" : "border-gray-300"}`}
                            placeholder="ABCDE1234F"
                          />
                          <ErrorMessage message={(errors as any).panNumber} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Aadhaar Number <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            value={form.aadhaarNumber}
                            onChange={(e) => handleChange("aadhaarNumber", e.target.value.replace(/\D/g, ''))}
                            maxLength={12}
                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition ${(errors as any).aadhaarNumber ? "border-red-500" : "border-gray-300"}`}
                            placeholder="123456789012"
                          />
                          <ErrorMessage message={(errors as any).aadhaarNumber} />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">PF Number</label>
                          <input
                            type="text"
                            value={form.pfNumber}
                            onChange={(e) => handleChange("pfNumber", e.target.value.toUpperCase())}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                            placeholder="KN1234567890"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">UAN</label>
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
                      <h3 className="text-sm font-semibold text-gray-900">Additional User Details</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">About Me</label>
                        <textarea
                          value={form.userDetails.aboutMe}
                          onChange={(e) => handleChange("userDetails.aboutMe", e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                          placeholder="Brief description about the employee"
                        />
                      </div>
                    </div>
                  </div>

                  {/* CTC Summary */}
                  <div className="space-y-4 pt-6 border-t border-gray-100">
                    <div className="flex items-center gap-2 mb-4">
                      <DollarSign className="w-4 h-4 text-cyan-600" />
                      <h3 className="text-sm font-semibold text-gray-900">CTC Details</h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">


                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          CTC Amount <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-gray-500">
                            {currencySymbol}
                          </span>
                          <input
                            type="number"
                            value={form.salary.ctc === 0 ? "" : form.salary.ctc}
                            onChange={(e) => handleChange("salary.ctc", Number(e.target.value))}
                            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
                            placeholder="Enter CTC amount"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Earnings */}
                  <div className="space-y-4 pt-6 border-t border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <h3 className="text-sm font-semibold text-gray-900">Earnings</h3>
                      </div>
                      <button type="button" onClick={addEarning} className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1 w-fit">
                        <PlusIcon className="h-4 w-4" />
                        Add Earning
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
                                placeholder="Earning name (e.g., Bonus, Incentive)"
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
                                  placeholder="Amount"
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
                        <h3 className="text-sm font-semibold text-gray-900">Additional Benefits</h3>
                      </div>
                      <button type="button" onClick={addAdditionalBenefits} className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1 w-fit">
                        <PlusIcon className="h-4 w-4" />
                        Add Additional Benefit
                      </button>
                    </div>

                    {form.salary.additionalBenefits.length === 0 ? (
                      <div className="text-center py-4 text-gray-500 text-sm">No additional benefits added.</div>
                    ) : (
                      <div className="space-y-3">
                        {form.salary.additionalBenefits.map((benefit, idx) => (
                          <div key={idx} className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                            <div className="flex-1 w-full">
                              <input
                                type="text"
                                value={benefit.name}
                                onChange={(e) => handleAdditionalBenefitsChange(idx, "name", e.target.value)}
                                placeholder="Benefit name (e.g., Mobile, Internet)"
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
                                  placeholder="Amount"
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


                </div>
              )}

              {/* Step 5: Review */}
              {currentStep === 5 && (
                <div className="space-y-6">
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold text-gray-900">Review & Confirm</h2>
                    <p className="text-sm text-gray-500 mt-1">Verify all information before submitting</p>
                  </div>

                  <div className="bg-gray-50 rounded-xl p-5 mb-6">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="w-12 h-12 rounded-full bg-cyan-600 text-white flex items-center justify-center text-base font-semibold">
                        {form.firstName.charAt(0)}{form.lastName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <h3 className="text-base font-semibold text-gray-900">
                          {form.firstName} {form.lastName}
                        </h3>
                        <p className="text-sm text-gray-600">{form.designation} • {form.department.name}</p>
                        <span className="text-xs text-gray-500 mt-1 block">{form.employmentType}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-gray-900">Contact Details</h4>
                      <div className="space-y-3">
                        <div className="text-sm break-all">
                          <div className="text-gray-500">Official Email</div>
                          <div className="text-gray-900">{form.officialEmail}</div>
                        </div>
                        <div className="text-sm">
                          <div className="text-gray-500">Phone</div>
                          <div className="text-gray-900">+{form.phone}</div>
                        </div>
                        <div className="text-sm">
                          <div className="text-gray-500">Location</div>
                          <div className="text-gray-900">{form.location}</div>
                        </div>
                        <div className="text-sm">
                          <div className="text-gray-500">Tenant</div>
                          <div className="text-gray-900">
                            {tenants.find(t => t.tenantId === form.tenantId)?.tenantName || form.tenantId}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-gray-900">Employment</h4>
                      <div className="space-y-3">
                        <div className="text-sm">
                          <div className="text-gray-500">Joining Date</div>
                          <div className="text-gray-900">{form.joiningDate?.toLocaleDateString()}</div>
                        </div>
                        <div className="text-sm">
                          <div className="text-gray-500">Department</div>
                          <div className="text-gray-900">{form.department.name}</div>
                        </div>
                        {form.domain && (
                          <div className="text-sm">
                            <div className="text-gray-500">Domain</div>
                            <div className="text-gray-900">{form.domain.domainName}</div>
                          </div>
                        )}
                        {form.managerId && (
                          <div className="text-sm">
                            <div className="text-gray-500">Manager</div>
                            <div className="text-gray-900">
                              {managers.find((m) => m.id.toString() === form.managerId)?.firstName}{" "}
                              {managers.find((m) => m.id.toString() === form.managerId)?.lastName}
                            </div>
                          </div>
                        )}
                        {form.roleNames.length > 0 && (
                          <div className="text-sm">
                            <div className="text-gray-500">Roles</div>
                            <div className="text-gray-900">{form.roleNames.map(r => r.roleName).join(", ")}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-gray-900">Banking</h4>
                      <div className="space-y-3">
                        <div className="text-sm">
                          <div className="text-gray-500">Bank</div>
                          <div className="text-gray-900">{form.bankName}</div>
                        </div>
                        <div className="text-sm break-all">
                          <div className="text-gray-500">Account Number</div>
                          <div className="text-gray-900">{form.bankAccountNumber}</div>
                        </div>
                        {isIndia && form.ifscCode && (
                          <div className="text-sm">
                            <div className="text-gray-500">IFSC</div>
                            <div className="text-gray-900">{form.ifscCode}</div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-gray-900">Salary Summary</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Total CTC</span>
                          <span className="font-semibold text-gray-900">
                            {currencySymbol} {totalCTC.toLocaleString()}
                          </span>
                        </div>
                        {form.salary.earnings.length > 0 && (
                          <div className="text-sm">
                            <div className="text-gray-500 mb-1">Earnings:</div>
                            {form.salary.earnings.map((earning, idx) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span>{earning.name}</span>
                                <span>{currencySymbol} {earning.amount.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {form.salary.additionalBenefits.length > 0 && (
                          <div className="text-sm">
                            <div className="text-gray-500 mb-1">Additional Benefits:</div>
                            {form.salary.additionalBenefits.map((benefit, idx) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span>{benefit.name}</span>
                                <span>{currencySymbol} {benefit.amount.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        )}

                      </div>
                    </div>

                    {isIndia && (
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-gray-900">Statutory Details</h4>
                        <div className="space-y-3">
                          <div className="text-sm">
                            <div className="text-gray-500">Tax Regime</div>
                            <div className="text-gray-900">{form.taxRegime}</div>
                          </div>
                          <div className="flex gap-4">
                            <div className="text-sm">
                              <div className="text-gray-500">ESI Applicable</div>
                              <div className="text-gray-900">{form.esiApplicable ? "Yes" : "No"}</div>
                            </div>
                            <div className="text-sm">
                              <div className="text-gray-500">Metro City</div>
                              <div className="text-gray-900">{form.metroCity ? "Yes" : "No"}</div>
                            </div>
                          </div>
                          {form.panNumber && (
                            <div className="text-sm break-all">
                              <div className="text-gray-500">PAN Number</div>
                              <div className="text-gray-900">{form.panNumber}</div>
                            </div>
                          )}
                          {form.aadhaarNumber && (
                            <div className="text-sm break-all">
                              <div className="text-gray-500">Aadhaar Number</div>
                              <div className="text-gray-900">{form.aadhaarNumber}</div>
                            </div>
                          )}
                          {form.pfNumber && (
                            <div className="text-sm break-all">
                              <div className="text-gray-500">PF Number</div>
                              <div className="text-gray-900">{form.pfNumber}</div>
                            </div>
                          )}
                          {form.uan && (
                            <div className="text-sm break-all">
                              <div className="text-gray-500">UAN</div>
                              <div className="text-gray-900">{form.uan}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 p-4 bg-cyan-50 border border-cyan-100 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-cyan-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-cyan-900">Ready to submit</p>
                        <p className="text-sm text-cyan-700 mt-1">
                          Verify all information is correct before creating employee record.
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed transition w-full sm:w-auto justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>

          {currentStep < 5 ? (
            <button
              onClick={nextStep}
              className="flex items-center gap-2 px-6 py-2.5 bg-cyan-600 !text-white text-sm font-medium rounded-lg hover:bg-cyan-700 transition w-full sm:w-auto justify-center"
            >
              Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 py-2.5 bg-cyan-600 !text-white text-sm font-medium rounded-lg hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
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
          min-height: 42px;
        }
        .react-select-container .react-select__control:hover {
          border-color: #06b6d4;
        }
        .react-select-container .react-select__control--is-focused {
          border-color: #06b6d4;
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
        @media (max-width: 640px) {
          .react-select-container .react-select__control {
            min-height: 38px;
          }
        }
      `}</style>
    </>
  );
};

export default AddEmployeePage;