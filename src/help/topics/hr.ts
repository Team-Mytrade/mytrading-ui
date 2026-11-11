import type { HelpRole, HelpTopic } from "../types";

// Who can do what on the HR & Payroll pages (payroll-service SecurityConfig): HRM:APPROVE reads everyone's pay and HR
// records and changes them (payroll runs, rollbacks, payslips, salaries, documents, IT declarations, exits, Gulf files,
// reports); HRM:EXPORT downloads bank files, payslip ZIPs, WPS / Mudad files and IT proofs; HRM:VIEW alone reads only the
// caller's own records. Self-service (own payslips, IT declaration, resignation, documents) is open to every employee.
// The demo HR & Payroll Manager has every right; the Executive has view, create and update.
const HR_ONLY: HelpRole[] = [
  { role: "HR & Payroll Manager", can: "Everything on the page (it needs the HR approve right; downloads need the export right)." },
];

const HR_REPORT_WHO: HelpRole[] = [
  { role: "HR & Payroll Manager", can: "Read and export the report (everyone's pay needs the HR approve right)." },
];

// HRMS (payroll part of the menu) and Payroll Reports
export const HR_TOPICS: HelpTopic[] = [
  {
    id: "employee-documents",
    route: "/employeeDocuments",
    module: "HRMS",
    title: "Documents",
    summary: "Every employee's documents (passport, national ID, work permit, tax ID and more), to verify or reject, preview and download.",
    who: HR_ONLY,
    tasks: [
      {
        title: "Where documents come from",
        steps: ["Employees upload theirs from their own Documents page (the Documents link on their profile): the Document Type and a PDF, JPG or PNG up to 5 MB."],
      },
      { title: "Check one", steps: ["Click Preview (or Download).", "Click Verify, or Reject with the reason."] },
    ],
    statuses: [
      { name: "Pending", meaning: "Uploaded, waiting for HR." },
      { name: "Verified", meaning: "Checked by HR." },
      { name: "Rejected", meaning: "Not accepted; upload a new one." },
    ],
    rules: ["Exporting the list (PDF, Excel, print) needs the export right; deleting needs the delete right."],
    related: [{ route: "/employeeRecords", label: "Employees" }],
  },
  {
    id: "employee-compensation",
    route: "/employeeCompensation",
    module: "HRMS",
    title: "Compensation",
    summary: "How each designation's yearly CTC is split into salary components. The split is used when an employee with that designation is added.",
    who: HR_ONLY,
    tasks: [
      {
        title: "Set a designation's split",
        steps: [
          "Click Add Role Compensation and enter the Designation (e.g. Senior Software Engineer).",
          "Add the components with Add Component: the Component Name (Basic, HRA, Special Allowances…) and its Percentage (%). Save.",
        ],
      },
    ],
    rules: [
      "Basic is a % of the yearly CTC and HRA a % of basic. Other components are kept for reference only.",
      "A change affects employees added from now on; existing employees keep their salary structure.",
    ],
    related: [
      { route: "/salaryStructure", label: "Salary Structure" },
      { route: "/employeeRecords", label: "Employees" },
    ],
    byRegion: {
      IN: {
        tasks: [
          {
            title: "Set how PF is paid",
            steps: [
              "Under Provident Fund (India), choose Employer PF: Part of the CTC (the salary split leaves room for it) or On top of the CTC (shown after the fixed salary).",
              "Tick Cap the PF wage at the statutory limit and enter the Monthly PF wage limit, or leave it unticked for PF on the full basic. Each change is saved at once.",
            ],
          },
        ],
        rules: [
          "Employee and employer each pay 12% of the basic; the employer's share goes to EPFO and shows on the payslip as an employer contribution.",
          "The PF wage limit is also the EPS (pension) ceiling: EPS is 8.33% of the basic up to it.",
          "PF settings apply to payroll runs from when they are saved.",
        ],
      },
    },
  },
  {
    id: "salary-structure",
    route: "/salaryStructure",
    module: "HRMS",
    title: "Salary Structure",
    summary: "Each employee's pay in yearly amounts: basic, HRA and other allowances, and the CTC they add up to. Payroll pays one twelfth each month.",
    who: HR_ONLY,
    tasks: [
      {
        title: "Set an employee's pay",
        steps: ["Click Add Structure.", "Choose the Employee and the Effective From date; enter the Basic (yearly), HRA (yearly) and Other Allowances (yearly). Save."],
      },
      { title: "See the totals", steps: ["The cards show the Total CTC Value, Avg Basic (yearly) and Avg Gross / Month; each row shows its gross per year and per month."] },
    ],
    rules: ["Amounts are yearly; each month's payroll pays one twelfth."],
    related: [
      { route: "/employeeSalary", label: "Salary" },
      { route: "/payrollEngine", label: "Payroll Engine" },
    ],
    flows: ["hire-to-pay"],
    byRegion: {
      IN: {
        rules: ["The basic decides PF (12% of the basic) and, under the old tax regime, the HRA exemption; HRA is a share of the basic."],
      },
      GCC: {
        rules: [
          "Enter the housing allowance as HRA (yearly), and transport and other allowances as Other Allowances (yearly).",
          "Keep the basic as on the labour contract: the UAE end-of-service gratuity is worked out on the basic pay, and nationals' pension contributions on their pensionable pay.",
        ],
      },
    },
  },
  {
    id: "employee-salary",
    route: "/employeeSalary",
    module: "HRMS",
    title: "Salary",
    summary: "Everyone's current salary at a glance: basic and gross, yearly and monthly, from the salary structures.",
    who: HR_ONLY,
    tasks: [{ title: "Read the payroll cost", steps: ["The cards show Employees, Yearly Gross Payroll, Monthly Gross Payroll and Average Monthly Gross.", "Click Refresh after changing a salary structure."] }],
    rules: ["This is what each employee is set to earn; Payslips show what was actually paid."],
    related: [
      { route: "/salaryStructure", label: "Salary Structure" },
      { route: "/employeePayslips", label: "Payslips" },
    ],
  },
  {
    id: "it-declaration",
    route: "/it-declaration",
    module: "HRMS",
    regions: ["IN"],
    title: "IT Declaration",
    summary: "India: each employee chooses their income-tax regime and declares their deductions with proofs; HR approves them, and only approved amounts reduce the tax payroll deducts.",
    who: [
      { role: "Every employee", can: "Fill in and submit their own declaration for the financial year." },
      { role: "HR & Payroll Manager", can: "Review everyone's declarations: approve or reject items, verify proofs, lock for payroll, download proofs." },
    ],
    tasks: [
      {
        title: "Declare (employee)",
        steps: [
          "Choose the Financial Year and the Tax Regime: Old Regime (claim HRA, LTA, 80C, 80D) or New Regime (lower rates, standard deduction applied by itself). Compare Regimes helps you choose.",
          "Click Add Item for each deduction: the Type, the amount (up to its maximum limit), a description and the proof.",
          "Save as Draft while you collect proofs, then click Submit Declaration and Yes, Submit.",
        ],
      },
      {
        title: "Review (HR)",
        who: "HR & Payroll Manager",
        steps: [
          "Under Declarations to review (tick Only those waiting for HR), open a declaration.",
          "For each item: Verify proof, set the Amount to approve and a Note for the employee, then Approve or Reject.",
          "Click Lock for Payroll when it is final; Unlock lets the employee change it again.",
        ],
      },
    ],
    rules: [
      "HR approves each item; only approved amounts reduce the tax. A changed amount goes back to HR for approval.",
      "A locked declaration can't change: ask HR to unlock it.",
      "The tax comparison is indicative; consult a tax advisor for your full situation.",
    ],
    related: [{ route: "/payrollEngine", label: "Payroll Engine" }],
  },
  {
    id: "payroll-engine",
    route: "/payrollEngine",
    module: "HRMS",
    title: "Payroll Engine",
    summary: "Run the month's payroll: add one-off earnings and deductions and the month's attendance, run it (bank transfer file and payslips), post it to the ledger and record the salary payment.",
    who: HR_ONLY,
    tasks: [
      {
        title: "Prepare the month",
        steps: [
          "On Process Payroll, choose the Payroll Month.",
          "Download Templates: the Earnings / Deductions Template and the Attendance Template list the employees still to be paid. Fill them in.",
          "Click Continue to Upload.",
        ],
      },
      {
        title: "Upload the files",
        steps: [
          "Choose One-off earning, One-off deduction or Attendance; for earnings and deductions enter the Name on payslips (e.g. Bonus).",
          "Choose the File and upload it. Remove takes a wrong file out. Click Review.",
        ],
      },
      {
        title: "Run it",
        steps: [
          "Check Employees to pay, Already paid this month and the one-off totals; fix anything under Fix before running payroll.",
          "With no attendance uploaded, tick the box to pay everyone for the full month.",
          "Click Run Payroll for the month: the bank transfer file and payslips are made.",
        ],
      },
      {
        title: "Approve a run (when approval is required)",
        steps: [
          "On Batch History, tick Require approval (and the flag ± change to look at): each run then waits for someone other than who ran it.",
          "Click Review & approve on a run Awaiting approval. Only what needs a look shows employees whose net pay moved by the flag or more, or who were paid last month but not this month.",
          "Click Approve run: the payslips, bank file and books follow. Or Send back, with a note: its salaries are rolled back so it can be run again.",
          "Reopen unlocks an approved run that isn't paid yet, to correct it; it needs approving again.",
        ],
      },
      {
        title: "Books and payment",
        steps: [
          "On Batch History, a run shows Waiting for the books until it is posted: click Post to the ledger.",
          "Download Bank Report for the bank transfer file.",
          "When the salaries are paid, click Record Payment: Paid on and Paid from. It clears the run's salaries payable.",
        ],
      },
    ],
    rules: [
      "The attendance file needs 'working days' and 'lop days' columns, the earnings / deductions file an 'amount' column: start from the downloaded template.",
      "An employee is paid once a month; those already paid are left out of a new run.",
      "Employees serving notice are held out of the regular payroll from the month before their last working day; Full & Final pays them.",
      "Sales commission sent to payroll shows on the payslip as Sales commission.",
    ],
    related: [
      { route: "/employeePayslips", label: "Payslips" },
      { route: "/journalEntries", label: "Journal Entries" },
    ],
    flows: ["hire-to-pay"],
    byRegion: {
      IN: {
        rules: [
          "The run deducts income tax (TDS) by each employee's tax regime and approved IT declarations, PF (as set on Compensation), ESI where it applies and professional tax by the state of the employee's current address.",
          "The financial year runs April to March: the tax still due for the year is spread over the months left.",
        ],
        related: [
          { route: "/it-declaration", label: "IT Declaration", why: "Approved deductions lower the tax" },
          { route: "/taxTracker", label: "Tax Tracker" },
        ],
      },
      GCC: {
        rules: [
          "There is no income tax. The run deducts the pension / social insurance share of nationals and GCC nationals (UAE: GPSSA or ADPF; Saudi Arabia: GOSI) and adds the employer's share.",
          "With a UAE or Saudi leave policy, sick leave is paid in the law's tiers.",
          "After the run, make the WPS salary file (UAE) or the Mudad file (Saudi Arabia) on Gulf Pay Files.",
        ],
        related: [
          { route: "/gulfPayFiles", label: "Gulf Pay Files", why: "WPS and Mudad files" },
          { route: "/gratuityProvision", label: "Gratuity Provision" },
        ],
      },
    },
  },
  {
    id: "payslips",
    route: "/employeePayslips",
    module: "HRMS",
    title: "Payslips",
    summary: "Each month's payslips: gross, deductions and net pay per employee, to view and download.",
    who: [
      { role: "HR & Payroll Manager", can: "Everyone's payslips: generate them again, roll back an employee's month, download ZIPs." },
      { role: "Every employee", can: "Only their own payslip." },
    ],
    tasks: [
      { title: "Find a month", steps: ["Choose the Payroll month; View Details shows the salary breakdown."] },
      { title: "Download", steps: ["Click Download Payslip on the row.", "Download Range (ZIP): choose From Month and To Month for one ZIP of payslips (needs the export right)."] },
      { title: "Make them again", who: "HR & Payroll Manager", steps: ["Click Generate Payslips and choose the month: the month's payslips are made again."] },
      {
        title: "Email them",
        who: "HR & Payroll Manager",
        steps: [
          "Click Email Payslips: they go to each employee's official email (else personal). Only payslips of approved runs are sent.",
          "Tick Password-protect emailed payslips if wanted (the email says how the password is formed, never the password), and Email each run's payslips automatically to send them as they are made.",
          "Choose employees and click Email selected; Resend failed retries the ones that didn't go.",
        ],
      },
      {
        title: "Undo an employee's month",
        who: "HR & Payroll Manager",
        steps: ["Click Rollback on the row: the payslip is removed and the run's bank transfer file no longer lists them. Run payroll again to pay them."],
      },
    ],
    statuses: [
      { name: "Processed", meaning: "Paid in a payroll run." },
      { name: "Draft", meaning: "Not run yet." },
    ],
    related: [{ route: "/payrollEngine", label: "Payroll Engine" }],
    flows: ["hire-to-pay"],
    byRegion: {
      IN: {
        rules: ["The payslip lists PF, ESI, professional tax and income tax (TDS); the employer's PF shows as an employer contribution."],
      },
      GCC: {
        rules: ["The payslip lists the pension / social insurance share where it applies (nationals and GCC nationals); there is no income tax."],
      },
    },
  },
  {
    id: "my-salary",
    route: "/mySalary",
    module: "HRMS",
    title: "My Salary",
    summary: "Your own salary: what your pay is made of, each month's pay with its payslip, and what is still to come this year.",
    who: [{ role: "Every employee", can: "Their own salary and payslips. Their login must be linked to their employee record (Users page)." }],
    tasks: [],

    rules: ["The page opens on the latest paid month; click another month to see it.", "A ZIP skips months without a payslip."],
    related: [{ route: "/employeePayslips", label: "Payslips" }],
    byRegion: {
      IN: {
        summary: "India payroll: your own salary for the financial year. What your CTC is made of, each month's pay with its payslip, and the income tax deducted so far and forecast for the months left.",
        tasks: [
          {
            title: "Read your salary",
            steps: [
              "Choose the Financial year at the top (April to March).",
              "The cards show your Yearly CTC, Monthly gross (a full month), Monthly take-home (for the month shown) and Tax for the year.",
              "CTC breakdown lists your fixed pay, the employer PF (inside the CTC or on top of it) and benefits the employer pays, up to the Total CTC. A variable pay target is on top and paid separately.",
            ],
          },
          {
            title: "Look at a month",
            steps: [
              "Under Income tax by month, click a month: A month's pay shows its gross pay, each deduction (provident fund, ESI, professional tax, other deductions, income tax) and the take-home.",
              "When the month has a payslip, View payslip or Download payslip with the icons on that card.",
            ],
          },
          {
            title: "Download several payslips",
            steps: ["Click Payslips (ZIP), choose the months (or a Custom range: From month, To month) and click Download ZIP."],
          },        ],

        fields: [
          { name: "Take-home", meaning: "Gross pay less your deductions and income tax: what is paid into your bank." },
          { name: "Forecast", meaning: "A month not paid yet (dashed tile): a full month at today's salary, with the tax left for the year spread evenly over the months left." },
          { name: "Tax for the year", meaning: "Tax deducted so far plus the forecast. The tiles' chips show how each month's tax and take-home changed from the month before." },
        ],
        rules: [
          "The forecast follows salary revisions, approved IT declarations and the tax regime, as the payroll runs will.",
          "Only employees on India payroll with a salary structure have this page.",
        ],
        related: [{ route: "/it-declaration", label: "IT Declaration", why: "Approved deductions lower the tax" }],
      },
      GCC: {
        summary: "Gulf payroll: your own pay for the calendar year. The annual package, each month's pay with its payslip, your pension or social insurance share and the end-of-service gratuity built up. There is no income tax.",
        tasks: [
          {
            title: "Read your pay",
            steps: [
              "Choose the Year at the top (January to December).",
              "The cards show your Annual package (with the cost to company), Monthly gross (a full month), Monthly take-home (for the month shown) and Gratuity to date.",
              "Annual package lists your fixed pay up to the Total pay, then what the employer adds: Employer pension / social insurance (with its scheme) and End-of-service gratuity (yearly provision), up to the Cost to company.",
            ],
          },
          {
            title: "Look at a month",
            steps: [
              "Under Take-home by month, click a month: A month's pay shows the Gross pay, your Pension / social insurance (you), Other deductions and the Take-home, then what your employer adds (not deducted from your pay).",
              "When the month has a payslip, view or download it with the icons on that card.",
            ],
          },
          {
            title: "Download several payslips",
            steps: ["Click Payslips (ZIP), choose the months (or a Custom range: From month, To month) and click Download ZIP."],
          },        ],

        fields: [
          { name: "Pension / social insurance", meaning: "Deducted only from nationals and GCC nationals: UAE GPSSA or Abu Dhabi Pension Fund, Saudi Arabia GOSI. Others have none." },
          { name: "Gratuity to date", meaning: "The end-of-service gratuity you would get if you left today." },
          { name: "Forecast", meaning: "A month not paid yet (dashed tile): a full month at today's salary." },
        ],
        rules: ["There is no income tax on Gulf payroll."],
      },
    },
  },
  {
    id: "tax-tracker",
    route: "/taxTracker",
    module: "HRMS",
    title: "Tax Tracker",
    summary: "Everyone's pay over the year, paid so far and forecast for the months left, with each employee's salary.",
    who: [{ role: "HR & Payroll Manager", can: "Everyone's pay (it needs the HR approve right). Others see only their own, on My Salary." }],
    tasks: [],

    related: [
      { route: "/mySalary", label: "My Salary" },
      { route: "/payrollEngine", label: "Payroll Engine" },
    ],
    byRegion: {
      IN: {
        summary: "India payroll: the company's income tax (TDS) for the financial year, deducted so far and forecast for the months left, with each employee's salary and tax.",
        tasks: [
          {
            title: "Read the year",
            steps: [
              "Choose the Financial year at the top.",
              "The cards show Tax deducted (up to the last month paid), Forecast, rest of year, Projected tax for the year (with the number of employees) and Take-home paid.",
              "Income tax by month charts April to March, deducted and forecast; Show table gives the figures.",
            ],
          },
          {
            title: "Look at an employee",
            steps: [
              "Under Employees, search by name, code or designation.",
              "Click a card: the employee's salary, months and payslips open as on their My Salary. All employees goes back.",
            ],
          },        ],

        fields: [
          { name: "Employee card", meaning: "Deducted, Forecast and the Year's tax, the share already deducted and the take-home per month." },
          { name: "Forecast", meaning: "Each month not paid yet: a full month at today's salary, with no one-off amounts, and the tax left for the year spread evenly over the months left." },
          { name: "Projected tax for the year", meaning: "Tax deducted plus the forecast." },
        ],
        rules: [
          "Covers employees on India payroll with a salary structure, highest yearly tax first.",
          "The forecast follows salary revisions, approved IT declarations, regime changes and exits, as the payroll runs will.",
        ],
        related: [{ route: "/it-declaration", label: "IT Declaration" }],
      },
      GCC: {
        title: "Pay Tracker",
        summary: "Gulf payroll: the year's net pay, paid so far and forecast for the months left, the employer's pension share and the gratuity provision, with each employee's pay. There is no income tax.",
        tasks: [
          {
            title: "Read the year",
            steps: [
              "Choose the Year at the top (January to December).",
              "The cards show Net pay paid (up to the last month paid), Forecast, rest of year (at today's salaries), Employer pension paid and Gratuity provision (built up this year).",
              "Net pay by month charts each month's pay, paid and forecast.",
            ],
          },
          {
            title: "Look at an employee",
            steps: [
              "Under Employees, search by name, code or designation.",
              "Click a card: the employee's salary, months and payslips open as on their My Salary. All employees goes back.",
            ],
          },        ],

        fields: [
          { name: "Employee card", meaning: "Net paid, Forecast and Gratuity, the take-home per month and the pension scheme, if any." },
          { name: "Gratuity provision", meaning: "End-of-service gratuity built up during the year: what the books should hold for it." },
        ],
        related: [{ route: "/gratuityProvision", label: "Gratuity Provision" }],
      },
    },
  },
  {
    id: "gulf-pay-files",
    route: "/gulfPayFiles",
    module: "HRMS",
    regions: ["GCC"],
    title: "Gulf Pay Files",
    summary: "UAE and Saudi payroll files: the WPS salary file (SIF), the Mudad file, and the month's pension and social insurance contributions.",
    who: HR_ONLY,
    tasks: [
      { title: "Choose the company", steps: ["Gulf pay files belong to one company: choose it in Working in at the top."] },
      {
        title: "Register the company",
        steps: ["Under Company registrations, enter the UAE MOHRE establishment ID and WPS agent routing code, or the KSA labour office and GOSI establishment numbers, and Save (needs the update right)."],
      },
      {
        title: "Make the files",
        steps: [
          "Choose the Payroll month.",
          "Under Salary files by payroll run, download the WPS file (SIF) for the UAE or the Mudad file for Saudi Arabia.",
          "Under Pension and social insurance, check each employee's contribution (Saudi Arabia: GOSI; UAE: GPSSA / ADPF) and Export Excel.",
        ],
      },
    ],
    rules: [
      "Run the month's payroll first: files are made per payroll run.",
      "The Mudad workbook follows the usual payroll upload columns; check them against your Mudad template.",
      "Downloads need the export right.",
    ],
    related: [
      { route: "/payrollEngine", label: "Payroll Engine" },
      { route: "/gratuityProvision", label: "Gratuity Provision" },
    ],
  },

  /* ================= Payroll Reports ================= */
  {
    id: "payroll-summary",
    route: "/payrollSummary",
    module: "Payroll Reports",
    title: "Payroll Summary",
    summary: "A month's payroll in totals: gross, deductions and net, the deductions by kind, and each employee's breakdown.",
    who: HR_REPORT_WHO,
    tasks: [{ title: "Read a month", steps: ["Choose the Payroll month.", "Read the totals and charts, then the Detailed Breakdown (working days and loss of pay days per employee). Export Excel for a copy."] }],
    fields: [
      { name: "Loss of Pay Days", meaning: "Days not paid, from the attendance uploaded for the run." },
    ],
    related: [
      { route: "/departmentSummary", label: "Department Summary" },
      { route: "/employeePayslips", label: "Payslips" },
    ],
  },
  {
    id: "department-summary",
    route: "/departmentSummary",
    module: "Payroll Reports",
    title: "Department Summary",
    summary: "A month's payroll cost per department: employees, gross cost, deductions and net paid.",
    who: HR_REPORT_WHO,
    tasks: [{ title: "Compare departments", steps: ["Choose the Payroll month.", "Read the Salary Breakdown by Department and the Employee Distribution."] }],
    related: [
      { route: "/payrollSummary", label: "Payroll Summary" },
      { route: "/employeeDepartments", label: "Departments" },
    ],
  },
  {
    id: "department-salary",
    route: "/departmentSalary",
    module: "Payroll Reports",
    title: "Department Salary",
    summary: "Salary cost by department from the payroll runs, for a month or the financial year to date: gross, income tax, net paid and cost to company, down to each employee.",
    who: HR_REPORT_WHO,
    tasks: [
      {
        title: "Choose the period",
        steps: [
          "Choose the Month, then Month or Year to date (from April of that financial year up to the month).",
          "Keep All departments, or choose one department to see only it, with its people open.",
        ],
      },
      {
        title: "Read it",
        steps: [
          "The cards show Employees paid, Gross pay, Net paid (with the income tax) and Cost to company.",
          "Cost to company by department shows each department's share; click a slice or a name to open that department in the table.",
          "In the table, click a department to show or hide its employees, each with their yearly CTC.",
          "Click Export for an Excel workbook: every employee, each department's total and the grand total.",
        ],
      },
    ],
    fields: [
      { name: "Avg yearly CTC", meaning: "The average yearly CTC of the department's employees." },
    ],
    rules: [
      "Each salary counts in the department it was paid under.",
      "Only months with a payroll run count; a month without one shows nothing.",
      "With more than seven departments, the smallest are put together as Other in the chart.",
    ],
    related: [
      { route: "/departmentSummary", label: "Department Summary" },
      { route: "/payrollSummary", label: "Payroll Summary" },
    ],
    byRegion: {
      IN: {
        fields: [{ name: "Cost to company", meaning: "Gross pay plus the employer's PF and ESI." }],
      },
      GCC: {
        summary: "Salary cost by department from the payroll runs, for a month or the year to date: gross, net paid and cost to company, down to each employee. There is no income tax on Gulf payroll.",
        fields: [{ name: "Cost to company", meaning: "Gross pay plus the employer's pension / social insurance share." }],
      },
    },
  },
  {
    id: "gratuity-provision",
    route: "/gratuityProvision",
    module: "Payroll Reports",
    regions: ["GCC"],
    title: "Gratuity Provision",
    summary: "What each Gulf employee would get as end-of-service gratuity if the company ended their employment on a date: the provision to hold in the books.",
    who: HR_REPORT_WHO,
    tasks: [{ title: "Work it out", steps: ["Choose As of (the date).", "Read each employee's service, wage and gratuity owed. Export Excel for the accounts."] }],
    rules: [
      "Counted from the first day, with no resignation cut. UAE: on basic pay; Saudi Arabia: on the actual wage.",
      "National employees in a pension fund are left out.",
      "An amount marked Approximate has a note saying why (point at it).",
    ],
    related: [
      { route: "/exitApprovals", label: "Exit Approvals", why: "The actual settlement at exit" },
      { route: "/gulfPayFiles", label: "Gulf Pay Files" },
    ],
  },
  {
    id: "exit-management",
    route: "/exit-management",
    module: "Payroll Reports",
    title: "Exit Management",
    summary: "Your own resignation: submit it, follow its steps and withdraw it if you change your mind.",
    who: [{ role: "Every employee", can: "Their own resignation. HR reviews it on Exit Approvals." }],
    tasks: [
      {
        title: "Resign",
        steps: [
          "Click Start Resignation and enter the Resignation Date. The Notice Period (days) comes from your company's rules, and the Last Working Date (LWD) from them.",
          "To leave earlier, enter the Proposed LWD: the Notice recovery days show what isn't served (recovery may apply, subject to HR approval).",
          "Add the reason and the Comment / handover details, then Submit Resignation: it goes to HR for approval.",
        ],
      },
      { title: "Follow it", steps: ["Exit Steps shows where it is; Request History lists your earlier resignations."] },
      { title: "Change your mind", steps: ["Click Withdraw Resignation, say why (optional) and Confirm Withdrawal. It waits for HR."] },
    ],
    related: [{ route: "/exitApprovals", label: "Exit Approvals" }],
  },
  {
    id: "exit-approvals",
    route: "/exitApprovals",
    module: "Payroll Reports",
    title: "Exit Approvals",
    summary: "Employees' resignations from request to relieving: approve or reject, notice period, clearance, final settlement and completing the exit.",
    who: HR_ONLY,
    tasks: [
      {
        title: "Decide",
        steps: [
          "Click Details / Edit to check the request and change the Last working day, Reason, How the employment ended, Unused annual leave (days) or Exit interview notes.",
          "Click Approve, or Reject with the reason.",
        ],
      },
      { title: "Notice period", steps: ["Click Start notice on an approved resignation."] },
      { title: "A withdrawal request", steps: ["Click Accept withdrawal or Decline."] },
      {
        title: "Set the full and final terms",
        steps: [
          "In Details / Edit, under Full & final settlement: decide the Unserved notice (Recover from the employee, Pay in lieu to the employee, or Waive), with the Days and a Remark. The suggestion follows how the employment ended.",
          "Add a Severance if due: months of gross or basic pay, or a fixed amount, paid With the F&F or Monthly after exit (in instalments).",
          "Add any Other earnings / deductions (e.g. pending bonus, asset not returned, loan recovery): Name, Earning or Deduction, Amount, Taxable. Click Save settlement terms.",
        ],
      },
      {
        title: "Finish the exit",
        steps: [
          "Click Clearance done once assets are handed back.",
          "Pay the settlement on Full & Final (it marks the settlement done); or click Settlement done once the last month's pay is processed.",
          "From the last working day, click Complete exit: the employee is relieved and their login is switched off.",
        ],
      },
    ],

    statuses: [
      { name: "Submitted / Under review", meaning: "Waiting for a decision." },
      { name: "Approved", meaning: "Accepted; start the notice period." },
      { name: "Notice period", meaning: "Serving notice until the last working day." },
      { name: "Rejected", meaning: "Not accepted." },
      { name: "Withdrawn", meaning: "The employee withdrew and HR accepted." },
      { name: "Completed", meaning: "Relieved; the login is off." },
    ],
    rules: ["Complete exit needs clearance and settlement done, and the last working day reached."],
    related: [
      { route: "/exit-management", label: "Exit Management" },
      { route: "/fullAndFinal", label: "Full & Final" },
    ],
    byRegion: {
      IN: {
        fields: [
          { name: "How the employment ended", meaning: "Decides what is suggested for unserved notice and when the full and final settlement falls due." },
          { name: "Unused annual leave (days)", meaning: "Encashed with the full and final settlement. Use the Attendance balance fills it in." },
        ],
      },
      GCC: {
        fields: [
          { name: "How the employment ended", meaning: "In Saudi Arabia it decides the end-of-service award: a resignation earns only part of it." },
          { name: "Unused annual leave (days)", meaning: "Paid with the final pay, a day being the monthly wage / 30. Use the Attendance balance fills it in." },
        ],
        rules: ["For an employee on Gulf payroll, Statement shows the end-of-service gratuity and the final pay."],
        related: [{ route: "/gratuityProvision", label: "Gratuity Provision" }],
      },
    },
  },
  {
    id: "full-and-final",
    route: "/fullAndFinal",
    module: "Payroll Reports",
    title: "Full & Final",
    summary: "Pay leaving employees: the months held back while they serve notice, plus their settlement lines (notice, severance, leave encashment, other earnings and deductions), once due.",
    who: HR_ONLY,
    tasks: [
      {
        title: "Pay what is due",
        steps: [
          "Under Leaving employees, check who is Due now (Not due yet and Action needed show the others). Decide anything missing on Exit Approvals first.",
          "Tick the employees (Select all due) and click Run F&F: a payroll batch and its bank sheet are made.",
          "Click Download bank sheet for the transfer. When runs need approval, it waits for approval on Payroll Engine and the bank sheet is released once approved.",
        ],
      },
      { title: "See what was paid", steps: ["Paid settlements lists each run with its employees, net and payslips."] },
    ],
    rules: [
      "Employees serving notice are held out of the regular payroll from the month before their last working day; their held months are paid here.",
      "Paying here records the exit's settlement as done.",
    ],
    related: [
      { route: "/exitApprovals", label: "Exit Approvals" },
      { route: "/payrollEngine", label: "Payroll Engine" },
    ],
  },
];
