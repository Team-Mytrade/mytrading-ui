import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Ban, CheckCheck, ClipboardList, Package, Plus, Printer, Trash2 } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { apiError as errorText } from "../../utils/apiError";
import { usePermissions } from "../../access/usePermissions";
import { formatDateTime, formatNumber } from "../../company/format";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

const API = "/v1/api/inventory/pick-lists";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";
const STATUS: Record<string, { label: string; tone: string }> = {
  OPEN: { label: "To pick", tone: "bg-amber-50 text-amber-700" },
  PICKED: { label: "Picked", tone: "bg-cyan-50 text-cyan-700" },
  PACKED: { label: "Packed", tone: "bg-indigo-50 text-indigo-700" },
  SHIPPED: { label: "Shipped", tone: "bg-emerald-50 text-emerald-700" },
  CANCELLED: { label: "Cancelled", tone: "bg-slate-100 text-slate-600" },
};
const PACKAGE_TYPES: Record<string, string> = { BOX: "Box", CARTON: "Carton", PALLET: "Pallet", CRATE: "Crate", BAG: "Bag" };

interface Warehouse { id: number; code?: string; name?: string; active?: boolean; isActive?: boolean }
interface Pending { dispatchId: number; dispatchNumber: string; salesOrderNumber: string | null; customerName: string | null; lines: number }
interface Line { productId: number; productCode: string | null; productName: string | null; quantity: number }
interface Task { index: number; productId: number; binId: number | null; binCode: string | null; quantity: number; picked: number }
interface Pkg { number: number; packageType: string; weightKg: number | null; lengthCm: number | null; widthCm: number | null; heightCm: number | null; contents: string | null }
interface PickList {
  id: number; pickNumber: string; warehouseCode: string | null; dispatchNumber: string; salesOrderNumber: string | null; customerName: string | null;
  status: string; createdDate: string | null; pickedAt: string | null; pickedBy: string | null; packedAt: string | null; packedBy: string | null;
  shippedAt: string | null; cancelReason: string | null; lines: Line[]; tasks: Task[]; packages: Pkg[]; totalWeightKg: number | null;
}
type PkgForm = { packageType: string; weightKg: string; lengthCm: string; widthCm: string; heightCm: string; contents: string };

const asArray = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : Array.isArray((data as { content?: T[] })?.content) ? (data as { content: T[] }).content : [];
const isOpen = (w: Warehouse) => w.active !== false && w.isActive !== false;
const num = (v: string) => (v.trim() === "" ? null : Number(v));
const blankPkg = (): PkgForm => ({ packageType: "BOX", weightKg: "", lengthCm: "", widthCm: "", heightCm: "", contents: "" });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

/**
 * Pick and pack (backlog 7.2.2 step 2): pick lists for draft sales dispatches, bin by bin in pick order; confirming
 * the picks takes the goods out of their bins until the dispatch is confirmed; then the packages they went into.
 */
export default function PickPack() {
  const { canCreate, canUpdate } = usePermissions("INVENTORY");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [lists, setLists] = useState<PickList[] | null>(null);
  const [shown, setShown] = useState<PickList | null>(null);
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [pkgs, setPkgs] = useState<PkgForm[]>([blankPkg()]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    axios.get("/v1/api/inventory/warehouses").then((r) => {
      const list = asArray<Warehouse>(r.data);
      setWarehouses(list);
      const first = list.find(isOpen) ?? list[0];
      if (first) setWarehouseId((w) => w || String(first.id));
    }).catch(() => setWarehouses([]));
  }, []);

  const load = useCallback(() => {
    if (!warehouseId) return;
    axios.get<PickList[]>(API, { params: { warehouseId } }).then((r) => setLists(r.data)).catch((err) => {
      setLists([]);
      ToasterService.error("Pick lists could not be loaded", errorText(err, "Is the inventory service running?"));
    });
    axios.get<Pending[]>(`${API}/pending-dispatches`, { params: { warehouseId } }).then((r) => setPending(r.data)).catch(() => setPending([]));
  }, [warehouseId]);
  useEffect(load, [load]);

  const open = (list: PickList) => {
    setShown(list);
    setPicks(Object.fromEntries(list.tasks.map((task) => [task.index, String(list.status === "OPEN" ? task.quantity : task.picked)])));
    setPkgs(list.packages.length ? list.packages.map((p) => ({ packageType: p.packageType, weightKg: p.weightKg != null ? String(p.weightKg) : "",
      lengthCm: p.lengthCm != null ? String(p.lengthCm) : "", widthCm: p.widthCm != null ? String(p.widthCm) : "",
      heightCm: p.heightCm != null ? String(p.heightCm) : "", contents: p.contents ?? "" })) : [blankPkg()]);
  };

  const run = async (request: () => Promise<{ data: PickList }>, done: string, failed: string) => {
    setBusy(true);
    try {
      const res = await request();
      ToasterService.success(done);
      open(res.data);
      load();
    } catch (err) {
      ToasterService.error(failed, errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const make = (d: Pending) => run(() => axios.post<PickList>(API, null, { params: { dispatchId: d.dispatchId } }),
    "Pick list made.", "The pick list could not be made");
  const confirmPicks = (list: PickList) => run(() => axios.post<PickList>(`${API}/${list.id}/pick`, {
    tasks: list.tasks.map((task) => ({ index: task.index, picked: Number(picks[task.index] ?? task.quantity) })),
  }), "Picks confirmed: the goods are out of their bins.", "The picks could not be confirmed");
  const savePacking = (list: PickList) => run(() => axios.post<PickList>(`${API}/${list.id}/pack`, {
    packages: pkgs.map((p) => ({ packageType: p.packageType, weightKg: num(p.weightKg), lengthCm: num(p.lengthCm), widthCm: num(p.widthCm),
      heightCm: num(p.heightCm), contents: p.contents.trim() || null })),
  }), "Packing saved.", "The packing could not be saved");
  const cancel = (list: PickList) => {
    const reason = window.prompt(t("Why is pick list {number} cancelled?", { number: list.pickNumber }));
    if (!reason?.trim()) return;
    run(() => axios.post<PickList>(`${API}/${list.id}/cancel`, { reason }), "Pick list cancelled.", "The pick list could not be cancelled");
  };

  const lineOf = (list: PickList, productId: number) => list.lines.find((l) => l.productId === productId);
  const productLabel = (l?: Line) => (l ? `${l.productCode ?? ""} ${l.productName ?? ""}`.trim() : "");

  const print = (list: PickList) => {
    const rows = list.tasks.map((task) => `<tr><td>${esc(task.binCode ?? t("Unassigned"))}</td><td>${esc(productLabel(lineOf(list, task.productId)))}</td><td class="n">${task.quantity}</td><td class="n">${list.status === "OPEN" ? "" : task.picked}</td></tr>`).join("");
    const packages = list.packages.map((p) => `<tr><td>${p.number}</td><td>${esc(t(PACKAGE_TYPES[p.packageType] ?? p.packageType))}</td><td class="n">${p.weightKg ?? ""}</td><td>${[p.lengthCm, p.widthCm, p.heightCm].every((v) => v != null) ? `${p.lengthCm} × ${p.widthCm} × ${p.heightCm}` : ""}</td><td>${esc(p.contents)}</td></tr>`).join("");
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    w.document.write(`<!doctype html><html dir="${document.documentElement.dir || "ltr"}"><head><meta charset="utf-8"><title>${esc(list.pickNumber)}</title>
      <style>body{font:13px system-ui,sans-serif;margin:24px;color:#111}h1{font-size:18px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:12px}
      th,td{border:1px solid #ccc;padding:6px;text-align:start}td.n{text-align:end}p{margin:2px 0;color:#444}</style></head><body>
      <h1>${esc(t(list.packages.length ? "Packing list" : "Pick list"))} ${esc(list.pickNumber)}</h1>
      <p>${esc(t("Dispatch"))} ${esc(list.dispatchNumber)} · ${esc(list.salesOrderNumber)} · ${esc(list.customerName)} · ${esc(list.warehouseCode)}</p>
      <table><thead><tr><th>${esc(t("Bin"))}</th><th>${esc(t("Product"))}</th><th>${esc(t("To pick"))}</th><th>${esc(t("Picked"))}</th></tr></thead><tbody>${rows}</tbody></table>
      ${packages ? `<table><thead><tr><th>#</th><th>${esc(t("Package"))}</th><th>${esc(t("Weight (kg)"))}</th><th>${esc(t("Size (cm)"))}</th><th>${esc(t("Contents"))}</th></tr></thead><tbody>${packages}</tbody></table>` : ""}
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <>
      <PageMeta title={t("Pick & Pack")} description="Pick lists and packing for sales dispatches" />
      <PageBreadcrumb pageTitle="Pick & Pack" />
      <div className={`${PAGE_BODY} space-y-4`}>
        <div className="min-w-[14rem] max-w-sm">
          <label className={LABEL} htmlFor="pp-wh">{t("Warehouse")}</label>
          <select id="pp-wh" className={INPUT} value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setShown(null); }}>
            {warehouses.map((w) => <option key={w.id} value={String(w.id)}>{w.code ? `${w.code} · ` : ""}{w.name}{isOpen(w) ? "" : ` (${t("inactive")})`}</option>)}
          </select>
        </div>

        {!shown && (
          <>
            <div className={`${CARD} overflow-hidden`}>
              <div className="border-b border-slate-100 px-4 py-3 dark:border-gray-800">
                <h2 className={CARD_TITLE}>{t("Dispatches to pick")}</h2>
                <p className="text-xs text-slate-500">{t("Draft dispatches from this warehouse. A dispatch with a pick list can only be confirmed once it is picked; one without ships as before.")}</p>
              </div>
              <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-[#222222]"><tr><th className={TH}>{t("Dispatch")}</th><th className={TH}>{t("Customer")}</th><th className={`${TH} text-end`}>{t("Products")}</th><th className={TH} /></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {pending === null ? <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                    : pending.length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-400">{t("No draft dispatches waiting to be picked.")}</td></tr>
                    : pending.map((d) => (
                      <tr key={d.dispatchId}>
                        <td className={TD}><span className="font-medium">{d.dispatchNumber}</span><span className="block text-xs text-slate-400">{d.salesOrderNumber}</span></td>
                        <td className={TD}>{d.customerName}</td>
                        <td className={`${TD} text-end`}>{d.lines}</td>
                        <td className={`${TD} text-end`}>{canCreate && d.lines > 0 && <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => make(d)}><ClipboardList className="h-4 w-4" /> {t("Make pick list")}</button>}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            <div className={`${CARD} overflow-hidden`}>
              <h2 className={`${CARD_TITLE} border-b border-slate-100 px-4 py-3 dark:border-gray-800`}>{t("Pick lists")}</h2>
              <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-[#222222]"><tr><th className={TH}>{t("Pick list")}</th><th className={TH}>{t("Dispatch")}</th><th className={TH}>{t("Customer")}</th><th className={TH}>{t("Status")}</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {lists === null ? <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                    : lists.length === 0 ? <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-400">{t("No pick lists yet.")}</td></tr>
                    : lists.map((l) => (
                      <tr key={l.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-[#222222]" onClick={() => open(l)}>
                        <td className={`${TD} font-medium text-cyan-700`}>{l.pickNumber}</td>
                        <td className={TD}>{l.dispatchNumber}</td>
                        <td className={TD}>{l.customerName}</td>
                        <td className={TD}><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[l.status]?.tone}`}>{t(STATUS[l.status]?.label ?? l.status)}</span></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {shown && (
          <div className={`${CARD} space-y-4 p-4`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={`${CARD_TITLE} flex items-center gap-2`}>{t("Pick list")} {shown.pickNumber}
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[shown.status]?.tone}`}>{t(STATUS[shown.status]?.label ?? shown.status)}</span></h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={SECONDARY_BUTTON} onClick={() => print(shown)}><Printer className="h-4 w-4" /> {t(shown.packages.length ? "Print packing list" : "Print pick list")}</button>
                {canUpdate && ["OPEN", "PICKED", "PACKED"].includes(shown.status) && <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => cancel(shown)}><Ban className="h-4 w-4" /> {t("Cancel")}</button>}
                <button type="button" className={SECONDARY_BUTTON} onClick={() => setShown(null)}>{t("Back to the list")}</button>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-gray-300">
              {t("Dispatch")} {shown.dispatchNumber} · {shown.salesOrderNumber} · {shown.customerName}
              {shown.pickedAt && <> · {t("Picked")} {formatDateTime(shown.pickedAt)} ({shown.pickedBy})</>}
              {shown.shippedAt && <> · {t("Shipped")} {formatDateTime(shown.shippedAt)}</>}
              {shown.cancelReason && <> · {t("Cancelled")}: {shown.cancelReason}</>}
            </p>

            <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-gray-800">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-[#222222]"><tr><th className={TH}>{t("Bin")}</th><th className={TH}>{t("Product")}</th><th className={`${TH} text-end`}>{t("To pick")}</th><th className={`${TH} w-32 text-end`}>{t("Picked")}</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {shown.tasks.map((task) => (
                    <tr key={task.index}>
                      <td className={`${TD} font-mono`}>{task.binCode ?? <span className="font-sans text-amber-700">{t("Unassigned")}</span>}</td>
                      <td className={TD}>{productLabel(lineOf(shown, task.productId))}</td>
                      <td className={`${TD} text-end`}>{task.quantity}</td>
                      <td className={`${TD} text-end`}>
                        {shown.status === "OPEN" && canUpdate
                          ? <input type="number" min="0" max={task.quantity} className={`${INPUT} text-end`} aria-label={t("Picked")} value={picks[task.index] ?? ""} onChange={(e) => setPicks({ ...picks, [task.index]: e.target.value })} />
                          : shown.status === "OPEN" ? "—" : task.picked}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown.status === "OPEN" && canUpdate && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="text-xs text-slate-500">{t("Every product must be picked in full; if a bin runs short, take the rest from another line's bin.")}</span>
                <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={() => confirmPicks(shown)}><CheckCheck className="h-4 w-4" /> {t("Confirm picks")}</button>
              </div>
            )}

            {["PICKED", "PACKED", "SHIPPED"].includes(shown.status) && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">{t("Packages")}{shown.totalWeightKg != null && <span className="ms-2 text-xs font-normal text-slate-500">{t("Total {weight} kg", { weight: formatNumber(shown.totalWeightKg, 3) })}</span>}</h3>
                {(shown.status === "SHIPPED" || !canUpdate) ? (
                  shown.packages.length === 0 ? <p className="text-sm text-slate-500">{t("Not packed.")}</p> : (
                    <ul className="text-sm text-slate-700 dark:text-gray-200">
                      {shown.packages.map((p) => <li key={p.number}>{p.number}. {t(PACKAGE_TYPES[p.packageType] ?? p.packageType)}{p.weightKg != null ? ` · ${p.weightKg} kg` : ""}{p.contents ? ` · ${p.contents}` : ""}</li>)}
                    </ul>
                  )
                ) : (
                  <>
                    {pkgs.map((p, i) => (
                      <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 p-2 sm:grid-cols-7 dark:border-gray-800">
                        <select className={INPUT} aria-label={t("Package")} value={p.packageType} onChange={(e) => setPkgs(pkgs.map((x, j) => (j === i ? { ...x, packageType: e.target.value } : x)))}>
                          {Object.entries(PACKAGE_TYPES).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                        </select>
                        {(["weightKg", "lengthCm", "widthCm", "heightCm"] as const).map((k) => (
                          <input key={k} type="number" min="0" step="any" className={INPUT} aria-label={t(k === "weightKg" ? "Weight (kg)" : k === "lengthCm" ? "Length (cm)" : k === "widthCm" ? "Width (cm)" : "Height (cm)")}
                            placeholder={t(k === "weightKg" ? "kg" : k === "lengthCm" ? "L cm" : k === "widthCm" ? "W cm" : "H cm")} value={p[k]} onChange={(e) => setPkgs(pkgs.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
                        ))}
                        <input className={`${INPUT} sm:col-span-1`} maxLength={300} aria-label={t("Contents")} placeholder={t("Contents")} value={p.contents} onChange={(e) => setPkgs(pkgs.map((x, j) => (j === i ? { ...x, contents: e.target.value } : x)))} />
                        <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Remove")} aria-label={t("Remove")} disabled={pkgs.length === 1} onClick={() => setPkgs(pkgs.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <div className="flex flex-wrap justify-between gap-2">
                      <button type="button" className={SECONDARY_BUTTON} onClick={() => setPkgs([...pkgs, blankPkg()])}><Plus className="h-4 w-4" /> {t("Add a package")}</button>
                      <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={() => savePacking(shown)}><Package className="h-4 w-4" /> {t("Save packing")}</button>
                    </div>
                    <p className="text-xs text-slate-500">{t("The goods ship when the dispatch is confirmed in Sales.")}</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
