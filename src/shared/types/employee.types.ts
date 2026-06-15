/**
 * Address interface for both permanent and current addresses
 */
export interface Address {
  line1: string;
  line2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

/**
 * Department interface
 */
export interface Department {
  id: number;
  name: string;
}

/**
 * Country-specific data for employee (PAN, Aadhaar for India)
 */
export interface EmployeeCountrySpecificData {
  pan?: string;
  aadhaar?: string;
  [key: string]: any; // Allow for other country-specific fields
}

/**
 * Salary country-specific data (PF, UAN, ESI for India)
 */
export interface SalaryCountrySpecificData {
  pf_number?: string;
  uan?: string;
  esi_applicable?: boolean;
  isMetrocity?: boolean;
  [key: string]: any; // Allow for other country-specific fields
}

/**
 * Tax regime types
 */
export type TaxRegime = 'OLD' | 'NEW';

/**
 * Salary information
 */
export interface Salary {
  currency: string;
  basic: number;
  hra: number;
  allowances: number;
  specialAllowance: number;
  grossSalary: number;
  providentFundEmployee: number;
  providentFundEmployer: number;
  professionalTax: number;
  tds: number;
  regime: TaxRegime;
  country: string;
  countrySpecificData?: SalaryCountrySpecificData;
}

/**
 * Marital status types
 */
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';

/**
 * Gender types
 */
export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

/**
 * Employment type
 */
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';

/**
 * Main Employee interface
 */
export interface Employee {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  personalEmail: string;
  officialEmail: string;
  createdAt?: string; // ISO datetime string
  maritalStatus: MaritalStatus;
  fatherName: string;
  phone: string;
  gender: Gender;
  dateOfBirth: string; // ISO date string
  employmentType: EmploymentType;
  designation: string;
  location: string;
  managerId: string | null;
  joiningDate: string; // ISO date string
  exitDate: string | null; // ISO date string or null
  bankAccountNumber: string;
  bankName: string;
  ifscCode: string;
  branch: string;
  countryCode: string;
  department: Department;
  active: boolean;
  permanentAddress: Address;
  currentAddress: Address;
  countrySpecificData?: EmployeeCountrySpecificData;
  salary: Salary;
}

/**
 * Form data for creating a new employee (some fields may be optional)
 */
export interface EmployeeCreateInput extends Omit<Employee, 'employeeCode' | 'active'> {
  employeeCode?: string; // May be auto-generated
}

/**
 * Form data for updating an employee (all fields optional except employeeCode)
 */
export interface EmployeeUpdateInput extends Partial<Omit<Employee, 'id'>> {
  id: number; // Required for identifying the employee to update
}

/**
 * Response type for employee operations
 */
export interface EmployeeResponse {
  success: boolean;
  data?: Employee;
  error?: string;
  message?: string;
}

/**
 * Response type for list of employees
 */
export interface EmployeeListResponse {
  success: boolean;
  data?: Employee[];
  total?: number;
  error?: string;
  message?: string;
}

/**
 * Filter options for employee search/list
 */
export interface EmployeeFilterOptions {
  department?: string;
  location?: string;
  employmentType?: EmploymentType;
  active?: boolean;
  managerId?: string;
  searchTerm?: string;
}

/**
 * Pagination options
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: keyof Employee;
  sortOrder?: 'asc' | 'desc';
}