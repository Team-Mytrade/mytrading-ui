import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { AlertTriangle, CheckCircle2, Circle, Eye, PackageCheck, Pencil, Plus, Ship, Trash2, XCircle } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { errorText } from "../../access/accessApi";
import { usePermissions } from "../../access/usePermissions";
import {
  CONTAINER_TYPES, INCOTERMS, OpenLine, SHIPMENT_FLOW, SHIPMENT_MODES, STATUS_TONE, Shipment, ShipmentContainer, shipmentApi, shipmentStatusLabel, statusLabel,
} from "../../purchase/shipmentApi";
import { companyCurrency, formatDate, formatDateTime, formatMoney, todayIso } from "../../company/format";
import { Declaration, customsApi } from "../../purchase/customsApi";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50 disabled:text-slate-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";

interface Named { id: number; name?: string; vendorCode?: string; code?: string; active?: boolean }
const asArray = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : Array.isArray((data as { content?: T[] })?.content) ? (data as { content: T[] }).content : [];

type ContainerRow = ShipmentContainer & { key: string };
type Form = {
  id: number | null; status: string; vendorId: string; mode: string; incoterm: string; carrier: string; transportDocument: string;
  vesselVoyage: string; portOfLoading: string; portOfDischarge: string; originCountry: string; etd: string; eta: string; notes: string;
  containers: ContainerRow[];
  // order line id → quantity (as typed)
  quantities: Record<number, string>;
};
type ReceiveRow = { received: string; rejected: string; batchNumber: string; expiryDate: string; serials: string };

let seq = 0;
const containerRow = (c?: ShipmentContainer): ContainerRow => ({ key: `k${seq++}`, containerNumber: c?.containerNumber ?? "", containerType: c?.containerType ?? "40HC", sealNumber: c?.sealNumber ?? "" });
const DOC_LABEL: Record<string, string> = { SEA: "Bill of lading", AIR: "Air waybill", ROAD: "Consignment note", RAIL: "Rail waybill", COURIER: "Tracking number" };
const NEXT_STEPS: Record<string, string[]> = { BOOKED: ["IN_TRANSIT", "ARRIVED", "CLEARED"], IN_TRANSIT: ["ARRIVED", "CLEARED"], ARRIVED: ["CLEARED"] };
const STEP_ACTION: Record<string, string> = { IN_TRANSIT: "Departed", ARRIVED: "Arrived", CLEARED: "Cleared by customs" };

const StatusChip = ({ status }: { status: string }) => (
  <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[status] ?? STATUS_TONE.BOOKED}`}>{t(shipmentStatusLabel(status))}</span>
);

/**
 * Inbound shipments (backlog 7.2.1): goods on a vendor's approved orders travelling together — containers, bill of
 * lading, vessel, ports and dates — moved from booked to in transit, arrived and cleared, then received into goods
 * receipts (one per order) and given their landed costs.
 */
export default function InboundShipmentsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { canCreate, canUpdate } = usePermissions("PURCHASE");
  const [shipments, setShipments] = useState<Shipment[] | null>(null);
  const [vendors, setVendors] = useState<Named[]>([]);
  const [warehouses, setWarehouses] = useState<Named[]>([]);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [form, setForm] = useState<Form | null>(null);
  const [openLines, setOpenLines] = useState<OpenLine[]>([]);
  const [shown, setShown] = useState<Shipment | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    shipmentApi.list().then(setShipments).catch((err) => {
      setShipments([]);
      ToasterService.error("Shipments could not be loaded", errorText(err, "Is the purchase service running?"));
    });
  }, []);

  useEffect(() => {
    load();
    axios.get("/v1/api/common/vendors").then((r) => setVendors(asArray<Named>(r.data))).catch(() => undefined);
    axios.get("/v1/api/inventory/warehouses").then((r) => setWarehouses(asArray<Named>(r.data))).catch(() => undefined);
  }, [load]);

  // ?id= opens a shipment (links from receipts and landed costs)
  const wantedId = Number(params.get("id")) || null;
  useEffect(() => {
    if (wantedId && shown?.id !== wantedId) shipmentApi.get(wantedId).then(setShown).catch(() => undefined);
  }, [wantedId, shown?.id]);

  const show = (s: Shipment | null) => {
    setShown(s);
    setForm(null);
    setParams(s ? { id: String(s.id) } : {}, { replace: true });
  };

  // The order lines the vendor still has to ship (this shipment's own lines count as open while editing)
  useEffect(() => {
    if (!form?.vendorId || (form.id && form.status !== "BOOKED")) {
      setOpenLines([]);
      return;
    }
    shipmentApi.openLines(Number(form.vendorId), form.id).then(setOpenLines).catch(() => setOpenLines([]));
  }, [form?.vendorId, form?.id, form?.status]);

  const startNew = () => {
    setShown(null);
    setParams({}, { replace: true });
    setForm({ id: null, status: "BOOKED", vendorId: "", mode: "SEA", incoterm: "FOB", carrier: "", transportDocument: "", vesselVoyage: "",
      portOfLoading: "", portOfDischarge: "", originCountry: "", etd: "", eta: "", notes: "", containers: [], quantities: {} });
  };

  const edit = (s: Shipment) => {
    setForm({ id: s.id, status: s.status, vendorId: String(s.vendorId), mode: s.mode, incoterm: s.incoterm ?? "", carrier: s.carrier ?? "",
      transportDocument: s.transportDocument ?? "", vesselVoyage: s.vesselVoyage ?? "", portOfLoading: s.portOfLoading ?? "",
      portOfDischarge: s.portOfDischarge ?? "", originCountry: s.originCountry ?? "", etd: s.etd ?? "", eta: s.eta ?? "", notes: s.notes ?? "",
      containers: s.containers.map(containerRow),
      quantities: Object.fromEntries(s.lines.map((l) => [l.purchaseOrderLineItemId, String(l.quantity)])) });
  };

  const linesOpen = !form?.id || form.status === "BOOKED";
  const containerMode = form?.mode === "SEA" || form?.mode === "RAIL";

  const save = async () => {
    if (!form) return;
    if (!form.vendorId) {
      ToasterService.error("Choose the vendor.");
      return;
    }
    const lines = Object.entries(form.quantities).filter(([, q]) => Number(q) > 0)
      .map(([id, q]) => ({ purchaseOrderLineItemId: Number(id), quantity: Number(q) }));
    if (linesOpen && lines.length === 0) {
      ToasterService.error("Tick the order lines on the shipment.");
      return;
    }
    setBusy(true);
    try {
      const saved = await shipmentApi.save(form.id, {
        vendorId: Number(form.vendorId), mode: form.mode, incoterm: form.incoterm || null, carrier: form.carrier || null,
        transportDocument: form.transportDocument || null, vesselVoyage: form.vesselVoyage || null, portOfLoading: form.portOfLoading || null,
        portOfDischarge: form.portOfDischarge || null, originCountry: form.originCountry || null, etd: form.etd || null, eta: form.eta || null,
        notes: form.notes || null,
        containers: containerMode ? form.containers.filter((c) => c.containerNumber || c.containerType === "LCL")
          .map(({ containerNumber, containerType, sealNumber }) => ({ containerNumber: containerNumber || null, containerType, sealNumber: sealNumber || null })) : [],
        lines: linesOpen ? lines : null,
      });
      ToasterService.success(form.id ? "Shipment saved." : `${saved.shipmentNumber}: ${t("booked")}.`);
      show(saved);
      load();
    } catch (err) {
      ToasterService.error("The shipment could not be saved", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const run = async (work: () => Promise<Shipment>, message: string) => {
    setBusy(true);
    try {
      const next = await work();
      ToasterService.success(t(message));
      setShown(next);
      load();
      return true;
    } catch (err) {
      ToasterService.error("The shipment could not be updated", errorText(err, "Please try again."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const visible = useMemo(() => (shipments ?? []).filter((s) => filter === "all" || !["RECEIVED", "CANCELLED"].includes(s.status)), [shipments, filter]);
  const vendorName = (id: string) => vendors.find((v) => String(v.id) === id)?.name;

  return (
    <>
      <PageMeta title={t("Inbound Shipments")} description="Goods on their way from vendors" />
      <PageBreadcrumb pageTitle="Inbound Shipments" />
      <div className={`${PAGE_BODY} space-y-4`}>
        {!form && !shown && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <h2 className={CARD_TITLE}>{t("Inbound shipments")}</h2>
                <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs dark:border-gray-700">
                  {(["open", "all"] as const).map((f) => (
                    <button key={f} type="button" onClick={() => setFilter(f)}
                      className={`rounded-md px-2.5 py-1 font-medium ${filter === f ? "bg-cyan-600 text-white" : "text-slate-600 dark:text-gray-300"}`}>
                      {t(f === "open" ? "On the way" : "All")}
                    </button>
                  ))}
                </div>
              </div>
              {canCreate && (
                <button type="button" className={PRIMARY_BUTTON} onClick={startNew}><Plus className="h-4 w-4" /> {t("Book a shipment")}</button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-[#222222]">
                  <tr>
                    <th className={TH}>{t("Shipment")}</th>
                    <th className={TH}>{t("Vendor")}</th>
                    <th className={TH}>{t("Mode")}</th>
                    <th className={TH}>{t("Reference")}</th>
                    <th className={TH}>{t("Route")}</th>
                    <th className={TH}>{t("ETA")}</th>
                    <th className={TH}>{t("Received")}</th>
                    <th className={TH}>{t("Status")}</th>
                    <th className={TH} aria-label={t("Actions")} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {shipments === null ? (
                    <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                  ) : visible.length === 0 ? (
                    <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-400">{t(filter === "open" ? "Nothing on the way." : "No shipments yet.")}</td></tr>
                  ) : visible.map((s) => (
                    <tr key={s.id}>
                      <td className={`${TD} whitespace-nowrap font-medium`}>{s.shipmentNumber}</td>
                      <td className={TD}>{s.vendorName}</td>
                      <td className={TD}>{t(statusLabel(s.mode))}{s.containers.length ? ` · ${s.containers.length} ${t("cntr")}` : ""}</td>
                      <td className={TD}>{s.transportDocument ?? "—"}</td>
                      <td className={TD}>{[s.portOfLoading, s.portOfDischarge].filter(Boolean).join(" → ") || "—"}</td>
                      <td className={`${TD} whitespace-nowrap`}>
                        <span className={s.overdue ? "inline-flex items-center gap-1 font-semibold text-red-600" : ""}>
                          {s.overdue && <AlertTriangle className="h-3.5 w-3.5" />}{formatDate(s.eta)}
                        </span>
                      </td>
                      <td className={`${TD} whitespace-nowrap`}>{s.receivedQuantity} / {s.totalQuantity}</td>
                      <td className={TD}><StatusChip status={s.status} /></td>
                      <td className={`${TD} whitespace-nowrap text-end`}>
                        <button type="button" className={ROW_ICON_BUTTON} title={t("View")} aria-label={t("View")} onClick={() => show(s)}><Eye className="h-4 w-4" /></button>
                        {canUpdate && !["RECEIVED", "CANCELLED"].includes(s.status) && (
                          <button type="button" className={ROW_ICON_BUTTON} title={t("Edit")} aria-label={t("Edit")} onClick={() => { setShown(s); edit(s); }}><Pencil className="h-4 w-4" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {form && (
          <div className={`${CARD} space-y-4 p-4`}>
            <h2 className={CARD_TITLE}>{form.id && shown ? `${t("Shipment")} ${shown.shipmentNumber}` : t("Book a shipment")}</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className={LABEL} htmlFor="sh-vendor">{t("Vendor")} *</label>
                <select id="sh-vendor" className={INPUT} value={form.vendorId} disabled={!linesOpen}
                  onChange={(e) => setForm({ ...form, vendorId: e.target.value, quantities: {} })}>
                  <option value="">{t("Choose…")}</option>
                  {vendors.filter((v) => v.active !== false || String(v.id) === form.vendorId).map((v) => <option key={v.id} value={String(v.id)}>{v.name || v.vendorCode}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="sh-mode">{t("Mode")} *</label>
                <select id="sh-mode" className={INPUT} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                  {SHIPMENT_MODES.map((m) => <option key={m} value={m}>{t(statusLabel(m))}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="sh-incoterm">{t("Incoterm")}</label>
                <select id="sh-incoterm" className={INPUT} value={form.incoterm} onChange={(e) => setForm({ ...form, incoterm: e.target.value })}>
                  <option value="">—</option>
                  {INCOTERMS.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              {([
                ["carrier", form.mode === "AIR" ? "Airline" : form.mode === "SEA" ? "Shipping line" : "Carrier", 120],
                ["transportDocument", DOC_LABEL[form.mode] ?? "Transport document", 60],
                ["vesselVoyage", form.mode === "AIR" ? "Flight" : "Vessel / voyage", 120],
                ["portOfLoading", form.mode === "AIR" ? "Airport of departure" : "Port of loading", 120],
                ["portOfDischarge", form.mode === "AIR" ? "Airport of arrival" : "Port of discharge", 120],
                ["originCountry", "Country of origin", 80],
              ] as const).map(([key, label, max]) => (
                <div key={key}>
                  <label className={LABEL} htmlFor={`sh-${key}`}>{t(label)}</label>
                  <input id={`sh-${key}`} className={INPUT} maxLength={max} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                </div>
              ))}
              <div>
                <label className={LABEL} htmlFor="sh-etd">{t("Expected departure (ETD)")}</label>
                <input id="sh-etd" type="date" className={INPUT} value={form.etd} onChange={(e) => setForm({ ...form, etd: e.target.value })} />
              </div>
              <div>
                <label className={LABEL} htmlFor="sh-eta">{t("Expected arrival (ETA)")}</label>
                <input id="sh-eta" type="date" className={INPUT} value={form.eta} min={form.etd || undefined} onChange={(e) => setForm({ ...form, eta: e.target.value })} />
              </div>
              <div>
                <label className={LABEL} htmlFor="sh-notes">{t("Notes")}</label>
                <input id="sh-notes" className={INPUT} maxLength={1000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>

            {containerMode && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className={CARD_TITLE}>{t("Containers")} ({form.containers.length})</span>
                  <button type="button" className={SECONDARY_BUTTON} onClick={() => setForm({ ...form, containers: [...form.containers, containerRow()] })}>
                    <Plus className="h-4 w-4" /> {t("Add container")}
                  </button>
                </div>
                {form.containers.length > 0 && (
                  <div className="space-y-2">
                    {form.containers.map((c) => (
                      <div key={c.key} className="grid grid-cols-[1fr_8rem_1fr_2.5rem] gap-2">
                        <input className={`${INPUT} uppercase`} placeholder={t("e.g. MSKU1234565")} aria-label={t("Container number")} maxLength={13}
                          value={c.containerNumber ?? ""} disabled={c.containerType === "LCL"}
                          onChange={(e) => setForm({ ...form, containers: form.containers.map((x) => (x.key === c.key ? { ...x, containerNumber: e.target.value.toUpperCase() } : x)) })} />
                        <select className={INPUT} aria-label={t("Type")} value={c.containerType}
                          onChange={(e) => setForm({ ...form, containers: form.containers.map((x) => (x.key === c.key ? { ...x, containerType: e.target.value } : x)) })}>
                          {CONTAINER_TYPES.map((type) => <option key={type} value={type}>{type === "LCL" ? t("LCL (shared)") : type}</option>)}
                        </select>
                        <input className={INPUT} placeholder={t("Seal number")} aria-label={t("Seal number")} maxLength={30} value={c.sealNumber ?? ""}
                          onChange={(e) => setForm({ ...form, containers: form.containers.map((x) => (x.key === c.key ? { ...x, sealNumber: e.target.value } : x)) })} />
                        <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Remove")} aria-label={t("Remove")}
                          onClick={() => setForm({ ...form, containers: form.containers.filter((x) => x.key !== c.key) })}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <p className="text-xs text-slate-500">{t("The container number's last digit is a check digit; a mistyped number is refused.")}</p>
                  </div>
                )}
              </div>
            )}

            <div>
              <span className={CARD_TITLE}>{t("What it carries")}</span>
              {!linesOpen ? (
                <p className="mt-1 text-xs text-slate-500">{t("The shipment has left; what it carries can't change.")}</p>
              ) : !form.vendorId ? (
                <p className="mt-1 text-xs text-slate-500">{t("Choose the vendor to see their approved orders with goods still to come.")}</p>
              ) : null}
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                  <thead className="bg-slate-50 dark:bg-[#222222]">
                    <tr>
                      <th className={`${TH} w-8`} />
                      <th className={TH}>{t("Order")}</th>
                      <th className={TH}>{t("Product")}</th>
                      <th className={`${TH} text-end`}>{t("Ordered")}</th>
                      <th className={`${TH} text-end`}>{t("Still to come")}</th>
                      <th className={`${TH} w-32`}>{t("On this shipment")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {linesOpen ? (
                      openLines.length === 0 ? (
                        form.vendorId ? <tr><td colSpan={6} className="px-3 py-4 text-sm text-slate-400">{t("This vendor has no approved orders with goods still to come.")}</td></tr> : null
                      ) : openLines.map((l) => {
                        const value = form.quantities[l.purchaseOrderLineItemId];
                        const ticked = value !== undefined;
                        return (
                          <tr key={l.purchaseOrderLineItemId}>
                            <td className={TD}>
                              <input type="checkbox" aria-label={`${l.poNumber} ${l.productCode}`} checked={ticked}
                                onChange={(e) => {
                                  const quantities = { ...form.quantities };
                                  if (e.target.checked) quantities[l.purchaseOrderLineItemId] = String(l.open);
                                  else delete quantities[l.purchaseOrderLineItemId];
                                  setForm({ ...form, quantities });
                                }} />
                            </td>
                            <td className={`${TD} whitespace-nowrap`}>{l.poNumber}{l.expectedDeliveryDate ? <span className="block text-xs text-slate-400">{t("Due")} {formatDate(l.expectedDeliveryDate)}</span> : null}</td>
                            <td className={TD}>{`${l.productCode ?? ""} ${l.productName ?? ""}`.trim()}</td>
                            <td className={`${TD} text-end`}>{l.ordered}</td>
                            <td className={`${TD} text-end`}>{l.open}{l.onShipments ? <span className="block text-xs text-slate-400">{t("{n} on other shipments", { n: l.onShipments })}</span> : null}</td>
                            <td className={TD}>
                              <input type="number" min={1} max={l.open} className={INPUT} disabled={!ticked} aria-label={t("On this shipment")} value={value ?? ""}
                                onChange={(e) => setForm({ ...form, quantities: { ...form.quantities, [l.purchaseOrderLineItemId]: e.target.value } })} />
                            </td>
                          </tr>
                        );
                      })
                    ) : (shown?.lines ?? []).map((l) => (
                      <tr key={l.purchaseOrderLineItemId}>
                        <td className={TD} />
                        <td className={TD}>{l.poNumber}</td>
                        <td className={TD}>{`${l.productCode ?? ""} ${l.productName ?? ""}`.trim()}</td>
                        <td className={TD} />
                        <td className={TD} />
                        <td className={`${TD} text-end`}>{l.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => (form.id && shown ? setForm(null) : show(null))}>{t("Close")}</button>
              <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={save}>
                {t(form.id ? "Save" : "Book the shipment")}{!form.id && vendorName(form.vendorId) ? ` · ${vendorName(form.vendorId)}` : ""}
              </button>
            </div>
          </div>
        )}

        {!form && shown && (
          <ShipmentDetail shipment={shown} busy={busy} canUpdate={canUpdate} canCreate={canCreate} warehouses={warehouses}
            onBack={() => show(null)} onEdit={() => edit(shown)}
            onMove={(status, date, note) => run(() => shipmentApi.move(shown.id, status, date || null, note || null), `${t(shipmentStatusLabel(status))}.`)}
            onCancel={(note) => run(() => shipmentApi.cancel(shown.id, note), "Shipment cancelled.")}
            onReceive={(body) => run(() => shipmentApi.receive(shown.id, body), "Received: goods receipts made.")}
            onLandedCost={() => navigate(`/purchase-service/landed-costs?shipment=${shown.id}`)}
            onDeclare={() => navigate(`/purchase-service/customs?shipment=${shown.id}`)}
            onOpenCustoms={() => navigate("/purchase-service/customs")} />
        )}
      </div>
    </>
  );
}

interface DetailProps {
  shipment: Shipment;
  busy: boolean;
  canUpdate: boolean;
  canCreate: boolean;
  warehouses: Named[];
  onBack: () => void;
  onEdit: () => void;
  onMove: (status: string, date: string, note: string) => Promise<boolean>;
  onCancel: (note: string) => Promise<boolean>;
  onReceive: (body: Parameters<typeof shipmentApi.receive>[1]) => Promise<boolean>;
  onLandedCost: () => void;
  onDeclare: () => void;
  onOpenCustoms: () => void;
}

function ShipmentDetail({ shipment: s, busy, canUpdate, canCreate, warehouses, onBack, onEdit, onMove, onCancel, onReceive, onLandedCost,
  onDeclare, onOpenCustoms }: DetailProps) {
  const next = NEXT_STEPS[s.status] ?? [];
  const [step, setStep] = useState(next[0] ?? "");
  const [stepDate, setStepDate] = useState(todayIso());
  const [stepNote, setStepNote] = useState("");
  const receivable = s.status === "ARRIVED" || s.status === "CLEARED";
  const [warehouseId, setWarehouseId] = useState("");
  const [receiptDate, setReceiptDate] = useState(todayIso());
  const [rows, setRows] = useState<Record<number, ReceiveRow>>({});

  useEffect(() => {
    setStep((NEXT_STEPS[s.status] ?? [])[0] ?? "");
    setStepNote("");
    setRows(Object.fromEntries(s.lines.filter((l) => l.open > 0).map((l) => [l.purchaseOrderLineItemId,
      { received: String(l.open), rejected: "0", batchNumber: "", expiryDate: "", serials: "" }])));
  }, [s]);

  const receive = async () => {
    if (!warehouseId) {
      ToasterService.error("Choose the warehouse the goods go into.");
      return;
    }
    const lines = Object.entries(rows).filter(([, r]) => Number(r.received) > 0).map(([id, r]) => ({
      purchaseOrderLineItemId: Number(id), receivedQuantity: Number(r.received), rejectedQuantity: Number(r.rejected) || 0,
      batchNumber: r.batchNumber.trim() || null, expiryDate: r.expiryDate || null,
      serialNumbers: r.serials.trim() ? r.serials.split(/[,\s]+/).filter(Boolean) : null, remarks: null,
    }));
    if (lines.length === 0) {
      ToasterService.error("Enter what was received.");
      return;
    }
    await onReceive({ receiptDate: receiptDate || null, warehouseId: Number(warehouseId), remarks: null, lines });
  };

  const cancel = async () => {
    const reason = window.prompt(t("Why is shipment {number} cancelled?", { number: s.shipmentNumber }));
    if (reason && reason.trim()) await onCancel(reason.trim());
  };

  const reached = (status: string) => s.events.find((e) => e.status === status);
  // Its customs declaration, if any
  const [entries, setEntries] = useState<Declaration[] | null>(null);
  useEffect(() => {
    customsApi.declarations(s.id).then(setEntries).catch(() => setEntries([]));
  }, [s]);
  const money = (v: number) => formatMoney(v, { currency: companyCurrency() });

  return (
    <div className={`${CARD} space-y-5 p-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Ship className="h-5 w-5 text-[rgb(var(--brand-600,0_151_167))]" />
          <h2 className={CARD_TITLE}>{t("Shipment")} {s.shipmentNumber}</h2>
          <StatusChip status={s.status} />
          {s.overdue && <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><AlertTriangle className="h-3.5 w-3.5" />{t("Overdue")}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {canUpdate && !["RECEIVED", "CANCELLED"].includes(s.status) && (
            <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={onEdit}><Pencil className="h-4 w-4" /> {t("Edit")}</button>
          )}
          {canUpdate && !["RECEIVED", "CANCELLED"].includes(s.status) && s.receipts.every((r) => r.status === "CANCELLED") && (
            <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={cancel}><XCircle className="h-4 w-4" /> {t("Cancel shipment")}</button>
          )}
          <button type="button" className={SECONDARY_BUTTON} onClick={onBack}>{t("Back to the list")}</button>
        </div>
      </div>

      <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-4 dark:text-gray-200">
        <div><span className={LABEL}>{t("Vendor")}</span>{s.vendorName}</div>
        <div><span className={LABEL}>{t("Mode")}</span>{t(statusLabel(s.mode))}{s.incoterm ? ` · ${s.incoterm}` : ""}</div>
        <div><span className={LABEL}>{t(DOC_LABEL[s.mode] ?? "Transport document")}</span>{s.transportDocument ?? "—"}</div>
        <div><span className={LABEL}>{t("Carrier")}</span>{[s.carrier, s.vesselVoyage].filter(Boolean).join(" · ") || "—"}</div>
        <div><span className={LABEL}>{t("Route")}</span>{[s.portOfLoading, s.portOfDischarge].filter(Boolean).join(" → ") || "—"}</div>
        <div><span className={LABEL}>{t("Country of origin")}</span>{s.originCountry ?? "—"}</div>
        <div><span className={LABEL}>{t("ETD / ETA")}</span>{formatDate(s.etd)} / {formatDate(s.eta)}</div>
        <div><span className={LABEL}>{t("Received")}</span>{s.receivedQuantity} / {s.totalQuantity}</div>
        {s.containers.length > 0 && (
          <div className="sm:col-span-2 lg:col-span-4"><span className={LABEL}>{t("Containers")}</span>
            {s.containers.map((c) => [c.containerNumber ?? t("LCL (shared)"), c.containerType, c.sealNumber ? `${t("seal")} ${c.sealNumber}` : null].filter(Boolean).join(" · ")).join("; ")}
          </div>
        )}
        {s.notes && <div className="sm:col-span-2 lg:col-span-4"><span className={LABEL}>{t("Notes")}</span>{s.notes}</div>}
      </div>

      {/* Timeline */}
      <ol className="flex flex-wrap items-start gap-2">
        {(s.status === "CANCELLED" ? [...SHIPMENT_FLOW.filter((x) => reached(x)), "CANCELLED"] : SHIPMENT_FLOW).map((status, i, all) => {
          const event = reached(status);
          return (
            <li key={status} className="flex items-start gap-2">
              <div className="flex min-w-[7rem] flex-col">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-gray-200">
                  {event ? (status === "CANCELLED" ? <XCircle className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />)
                    : <Circle className="h-4 w-4 text-slate-300" />}
                  {t(shipmentStatusLabel(status))}
                </span>
                <span className="ps-5 text-[11px] text-slate-500">{event ? formatDate(event.date) : ""}</span>
                {event?.note && <span className="ps-5 text-[11px] text-slate-400">{event.note}</span>}
              </div>
              {i < all.length - 1 && <span className="mt-2 h-px w-6 bg-slate-200 dark:bg-gray-700" />}
            </li>
          );
        })}
      </ol>

      {canUpdate && next.length > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-100 p-3 dark:border-gray-800">
          <div>
            <label className={LABEL} htmlFor="sh-step">{t("Next step")}</label>
            <select id="sh-step" className={INPUT} value={step} onChange={(e) => setStep(e.target.value)}>
              {next.map((n) => <option key={n} value={n}>{t(STEP_ACTION[n])}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="sh-step-date">{t("On")}</label>
            <input id="sh-step-date" type="date" className={INPUT} value={stepDate} max={todayIso()} onChange={(e) => setStepDate(e.target.value)} />
          </div>
          <div className="min-w-[14rem] flex-1">
            <label className={LABEL} htmlFor="sh-step-note">{t("Note")}</label>
            <input id="sh-step-note" className={INPUT} maxLength={500} value={stepNote} onChange={(e) => setStepNote(e.target.value)} />
          </div>
          <button type="button" className={PRIMARY_BUTTON} disabled={busy || !step} onClick={() => onMove(step, stepDate, stepNote)}>{t("Record")}</button>
        </div>
      )}

      <div>
        <span className={CARD_TITLE}>{t("What it carries")}</span>
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
          <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
            <thead className="bg-slate-50 dark:bg-[#222222]">
              <tr>
                <th className={TH}>{t("Order")}</th>
                <th className={TH}>{t("Product")}</th>
                <th className={`${TH} text-end`}>{t("Shipped")}</th>
                <th className={`${TH} text-end`}>{t("Received")}</th>
                {receivable && canCreate && <>
                  <th className={`${TH} w-24`}>{t("Receive now")}</th>
                  <th className={`${TH} w-24`}>{t("Rejected")}</th>
                  <th className={`${TH} w-32`}>{t("Batch")}</th>
                  <th className={`${TH} w-36`}>{t("Expiry")}</th>
                  <th className={`${TH} w-40`}>{t("Serials")}</th>
                </>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {s.lines.map((l) => {
                const r = rows[l.purchaseOrderLineItemId];
                const set = (patch: Partial<ReceiveRow>) => setRows({ ...rows, [l.purchaseOrderLineItemId]: { ...r, ...patch } });
                return (
                  <tr key={l.purchaseOrderLineItemId}>
                    <td className={`${TD} whitespace-nowrap`}>{l.poNumber}</td>
                    <td className={TD}>{`${l.productCode ?? ""} ${l.productName ?? ""}`.trim()}</td>
                    <td className={`${TD} text-end`}>{l.quantity}</td>
                    <td className={`${TD} text-end`}>{l.received}</td>
                    {receivable && canCreate && (r ? <>
                      <td className={TD}><input type="number" min={0} max={l.open} className={INPUT} aria-label={t("Receive now")} value={r.received} onChange={(e) => set({ received: e.target.value })} /></td>
                      <td className={TD}><input type="number" min={0} className={INPUT} aria-label={t("Rejected")} value={r.rejected} onChange={(e) => set({ rejected: e.target.value })} /></td>
                      <td className={TD}><input className={INPUT} maxLength={60} aria-label={t("Batch")} value={r.batchNumber} onChange={(e) => set({ batchNumber: e.target.value })} /></td>
                      <td className={TD}><input type="date" className={INPUT} aria-label={t("Expiry")} value={r.expiryDate} onChange={(e) => set({ expiryDate: e.target.value })} /></td>
                      <td className={TD}><input className={INPUT} aria-label={t("Serials")} placeholder={t("comma separated")} value={r.serials} onChange={(e) => set({ serials: e.target.value })} /></td>
                    </> : <td colSpan={5} className={`${TD} text-xs text-emerald-600`}>{t("All received")}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {receivable && canCreate && Object.keys(rows).length > 0 && (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div>
              <label className={LABEL} htmlFor="sh-wh">{t("Into warehouse")} *</label>
              <select id="sh-wh" className={INPUT} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                <option value="">{t("Choose…")}</option>
                {warehouses.filter((w) => w.active !== false).map((w) => <option key={w.id} value={String(w.id)}>{w.name || w.code}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="sh-rdate">{t("Receipt date")}</label>
              <input id="sh-rdate" type="date" className={INPUT} value={receiptDate} max={todayIso()} onChange={(e) => setReceiptDate(e.target.value)} />
            </div>
            <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={receive}><PackageCheck className="h-4 w-4" /> {t("Receive")}</button>
            <p className="w-full text-xs text-slate-500">{t("One goods receipt is made for each purchase order on the shipment; it goes into stock straight away.")}</p>
          </div>
        )}
        {!receivable && !["RECEIVED", "CANCELLED"].includes(s.status) && (
          <p className="mt-2 text-xs text-slate-500">{t("Goods are received from the shipment once it has arrived.")}</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div>
          <div className="flex items-center justify-between">
            <span className={CARD_TITLE}>{t("Customs")}</span>
            {canCreate && entries !== null && entries.length === 0 && ["ARRIVED", "CLEARED", "RECEIVED"].includes(s.status) && (
              <button type="button" className={SECONDARY_BUTTON} onClick={onDeclare}><Plus className="h-4 w-4" /> {t("Declare to customs")}</button>
            )}
          </div>
          <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-gray-200">
            {entries === null ? <li className="text-slate-400">{t("Loading...")}</li>
              : entries.length === 0 ? <li className="text-slate-400">{t(["ARRIVED", "CLEARED", "RECEIVED"].includes(s.status) ? "Not declared yet." : "Declared once it has arrived.")}</li>
                : entries.map((d) => (
                  <li key={d.id}>
                    <button type="button" className="text-start underline decoration-dotted hover:text-cyan-700" onClick={onOpenCustoms}>{d.entryNumber}</button>
                    {" · "}{t("duty")} {formatMoney(d.dutyAmount, { currency: companyCurrency() })} · {t("VAT")} {formatMoney(d.vatAmount, { currency: companyCurrency() })} · {t(d.status === "POSTED" ? "Posted" : "Draft")}
                  </li>
                ))}
          </ul>
        </div>
        <div>
          <span className={CARD_TITLE}>{t("Goods receipts")} ({s.receipts.length})</span>
          <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-gray-200">
            {s.receipts.length === 0 && <li className="text-slate-400">{t("None yet.")}</li>}
            {s.receipts.map((r) => (
              <li key={r.id} className={r.status === "CANCELLED" ? "text-slate-400 line-through" : ""}>{r.receiptNumber} · {r.poNumber} · {formatDate(r.receiptDate)}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className={CARD_TITLE}>{t("Landed costs")} ({s.landedCosts.length})</span>
            {canCreate && s.receipts.some((r) => r.status !== "CANCELLED") && (
              <button type="button" className={SECONDARY_BUTTON} onClick={onLandedCost}><Plus className="h-4 w-4" /> {t("Add freight, duty…")}</button>
            )}
          </div>
          <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-gray-200">
            {s.landedCosts.length === 0 && <li className="text-slate-400">{t("None yet.")}</li>}
            {s.landedCosts.map((v) => (
              <li key={v.id}>{v.voucherNumber} · {money(v.totalCharges)} · {t(v.status === "POSTED" ? "Posted" : "Draft")}</li>
            ))}
          </ul>
        </div>
      </div>

      <details className="text-xs text-slate-500">
        <summary className="cursor-pointer">{t("History")}</summary>
        <ul className="mt-2 space-y-1">
          {s.events.map((e, i) => (
            <li key={i}>{formatDate(e.date)} · {t(shipmentStatusLabel(e.status))}{e.note ? ` · ${e.note}` : ""} · {e.recordedBy ?? ""} {e.recordedAt ? `(${formatDateTime(e.recordedAt)})` : ""}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
