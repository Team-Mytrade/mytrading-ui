import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Globe2, Image, ImageUp, MapPin, Phone, Save, Trash2 } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { CompanyProfile, companyApi, useCompany } from "../../company/companyApi";
import {
  INDIAN_STATES, findIndianState, validateEmail, validateGstin, validatePan, validatePhone, validatePinCode,
  validatePinState, validateWebsite,
} from "../../utils/indiaValidators";
import {
  DATE_FORMATS, DEFAULT_REGIONAL, LANGUAGES, NUMBER_LOCALES, WEEK_DAYS, WEEK_STARTS, countries, currencies, currencyDigits,
  dayLabel, findCountry, formatDateIn, formatMoneyIn, formatTimeIn, presetForCountry, taxRegimeForCountry, timeZones, vatNumberError, countryLabel } from "../../company/regional";
import { ADD_BUTTON_COLORS } from "../../components/common/AddButton";
import { CARD, CARD_TITLE, PAGE_BODY, SECONDARY_BUTTON, TOOL_BUTTON } from "../Payroll/hrmsUi";
import { formatDateTime, liveMonthNames } from "../../company/format";

import { t } from "../../i18n/i18n";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50 disabled:text-slate-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const ERROR = "mt-1 text-[11px] text-red-600";
const MONTHS = liveMonthNames("long");
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Section heading with the cyan icon chip used on the profile page. */
const sectionTitle = (Icon: React.ComponentType<{ className?: string }>, text: string) => (
  <h3 className={`${CARD_TITLE} mb-3 flex items-center gap-2`}>
    <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e0f7fa] text-[#0097a7] dark:bg-cyan-950/40 dark:text-cyan-300">
      <Icon className="h-4 w-4" />
    </span>
    {t(text)}
  </h3>
);

type Form = Omit<CompanyProfile, "tenantId" | "hasLogo" | "updatedDate" | "editable">;

const toForm = (p: CompanyProfile): Form => ({
  companyName: p.companyName ?? "", legalName: p.legalName ?? "", gstin: p.gstin ?? "", pan: p.pan ?? "",
  addressLine1: p.addressLine1 ?? "", addressLine2: p.addressLine2 ?? "", city: p.city ?? "", state: p.state ?? "",
  postalCode: p.postalCode ?? "", country: p.country || "India", phone: p.phone ?? "", email: p.email ?? "",
  website: p.website ?? "", financialYearStartMonth: p.financialYearStartMonth || 4, currency: p.currency || "INR",
  currencyDecimals: p.currencyDecimals ?? currencyDigits(p.currency || "INR"),
  language: p.language || DEFAULT_REGIONAL.language,
  timeZone: p.timeZone || DEFAULT_REGIONAL.timeZone,
  dateFormat: p.dateFormat || DEFAULT_REGIONAL.dateFormat,
  timeFormat: p.timeFormat || DEFAULT_REGIONAL.timeFormat,
  numberLocale: p.numberLocale || DEFAULT_REGIONAL.numberLocale,
  weekStart: p.weekStart || DEFAULT_REGIONAL.weekStart,
  weekendDays: p.weekendDays ?? DEFAULT_REGIONAL.weekendDays,
  taxRegime: p.taxRegime || ((p.country || "India").toLowerCase() === "india" ? "GST" : "NONE"),
  taxNumber: p.taxNumber ?? "",
  tradeLicenseNumber: p.tradeLicenseNumber ?? "",
  licenseAuthority: p.licenseAuthority ?? "",
});

const validate = (f: Form): Record<string, string> => {
  const errors: Record<string, string | null> = {};
  const india = (f.country || "India").toLowerCase() === "india";
  if (!f.companyName.trim()) errors.companyName = "Enter the company name";
  if (f.taxRegime === "GST") {
    errors.gstin = validateGstin(f.gstin, f.pan);
    errors.pan = validatePan(f.pan);
  }
  // Tax invoices of a VAT-registered company must show its TRN
  if (f.taxRegime === "VAT") errors.taxNumber = vatNumberError(f.taxNumber, f.country);
  if (f.tradeLicenseNumber?.trim() && !f.licenseAuthority?.trim()) errors.licenseAuthority = "Enter the authority that issued the trade licence";
  errors.email = validateEmail(f.email);
  errors.website = validateWebsite(f.website);
  if (india) {
    errors.phone = validatePhone(f.phone);
    errors.postalCode = validatePinCode(f.postalCode) ?? validatePinState(f.postalCode, f.state);
    const state = findIndianState(f.state);
    const gstin = (f.gstin ?? "").trim().toUpperCase();
    if (!errors.gstin && gstin && state && !state.gstCodes.includes(gstin.slice(0, 2))) {
      errors.gstin = `This GSTIN is registered in another state (code ${gstin.slice(0, 2)}); ${state.name} is ${state.gstCodes[0]}`;
    }
  }
  if (!/^[A-Za-z]{3}$/.test(f.currency.trim())) errors.currency = "Use a 3-letter code such as INR";
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v)) as Record<string, string>;
};

/**
 * The company's details, printed on quotations, payslips and report headers. Tenant Administrators
 * (USERS:ADMIN) can change them; everyone else sees them read-only.
 */
export default function CompanySettingsPage() {
  const { company, logo, loading } = useCompany();
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (company) setForm(toForm(company));
  }, [company]);

  const editable = !!company?.editable;
  const dirty = !!company && !!form && JSON.stringify(toForm(company)) !== JSON.stringify(form);
  const india = (form?.country || "India").toLowerCase() === "india";
  const countryList = useMemo(() => countries(), []);
  const zoneList = useMemo(() => timeZones(), []);
  const currencyList = useMemo(() => currencies(), []);

  const set = (key: keyof Form, value: string | number | string[]) => {
    if (!form) return;
    setForm({ ...form, [key]: value });
    if (errors[key]) setErrors({ ...errors, [key]: "" });
  };

  // A new country brings its usual currency, time zone, weekend and number style (all can still be changed)
  const changeCountry = (name: string) => {
    if (!form) return;
    const country = findCountry(name);
    if (!country || name === form.country) {
      set("country", name);
      return;
    }
    setForm({ ...form, country: name, ...presetForCountry(country), taxRegime: taxRegimeForCountry(country) ?? form.taxRegime });
    ToasterService.info(`Currency, time zone, weekend, number format and tax registration set for ${country.name}. Change them below if needed.`);
  };

  const changeCurrency = (code: string) => form && setForm({ ...form, currency: code, currencyDecimals: currencyDigits(code) });

  const toggleWeekend = (day: string) => {
    if (!form) return;
    const days = form.weekendDays.includes(day) ? form.weekendDays.filter((d) => d !== day) : [...form.weekendDays, day];
    if (days.length > 3) {
      ToasterService.error("Choose at most 3 weekend days.");
      return;
    }
    set("weekendDays", WEEK_DAYS.filter((d) => days.includes(d)));
  };

  // How dates, times and amounts will look with the chosen settings
  const preview = useMemo(() => {
    if (!form) return "";
    try {
      const now = new Date();
      return `${formatDateIn(now, form.dateFormat, form.timeZone)} · ${formatTimeIn(now, form.timeFormat, form.timeZone)} · ${formatMoneyIn(1234567.891, form.currency, form.currencyDecimals, form.numberLocale)}`;
    } catch {
      return "";
    }
  }, [form]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      ToasterService.error("Please correct the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      await companyApi.update({ ...form, gstin: form.gstin?.toUpperCase(), pan: form.pan?.toUpperCase(), currency: form.currency.toUpperCase(),
        taxNumber: form.taxRegime === "VAT" ? form.taxNumber?.replace(/\s+/g, "").toUpperCase() : null });
      ToasterService.success("Company details saved.");
    } catch (err) {
      ToasterService.error(errorText(err, "Could not save the company details."));
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file?: File) => {
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      ToasterService.error("Choose a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > 512 * 1024) {
      ToasterService.error("The logo must be 512 KB or smaller.");
      return;
    }
    setUploading(true);
    try {
      await companyApi.uploadLogo(file);
      ToasterService.success("Logo updated.");
    } catch (err) {
      ToasterService.error(errorText(err, "Could not upload the logo."));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removeLogo = async () => {
    if (!window.confirm("Remove the company logo?")) return;
    try {
      await companyApi.removeLogo();
      ToasterService.success("Logo removed.");
    } catch (err) {
      ToasterService.error(errorText(err, "Could not remove the logo."));
    }
  };

  const field = (key: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className={LABEL} htmlFor={`company-${key}`}>{t(label)}</label>
      <input id={`company-${key}`} className={INPUT} disabled={!editable} value={String(form?.[key] ?? "")}
        onChange={(e) => set(key, e.target.value)} {...props} placeholder={props.placeholder ? t(String(props.placeholder)) : undefined} />
      {errors[key] && <p className={ERROR}>{t(String(errors[key]))}</p>}
    </div>
  );

  return (
    <>
      <PageMeta title={t("Company Settings")} description="Company details used on documents" />
      <PageBreadcrumb
        pageTitle="Company Settings"
        actions={editable && form ? (
          <div className="flex items-center gap-2">
            <button type="button" className={TOOL_BUTTON} disabled={!dirty} onClick={() => { setForm(toForm(company!)); setErrors({}); }}>
              {t("Discard changes")}
            </button>
            <button type="submit" form="company-settings-form" className={`${TOOL_BUTTON} ${ADD_BUTTON_COLORS}`} disabled={saving || !dirty}>
              <Save className="h-3.5 w-3.5" />
              {t(saving ? "Saving..." : "Save")}
            </button>
          </div>
        ) : undefined}
      />

      <div className={PAGE_BODY}>
        {loading || !form ? (
          <div className={`${CARD} p-6 text-sm text-slate-400`}>{t(loading ? "Loading..." : "The company details could not be loaded.")}</div>
        ) : (
          <form id="company-settings-form" onSubmit={save} className="space-y-4">
            {!editable && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {t("Only a Tenant Administrator can change these details.")}
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <section className={`${CARD} p-4`}>
                  {sectionTitle(Building2, "Company")}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {field("companyName", "Company name *", { maxLength: 255 })}
                    {field("legalName", "Registered (legal) name", { maxLength: 200, placeholder: india ? "As on the GST certificate" : "As on the trade licence" })}
                    {/* VAT companies print their TRN on tax invoices and file VAT returns; GST companies use the GSTIN */}
                    <div>
                      <label className={LABEL} htmlFor="company-taxRegime">{t("Tax registration")}</label>
                      <select id="company-taxRegime" className={INPUT} disabled={!editable} value={form.taxRegime ?? "NONE"}
                        onChange={(e) => set("taxRegime", e.target.value)}>
                        <option value="VAT">{t("VAT registered")}</option>
                        <option value="GST">{t("GST registered (India)")}</option>
                        <option value="NONE">{t("Not registered for tax")}</option>
                      </select>
                    </div>
                    {form.taxRegime === "VAT" && field("taxNumber", "VAT registration number (TRN) *", {
                      maxLength: 20, style: { textTransform: "uppercase" },
                      placeholder: findCountry(form.country)?.isoCode === "AE" ? "15 digits, e.g. 100123456700003"
                        : findCountry(form.country)?.isoCode === "SA" ? "15 digits starting and ending with 3" : "As on the VAT certificate",
                    })}
                    {form.taxRegime === "GST" && field("gstin", "GSTIN", { maxLength: 15, placeholder: "e.g. 29ABCDE1234F1ZW", style: { textTransform: "uppercase" } })}
                    {form.taxRegime === "GST" && field("pan", "PAN", { maxLength: 10, placeholder: "Filled from the GSTIN if left empty", style: { textTransform: "uppercase" } })}
                    {/* UAE e-invoices identify the seller by its trade licence and the authority that issued it */}
                    {!india && field("tradeLicenseNumber", "Trade licence number", { maxLength: 50 })}
                    {!india && field("licenseAuthority", "Issued by", {
                      maxLength: 150,
                      placeholder: findCountry(form.country)?.isoCode === "AE" ? "e.g. Dubai Department of Economy and Tourism" : "Licensing authority",
                    })}
                  </div>
                </section>

                <section className={`${CARD} p-4`}>
                  {sectionTitle(MapPin, "Registered address")}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {field("addressLine1", "Address line 1", { maxLength: 200 })}
                    {field("addressLine2", "Address line 2", { maxLength: 200 })}
                    {field("city", "City", { maxLength: 100 })}
                    <div>
                      <label className={LABEL} htmlFor="company-state">{t("State")}</label>
                      {india ? (
                        <select id="company-state" className={INPUT} disabled={!editable} value={form.state ?? ""}
                          onChange={(e) => set("state", e.target.value)}>
                          <option value="">{t("Select state")}</option>
                          {form.state && !findIndianState(form.state) && <option value={form.state}>{form.state}</option>}
                          {INDIAN_STATES.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                        </select>
                      ) : (
                        <input id="company-state" className={INPUT} disabled={!editable} value={form.state ?? ""} maxLength={100}
                          onChange={(e) => set("state", e.target.value)} />
                      )}
                    </div>
                    {field("postalCode", india ? "PIN code" : "Postal code / PO Box", { maxLength: 20 })}
                    <div>
                      <label className={LABEL} htmlFor="company-country">{t("Country")}</label>
                      <select id="company-country" className={INPUT} disabled={!editable} value={form.country ?? ""}
                        onChange={(e) => changeCountry(e.target.value)}>
                        {form.country && !findCountry(form.country) && <option value={form.country}>{form.country}</option>}
                        {countryList.map((c) => <option key={c.isoCode} value={c.name}>{countryLabel(c.isoCode, c.name)}</option>)}
                      </select>
                    </div>
                  </div>
                </section>

                <section className={`${CARD} p-4`}>
                  {sectionTitle(Phone, "Contact")}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {field("phone", "Phone", { maxLength: 30 })}
                    {field("email", "Email", { maxLength: 150, type: "email" })}
                    {field("website", "Website", { maxLength: 200, placeholder: "www.example.com" })}
                  </div>
                </section>

                <section className={`${CARD} p-4`}>
                  {sectionTitle(Globe2, "Regional settings")}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <label className={LABEL} htmlFor="company-currency">{t("Currency")}</label>
                      <select id="company-currency" className={INPUT} disabled={!editable} value={form.currency}
                        onChange={(e) => changeCurrency(e.target.value)}>
                        {!currencyList.some((c) => c.code === form.currency) && <option value={form.currency}>{form.currency}</option>}
                        {currencyList.map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="company-decimals">{t("Decimal places for amounts")}</label>
                      <select id="company-decimals" className={INPUT} disabled={!editable} value={form.currencyDecimals}
                        onChange={(e) => set("currencyDecimals", Number(e.target.value))}>
                        {[0, 1, 2, 3].map((d) => <option key={d} value={d}>{d}{d === currencyDigits(form.currency) ? ` ${t("(usual for {currency})", { currency: form.currency })}` : ""}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="company-language">{t("Language")}</label>
                      <select id="company-language" className={INPUT} disabled={!editable} value={form.language}
                        onChange={(e) => set("language", e.target.value)}>
                        {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="company-zone">{t("Time zone")}</label>
                      <select id="company-zone" className={INPUT} disabled={!editable} value={form.timeZone}
                        onChange={(e) => set("timeZone", e.target.value)}>
                        {!zoneList.includes(form.timeZone) && <option value={form.timeZone}>{form.timeZone}</option>}
                        {zoneList.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="company-date-format">{t("Date format")}</label>
                      <select id="company-date-format" className={INPUT} disabled={!editable} value={form.dateFormat}
                        onChange={(e) => set("dateFormat", e.target.value)}>
                        {DATE_FORMATS.map((f) => <option key={f} value={f}>{f.replace("yyyy", "YYYY").replace("dd", "DD")}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="company-time-format">{t("Time format")}</label>
                      <select id="company-time-format" className={INPUT} disabled={!editable} value={form.timeFormat}
                        onChange={(e) => set("timeFormat", e.target.value)}>
                        <option value="12h">12-hour (2:30 PM)</option>
                        <option value="24h">24-hour (14:30)</option>
                      </select>
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="company-number-format">{t("Number format")}</label>
                      <select id="company-number-format" className={INPUT} disabled={!editable} value={form.numberLocale}
                        onChange={(e) => set("numberLocale", e.target.value)}>
                        {NUMBER_LOCALES.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="company-week-start">{t("Week starts on")}</label>
                      <select id="company-week-start" className={INPUT} disabled={!editable} value={form.weekStart}
                        onChange={(e) => set("weekStart", e.target.value)}>
                        {WEEK_STARTS.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={LABEL} htmlFor="company-fy">{t("Financial year starts in")}</label>
                      <select id="company-fy" className={INPUT} disabled={!editable} value={form.financialYearStartMonth}
                        onChange={(e) => set("financialYearStartMonth", Number(e.target.value))}>
                        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <span className={LABEL}>{t("Weekend days")}</span>
                      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("Weekend days")}>
                        {WEEK_DAYS.map((day) => {
                          const on = form.weekendDays.includes(day);
                          return (
                            <button key={day} type="button" aria-pressed={on} disabled={!editable} onClick={() => toggleWeekend(day)}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed ${on
                                ? "border-cyan-300 bg-cyan-50 text-cyan-800 dark:border-transparent dark:bg-cyan-500/20 dark:text-cyan-300"
                                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-transparent dark:bg-[#222222] dark:text-gray-400"}`}>
                              {dayLabel(day).slice(0, 3)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {preview && (
                    <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-[#222222] dark:text-gray-300">
                      <span className="font-semibold">{t("Preview:")}</span> {preview}
                    </p>
                  )}
                </section>
              </div>

              <div className="space-y-4">
                <section className={`${CARD} p-4`}>
                  {sectionTitle(Image, "Logo")}
                  <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:border-gray-700 dark:bg-[#222222]">
                    {logo ? (
                      <img src={logo.dataUrl} alt="Company logo" className="max-h-24 max-w-[90%] object-contain" />
                    ) : (
                      <span className="text-xs text-slate-400">{t("No logo yet")}</span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-gray-400">{t("PNG, JPEG or WebP, up to 512 KB. Shown on quotations and payslips (payslips need PNG or JPEG).")}</p>
                  {editable && (
                    <div className="mt-3 flex gap-2">
                      <input ref={fileRef} type="file" accept={LOGO_TYPES.join(",")} className="hidden"
                        onChange={(e) => uploadLogo(e.target.files?.[0])} />
                      <button type="button" className={SECONDARY_BUTTON} disabled={uploading} onClick={() => fileRef.current?.click()}>
                        <ImageUp className="mr-1 inline h-4 w-4" />{uploading ? "Uploading..." : company?.hasLogo ? "Replace" : "Upload"}
                      </button>
                      {company?.hasLogo && (
                        <button type="button" className={SECONDARY_BUTTON} onClick={removeLogo}>
                          <Trash2 className="mr-1 inline h-4 w-4" />{t("Remove")}
                        </button>
                      )}
                    </div>
                  )}
                </section>
              </div>
            </div>

            {company?.updatedDate && (
              <p className="text-right text-[11px] text-slate-400">{t("Last changed")} {formatDateTime(company.updatedDate)}</p>
            )}
          </form>
        )}
      </div>
    </>
  );
}
