import { createContext, useContext } from "react";
import { usePayrollRegion } from "../company/payrollRegion";
import type { HelpRegion } from "./types";

export { HELP_REGIONS, REGION_NAME, regionalFlow, regionalTopic, topicForRegion, topicVaries } from "./regionText";

// Which region's help to show: the company's, from its country in Company Settings (the same rule the menu and the
// payroll pages follow), unless the Help Center reader picked the other one (HelpRegionContext).

/** Set by the Help Center when the reader picks a region's help; null follows the company. */
export const HelpRegionContext = createContext<HelpRegion | null>(null);

/** The region the help is shown for: the Help Center's choice, else the company's. */
export const useHelpRegion = (): HelpRegion => {
  const chosen = useContext(HelpRegionContext);
  const company = usePayrollRegion();
  return chosen ?? company;
};
