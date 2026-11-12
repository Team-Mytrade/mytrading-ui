import type { HelpExample } from "../types";

// Examples for HR & Payroll and Payroll Reports (topics/hr.ts). Sample data: Gulf Electronics Trading LLC (UAE, 54
// employees); India-only pages use Speedline Auto Parts (Chennai). Main case: Joseph D'Souza, EMP-0059.
export const HR_EXAMPLES: Record<string, HelpExample> = {
  "employee-documents": {
    story: "HR checks which visas expire soon.",
    data: [
      { label: "Employee", value: "Joseph D'Souza · EMP-0059" },
      { label: "Passport", value: "Expires 04 Aug 2030" },
      { label: "Residence visa", value: "Expires 12 Jan 2027 (in 60 days)" },
      { label: "Emirates ID", value: "784-1990-4471823-6" },
    ],
    result: "The visa shows as expiring soon so renewal can start in time.",
  },
  "employee-compensation": {
    story: "HR sets how an Inventory Executive's pay is split.",
    data: [
      { label: "Designation", value: "Inventory Executive" },
      { label: "Basic", value: "60%" },
      { label: "Housing", value: "25%" },
      { label: "Transport", value: "15%" },
    ],
    result: "Anyone given this designation gets the same split of their monthly pay.",
  },
  "salary-structure": {
    story: "HR sets Joseph's pay before his first month.",
    data: [
      { label: "Employee", value: "Joseph D'Souza · EMP-0059" },
      { label: "Basic", value: "AED 4,800" },
      { label: "Housing allowance", value: "AED 2,000" },
      { label: "Transport allowance", value: "AED 1,200" },
      { label: "Monthly gross", value: "AED 8,000" },
    ],
    result: "Payroll uses AED 8,000 a month; gratuity is worked out on the basic of AED 4,800.",
  },
  "employee-salary": {
    story: "Finance reviews what payroll costs the company each month.",
    data: [
      { label: "Employees", value: "54" },
      { label: "Monthly gross", value: "AED 486,400" },
      { label: "Gratuity provision", value: "AED 18,950" },
      { label: "Total cost", value: "AED 505,350" },
    ],
    result: "The total is used for the payroll budget.",
  },
  "it-declaration": {
    company: "SAP",
    story: "Karthik Raman at Speedline declares his tax-saving investments for the year.",
    data: [
      { label: "Section 80C", value: "PPF ₹1,00,000 · ELSS ₹50,000" },
      { label: "Section 80D", value: "Health insurance ₹25,000" },
      { label: "HRA", value: "Rent ₹18,000 / month, Chennai" },
      { label: "Regime", value: "Old" },
    ],
    result: "Once HR reviews it, monthly TDS on his salary drops to match.",
  },
  "payroll-engine": {
    story: "HR runs November payroll after attendance is closed.",
    data: [
      { label: "Month", value: "November 2026" },
      { label: "Employees", value: "54" },
      { label: "Gross", value: "AED 486,400" },
      { label: "Deductions", value: "AED 3,850 (unpaid leave, advances)" },
      { label: "Net pay", value: "AED 482,550" },
    ],
    result: "Once approved, the run posts to the books and the bank file can be made.",
  },
  payslips: {
    story: "HR sends November payslips to everyone.",
    data: [
      { label: "Month", value: "November 2026" },
      { label: "Payslips", value: "54" },
      { label: "Example", value: "Joseph D'Souza · gross 8,000 · net 7,733.33" },
      { label: "Sent", value: "By email, as PDF" },
    ],
    result: "Each employee receives their own payslip; HR can download all as one file.",
  },
  "my-salary": {
    story: "Joseph looks at his November pay.",
    data: [
      { label: "Gross", value: "AED 8,000.00" },
      { label: "Unpaid leave (1 day)", value: "− AED 266.67" },
      { label: "Net pay", value: "AED 7,733.33" },
    ],
    result: "He downloads the payslip as a PDF for his bank.",
  },
  "tax-tracker": {
    company: "SAP",
    story: "Speedline's HR checks the year's income tax for an employee.",
    data: [
      { label: "Employee", value: "Karthik Raman" },
      { label: "Yearly taxable", value: "₹9,40,000" },
      { label: "Tax for the year", value: "₹58,240" },
      { label: "TDS so far (Apr–Oct)", value: "₹33,970" },
    ],
    result: "₹24,270 is still to be deducted over November to March.",
  },
  "gulf-pay-files": {
    story: "HR makes the WPS salary file for November.",
    data: [
      { label: "Company", value: "Gulf Electronics Trading LLC · MOHRE 1048823" },
      { label: "File", value: "WPS SIF · November 2026" },
      { label: "Employees", value: "54" },
      { label: "Total", value: "AED 482,550" },
    ],
    result: "The bank uploads the SIF file and salaries reach everyone's accounts under WPS.",
  },
  "payroll-summary": {
    story: "Management reviews November payroll at a glance.",
    data: [
      { label: "Employees paid", value: "54" },
      { label: "Gross", value: "AED 486,400" },
      { label: "Deductions", value: "AED 3,850" },
      { label: "Net", value: "AED 482,550" },
    ],
    result: "It matches the payroll run and the bank file.",
  },
  "department-summary": {
    story: "Management compares department costs.",
    data: [
      { label: "Sales", value: "6 people · AED 72,500" },
      { label: "Warehouse", value: "6 people · AED 46,800" },
      { label: "Finance & Accounts", value: "6 people · AED 61,300" },
    ],
    result: "Sales is the most expensive team per person, mostly from commission.",
  },
  "department-salary": {
    story: "HR looks at Warehouse salaries for the quarter.",
    data: [
      { label: "Department", value: "Warehouse" },
      { label: "Period", value: "Sep – Nov 2026" },
      { label: "Total", value: "AED 138,400" },
    ],
    result: "One new hire in November explains the rise.",
  },
  "gratuity-provision": {
    story: "Finance works out end-of-service gratuity owed so far.",
    data: [
      { label: "Employee", value: "Fatima Khan · 3 years' service" },
      { label: "Basic", value: "AED 6,000 (AED 200 a day)" },
      { label: "Days earned", value: "21 days × 3 years = 63 days" },
      { label: "Provision", value: "AED 12,600" },
    ],
    result: "The company total is posted as a provision so the liability shows in the books.",
  },
  "exit-management": {
    story: "Maria D'Souza resigns to move abroad.",
    data: [
      { label: "Resignation date", value: "01 Nov 2026" },
      { label: "Notice period", value: "30 days" },
      { label: "Last working day", value: "30 Nov 2026" },
      { label: "Reason", value: "Relocation" },
    ],
    result: "Her manager and HR get the request to approve.",
  },
  "exit-approvals": {
    story: "HR approves Maria's exit and sets the final terms.",
    data: [
      { label: "Employee", value: "Maria D'Souza" },
      { label: "Approved by", value: "Ahmed Al Mansoori, then HR" },
      { label: "Leave to encash", value: "9 days" },
      { label: "Status", value: "Approved → Finished" },
    ],
    result: "On finishing, her login is switched off and full & final settlement is ready.",
  },
  "full-and-final": {
    story: "Maria's last pay is worked out and paid.",
    data: [
      { label: "November salary", value: "AED 9,500" },
      { label: "Leave encashment (9 days)", value: "AED 1,710" },
      { label: "Gratuity (2 years)", value: "AED 7,980" },
      { label: "Total paid", value: "AED 19,190" },
    ],
    result: "Paying it closes her file; the gratuity provision for her is released.",
  },
};
