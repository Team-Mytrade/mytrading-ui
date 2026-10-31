import { useEffect, useMemo, useRef, useState } from "react";
import { CompanyPlan, STORAGE_SOURCES, SUBSCRIPTION_TONE, Usage, bytesText, limitText, planPrice, plansApi, storageText, subscriptionText } from "../../platform/plansApi";
import { Building2, CreditCard, Download, Globe2, History, Image, ImageUp, KeyRound, MapPin, Palette, Phone, Save, ShieldCheck, Trash2 } from "lucide-react";
import axios from "axios";
import { brandPalette } from "../../company/brand";
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
import { formatDate, formatDateTime, formatHijri, liveMonthNames } from "../../company/format";
import { addressStyle, regionalAddressErrors } from "../../company/regionalAddress";
import RegionalAddressFields from "../../components/common/RegionalAddressFields";

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
    <span className="grid h-7 w-7 place-items-center rounded-lg bg-[rgb(var(--brand-50,224_247_250))] text-[rgb(var(--brand-600,0_151_167))] dark:bg-cyan-950/40 dark:text-cyan-300">
      <Icon className="h-4 w-4" />
    </span>
    {t(text)}
  </h3>
);

type Form = Omit<CompanyProfile, "tenantId" | "hasLogo" | "hasFavicon" | "updatedDate" | "editable">;

// Colours offered next to the picker; the first is the standard one
const BRAND_PRESETS = ["#0891B2", "#2563EB", "#4F46E5", "#7C3AED", "#DB2777", "#DC2626", "#EA580C", "#059669", "#334155"];
const FAVICON_TYPES = ["image/png", "image/x-icon", "image/vnd.microsoft.icon"];

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
  hijriDates: p.hijriDates ?? DEFAULT_REGIONAL.hijriDates,
  taxRegime: p.taxRegime || ((p.country || "India").toLowerCase() === "india" ? "GST" : "NONE"),
  taxNumber: p.taxNumber ?? "",
  tradeLicenseNumber: p.tradeLicenseNumber ?? "",
  licenseAuthority: p.licenseAuthority ?? "",
  brandColor: p.brandColor ?? "",
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
  // UAE: emirate and P.O. Box; Saudi Arabia: the national address (its parts go on ZATCA e-invoices)
  Object.assign(errors, regionalAddressErrors(addressStyle(f.country), {
    addressLine1: f.addressLine1 ?? "", addressLine2: f.addressLine2, city: f.city ?? "", state: f.state ?? "", postalCode: f.postalCode ?? "",
  }));
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

  const set = (key: keyof Form, value: string | number | boolean | string[]) => {
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
      const hijri = form.hijriDates ? ` (${formatHijri(now)})` : "";
      return `${formatDateIn(now, form.dateFormat, form.timeZone)}${hijri} · ${formatTimeIn(now, form.timeFormat, form.timeZone)} · ${formatMoneyIn(1234567.891, form.currency, form.currencyDecimals, form.numberLocale)}`;
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
                  {addressStyle(form.country) !== "OTHER" ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <RegionalAddressFields style={addressStyle(form.country) as "AE" | "SA"} idPrefix="company" disabled={!editable}
                        inputClass={INPUT} labelClass={LABEL} errorClass={ERROR} errors={errors}
                        value={{ addressLine1: form.addressLine1 ?? "", addressLine2: form.addressLine2 ?? "", city: form.city ?? "",
                          state: form.state ?? "", postalCode: form.postalCode ?? "" }}
                        onChange={(patch) => {
                          setForm({ ...form, ...patch });
                          setErrors({});
                        }} />
                      <div>
                        <label className={LABEL} htmlFor="company-country">{t("Country")}</label>
                        <select id="company-country" className={INPUT} disabled={!editable} value={form.country ?? ""}
                          onChange={(e) => changeCountry(e.target.value)}>
                          {form.country && !findCountry(form.country) && <option value={form.country}>{form.country}</option>}
                          {countryList.map((c) => <option key={c.isoCode} value={c.name}>{countryLabel(c.isoCode, c.name)}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : (
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
                  )}
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
                    <label className="flex cursor-pointer items-start gap-2 md:col-span-3">
                      <input type="checkbox" className="mt-0.5 h-4 w-4 accent-cyan-600" disabled={!editable}
                        checked={form.hijriDates} onChange={(e) => set("hijriDates", e.target.checked)} />
                      <span>
                        <span className="block text-xs font-semibold text-slate-700 dark:text-gray-200">{t("Show Hijri dates")}</span>
                        <span className="block text-[11px] text-slate-500 dark:text-gray-400">
                          {t("The Umm al-Qura date beside the Gregorian one on documents and calendars (usual in Saudi Arabia).")}
                        </span>
                      </span>
                    </label>
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
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-gray-400">{t("PNG, JPEG or WebP, up to 512 KB. Printed on invoices, credit notes, quotations, purchase orders, delivery notes, payslips and PDF exports (payslips need PNG or JPEG).")}</p>
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

                <BrandingSection
                  editable={editable}
                  colour={form.brandColor ?? ""}
                  onColour={(value) => set("brandColor", value)}
                  hasFavicon={Boolean(company?.hasFavicon)}
                />

                <SecuritySection editable={editable} />

                <SingleSignOnSection editable={editable} />

                <PlanSection />

                {editable && <DataExportSection />}

                {editable && <RetentionSection />}
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

/**
 * The company's colour (applied to the whole app and printed documents once saved) and its browser-tab icon
 * (uploaded straight away, like the logo).
 */
function BrandingSection({ editable, colour, onColour, hasFavicon }: {
  editable: boolean;
  colour: string;
  onColour: (value: string) => void;
  hasFavicon: boolean;
}) {
  const iconRef = useRef<HTMLInputElement>(null);
  const [icon, setIcon] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const shown = /^#[0-9a-f]{6}$/i.test(colour) ? colour.toUpperCase() : BRAND_PRESETS[0];
  const palette = brandPalette(shown);
  const rgb = (step: number) => (palette ? `rgb(${palette[step]})` : undefined);

  useEffect(() => {
    let url: string | null = null;
    if (!hasFavicon) {
      setIcon(null);
      return;
    }
    axios.get<Blob>("/v1/api/user/company/favicon", { responseType: "blob" })
      .then((res) => setIcon((url = URL.createObjectURL(res.data))))
      .catch(() => setIcon(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [hasFavicon]);

  const upload = async (file?: File) => {
    if (!file) return;
    if (!FAVICON_TYPES.includes(file.type)) {
      ToasterService.error(t("Choose a PNG or ICO image."));
      return;
    }
    if (file.size > 64 * 1024) {
      ToasterService.error(t("The tab icon must be 64 KB or smaller."));
      return;
    }
    setUploading(true);
    try {
      await companyApi.uploadFavicon(file);
      ToasterService.success(t("Tab icon updated."));
    } catch (err) {
      ToasterService.error(errorText(err, t("Could not upload the tab icon.")));
    } finally {
      setUploading(false);
      if (iconRef.current) iconRef.current.value = "";
    }
  };

  const remove = async () => {
    try {
      await companyApi.removeFavicon();
      ToasterService.success(t("Tab icon removed."));
    } catch (err) {
      ToasterService.error(errorText(err, t("Could not remove the tab icon.")));
    }
  };

  return (
    <section className={`${CARD} p-4`}>
      {sectionTitle(Palette, "Branding")}
      <label className={LABEL} htmlFor="company-brandColor">{t("Company colour")}</label>
      <div className="flex flex-wrap items-center gap-2">
        <input id="company-brandColor" type="color" disabled={!editable} value={shown}
          onChange={(e) => onColour(e.target.value.toUpperCase())}
          className="h-9 w-12 cursor-pointer rounded border border-slate-200 bg-white p-0.5 disabled:cursor-not-allowed dark:border-gray-700" />
        <input className={`${INPUT} w-28 uppercase`} disabled={!editable} value={colour} placeholder={BRAND_PRESETS[0]} maxLength={7}
          onChange={(e) => onColour(e.target.value.trim())} aria-label={t("Colour code")} />
        {editable && colour && (
          <button type="button" className="text-xs font-medium text-slate-500 hover:underline" onClick={() => onColour("")}>
            {t("Standard colour")}
          </button>
        )}
      </div>
      {editable && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {BRAND_PRESETS.map((preset) => (
            <button key={preset} type="button" title={preset} aria-label={preset} onClick={() => onColour(preset === BRAND_PRESETS[0] ? "" : preset)}
              className={`h-6 w-6 rounded-full border-2 ${shown === preset ? "border-slate-800 dark:border-white" : "border-transparent"}`}
              style={{ background: preset }} />
          ))}
        </div>
      )}
      {/* How it looks: the main button, a light highlight and a link */}
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-100 p-2 dark:border-gray-800">
        <span className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: rgb(600) }}>{t("Save")}</span>
        <span className="rounded-lg px-3 py-1.5 text-xs font-semibold" style={{ background: rgb(300), color: rgb(950) }}>{t("Add")}</span>
        <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: rgb(50), color: rgb(700) }}>{t("Active")}</span>
        <span className="text-xs font-medium underline" style={{ color: rgb(700) }}>{t("Link")}</span>
      </div>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-gray-400">
        {t("Buttons, links and highlights take this colour once saved; invoices and credit notes print the company name and title in it.")}
      </p>

      <div className="mt-4">
        <span className={LABEL}>{t("Browser tab icon")}</span>
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:border-gray-700 dark:bg-[#222222]">
            {icon ? <img src={icon} alt="" className="h-6 w-6 object-contain" /> : <Image className="h-4 w-4 text-slate-400" />}
          </div>
          {editable && (
            <>
              <input ref={iconRef} type="file" accept=".png,.ico,image/png,image/x-icon" className="hidden"
                onChange={(e) => upload(e.target.files?.[0])} />
              <button type="button" className={SECONDARY_BUTTON} disabled={uploading} onClick={() => iconRef.current?.click()}>
                <ImageUp className="mr-1 inline h-4 w-4" />{t(uploading ? "Uploading..." : hasFavicon ? "Replace" : "Upload")}
              </button>
              {hasFavicon && (
                <button type="button" className={SECONDARY_BUTTON} onClick={remove}>
                  <Trash2 className="mr-1 inline h-4 w-4" />{t("Remove")}
                </button>
              )}
            </>
          )}
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-gray-400">{t("PNG or ICO, square, up to 64 KB. Without one the logo is used.")}</p>
      </div>
    </section>
  );
}

const MFA_POLICIES = [
  { value: "OPTIONAL", label: "Optional: each person decides" },
  { value: "ADMINS", label: "Required for administrators" },
  { value: "ALL", label: "Required for everyone" },
  { value: "OFF", label: "Off: nobody is asked for a code" },
];

/** Who must use two-step sign-in (an authenticator app code after the password); saved as soon as it changes. */
function SecuritySection({ editable }: { editable: boolean }) {
  const [policy, setPolicy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get<{ mfaPolicy: string }>("/v1/api/user/company/security")
      .then((r) => setPolicy(r.data.mfaPolicy))
      .catch(() => setPolicy(null));
  }, []);

  const change = async (value: string) => {
    if ((value === "ALL" || value === "ADMINS") && !window.confirm(t("Those who must use it will set up an authenticator app at their next sign-in. Continue?"))) return;
    setSaving(true);
    try {
      const res = await axios.put<{ mfaPolicy: string }>("/v1/api/user/company/security", { mfaPolicy: value });
      setPolicy(res.data.mfaPolicy);
      ToasterService.success(t("Sign-in policy saved."));
    } catch (err) {
      ToasterService.error(errorText(err, t("Could not save the sign-in policy.")));
    } finally {
      setSaving(false);
    }
  };

  if (policy === null) return null;
  return (
    <section className={`${CARD} p-4`}>
      {sectionTitle(ShieldCheck, "Sign-in security")}
      <label className={LABEL} htmlFor="company-mfaPolicy">{t("Two-step sign-in")}</label>
      <select id="company-mfaPolicy" className={INPUT} value={policy} disabled={!editable || saving} onChange={(e) => change(e.target.value)}>
        {MFA_POLICIES.map((p) => <option key={p.value} value={p.value}>{t(p.label)}</option>)}
      </select>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-gray-400">
        {t("After the password, sign-in asks for a code from an authenticator app. Administrators are users with any Admin permission. A lost phone: reset the person's two-step sign-in on the Users page.")}
      </p>
    </section>
  );
}

/** The company's subscription plan (set by the platform): what it includes. Hidden when it has none. */
function PlanSection() {
  const [plan, setPlan] = useState<CompanyPlan | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);

  useEffect(() => {
    plansApi.mine().then(setPlan).catch(() => setPlan(null));
    plansApi.usage().then(setUsage).catch(() => setUsage(null));
  }, []);

  if (!plan) return null;
  const bar = (used: number, max: number | null, label: string, text: string) => {
    const percent = max ? Math.min(100, Math.round((used * 100) / max)) : 0;
    const tone = percent >= 100 ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-[rgb(var(--brand-500,0_188_212))]";
    return (
      <div>
        <div className="flex justify-between text-[11px] text-slate-600 dark:text-gray-300">
          <span>{t(label)}</span>
          <span>{text}{max ? ` (${percent}%)` : ""}</span>
        </div>
        {max != null && (
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800" role="progressbar" aria-valuenow={percent}
            aria-valuemin={0} aria-valuemax={100} aria-label={t(label)}>
            <div className={`h-full ${tone}`} style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
    );
  };
  return (
    <section className={`${CARD} p-4`}>
      {sectionTitle(CreditCard, "Your plan")}
      <p className="text-sm font-semibold text-slate-900 dark:text-white">{plan.planName}</p>
      {plan.subscription && (
        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${SUBSCRIPTION_TONE[plan.subscription.state]}`}>
          {t(subscriptionText(plan.subscription, (d) => formatDate(d)))}
        </span>
      )}
      <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
        <dt className="text-slate-500">{t("Users")}</dt>
        <dd className="text-slate-800 dark:text-gray-100">{t(limitText(plan.maxUsers, "users"))}</dd>
        <dt className="text-slate-500">{t("Storage")}</dt>
        <dd className="text-slate-800 dark:text-gray-100">{t(storageText(plan.maxStorageMb))}</dd>
        {plan.monthlyPrice != null && <>
          <dt className="text-slate-500">{t("Monthly price")}</dt>
          <dd className="text-slate-800 dark:text-gray-100">{planPrice(plan.monthlyPrice, plan.currency)}</dd>
        </>}
        {plan.yearlyPrice != null && <>
          <dt className="text-slate-500">{t("Yearly price")}</dt>
          <dd className="text-slate-800 dark:text-gray-100">{planPrice(plan.yearlyPrice, plan.currency)}</dd>
        </>}
      </dl>
      {usage && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 dark:border-gray-800">
          {bar(usage.users, usage.maxUsers, "Active users", usage.maxUsers ? `${usage.users} / ${usage.maxUsers}` : String(usage.users))}
          {bar(usage.storageBytes, usage.maxStorageBytes, "Storage used",
            usage.maxStorageBytes ? `${bytesText(usage.storageBytes)} / ${bytesText(usage.maxStorageBytes)}` : bytesText(usage.storageBytes))}
          <p className="text-[10px] text-slate-400">
            {usage.sources.filter((s) => s.bytes > 0).map((s) => `${t(STORAGE_SOURCES[s.source] ?? s.source)} ${bytesText(s.bytes)}`).join(" · ")}
          </p>
          {usage.warnings.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
              {t("You are close to your plan's limit. New users or files are refused once it is reached.")}
            </p>
          )}
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-500 dark:text-gray-400">{t("To change your plan, contact your provider.")}</p>
    </section>
  );
}

interface DataExport {
  id: number;
  status: "RUNNING" | "DONE" | "PARTIAL" | "FAILED";
  /** UTC, without an offset. */
  requestedAt: string;
  finishedAt: string | null;
  requestedBy: string | null;
  sizeBytes: number | null;
  services: { service: string; ok: boolean; files: number; error: string | null }[];
  error: string | null;
}

const EXPORTS = "/v1/api/user/company/exports";
const EXPORT_STATUS: Record<DataExport["status"], { label: string; tone: string }> = {
  RUNNING: { label: "Being made...", tone: "bg-amber-50 text-amber-700" },
  DONE: { label: "Ready", tone: "bg-emerald-50 text-emerald-700" },
  PARTIAL: { label: "Ready, some parts missing", tone: "bg-orange-50 text-orange-700" },
  FAILED: { label: "Failed", tone: "bg-red-50 text-red-700" },
};

const fileSize = (bytes: number | null) =>
  bytes == null ? "" : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Everything the company has in the app, as CSV files in a ZIP (a folder per module), made in the background.
 * Passwords, keys and other secrets, and pictures and files, are not included.
 */
function DataExportSection() {
  const [exports, setExports] = useState<DataExport[]>([]);
  const [busy, setBusy] = useState(false);

  const load = () => axios.get<DataExport[]>(EXPORTS).then((r) => setExports(r.data)).catch(() => undefined);

  useEffect(() => {
    load();
  }, []);

  // Checks again while one is being made
  const running = exports.some((e) => e.status === "RUNNING");
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [running]);

  const start = async () => {
    setBusy(true);
    try {
      await axios.post(EXPORTS);
      ToasterService.success(t("The export is being made; it appears below when ready."));
      await load();
    } catch (err) {
      ToasterService.error(errorText(err, t("Could not start the export.")));
    } finally {
      setBusy(false);
    }
  };

  const download = async (row: DataExport) => {
    try {
      const res = await axios.get<Blob>(`${EXPORTS}/${row.id}/file`, { responseType: "blob" });
      const name = /filename="?([^";]+)"?/.exec(String(res.headers["content-disposition"] ?? ""))?.[1] ?? `company-export-${row.id}.zip`;
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      ToasterService.error(errorText(err, t("Could not download the export.")));
    }
  };

  const remove = async (row: DataExport) => {
    if (!window.confirm(t("Delete this export file?"))) return;
    try {
      await axios.delete(`${EXPORTS}/${row.id}`);
      setExports((list) => list.filter((e) => e.id !== row.id));
    } catch (err) {
      ToasterService.error(errorText(err, t("Could not delete the export.")));
    }
  };

  return (
    <section className={`${CARD} p-4`}>
      {sectionTitle(Download, "Company data export")}
      <p className="text-[11px] text-slate-500 dark:text-gray-400">
        {t("All the company's records in every module, as CSV files in one ZIP (opens in Excel). Passwords, keys and other secrets, and pictures and attached files, are not included.")}
      </p>
      <button type="button" className={`${SECONDARY_BUTTON} mt-3`} disabled={busy || running} onClick={start}>
        <Download className="mr-1 inline h-4 w-4" />{t(running ? "Export being made..." : "Export all data")}
      </button>
      {exports.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-gray-800">
          {exports.map((row) => {
            const status = EXPORT_STATUS[row.status] ?? EXPORT_STATUS.FAILED;
            const failed = row.services.filter((s) => !s.ok).map((s) => s.service);
            return (
              <li key={row.id} className="flex flex-wrap items-center gap-2 py-2 text-xs">
                <span className="text-slate-700 dark:text-gray-200">{formatDateTime(`${row.requestedAt}Z`)}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.tone}`}>{t(status.label)}</span>
                <span className="text-slate-400">{fileSize(row.sizeBytes)}</span>
                {row.requestedBy && <span className="text-slate-400">· {row.requestedBy}</span>}
                <span className="ms-auto flex gap-1">
                  {(row.status === "DONE" || row.status === "PARTIAL") && (
                    <button type="button" className={TOOL_BUTTON} onClick={() => download(row)}>
                      <Download className="h-3.5 w-3.5" /> {t("Download")}
                    </button>
                  )}
                  {row.status !== "RUNNING" && (
                    <button type="button" className={TOOL_BUTTON} aria-label={t("Delete")} onClick={() => remove(row)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
                {(failed.length > 0 || row.error) && (
                  <p className="w-full text-[11px] text-orange-700">
                    {row.error ?? `${t("Not included (the service did not answer):")} ${failed.join(", ")}`}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

interface Retention {
  auditLogDays: number;
  notificationDays: number;
  signInHistoryDays: number;
  exportDays: number;
  /** UTC, without an offset. */
  updatedAt: string | null;
  updatedBy: string | null;
}

// Field, label, hint, smallest and largest number of days (as the user service checks them)
const RETENTION_FIELDS: [keyof Omit<Retention, "updatedAt" | "updatedBy">, string, string, number, number][] = [
  ["auditLogDays", "Audit log", "Who did what (Settings → Audit Log).", 90, 3650],
  ["notificationDays", "Notifications", "Read or settled alerts and sent-email records; unread alerts stay.", 30, 1825],
  ["signInHistoryDays", "Sign-in history", "The record of each sign-in.", 30, 1825],
  ["exportDays", "Export files", "Full company exports above.", 1, 365],
];

/**
 * How long logs are kept before the nightly job deletes them. Invoices, the ledger, stock and payroll records are
 * never deleted by it (tax law needs them kept).
 */
function RetentionSection() {
  const [saved, setSaved] = useState<Retention | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fill = (r: Retention) => {
    setSaved(r);
    setForm(Object.fromEntries(RETENTION_FIELDS.map(([key]) => [key, String(r[key])])));
  };

  useEffect(() => {
    axios.get<Retention>("/v1/api/user/company/retention").then((r) => fill(r.data)).catch(() => setSaved(null));
  }, []);

  if (!saved) return null;
  const dirty = RETENTION_FIELDS.some(([key]) => form[key] !== String(saved[key]));

  const save = async () => {
    for (const [key, label, , min, max] of RETENTION_FIELDS) {
      const days = Number(form[key]);
      if (!Number.isInteger(days) || days < min || days > max) {
        ToasterService.error(`${t(label)}: ${t("enter a number of days from")} ${min} ${t("to")} ${max}.`);
        return;
      }
    }
    setSaving(true);
    try {
      const res = await axios.put<Retention>("/v1/api/user/company/retention",
        Object.fromEntries(RETENTION_FIELDS.map(([key]) => [key, Number(form[key])])));
      fill(res.data);
      ToasterService.success(t("Retention saved."));
    } catch (err) {
      ToasterService.error(errorText(err, t("Could not save the retention.")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={`${CARD} p-4`}>
      {sectionTitle(History, "Log retention")}
      <p className="mb-3 text-[11px] text-slate-500 dark:text-gray-400">
        {t("Older entries are deleted every night. Invoices, the ledger, stock and payroll records are never deleted automatically (tax law needs them kept).")}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {RETENTION_FIELDS.map(([key, label, hint, min, max]) => (
          <div key={key}>
            <label className={LABEL} htmlFor={`retention-${key}`}>{t(label)} ({t("days")})</label>
            <input id={`retention-${key}`} type="number" min={min} max={max} className={INPUT} value={form[key] ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-gray-400">{t(hint)} {min}–{max}.</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button type="button" className={SECONDARY_BUTTON} disabled={!dirty || saving} onClick={save}>
          <Save className="mr-1 inline h-4 w-4" />{t(saving ? "Saving..." : "Save retention")}
        </button>
        {saved.updatedAt && (
          <span className="text-[11px] text-slate-400">
            {t("Last changed")} {formatDateTime(`${saved.updatedAt}Z`)}{saved.updatedBy ? ` · ${saved.updatedBy}` : ""}
          </span>
        )}
      </div>
    </section>
  );
}

interface SsoSettings {
  provider: "MICROSOFT" | "GOOGLE";
  enabled: boolean;
  clientId: string | null;
  hasSecret: boolean;
  directoryTenant: string | null;
  domains: string[];
}

/**
 * Single sign-on with Microsoft (Entra ID) or Google: the app registration the company made there, and the email
 * domains whose people then sign in with it. Each provider is saved on its own.
 */
function SingleSignOnSection({ editable }: { editable: boolean }) {
  const [rows, setRows] = useState<SsoSettings[] | null>(null);
  const redirectUri = `${window.location.origin}/v1/api/auth/sso/callback`;

  useEffect(() => {
    axios.get<SsoSettings[]>("/v1/api/user/company/sso").then((r) => setRows(r.data)).catch(() => setRows(null));
  }, []);

  if (!rows) return null;
  return (
    <section className={`${CARD} p-4`}>
      {sectionTitle(KeyRound, "Single sign-on")}
      <p className="text-[11px] text-slate-500 dark:text-gray-400">
        {t("Register the app with Microsoft Entra ID or Google, with this redirect URI:")}{" "}
        <code className="select-all break-all rounded bg-slate-100 px-1.5 py-0.5 text-slate-700 dark:bg-white/10 dark:text-gray-200">{redirectUri}</code>
      </p>
      <div className="mt-3 space-y-3">
        {rows.map((row) => (
          <SsoProviderForm key={row.provider} editable={editable} settings={row}
            onSaved={(saved) => setRows((list) => (list ?? []).map((r) => (r.provider === saved.provider ? saved : r)))} />
        ))}
      </div>
    </section>
  );
}

function SsoProviderForm({ editable, settings, onSaved }: { editable: boolean; settings: SsoSettings; onSaved: (s: SsoSettings) => void }) {
  const [form, setForm] = useState({
    enabled: settings.enabled, clientId: settings.clientId ?? "", clientSecret: "",
    directoryTenant: settings.directoryTenant ?? "", domains: settings.domains.join(", "),
  });
  const [saving, setSaving] = useState(false);
  const microsoft = settings.provider === "MICROSOFT";

  const save = async () => {
    setSaving(true);
    try {
      const res = await axios.put<SsoSettings>(`/v1/api/user/company/sso/${settings.provider}`, {
        enabled: form.enabled, clientId: form.clientId,
        // Empty keeps the saved secret
        clientSecret: form.clientSecret ? form.clientSecret : null,
        directoryTenant: form.directoryTenant,
        domains: form.domains.split(/[,\s]+/).filter(Boolean),
      });
      onSaved(res.data);
      setForm((f) => ({ ...f, clientSecret: "" }));
      ToasterService.success(t("Single sign-on saved."));
    } catch (err) {
      ToasterService.error(errorText(err, t("Could not save single sign-on.")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-gray-700">
      <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-gray-100">
        <input type="checkbox" className="accent-cyan-600" disabled={!editable} checked={form.enabled}
          onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))} />
        <i className={`fab ${microsoft ? "fa-microsoft" : "fa-google"}`} aria-hidden="true"></i>
        {t(microsoft ? "Sign in with Microsoft" : "Sign in with Google")}
      </label>
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        <div>
          <label className={LABEL}>{t(microsoft ? "Application (client) ID" : "Client ID")}</label>
          <input className={INPUT} disabled={!editable} value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))} />
        </div>
        <div>
          <label className={LABEL}>{t("Client secret")}</label>
          <input className={INPUT} type="password" autoComplete="new-password" disabled={!editable} value={form.clientSecret}
            placeholder={settings.hasSecret ? t("Saved; leave empty to keep it") : ""}
            onChange={(e) => setForm((f) => ({ ...f, clientSecret: e.target.value }))} />
        </div>
        {microsoft && (
          <div>
            <label className={LABEL}>{t("Directory (tenant) ID")}</label>
            <input className={INPUT} disabled={!editable} value={form.directoryTenant} placeholder={t("Empty: any work account")}
              onChange={(e) => setForm((f) => ({ ...f, directoryTenant: e.target.value }))} />
          </div>
        )}
        <div>
          <label className={LABEL}>{t("Email domains")}</label>
          <input className={INPUT} disabled={!editable} value={form.domains} placeholder="gulftrading.ae"
            onChange={(e) => setForm((f) => ({ ...f, domains: e.target.value }))} />
        </div>
      </div>
      {editable && (
        <button type="button" className={`${SECONDARY_BUTTON} mt-2`} disabled={saving} onClick={save}>{t(saving ? "Saving..." : "Save")}</button>
      )}
    </div>
  );
}