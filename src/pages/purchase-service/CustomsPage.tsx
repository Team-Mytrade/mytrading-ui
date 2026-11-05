import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { Calculator, Eye, Pencil, Plus, Save, Stamp, Trash2 } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { usePermissions } from "../../access/usePermissions";
import { Declaration, HsTariff, customsApi } from "../../purchase/customsApi";
import { Shipment, shipmentApi } from "../../purchase/shipmentApi";
import { companyCurrency, formatDate, formatDateTime, formatMoney, formatNumber, todayIso } from "../../company/format";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50 disabled:text-slate-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";

interface Named { id: number; name?: string; vendorCode?: string; active?: boolean }
const asArray = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : Array.isArray((data as { content?: T[] })?.content) ? (data as { content: T[] }).content : [];
const money = (v: number | null | undefined) => (v == null ? "—" : formatMoney(v, { currency: companyCurrency() }));
const pct = (v: number | null | undefined) => (v == null ? "—" : `${formatNumber(v, 3)}%`);
const num = (v: string) => (v.trim() === "" ? null : Number(v));

type Form = {
  id: number | null; shipmentId: string; entryNumber: string; declarationDate: string; customsOffice: string; exchangeRate: string;
  freightAmount: string; insuranceAmount: string; otherAmount: string; importVatRate: string; payeeVendorId: string;
  overrides: Record<number, { hsCode: string; dutyRate: string }>;
};

const RATE_SOURCE: Record<string, string> = { DEFAULT: "Default rate", NO_HS_CODE: "No HS code: default rate", MANUAL: "Set by hand" };

/**
 * Customs (backlog 7.2.1 step 2): declarations (bills of entry) for arrived shipments — customs value (CIF), duty by
 * the most specific HS rate, import VAT — posted as each product's duty into its stock cost and a bill from customs;
 * and the company's HS tariff and customs settings.
 */
export default function CustomsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { canCreate, canUpdate, canDelete, canApprove } = usePermissions("PURCHASE");
  const { access } = useContext(AuthContext);
  // Customs settings are the administrators' call (the server checks PURCHASE:ADMIN too)
  const canAdmin = hasPermission(access, "PURCHASE:ADMIN");
  const [tab, setTab] = useState<"declarations" | "tariff">(params.get("tab") === "tariff" ? "tariff" : "declarations");
  const [declarations, setDeclarations] = useState<Declaration[] | null>(null);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [vendors, setVendors] = useState<Named[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [shown, setShown] = useState<Declaration | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    customsApi.declarations().then(setDeclarations).catch((err) => {
      setDeclarations([]);
      ToasterService.error("Customs declarations could not be loaded", errorText(err, "Is the purchase service running?"));
    });
    shipmentApi.list().then(setShipments).catch(() => setShipments([]));
  }, []);

  useEffect(() => {
    load();
    axios.get("/v1/api/common/vendors").then((r) => setVendors(asArray<Named>(r.data))).catch(() => undefined);
  }, [load]);

  const blank = (shipmentId = ""): Form => ({ id: null, shipmentId, entryNumber: "", declarationDate: todayIso(), customsOffice: "", exchangeRate: "",
    freightAmount: "", insuranceAmount: "", otherAmount: "", importVatRate: "", payeeVendorId: "", overrides: {} });

  // ?shipment= starts a declaration for it (from the shipment page)
  const fromShipment = params.get("shipment");
  useEffect(() => {
    if (!fromShipment) return;
    setTab("declarations");
    setShown(null);
    setForm(blank(fromShipment));
    setParams({}, { replace: true });
  }, [fromShipment, setParams]);

  const open = (d: Declaration) => {
    setShown(d);
    setConfirming(false);
    setForm(d.status === "DRAFT" && canUpdate ? {
      id: d.id, shipmentId: String(d.shipmentId), entryNumber: d.entryNumber, declarationDate: d.declarationDate, customsOffice: d.customsOffice ?? "",
      exchangeRate: String(d.exchangeRate), freightAmount: String(d.freightAmount ?? ""), insuranceAmount: String(d.insuranceAmount ?? ""),
      otherAmount: String(d.otherAmount ?? ""), importVatRate: String(d.importVatRate), payeeVendorId: d.payeeVendorId ? String(d.payeeVendorId) : "",
      overrides: Object.fromEntries(d.lines.map((l) => [l.purchaseOrderLineItemId, { hsCode: l.hsCode ?? "", dutyRate: l.rateSource === "MANUAL" ? String(l.dutyRate) : "" }])),
    } : null);
  };

  const declarable = useMemo(() => {
    const declared = new Set((declarations ?? []).filter((d) => d.id !== form?.id).map((d) => d.shipmentId));
    return shipments.filter((s) => ["ARRIVED", "CLEARED", "RECEIVED"].includes(s.status) && !declared.has(s.id));
  }, [shipments, declarations, form?.id]);

  const save = async () => {
    if (!form) return;
    if (!form.shipmentId || !form.entryNumber.trim()) {
      ToasterService.error("Choose the shipment and enter the customs entry number.");
      return;
    }
    setBusy(true);
    try {
      const saved = await customsApi.save(form.id, {
        shipmentId: Number(form.shipmentId), entryNumber: form.entryNumber.trim(), declarationDate: form.declarationDate || null,
        customsOffice: form.customsOffice.trim() || null, exchangeRate: num(form.exchangeRate), freightAmount: num(form.freightAmount),
        insuranceAmount: num(form.insuranceAmount), otherAmount: num(form.otherAmount), importVatRate: num(form.importVatRate),
        payeeVendorId: form.payeeVendorId ? Number(form.payeeVendorId) : null,
        lines: Object.entries(form.overrides).map(([id, o]) => ({ purchaseOrderLineItemId: Number(id), hsCode: o.hsCode.trim() || null, dutyRate: num(o.dutyRate) })),
      });
      ToasterService.success(form.id ? "Declaration worked out again." : "Declaration drafted: check the duty, then post it.");
      open(saved);
      load();
    } catch (err) {
      ToasterService.error("The declaration could not be saved", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const post = async (d: Declaration) => {
    setBusy(true);
    try {
      const posted = await customsApi.post(d.id);
      ToasterService.success(`${posted.entryNumber}: ${t("posted")}.`);
      open(posted);
      load();
    } catch (err) {
      ToasterService.error("The declaration could not be posted", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const remove = async (d: Declaration) => {
    if (!window.confirm(t("Delete the draft declaration {number}?", { number: d.entryNumber }))) return;
    try {
      await customsApi.remove(d.id);
      setShown(null);
      setForm(null);
      load();
    } catch (err) {
      ToasterService.error("The declaration could not be deleted", errorText(err, "Please try again."));
    }
  };

  const setOverride = (id: number, patch: Partial<{ hsCode: string; dutyRate: string }>) =>
    setForm((f) => (f ? { ...f, overrides: { ...f.overrides, [id]: { ...(f.overrides[id] ?? { hsCode: "", dutyRate: "" }), ...patch } } } : f));

  return (
    <>
      <PageMeta title={t("Customs")} description="Customs declarations and HS tariff" />
      <PageBreadcrumb pageTitle="Customs" />
      <div className={`${PAGE_BODY} space-y-4`}>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm dark:border-gray-700 dark:bg-[#191919]">
          {(["declarations", "tariff"] as const).map((k) => (
            <button key={k} type="button" onClick={() => { setTab(k); setForm(null); setShown(null); }}
              className={`rounded-md px-3 py-1.5 font-medium ${tab === k ? "bg-cyan-600 text-white" : "text-slate-600 dark:text-gray-300"}`}>
              {t(k === "declarations" ? "Declarations" : "HS tariff & settings")}
            </button>
          ))}
        </div>

        {tab === "tariff" && <TariffPanel vendors={vendors} canEdit={canUpdate} canAdmin={canAdmin} canDelete={canDelete} />}

        {tab === "declarations" && !form && !shown && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-gray-800">
              <h2 className={CARD_TITLE}>{t("Customs declarations")}</h2>
              {canCreate && <button type="button" className={PRIMARY_BUTTON} onClick={() => setForm(blank())}><Plus className="h-4 w-4" /> {t("New declaration")}</button>}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-[#222222]">
                  <tr>
                    <th className={TH}>{t("Entry no.")}</th>
                    <th className={TH}>{t("Date")}</th>
                    <th className={TH}>{t("Shipment")}</th>
                    <th className={`${TH} text-end`}>{t("Customs value")}</th>
                    <th className={`${TH} text-end`}>{t("Duty")}</th>
                    <th className={`${TH} text-end`}>{t("Import VAT")}</th>
                    <th className={TH}>{t("Status")}</th>
                    <th className={TH} aria-label={t("Actions")} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {declarations === null ? (
                    <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                  ) : declarations.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-slate-400">{t("No customs declarations yet.")}</td></tr>
                  ) : declarations.map((d) => (
                    <tr key={d.id}>
                      <td className={`${TD} font-medium`}>{d.entryNumber}</td>
                      <td className={`${TD} whitespace-nowrap`}>{formatDate(d.declarationDate)}</td>
                      <td className={TD}>{d.shipmentNumber}</td>
                      <td className={`${TD} text-end`}>{money(d.customsValue)}</td>
                      <td className={`${TD} text-end`}>{money(d.dutyAmount)}</td>
                      <td className={`${TD} text-end`}>{money(d.vatAmount)}</td>
                      <td className={TD}>
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${d.status === "POSTED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {t(d.status === "POSTED" ? "Posted" : "Draft")}
                        </span>
                      </td>
                      <td className={`${TD} whitespace-nowrap text-end`}>
                        <button type="button" className={ROW_ICON_BUTTON} title={t(d.status === "DRAFT" && canUpdate ? "Edit" : "View")}
                          aria-label={t(d.status === "DRAFT" && canUpdate ? "Edit" : "View")} onClick={() => open(d)}>
                          {d.status === "DRAFT" && canUpdate ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                        {d.status === "DRAFT" && canDelete && (
                          <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Delete")} aria-label={t("Delete")} onClick={() => remove(d)}><Trash2 className="h-4 w-4" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "declarations" && form && (
          <div className={`${CARD} space-y-4 p-4`}>
            <h2 className={CARD_TITLE}>{shown ? `${t("Customs entry")} ${shown.entryNumber} (${t("Draft")})` : t("New declaration")}</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className={LABEL} htmlFor="cd-shipment">{t("Shipment")} *</label>
                <select id="cd-shipment" className={INPUT} value={form.shipmentId} onChange={(e) => setForm({ ...form, shipmentId: e.target.value, overrides: {} })}>
                  <option value="">{t("Choose…")}</option>
                  {declarable.map((s) => <option key={s.id} value={String(s.id)}>{s.shipmentNumber} · {s.vendorName}</option>)}
                  {form.shipmentId && !declarable.some((s) => String(s.id) === form.shipmentId) && <option value={form.shipmentId}>{shown?.shipmentNumber ?? `#${form.shipmentId}`}</option>}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="cd-entry">{t("Customs entry (bill of entry) no.")} *</label>
                <input id="cd-entry" className={`${INPUT} uppercase`} maxLength={40} value={form.entryNumber} onChange={(e) => setForm({ ...form, entryNumber: e.target.value })} />
              </div>
              <div>
                <label className={LABEL} htmlFor="cd-date">{t("Date")}</label>
                <input id="cd-date" type="date" className={INPUT} max={todayIso()} value={form.declarationDate} onChange={(e) => setForm({ ...form, declarationDate: e.target.value })} />
              </div>
              <div>
                <label className={LABEL} htmlFor="cd-office">{t("Customs office")}</label>
                <input id="cd-office" className={INPUT} maxLength={120} value={form.customsOffice} onChange={(e) => setForm({ ...form, customsOffice: e.target.value })} />
              </div>
              <div>
                <label className={LABEL} htmlFor="cd-rate">{t("Customs exchange rate")}</label>
                <input id="cd-rate" type="number" min="0" step="any" className={INPUT} placeholder={t("Finance's rate if blank")} value={form.exchangeRate}
                  onChange={(e) => setForm({ ...form, exchangeRate: e.target.value })} />
              </div>
              <div>
                <label className={LABEL} htmlFor="cd-payee">{t("Paid to (customs or clearing agent)")}</label>
                <select id="cd-payee" className={INPUT} value={form.payeeVendorId} onChange={(e) => setForm({ ...form, payeeVendorId: e.target.value })}>
                  <option value="">{t("From the customs settings")}</option>
                  {vendors.filter((v) => v.active !== false || String(v.id) === form.payeeVendorId).map((v) => <option key={v.id} value={String(v.id)}>{v.name || v.vendorCode}</option>)}
                </select>
              </div>
              {([["freightAmount", "Freight"], ["insuranceAmount", "Insurance"], ["otherAmount", "Other costs"]] as const).map(([key, label]) => (
                <div key={key}>
                  <label className={LABEL} htmlFor={`cd-${key}`}>{t(label)} ({companyCurrency()})</label>
                  <input id={`cd-${key}`} type="number" min="0" step="any" className={INPUT} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                </div>
              ))}
              <div>
                <label className={LABEL} htmlFor="cd-vat">{t("Import VAT %")}</label>
                <input id="cd-vat" type="number" min="0" max="100" step="any" className={INPUT} placeholder={t("From the customs settings")} value={form.importVatRate}
                  onChange={(e) => setForm({ ...form, importVatRate: e.target.value })} />
              </div>
            </div>
            <p className="text-xs text-slate-500">{t("Customs value = the goods at the customs rate + freight, insurance and other costs to the border, spread by value (CIF). Leave freight and insurance at 0 when the price already includes them (CIF, CFR).")}</p>

            {shown && <DeclarationLines declaration={shown} overrides={form.overrides} onOverride={setOverride} />}
            {!shown && <p className="text-sm text-slate-500">{t("Save to work out the customs value, duty and import VAT for each product.")}</p>}

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => { setForm(null); setShown(null); }}>{t("Close")}</button>
              <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={save}><Calculator className="h-4 w-4" /> {t(form.id ? "Work it out again" : "Save draft and work it out")}</button>
              {shown && shown.status === "DRAFT" && canApprove && (confirming ? (
                <>
                  <span className="self-center text-xs text-slate-600">{t("Duty goes into the goods' cost and customs bills {amount}. It can't be changed afterwards.", { amount: money(shown.totalPayable) })}</span>
                  <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={() => post(shown)}><Stamp className="h-4 w-4" /> {t("Confirm and post")}</button>
                </>
              ) : (
                <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={() => setConfirming(true)}><Stamp className="h-4 w-4" /> {t("Post")}</button>
              ))}
            </div>
          </div>
        )}

        {tab === "declarations" && !form && shown && (
          <div className={`${CARD} space-y-4 p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={CARD_TITLE}>{t("Customs entry")} {shown.entryNumber}</h2>
              <div className="flex gap-2">
                <button type="button" className={SECONDARY_BUTTON} onClick={() => navigate(`/purchase-service/shipments?id=${shown.shipmentId}`)}>{t("Open the shipment")}</button>
                <button type="button" className={SECONDARY_BUTTON} onClick={() => setShown(null)}>{t("Back to the list")}</button>
              </div>
            </div>
            <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4 dark:text-gray-200">
              <div><span className={LABEL}>{t("Date")}</span>{formatDate(shown.declarationDate)}</div>
              <div><span className={LABEL}>{t("Shipment")}</span>{shown.shipmentNumber}</div>
              <div><span className={LABEL}>{t("Customs office")}</span>{shown.customsOffice ?? "—"}</div>
              <div><span className={LABEL}>{t("Customs exchange rate")}</span>{shown.currency ? `1 ${shown.currency} = ${formatNumber(shown.exchangeRate, 6)}` : "1"}</div>
              <div><span className={LABEL}>{t("Paid to (customs or clearing agent)")}</span>{shown.payeeVendorName ?? "—"}</div>
              <div><span className={LABEL}>{t("Landed cost")}</span>{shown.landedCostNumber ?? "—"}</div>
              {shown.postedAt && <div className="sm:col-span-2"><span className={LABEL}>{t("Posted")}</span>{formatDateTime(shown.postedAt)} · {shown.postedBy}</div>}
            </div>
            <DeclarationLines declaration={shown} />
          </div>
        )}
      </div>
    </>
  );
}

/** The declared products: value build-up, rate (and where it came from), duty and VAT, with the totals. */
function DeclarationLines({ declaration: d, overrides, onOverride }: {
  declaration: Declaration;
  overrides?: Record<number, { hsCode: string; dutyRate: string }>;
  onOverride?: (id: number, patch: Partial<{ hsCode: string; dutyRate: string }>) => void;
}) {
  const editable = !!onOverride && d.status === "DRAFT";
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
      {/* Wide enough for the HS code and rate inputs; scrolls sideways on narrow screens */}
      <table className="w-full min-w-[64rem] divide-y divide-slate-100 dark:divide-gray-800">
        <thead className="bg-slate-50 dark:bg-[#222222]">
          <tr>
            <th className={`${TH} min-w-[12rem]`}>{t("Product")}</th>
            <th className={`${TH} w-36`}>{t("HS code")}</th>
            <th className={`${TH} text-end`}>{t("Qty")}</th>
            <th className={`${TH} text-end`}>{t("Goods")}</th>
            <th className={`${TH} text-end`}>{t("Freight + insurance")}</th>
            <th className={`${TH} text-end`}>{t("Customs value")}</th>
            <th className={`${TH} w-28 text-end`}>{t("Duty %")}</th>
            <th className={`${TH} text-end`}>{t("Duty")}</th>
            <th className={`${TH} text-end`}>{t("Import VAT")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
          {d.lines.map((l) => {
            const o = overrides?.[l.purchaseOrderLineItemId] ?? { hsCode: l.hsCode ?? "", dutyRate: "" };
            return (
              <tr key={l.purchaseOrderLineItemId}>
                <td className={TD}>{`${l.productCode ?? ""} ${l.productName ?? ""}`.trim()}<span className="block text-xs text-slate-400">{l.poNumber}</span></td>
                <td className={TD}>
                  {editable ? <input className={INPUT} aria-label={t("HS code")} value={o.hsCode} onChange={(e) => onOverride!(l.purchaseOrderLineItemId, { hsCode: e.target.value })} />
                    : (l.hsCode ?? "—")}
                </td>
                <td className={`${TD} text-end`}>{l.quantity}</td>
                <td className={`${TD} text-end`}>{money(l.goodsValue)}</td>
                <td className={`${TD} text-end`}>{money(l.freightShare + l.insuranceShare + l.otherShare)}</td>
                <td className={`${TD} text-end`}>{money(l.customsValue)}</td>
                <td className={`${TD} text-end`}>
                  {editable ? <input type="number" min="0" max="100" step="any" className={INPUT} aria-label={t("Duty %")} placeholder={formatNumber(l.dutyRate, 3)}
                    value={o.dutyRate} onChange={(e) => onOverride!(l.purchaseOrderLineItemId, { dutyRate: e.target.value })} /> : pct(l.dutyRate)}
                  <span className="block text-[11px] text-slate-400">{RATE_SOURCE[l.rateSource] ? t(RATE_SOURCE[l.rateSource]) : `${t("HS")} ${l.rateSource}`}</span>
                </td>
                <td className={`${TD} text-end font-medium`}>{money(l.dutyAmount)}</td>
                <td className={`${TD} text-end`}>{money(l.vatAmount)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot className="bg-slate-50 font-semibold dark:bg-[#222222]">
          <tr>
            <td className={TD} colSpan={5}>{t("Total")} · {t("Import VAT {rate}", { rate: pct(d.importVatRate) })}</td>
            <td className={`${TD} text-end`}>{money(d.customsValue)}</td>
            <td className={TD} />
            <td className={`${TD} text-end`}>{money(d.dutyAmount)}</td>
            <td className={`${TD} text-end`}>{money(d.vatAmount)}</td>
          </tr>
          <tr>
            <td className={TD} colSpan={7}>{t("Payable to customs")}</td>
            <td className={`${TD} text-end`} colSpan={2}>{money(d.totalPayable)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** The company's duty rates by HS code or heading, and its customs defaults. */
function TariffPanel({ vendors, canEdit, canAdmin, canDelete }: { vendors: Named[]; canEdit: boolean; canAdmin: boolean; canDelete: boolean }) {
  const [tariffs, setTariffs] = useState<HsTariff[] | null>(null);
  const [settings, setSettings] = useState({ defaultDutyRate: "5", importVatRate: "5", customsVendorId: "" });
  const [row, setRow] = useState<{ id: number | null; hsCode: string; description: string; dutyRate: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    customsApi.tariffs().then(setTariffs).catch(() => setTariffs([]));
    customsApi.settings().then((s) => setSettings({ defaultDutyRate: String(s.defaultDutyRate), importVatRate: String(s.importVatRate),
      customsVendorId: s.customsVendorId ? String(s.customsVendorId) : "" })).catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  const saveSettings = async () => {
    setBusy(true);
    try {
      await customsApi.saveSettings({ defaultDutyRate: Number(settings.defaultDutyRate), importVatRate: Number(settings.importVatRate),
        customsVendorId: settings.customsVendorId ? Number(settings.customsVendorId) : null });
      ToasterService.success("Customs settings saved.");
      load();
    } catch (err) {
      ToasterService.error("The customs settings could not be saved", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const saveRow = async () => {
    if (!row) return;
    setBusy(true);
    try {
      await customsApi.saveTariff(row.id, { hsCode: row.hsCode, description: row.description || null, dutyRate: Number(row.dutyRate) });
      setRow(null);
      load();
    } catch (err) {
      ToasterService.error("The duty rate could not be saved", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const removeRow = async (tariff: HsTariff) => {
    if (!window.confirm(t("Remove the rate for HS {code}?", { code: tariff.hsCode }))) return;
    await customsApi.deleteTariff(tariff.id).then(load).catch((err) => ToasterService.error("The duty rate could not be removed", errorText(err, "Please try again.")));
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-gray-800">
          <h2 className={CARD_TITLE}>{t("Duty by HS code")}</h2>
          {canEdit && !row && <button type="button" className={SECONDARY_BUTTON} onClick={() => setRow({ id: null, hsCode: "", description: "", dutyRate: "" })}><Plus className="h-4 w-4" /> {t("Add a rate")}</button>}
        </div>
        <p className="px-4 pt-3 text-xs text-slate-500">{t("The most specific code wins: a rate for 8544 covers 8544.42.00 unless that has its own. Codes not listed pay the default rate.")}</p>
        <table className="mt-2 min-w-full divide-y divide-slate-100 dark:divide-gray-800">
          <thead className="bg-slate-50 dark:bg-[#222222]">
            <tr><th className={TH}>{t("HS code")}</th><th className={TH}>{t("Description")}</th><th className={`${TH} text-end`}>{t("Duty %")}</th><th className={TH} /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
            {row && (
              <tr>
                <td className={TD}><input className={INPUT} aria-label={t("HS code")} placeholder="8544.42" value={row.hsCode} onChange={(e) => setRow({ ...row, hsCode: e.target.value })} /></td>
                <td className={TD}><input className={INPUT} aria-label={t("Description")} maxLength={200} value={row.description} onChange={(e) => setRow({ ...row, description: e.target.value })} /></td>
                <td className={TD}><input type="number" min="0" max="100" step="any" className={INPUT} aria-label={t("Duty %")} value={row.dutyRate} onChange={(e) => setRow({ ...row, dutyRate: e.target.value })} /></td>
                <td className={`${TD} whitespace-nowrap`}>
                  <button type="button" className={ROW_ICON_BUTTON} title={t("Save")} aria-label={t("Save")} disabled={busy} onClick={saveRow}><Save className="h-4 w-4" /></button>
                  <button type="button" className={ROW_ICON_BUTTON} title={t("Cancel")} aria-label={t("Cancel")} onClick={() => setRow(null)}>✕</button>
                </td>
              </tr>
            )}
            {tariffs === null ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
            ) : tariffs.length === 0 && !row ? (
              <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-400">{t("No rates yet: every product pays the default rate.")}</td></tr>
            ) : tariffs.map((x) => (
              <tr key={x.id}>
                <td className={`${TD} font-mono`}>{x.hsCode}</td>
                <td className={TD}>{x.description ?? ""}</td>
                <td className={`${TD} text-end`}>{pct(x.dutyRate)}</td>
                <td className={`${TD} whitespace-nowrap text-end`}>
                  {canEdit && <button type="button" className={ROW_ICON_BUTTON} title={t("Edit")} aria-label={t("Edit")}
                    onClick={() => setRow({ id: x.id, hsCode: x.hsCode, description: x.description ?? "", dutyRate: String(x.dutyRate) })}><Pencil className="h-4 w-4" /></button>}
                  {canDelete && <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Delete")} aria-label={t("Delete")} onClick={() => removeRow(x)}><Trash2 className="h-4 w-4" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`${CARD} space-y-3 p-4`}>
        <h2 className={CARD_TITLE}>{t("Customs settings")}</h2>
        <div>
          <label className={LABEL} htmlFor="cs-duty">{t("Default duty %")}</label>
          <input id="cs-duty" type="number" min="0" max="100" step="any" className={INPUT} disabled={!canAdmin} value={settings.defaultDutyRate}
            onChange={(e) => setSettings({ ...settings, defaultDutyRate: e.target.value })} />
          <p className="mt-1 text-[11px] text-slate-500">{t("GCC common customs tariff: 5% on most goods.")}</p>
        </div>
        <div>
          <label className={LABEL} htmlFor="cs-vat">{t("Import VAT %")}</label>
          <input id="cs-vat" type="number" min="0" max="100" step="any" className={INPUT} disabled={!canAdmin} value={settings.importVatRate}
            onChange={(e) => setSettings({ ...settings, importVatRate: e.target.value })} />
          <p className="mt-1 text-[11px] text-slate-500">{t("UAE 5%, Saudi Arabia 15%.")}</p>
        </div>
        <div>
          <label className={LABEL} htmlFor="cs-vendor">{t("Paid to (customs or clearing agent)")}</label>
          <select id="cs-vendor" className={INPUT} disabled={!canAdmin} value={settings.customsVendorId} onChange={(e) => setSettings({ ...settings, customsVendorId: e.target.value })}>
            <option value="">—</option>
            {vendors.filter((v) => v.active !== false || String(v.id) === settings.customsVendorId).map((v) => <option key={v.id} value={String(v.id)}>{v.name || v.vendorCode}</option>)}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">{t("Add the customs authority or your clearing agent as a vendor; duty and import VAT are billed by them.")}</p>
        </div>
        {canAdmin && <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={saveSettings}><Save className="h-4 w-4" /> {t("Save")}</button>}
      </div>
    </div>
  );
}
