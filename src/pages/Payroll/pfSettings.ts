// The company's provident fund rules for India payroll (see IndiaPfSettingsCard)

export const PF_SETTINGS_API = "/v1/api/payroll/pf-settings";

export interface PfSettings {
  employerPfInCtc: boolean;
  pfWageCapped: boolean;
  pfWageLimit: number;
}

export const DEFAULT_PF_SETTINGS: PfSettings = { employerPfInCtc: true, pfWageCapped: false, pfWageLimit: 15000 };

export const toPfSettings = (data: { employerPfInCtc?: unknown; pfWageCapped?: unknown; pfWageLimit?: unknown } | null | undefined): PfSettings => ({
  employerPfInCtc: data?.employerPfInCtc !== false,
  pfWageCapped: !!data?.pfWageCapped,
  pfWageLimit: Number(data?.pfWageLimit) > 0 ? Number(data?.pfWageLimit) : 15000,
});

/** Yearly employer PF on a yearly basic: 12% of the monthly basic (at most the wage limit when capped), × 12. */
export const yearlyEmployerPf = (yearlyBasic: number, settings: PfSettings) => {
  const monthlyBasic = yearlyBasic / 12;
  const wage = settings.pfWageCapped ? Math.min(monthlyBasic, settings.pfWageLimit) : monthlyBasic;
  return Math.round(wage * 0.12) * 12;
};
