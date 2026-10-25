import { useEffect, useRef, useState } from "react";
import { Building2, Image, ImageUp, MapPin, Phone, Save, SlidersHorizontal, Trash2 } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { CompanyProfile, companyApi, useCompany } from "../../company/companyApi";
import {
  INDIAN_STATES, findIndianState, validateEmail, validateGstin, validatePan, validatePhone, validatePinCode,
  validatePinState, validateWebsite,
} from "../../utils/indiaValidators";
import { ADD_BUTTON_COLORS } from "../../components/common/AddButton";
import { CARD, CARD_TITLE, PAGE_BODY, SECONDARY_BUTTON, TOOL_BUTTON } from "../Payroll/hrmsUi";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50 disabled:text-slate-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const ERROR = "mt-1 text-[11px] text-red-600";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

/** Section heading with the cyan icon chip used on the profile page. */
const sectionTitle = (Icon: React.ComponentType<{ className?: string }>, text: string) => (
  <h3 className={`${CARD_TITLE} mb-3 flex items-center gap-2`}>
    <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#e0f7fa] text-[#0097a7] dark:bg-cyan-950/40 dark:text-cyan-300">
      <Icon className="h-4 w-4" />
    </span>
    {text}
  </h3>
);

type Form = Omit<CompanyProfile, "tenantId" | "hasLogo" | "updatedDate" | "editable">;

const toForm = (p: CompanyProfile): Form => ({
  companyName: p.companyName ?? "", legalName: p.legalName ?? "", gstin: p.gstin ?? "", pan: p.pan ?? "",
  addressLine1: p.addressLine1 ?? "", addressLine2: p.addressLine2 ?? "", city: p.city ?? "", state: p.state ?? "",
  postalCode: p.postalCode ?? "", country: p.country || "India", phone: p.phone ?? "", email: p.email ?? "",
  website: p.website ?? "", financialYearStartMonth: p.financialYearStartMonth || 4, currency: p.currency || "INR",
});

const validate = (f: Form): Record<string, string> => {
  const errors: Record<string, string | null> = {};
  const india = (f.country || "India").toLowerCase() === "india";
  if (!f.companyName.trim()) errors.companyName = "Enter the company name";
  errors.gstin = validateGstin(f.gstin, f.pan);
  errors.pan = validatePan(f.pan);
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

  const set = (key: keyof Form, value: string | number) => {
    if (!form) return;
    setForm({ ...form, [key]: value });
    if (errors[key]) setErrors({ ...errors, [key]: "" });
  };

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
      await companyApi.update({ ...form, gstin: form.gstin?.toUpperCase(), pan: form.pan?.toUpperCase(), currency: form.currency.toUpperCase() });
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
      <label className={LABEL} htmlFor={`company-${key}`}>{label}</label>
      <input id={`company-${key}`} className={INPUT} disabled={!editable} value={String(form?.[key] ?? "")}
        onChange={(e) => set(key, e.target.value)} {...props} />
      {errors[key] && <p className={ERROR}>{errors[key]}</p>}
    </div>
  );

  return (
    <>
      <PageMeta title="Company Settings" description="Company details used on documents" />
      <PageBreadcrumb
        pageTitle="Company Settings"
        actions={editable && form ? (
          <div className="flex items-center gap-2">
            <button type="button" className={TOOL_BUTTON} disabled={!dirty} onClick={() => { setForm(toForm(company!)); setErrors({}); }}>
              Discard changes
            </button>
            <button type="submit" form="company-settings-form" className={`${TOOL_BUTTON} ${ADD_BUTTON_COLORS}`} disabled={saving || !dirty}>
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        ) : undefined}
      />

      <div className={PAGE_BODY}>
        {loading || !form ? (
          <div className={`${CARD} p-6 text-sm text-slate-400`}>{loading ? "Loading..." : "The company details could not be loaded."}</div>
        ) : (
          <form id="company-settings-form" onSubmit={save} className="space-y-4">
            {!editable && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Only a Tenant Administrator can change these details.
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <section className={`${CARD} p-4`}>
                  {sectionTitle(Building2, "Company")}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {field("companyName", "Company name *", { maxLength: 255 })}
                    {field("legalName", "Registered (legal) name", { maxLength: 200, placeholder: "As on the GST certificate" })}
                    {field("gstin", "GSTIN", { maxLength: 15, placeholder: "e.g. 29ABCDE1234F1ZW", style: { textTransform: "uppercase" } })}
                    {field("pan", "PAN", { maxLength: 10, placeholder: "Filled from the GSTIN if left empty", style: { textTransform: "uppercase" } })}
                  </div>
                </section>

                <section className={`${CARD} p-4`}>
                  {sectionTitle(MapPin, "Registered address")}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {field("addressLine1", "Address line 1", { maxLength: 200 })}
                    {field("addressLine2", "Address line 2", { maxLength: 200 })}
                    {field("city", "City", { maxLength: 100 })}
                    <div>
                      <label className={LABEL} htmlFor="company-state">State</label>
                      {india ? (
                        <select id="company-state" className={INPUT} disabled={!editable} value={form.state ?? ""}
                          onChange={(e) => set("state", e.target.value)}>
                          <option value="">Select state</option>
                          {form.state && !findIndianState(form.state) && <option value={form.state}>{form.state}</option>}
                          {INDIAN_STATES.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                        </select>
                      ) : (
                        <input id="company-state" className={INPUT} disabled={!editable} value={form.state ?? ""} maxLength={100}
                          onChange={(e) => set("state", e.target.value)} />
                      )}
                    </div>
                    {field("postalCode", india ? "PIN code" : "Postal code", { maxLength: 20 })}
                    {field("country", "Country", { maxLength: 100 })}
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
              </div>

              <div className="space-y-4">
                <section className={`${CARD} p-4`}>
                  {sectionTitle(Image, "Logo")}
                  <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 dark:border-gray-700 dark:bg-[#222222]">
                    {logo ? (
                      <img src={logo.dataUrl} alt="Company logo" className="max-h-24 max-w-[90%] object-contain" />
                    ) : (
                      <span className="text-xs text-slate-400">No logo yet</span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-gray-400">PNG, JPEG or WebP, up to 512 KB. Shown on quotations and payslips (payslips need PNG or JPEG).</p>
                  {editable && (
                    <div className="mt-3 flex gap-2">
                      <input ref={fileRef} type="file" accept={LOGO_TYPES.join(",")} className="hidden"
                        onChange={(e) => uploadLogo(e.target.files?.[0])} />
                      <button type="button" className={SECONDARY_BUTTON} disabled={uploading} onClick={() => fileRef.current?.click()}>
                        <ImageUp className="mr-1 inline h-4 w-4" />{uploading ? "Uploading..." : company?.hasLogo ? "Replace" : "Upload"}
                      </button>
                      {company?.hasLogo && (
                        <button type="button" className={SECONDARY_BUTTON} onClick={removeLogo}>
                          <Trash2 className="mr-1 inline h-4 w-4" />Remove
                        </button>
                      )}
                    </div>
                  )}
                </section>

                <section className={`${CARD} p-4`}>
                  {sectionTitle(SlidersHorizontal, "Preferences")}
                  <div className="space-y-3">
                    <div>
                      <label className={LABEL} htmlFor="company-fy">Financial year starts in</label>
                      <select id="company-fy" className={INPUT} disabled={!editable} value={form.financialYearStartMonth}
                        onChange={(e) => set("financialYearStartMonth", Number(e.target.value))}>
                        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                      </select>
                    </div>
                    {field("currency", "Currency", { maxLength: 3, style: { textTransform: "uppercase" } })}
                  </div>
                </section>
              </div>
            </div>

            {company?.updatedDate && (
              <p className="text-right text-[11px] text-slate-400">Last changed {new Date(company.updatedDate).toLocaleString("en-IN")}</p>
            )}
          </form>
        )}
      </div>
    </>
  );
}
