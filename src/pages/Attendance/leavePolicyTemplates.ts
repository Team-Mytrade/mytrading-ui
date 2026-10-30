// Leave policies to start from: the statutory leave of the UAE (Federal Decree-Law 33 of 2021) and Saudi Arabia
// (Labour Law, as amended in 2025), with the leave types the system has. Sick leave pay tiers and unused-leave pay
// at the exit are applied by payroll.
import type { LeavePolicyModel, PolicyDetailItem } from "./LeavePolicyPage";

export type LeavePolicyTemplate = "STANDARD" | "UAE" | "SA";

const detail = (leaveType: string, allocatedLeaves: number, extra: Partial<PolicyDetailItem> = {}): PolicyDetailItem => ({
  leaveType,
  allocatedLeaves,
  carryForwardAllowed: false,
  maxCarryForward: 0,
  allowNegativeBalance: false,
  encashmentAllowed: false,
  documentRequired: false,
  ...extra,
});

export const LEAVE_POLICY_TEMPLATES: { value: LeavePolicyTemplate; label: string }[] = [
  { value: "STANDARD", label: "Standard (casual, sick, earned)" },
  { value: "UAE", label: "UAE labour law" },
  { value: "SA", label: "Saudi labour law" },
];

/** The form for a new policy from a template, for the calendar year (Gulf) or the April financial year (standard). */
export const policyFromTemplate = (template: LeavePolicyTemplate, year = new Date().getFullYear()): LeavePolicyModel => {
  if (template === "UAE") {
    return {
      policyCode: `UAE_LABOUR_${year}`,
      policyName: `UAE labour law leave ${year}`,
      financialYear: year,
      effectiveFrom: `${year}-01-01`,
      effectiveTo: `${year}-12-31`,
      description: "UAE Decree-Law 33/2021: 30 days' annual leave (2 a month between 6 and 12 months of service), "
        + "unused leave paid at the exit on basic pay; 90 days' sick leave a year after probation (15 full pay, 30 half, 45 unpaid); "
        + "60 days' maternity (45 full, 15 half); 5 working days' parental; 5 days' bereavement (spouse; 3 for close family). "
        + "Study leave (10 days) can be added as compensatory off.",
      active: true,
      policyDetails: [
        detail("EARNED", 30, { carryForwardAllowed: true, maxCarryForward: 30, encashmentAllowed: true, minimumServiceMonths: 6 }),
        detail("SICK", 90, { documentRequired: true, minimumServiceMonths: 3 }),
        detail("MATERNITY", 60, { documentRequired: true }),
        detail("PATERNITY", 5),
        detail("BEREAVEMENT", 5),
      ],
    };
  }
  if (template === "SA") {
    return {
      policyCode: `KSA_LABOUR_${year}`,
      policyName: `Saudi labour law leave ${year}`,
      financialYear: year,
      effectiveFrom: `${year}-01-01`,
      effectiveTo: `${year}-12-31`,
      description: "Saudi Labour Law: 21 days' annual leave (30 after five years of service: raise it for those employees), "
        + "unused leave paid at the exit on the actual wage; 120 days' sick leave a year (30 full pay, 60 at three quarters, 30 unpaid); "
        + "12 weeks' maternity on full pay; 3 days' paternity; 5 days' bereavement; 5 days' marriage. "
        + "Hajj leave (10 to 15 days, once) can be added as compensatory off.",
      active: true,
      policyDetails: [
        detail("EARNED", 21, { carryForwardAllowed: true, maxCarryForward: 21, encashmentAllowed: true }),
        detail("SICK", 120, { documentRequired: true }),
        detail("MATERNITY", 84, { documentRequired: true }),
        detail("PATERNITY", 3),
        detail("BEREAVEMENT", 5),
        detail("MARRIAGE", 5),
      ],
    };
  }
  return {
    policyCode: `FY${year}_STD`,
    policyName: `FY ${year} Standard Policy`,
    financialYear: year,
    effectiveFrom: `${year}-04-01`,
    effectiveTo: `${year + 1}-03-31`,
    description: "Standard leave policy for all employees",
    active: true,
    policyDetails: [
      detail("CASUAL", 12),
      detail("SICK", 12),
      detail("EARNED", 18, { carryForwardAllowed: true, maxCarryForward: 30 }),
    ],
  };
};
