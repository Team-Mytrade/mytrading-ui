import type { HelpExample } from "../types";

// Examples for Attendance (topics/attendance.ts). Sample data: Gulf Electronics Trading LLC (tools/demo-data).
// Main case: Joseph D'Souza (Warehouse, General shift 09:00–18:00, weekly off Sat + Sun).
export const ATTENDANCE_EXAMPLES: Record<string, HelpExample> = {
  "my-attendance": {
    story: "Joseph starts and ends his working day from My Attendance.",
    data: [
      { label: "Date", value: "Thu 13 Nov 2026" },
      { label: "Check in", value: "08:56 · Jebel Ali" },
      { label: "Check out", value: "18:07" },
      { label: "Worked", value: "9 h 11 m · Present" },
    ],
    result: "The day counts as present; payroll reads it at month close.",
  },
  "attendance-punch": {
    story: "Joseph steps out for a delivery check and punches out and back in.",
    data: [
      { label: "Punches", value: "08:56 in · 13:02 out · 13:48 in · 18:07 out" },
      { label: "Worked", value: "8 h 25 m" },
    ],
    result: "All four punches are kept; the time away is not counted as work.",
  },
  "leave-requests": {
    story: "Joseph asks for annual leave for a family trip.",
    data: [
      { label: "Leave type", value: "Annual leave" },
      { label: "From – to", value: "21 Dec – 25 Dec 2026" },
      { label: "Working days", value: "5" },
      { label: "Balance after", value: "17 days" },
    ],
    result: "His manager gets the request; once approved, the days show as leave.",
  },
  "attendance-regularization": {
    story: "Joseph forgot to check out on Tuesday.",
    data: [
      { label: "Date", value: "11 Nov 2026" },
      { label: "Recorded", value: "In 08:58 · no check-out" },
      { label: "Correct to", value: "Out 18:05" },
      { label: "Reason", value: "Phone battery died" },
    ],
    result: "Once approved, Tuesday becomes a full present day.",
  },
  "on-duty-requests": {
    story: "Joseph spends a day at a customer's site for a stock count.",
    data: [
      { label: "Date", value: "17 Nov 2026" },
      { label: "Where", value: "Smart Office Solutions warehouse, Al Quoz" },
      { label: "Purpose", value: "Consignment stock count" },
    ],
    result: "Once approved, the day counts as present though he never checked in at the office.",
  },
  "holiday-calendar": {
    story: "HR sets the public holidays for 2026.",
    data: [
      { label: "UAE National Day", value: "02 – 03 Dec 2026" },
      { label: "New Year", value: "01 Jan 2027" },
      { label: "Applies to", value: "All employees" },
    ],
    result: "Nobody is marked absent on these days and leave across them doesn't use balance.",
  },
  "manager-leave-dashboard": {
    story: "Ahmed checks who in his team is away in December.",
    data: [
      { label: "Waiting for you", value: "2 leave, 1 regularization" },
      { label: "Away this week", value: "Rahul Menon (sick leave, 2 days)" },
      { label: "December", value: "Omar Haddad 21–25 Dec" },
    ],
    result: "He approves the requests from the queue without opening each page.",
  },
  "leave-approvals": {
    story: "Joseph's manager decides his leave request.",
    data: [
      { label: "Employee", value: "Joseph D'Souza" },
      { label: "Leave", value: "Annual · 21–25 Dec 2026 · 5 days" },
      { label: "Balance", value: "22 days" },
      { label: "Decision", value: "Approved" },
    ],
    result: "Joseph is told by email; the days are taken from his balance.",
  },
  "regularization-approvals": {
    story: "The manager reviews Joseph's missed check-out.",
    data: [
      { label: "Day", value: "11 Nov 2026" },
      { label: "Asked", value: "Check-out 18:05" },
      { label: "Decision", value: "Approved" },
    ],
    result: "The day is corrected in attendance.",
  },
  "on-duty-approvals": {
    story: "The manager approves Joseph's day at the customer site.",
    data: [
      { label: "Day", value: "17 Nov 2026" },
      { label: "Where", value: "Smart Office Solutions, Al Quoz" },
      { label: "Decision", value: "Approved" },
    ],
    result: "17 November counts as an on-duty present day.",
  },
  "attendance-tracking": {
    story: "HR reviews the Warehouse team for November.",
    data: [
      { label: "Present", value: "112 days" },
      { label: "Leave", value: "6 days" },
      { label: "Absent", value: "2 days (Joseph, 1 unpaid)" },
      { label: "Late arrivals", value: "4" },
    ],
    result: "HR exports the month to share with the warehouse manager.",
  },
  "shift-roster": {
    story: "The warehouse needs one person on an early shift next week.",
    data: [
      { label: "Employee", value: "Joseph D'Souza" },
      { label: "Week", value: "17 – 21 Nov 2026" },
      { label: "Shift", value: "Early 07:00 – 16:00" },
    ],
    result: "That week, Joseph's attendance is checked against the early shift.",
  },
  "attendance-reports": {
    story: "HR pulls the late-coming report for November.",
    data: [
      { label: "Report", value: "Late arrivals" },
      { label: "Month", value: "November 2026" },
      { label: "Result", value: "9 late arrivals across 5 people" },
    ],
    result: "Exported to Excel for the managers' meeting.",
  },
  "shift-master": {
    story: "HR defines the normal office shift.",
    data: [
      { label: "Shift", value: "General" },
      { label: "Hours", value: "09:00 – 18:00, 1 h break" },
      { label: "Grace", value: "15 minutes" },
      { label: "Weekly off", value: "Saturday, Sunday" },
    ],
    result: "Arriving at 09:16 counts as late; Saturdays and Sundays are off.",
  },
  "attendance-policy": {
    story: "HR sets the company's attendance rules.",
    data: [
      { label: "Policy", value: "Standard UAE office" },
      { label: "Half day under", value: "4 hours" },
      { label: "Late marks for a half day", value: "3" },
      { label: "Applies to", value: "Everyone" },
    ],
    result: "Three late arrivals in a month cost half a day.",
  },
  "leave-policy": {
    story: "HR sets the leave everyone gets each year.",
    data: [
      { label: "Policy", value: "UAE staff 2026" },
      { label: "Annual leave", value: "30 days" },
      { label: "Sick leave", value: "15 days full pay" },
      { label: "Carry forward", value: "Up to 10 days" },
    ],
    result: "New employees get this policy from their joining date.",
  },
  "leave-types": {
    story: "HR adds a leave type for the Hajj pilgrimage.",
    data: [
      { label: "Leave type", value: "Hajj leave" },
      { label: "Days", value: "30, once in service" },
      { label: "Paid", value: "No" },
    ],
    result: "Employees can now ask for Hajj leave.",
  },
  "leave-year": {
    story: "Joseph worked on a Saturday stock count and gets a day back.",
    data: [
      { label: "Employee", value: "Joseph D'Souza" },
      { label: "Worked on", value: "Sat 08 Nov 2026" },
      { label: "Comp off granted", value: "1 day · use by 08 Feb 2027" },
    ],
    result: "Joseph can apply for 1 day of comp off.",
  },
  "month-close": {
    story: "HR locks October before running payroll.",
    data: [
      { label: "Month", value: "October 2026" },
      { label: "Open requests", value: "0" },
      { label: "Status", value: "Locked" },
    ],
    result: "October attendance can't change anymore and payroll reads it as final.",
  },
};
