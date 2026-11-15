// The company's provident fund rules for India payroll (see IndiaPfSettingsCard)

export const PF_SETTINGS_API = "/v1/api/payroll/pf-settings";

export interface PfSettings {
  employerPfInCtc: boolean;
  pfWageCapped: boolean;
  pfWageLimit: number;
  // The employer's charges to EPFO, as percentages (0.5 = 0.5%), and the admin charges' monthly minimum
  adminChargePercent: number;
  adminChargeMinimum: number;
  edliPercent: number;
}

export const DEFAULT_PF_SETTINGS: PfSettings = { employerPfInCtc: true, pfWageCapped: false, pfWageLimit: 15000, adminChargePercent: 0.5, adminChargeMinimum: 500, edliPercent: 0.5 };

const num = (v: unknown, fallback: number) => (v == null || v === "" || Number.isNaN(Number(v)) ? fallback : Number(v));

export const toPfSettings = (data: { employerPfInCtc?: unknown; pfWageCapped?: unknown; pfWageLimit?: unknown; adminChargePercent?: unknown;
  adminChargeMinimum?: unknown; edliPercent?: unknown } | null | undefined): PfSettings => ({
  employerPfInCtc: data?.employerPfInCtc !== false,
  pfWageCapped: !!data?.pfWageCapped,
  pfWageLimit: Number(data?.pfWageLimit) > 0 ? Number(data?.pfWageLimit) : 15000,
  adminChargePercent: num(data?.adminChargePercent, 0.5),
  adminChargeMinimum: num(data?.adminChargeMinimum, 500),
  edliPercent: num(data?.edliPercent, 0.5),
});

/** Yearly employer PF on a yearly basic: 12% of the monthly basic (at most the wage limit when capped), × 12. */
export const yearlyEmployerPf = (yearlyBasic: number, settings: PfSettings) => {
  const monthlyBasic = yearlyBasic / 12;
  const wage = settings.pfWageCapped ? Math.min(monthlyBasic, settings.pfWageLimit) : monthlyBasic;
  return Math.round(wage * 0.12) * 12;
};
