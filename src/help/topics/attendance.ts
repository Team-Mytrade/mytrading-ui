import type { HelpRole, HelpTopic } from "../types";

// Who can do what on the Attendance pages (attendance-service SecurityConfig): punching, own leave, regularization and
// on-duty requests and the calendars are self-service, open to every employee whose login is linked to their employee
// record. ATTENDANCE:APPROVE decides requests (never one's own: ApproverCheck) and adjusts leave balances. Shift Master,
// Shift Roster, Attendance Policy and Leave Policy Master need ATTENDANCE:ADMIN (menu). The demo Attendance Manager has
// every right; the Executive has view, create and update.
const SELF_WHO: HelpRole[] = [
  { role: "Every employee", can: "Their own attendance, leave and requests. Their login must be linked to their employee record (Users page)." },
];

const APPROVER_WHO: HelpRole[] = [
  { role: "Attendance Manager", can: "Approve or reject everyone's requests except their own (needs the Attendance approve right)." },
];

const ADMIN_WHO = (what: string): HelpRole[] => [
  { role: "Attendance Manager", can: `${what} (needs the Attendance admin right).` },
];

const TEAM_WHO: HelpRole[] = [
  { role: "Attendance Manager / Executive", can: "See everyone's attendance; exporting needs the export right." },
];

// The three approval pages share one desk
const approvalTasks = (what: string) => [
  {
    title: "Decide a request",
    steps: [
      `Pending lists the ${what} waiting for a decision; View shows one in full.`,
      "Click Approve on the row (a remark is optional), or Reject with the reason.",
      "Approved and Rejected list what was decided.",
    ],
  },
];

const APPROVAL_STATUSES = [
  { name: "Pending", meaning: "Waiting for a decision." },
  { name: "Approved", meaning: "Accepted; the attendance calendar shows it." },
  { name: "Rejected", meaning: "Not accepted; the reason shows to the employee." },
];

const APPROVAL_RULES = ["Nobody can approve or reject their own request: it shows as Your own request.", "A rejection needs the reason."];

// Attendance (menu: Attendance)
export const ATTENDANCE_TOPICS: HelpTopic[] = [
  /* ================= My attendance ================= */
  {
    id: "my-attendance",
    route: "/att_selfService",
    module: "Attendance",
    title: "My Attendance",
    summary: "Your day at a glance: clock in and out, apply for leave, raise requests and see your attendance calendar.",
    who: SELF_WHO,
    tasks: [
      { title: "Start and end your day", steps: ["Click Clock In when you start and Clock Out when you finish."] },
      {
        title: "Apply for leave",
        steps: ["Click Apply Leave (or + Apply on a leave type).", "Choose the Leave Type, the From Date and To Date and add a reason, then Submit Request."],
      },
      { title: "Raise a request", steps: ["Under Raise Request For, choose On duty (client and site visits), Attendance regularization (missed check-ins / outs) or Apply leave."] },
      { title: "See a day", steps: ["In the Attendance Calendar, click a day (or Pick a date) for its punches and status."] },
    ],
    rules: [
      "On a day of approved full-day leave you can't clock in (On leave today).",
      "No leave policy assigned? Ask HR to assign one before applying.",
    ],
    related: [
      { route: "/att_punch", label: "Attendance Punch" },
      { route: "/att_leaveRequest", label: "Leave Requests" },
      { route: "/att_holidayCalendar", label: "Holiday Calendar" },
    ],
  },
  {
    id: "attendance-punch",
    route: "/att_punch",
    module: "Attendance",
    title: "Attendance Punch",
    summary: "Record your check-in and check-out with where you are working from; every punch is listed below.",
    who: SELF_WHO,
    tasks: [
      { title: "Punch", steps: ["Choose the Attendance Mode: Office, Work from home, Hybrid or On duty.", "Click CHECK-IN when you start and CHECK-OUT when you finish."] },
      { title: "See your punches", steps: ["Attendance History lists them; filter All, Check-Ins or Check-Outs."] },
    ],
    rules: [
      "Your location is read from this device when you punch; the server records the IP address and device.",
      "Punching needs an attendance policy (yours, or the company default).",
      "On a night shift, the check-out after midnight closes the day before.",
      "You can't check in on a day of approved full-day leave; a half-day leave is fine.",
    ],
    related: [{ route: "/att_selfService", label: "My Attendance" }],
  },
  {
    id: "leave-requests",
    route: "/att_leaveRequest",
    module: "Attendance",
    title: "Leave Requests",
    summary: "Apply for leave and follow your requests. Leave costs working days only.",
    who: SELF_WHO,
    tasks: [
      {
        title: "Apply",
        steps: [
          "Pick the dates on the calendar (double click a date for a single day), or enter the From Date and To Date.",
          "Choose the Leave Type and the Day Portion: Full Day, First half or Second half.",
          "Add your reason and submit.",
        ],
      },
      { title: "Withdraw", steps: ["Open Request History and click Withdraw on a pending request, or an approved one that hasn't started yet."] },
    ],
    statuses: [
      { name: "Pending", meaning: "Waiting for approval." },
      { name: "Approved", meaning: "Granted; the days come off your balance." },
      { name: "Rejected", meaning: "Not granted; the approver's reason shows." },
      { name: "Cancelled", meaning: "Withdrawn." },
    ],
    rules: [
      "Working days only: weekly offs and holidays are not counted. A half day counts 0.5.",
      "Your leave policy must cover the dates; no leave before your joining date.",
    ],
    related: [
      { route: "/att_attendanceApproval", label: "Leave Approvals" },
      { route: "/att_leavePolicy", label: "Leave Policy Master" },
    ],
  },
  {
    id: "attendance-regularization",
    route: "/att_timesheetManagement",
    module: "Attendance",
    title: "Attendance Regularization",
    summary: "Correct a day you forgot to punch, or punched wrongly: give the right check-in and check-out times and the reason.",
    who: SELF_WHO,
    tasks: [
      {
        title: "Correct a day",
        steps: [
          "Pick the day to correct (days with a missing punch are marked in red; double click a date for just that day). View Punches shows what was recorded.",
          "Enter the Check in and Check out times and the reason (e.g. Biometric was down, punched in the register). Submit.",
        ],
      },
      { title: "Withdraw", steps: ["In the history, click Withdraw on a pending request."] },
    ],
    statuses: [
      { name: "Pending", meaning: "Waiting for approval." },
      { name: "Approved", meaning: "The day now uses the corrected times." },
      { name: "Rejected", meaning: "Not accepted." },
      { name: "Cancelled", meaning: "Withdrawn." },
    ],
    rules: ["Past working days only.", "Your attendance policy must allow regularization."],
    related: [{ route: "/att_regularizationApproval", label: "Regularization Approvals" }],
  },
  {
    id: "on-duty-requests",
    route: "/att_requests",
    module: "Attendance",
    title: "On-Duty Requests",
    summary: "Ask to be marked present while working away from the office: an on-duty visit (client or site) or work from home.",
    who: SELF_WHO,
    tasks: [
      {
        title: "Request",
        steps: [
          "Choose the Request Type: On duty visit or Work from home, and the From Date and To Date.",
          "On duty: the Client Name, Visit Location and Visit Purpose. Work from home: what you will work on (Task ID optional).",
          "Enter the reason (and remarks), then click Review days & times: check each day's shift and working times. Weekly offs and holidays are left out unless you tick them.",
          "Submit.",
        ],
      },
      { title: "Follow or withdraw", steps: ["My Requests lists them; Withdraw request takes back a pending one."] },
    ],
    statuses: [
      { name: "Pending", meaning: "Waiting for approval." },
      { name: "Approved", meaning: "The days are marked on duty or work from home." },
      { name: "Rejected", meaning: "Not accepted." },
      { name: "Cancelled", meaning: "Withdrawn." },
    ],
    rules: [
      "Forgot to punch? Use Attendance Regularization instead.",
      "Your attendance policy must allow on duty / work from home.",
      "Not on days of approved or pending full-day leave.",
    ],
    related: [{ route: "/att_onDutyApproval", label: "On-Duty Approvals" }],
  },
  {
    id: "holiday-calendar",
    route: "/att_holidayCalendar",
    module: "Attendance",
    title: "Holiday Calendar",
    summary: "The company's holidays per year. Holidays on an active calendar don't count as leave days or absences.",
    who: [
      { role: "Every employee", can: "See the holidays." },
      { role: "Attendance Manager / Executive", can: "Create calendars and manage their holidays (deleting needs the delete right)." },
    ],
    tasks: [
      { title: "See the holidays", steps: ["Choose the Year and the calendar; click a date to inspect it."] },
      {
        title: "Set up a year",
        steps: [
          "Click Create Calendar: the Calendar Code, Calendar Name, Calendar Year, Status and Description.",
          "Click Manage Holidays and Add Holiday Row for each holiday: its name, date and type (National, State or Festival). Validate Duplicates checks for repeats.",
          "Next year: Duplicate Calendar for Next Year, then adjust the dates.",
        ],
      },
    ],
    rules: [
      "Calendar codes are unique within your company.",
      "Only active calendars count.",
      "Like the other My attendance pages, it opens only for logins linked to an employee record.",
    ],
    related: [
      { route: "/att_leaveRequest", label: "Leave Requests" },
      { route: "/att_attendanceTracking", label: "Attendance Tracking" },
    ],
  },

  /* ================= Approvals ================= */
  {
    id: "manager-leave-dashboard",
    route: "/att_leaveManagerDashboard",
    module: "Attendance",
    title: "Manager Leave Dashboard",
    summary: "Your team's leave at a glance, the queues waiting for a decision, and manual changes to leave balances.",
    who: APPROVER_WHO,
    tasks: [
      { title: "See the team", steps: ["The cards show Team Members, Pending Approvals, Team On Leave Today and Team Leaves Starting This Week."] },
      { title: "Work the queues", steps: ["Under Pending Approval Queues, click Open queue for leave, regularization or on-duty requests."] },
      {
        title: "Adjust a balance",
        steps: ["Click Adjust Leave Balance: choose the Employee and Leave type, enter the days (e.g. 2 or -1) and the reason (e.g. Compensatory off for working on 12 Oct).", "The Leave Adjustments Log keeps every change."],
      },
    ],
    rules: ["Team figures need your login linked to your employee record; the approval queues cover the whole company."],
    related: [
      { route: "/att_attendanceApproval", label: "Leave Approvals" },
      { route: "/att_regularizationApproval", label: "Regularization Approvals" },
      { route: "/att_onDutyApproval", label: "On-Duty Approvals" },
    ],
  },
  {
    id: "leave-approvals",
    route: "/att_attendanceApproval",
    module: "Attendance",
    title: "Leave Approvals",
    summary: "Leave requests waiting for a decision, and the ones already decided.",
    who: APPROVER_WHO,
    tasks: approvalTasks("leave requests"),
    statuses: APPROVAL_STATUSES,
    rules: [...APPROVAL_RULES, "Approved leave comes off the employee's balance."],
    related: [
      { route: "/att_leaveManagerDashboard", label: "Manager Leave Dashboard" },
      { route: "/att_leaveRequest", label: "Leave Requests" },
    ],
  },
  {
    id: "regularization-approvals",
    route: "/att_regularizationApproval",
    module: "Attendance",
    title: "Regularization Approvals",
    summary: "Corrections to missed or wrong punches waiting for a decision.",
    who: APPROVER_WHO,
    tasks: approvalTasks("regularization requests"),
    statuses: APPROVAL_STATUSES,
    rules: [...APPROVAL_RULES, "Approving replaces the day's first check-in and last check-out with the requested times."],
    related: [{ route: "/att_timesheetManagement", label: "Attendance Regularization" }],
  },
  {
    id: "on-duty-approvals",
    route: "/att_onDutyApproval",
    module: "Attendance",
    title: "On-Duty Approvals",
    summary: "On-duty visits and work-from-home requests waiting for a decision.",
    who: APPROVER_WHO,
    tasks: approvalTasks("on-duty and work-from-home requests"),
    statuses: APPROVAL_STATUSES,
    rules: [...APPROVAL_RULES, "Approving a request approves every day in it."],
    related: [{ route: "/att_requests", label: "On-Duty Requests" }],
  },

  /* ================= Team ================= */
  {
    id: "attendance-tracking",
    route: "/att_attendanceTracking",
    module: "Attendance",
    title: "Attendance Tracking",
    summary: "One employee's month on a calendar: each day's status, hours worked and overtime.",
    who: TEAM_WHO,
    tasks: [
      { title: "Read a month", steps: ["Choose the Employee; move with Previous Month / Next Month, or Today.", "Click a card (Present days, Absent, Late arrivals, Leave, Holidays & offs) to show only those days; Clear filter shows all."] },
      { title: "See a day", steps: ["Click the day: Attendance Details with its punches and status."] },
      { title: "Share it", steps: ["Export Excel or Export PDF (needs the export right)."] },
    ],
    statuses: [
      { name: "P / LT / HD", meaning: "Present, Late, Half day." },
      { name: "A / L", meaning: "Absent, Leave." },
      { name: "H / WO", meaning: "Holiday, Week off." },
      { name: "OD / WFH", meaning: "On duty, Work from home." },
      { name: "IN / REG", meaning: "Checked in (day still open), Regularized." },
    ],
    rules: [
      "Half day or absent is decided when the day closes; until then a checked-out day counts as present.",
      "Days are marked absent only from the joining date and the company's first attendance record.",
    ],
    related: [
      { route: "/att_reports", label: "Attendance Reports" },
      { route: "/att_holidayCalendar", label: "Holiday Calendar" },
    ],
  },
  {
    id: "shift-roster",
    route: "/att_shiftSchedule",
    module: "Attendance",
    title: "Shift Roster & Schedule",
    summary: "Which shift each employee works from when. The shift decides late marks, weekly offs and working hours.",
    who: ADMIN_WHO("Assign and change shifts"),
    tasks: [
      { title: "Assign a shift", steps: ["Click Assign Shift: the Employee, the shift (Select Shift) and Effective From. Save."] },
      { title: "Change it", steps: ["Click Edit Assignment on the employee; Refresh Roster reloads the list."] },
    ],
    rules: ["An employee without a shift can still punch, but isn't marked late."],
    related: [{ route: "/att_shift", label: "Shift Master" }],
  },
  {
    id: "attendance-reports",
    route: "/att_reports",
    module: "Attendance",
    title: "Attendance Reports",
    summary: "Attendance across the company: today's summary, daily and monthly reports, late arrivals and missing punches.",
    who: TEAM_WHO,
    tasks: [
      {
        title: "Choose a report",
        steps: [
          "Day Summary: a day's counts at a glance.",
          "Daily Report: each employee's check-in, check-out, worked hours and status for a date.",
          "Monthly Report: present, half, absent, leave, on-duty and WFH days, late count, hours and overtime per employee.",
          "Late Arrivals and Missing Punches: who was late, and who has a day without a check-out.",
        ],
      },
    ],
    related: [
      { route: "/att_attendanceTracking", label: "Attendance Tracking" },
      { route: "/att_timesheetManagement", label: "Attendance Regularization", why: "Fix a missing punch" },
    ],
  },

  /* ================= Set-up ================= */
  {
    id: "shift-master",
    route: "/att_shift",
    module: "Attendance",
    title: "Shift Master",
    summary: "The shifts people work: start and end times, break, grace period, weekly offs and overtime.",
    who: ADMIN_WHO("Create and change shifts"),
    tasks: [
      {
        title: "Create a shift",
        steps: [
          "Click Create Shift: the Shift Code (e.g. GEN, A, N), Shift Name, Start Time and End Time.",
          "Set the Break Minutes, Grace Period Mins and Finalize Buffer Mins; tick the Weekly Offs (Saturday and Sunday by default) and Overtime Permitted. Save.",
        ],
      },
      { title: "Weekly offs like the 2nd and 4th Saturday", steps: ["After saving, click the shift's Weekly Offs column (Manage Weekly Off Rules): the Day of Week and the Week Occurrence."] },
    ],
    fields: [
      { name: "Grace Period Mins", meaning: "How late after the start someone can check in without a late mark." },
      { name: "Finalize Buffer Mins", meaning: "Minutes after the shift ends before a missed check-out is closed automatically (time for overtime)." },
    ],
    rules: ["A shift that ends before it starts is a night shift.", "Weekly offs are free days: they don't count as leave or absence."],
    related: [
      { route: "/att_shiftSchedule", label: "Shift Roster & Schedule" },
      { route: "/att_attendancePolicy", label: "Attendance Policy" },
    ],
  },
  {
    id: "attendance-policy",
    route: "/att_attendancePolicy",
    module: "Attendance",
    title: "Attendance Policy",
    summary: "The rules a day is judged by: minutes for a full and a half day, grace, breaks, overtime, and whether work from home, regularization and on duty are allowed.",
    who: ADMIN_WHO("Create, assign and change policies"),
    tasks: [
      {
        title: "Create a policy",
        steps: [
          "Click Create Policy: the Policy Name, then the Time Thresholds (Minutes): Full Day Min, Half Day Min, Grace Period, Max Break, Overtime After and Permission (Hrs/Mo).",
          "Tick what it allows: Allow WFH, Allow Regularization, Allow On Duty. Save.",
        ],
      },
      { title: "Use it for everyone", steps: ["Click Make default on the policy: it applies to everyone without an assigned policy."] },
      { title: "Give someone their own", steps: ["Click Assign Policy to Employee: the Employee, the policy and Effective From.", "Look up an employee's Current Active policy or All History."] },
    ],
    rules: [
      "Each day uses the employee's policy assigned for that date, else the company default.",
      "With no policy at all, punches are refused.",
    ],
    related: [
      { route: "/att_shift", label: "Shift Master" },
      { route: "/att_leavePolicy", label: "Leave Policy Master" },
    ],
  },
  {
    id: "leave-policy",
    route: "/att_leavePolicy",
    module: "Attendance",
    title: "Leave Policy Master",
    summary: "Leave entitlements: which leave types, how many days a year, and carry forward. Assigning a policy gives employees their leave balances.",
    who: ADMIN_WHO("Create, assign and change leave policies"),
    tasks: [
      {
        title: "Create a policy",
        steps: [
          "Click Create Leave Policy and choose what to Start from: Standard (casual, sick, earned), UAE labour law or Saudi labour law.",
          "Enter the Policy Code, Policy Name, Financial Year, Effective From and Effective To.",
          "Add each leave type (+ Add leave type): the Days per year, Carry forward and Max carry forward. Save.",
        ],
      },
      { title: "Give it to employees", steps: ["Click Assign Policy to Employees, Select Employees and assign: they get its leave balances."] },
    ],
    rules: [
      "With a UAE or Saudi template, payroll pays sick leave in the law's tiers and unused annual leave at the exit.",
      "Policy codes are unique within your company.",
    ],
    related: [
      { route: "/att_leaveRequest", label: "Leave Requests" },
      { route: "/att_leaveManagerDashboard", label: "Manager Leave Dashboard", why: "Adjust a balance" },
    ],
  },
];
