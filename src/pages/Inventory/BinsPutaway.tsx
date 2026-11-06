import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ArrowRightLeft, PackageOpen, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import { apiError as errorText } from "../../utils/apiError";
import { usePermissions } from "../../access/usePermissions";
import { formatDateTime } from "../../company/format";
import { CARD, CARD_TITLE, PAGE_BODY, PRIMARY_BUTTON, ROW_ICON_BUTTON, ROW_ICON_BUTTON_DANGER, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

const API = "/v1/api/inventory/bins";
const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:bg-slate-50 dark:border-gray-700 dark:bg-[#222222] dark:text-white";
const LABEL = "mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300";
const TH = "px-3 py-2 text-start text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400";
const TD = "px-3 py-2 align-top text-sm text-slate-700 dark:text-gray-200";
const TYPES: Record<string, string> = { STORAGE: "Storage", PICKING: "Picking", BULK: "Bulk / reserve", QUARANTINE: "Quarantine" };
const MOVE_TYPES: Record<string, string> = { PUTAWAY: "Put away", MOVE: "Moved", UNASSIGNED: "Back to unassigned", RELEASED: "Left the warehouse" };

interface Warehouse { id: number; code?: string; name?: string; active?: boolean; isActive?: boolean }
interface Product { id: number; productCode?: string; productName?: string }
interface Bin { id: number; warehouseId: number; code: string; description: string | null; zone: string | null; binType: string; capacity: number | null; pickSequence: number; active: boolean; units: number; products: number }
interface BinQuantity { binId: number; binCode: string; binType: string | null; quantity: number }
interface Placement { productId: number; onHand: number; inBins: number; unassigned: number; bins: BinQuantity[]; suggestedBinId: number | null; suggestedBinCode: string | null }
interface Movement { id: number; productId: number; fromBinCode: string | null; toBinCode: string | null; quantity: number; movementType: string; movedAt: string; movedBy: string | null; note: string | null }
interface WarehousePlacement { warehouseId: number; warehouseCode: string; warehouseName: string; onHand: number; unassigned: number; bins: BinQuantity[] }
type BinForm = { id: number | null; code: string; description: string; zone: string; binType: string; capacity: string; pickSequence: string; active: boolean };
type Move = { productId: number; fromBinId: number | null; max: number; toBinId: string; quantity: string; note: string };

const asArray = <T,>(data: unknown): T[] =>
  Array.isArray(data) ? (data as T[]) : Array.isArray((data as { content?: T[] })?.content) ? (data as { content: T[] }).content : [];
const isOpen = (w: Warehouse) => w.active !== false && w.isActive !== false;

/**
 * Bins and putaway (backlog 7.2.2 step 1): a warehouse's bins, what is still unassigned (received, not put away) and
 * where each product sits; putaway and bin-to-bin moves within the bins' capacity.
 */
export default function BinsPutaway() {
  const { canCreate, canUpdate, canDelete } = usePermissions("INVENTORY");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Record<number, Product>>({});
  const [warehouseId, setWarehouseId] = useState("");
  const [tab, setTab] = useState<"putaway" | "bins" | "find">("putaway");
  const [bins, setBins] = useState<Bin[] | null>(null);
  const [placements, setPlacements] = useState<Placement[] | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [binForm, setBinForm] = useState<BinForm | null>(null);
  const [move, setMove] = useState<Move | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    axios.get("/v1/api/inventory/warehouses").then((r) => {
      const list = asArray<Warehouse>(r.data);
      setWarehouses(list);
      const first = list.find(isOpen) ?? list[0];
      if (first) setWarehouseId((w) => w || String(first.id));
    }).catch(() => setWarehouses([]));
    axios.get("/v1/api/common/products").then((r) => {
      const map: Record<number, Product> = {};
      asArray<Product>(r.data).forEach((p) => { map[p.id] = p; });
      setProducts(map);
    }).catch(() => undefined);
  }, []);

  const load = useCallback(() => {
    if (!warehouseId) return;
    axios.get<Bin[]>(API, { params: { warehouseId } }).then((r) => setBins(r.data)).catch((err) => {
      setBins([]);
      ToasterService.error("Bins could not be loaded", errorText(err, "Is the inventory service running?"));
    });
    axios.get<Placement[]>(`${API}/placements`, { params: { warehouseId } }).then((r) => setPlacements(r.data)).catch(() => setPlacements([]));
    axios.get<Movement[]>(`${API}/movements`, { params: { warehouseId } }).then((r) => setMovements(r.data)).catch(() => setMovements([]));
  }, [warehouseId]);
  useEffect(load, [load]);

  const product = (id: number) => {
    const p = products[id];
    return p ? `${p.productCode ?? ""} ${p.productName ?? ""}`.trim() : `#${id}`;
  };
  const openBins = useMemo(() => (bins ?? []).filter((b) => b.active), [bins]);
  const unassigned = useMemo(() => (placements ?? []).filter((p) => p.unassigned > 0), [placements]);
  const warehouse = warehouses.find((w) => String(w.id) === warehouseId);

  const saveBin = async () => {
    if (!binForm) return;
    setBusy(true);
    try {
      const body = { warehouseId: Number(warehouseId), code: binForm.code, description: binForm.description || null, zone: binForm.zone || null,
        binType: binForm.binType, capacity: binForm.capacity ? Number(binForm.capacity) : null,
        pickSequence: binForm.pickSequence ? Number(binForm.pickSequence) : null, active: binForm.active };
      if (binForm.id) await axios.put(`${API}/${binForm.id}`, body); else await axios.post(API, body);
      ToasterService.success("Bin saved.");
      setBinForm(null);
      load();
    } catch (err) {
      ToasterService.error("The bin could not be saved", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const deleteBin = async (bin: Bin) => {
    if (!window.confirm(t("Delete bin {code}?", { code: bin.code }))) return;
    try {
      await axios.delete(`${API}/${bin.id}`);
      load();
    } catch (err) {
      ToasterService.error("The bin could not be deleted", errorText(err, "Please try again."));
    }
  };

  const saveMove = async () => {
    if (!move) return;
    setBusy(true);
    try {
      await axios.post(`${API}/moves`, { warehouseId: Number(warehouseId), productId: move.productId, fromBinId: move.fromBinId,
        toBinId: move.toBinId ? Number(move.toBinId) : null, quantity: Number(move.quantity), note: move.note || null });
      ToasterService.success(move.fromBinId == null ? "Put away." : "Moved.");
      setMove(null);
      load();
    } catch (err) {
      ToasterService.error("The stock could not be moved", errorText(err, "Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const startPutaway = (p: Placement) =>
    setMove({ productId: p.productId, fromBinId: null, max: p.unassigned, toBinId: p.suggestedBinId ? String(p.suggestedBinId) : "", quantity: String(p.unassigned), note: "" });

  return (
    <>
      <PageMeta title={t("Bins & Putaway")} description="Bin locations, putaway and where stock sits" />
      <PageBreadcrumb pageTitle="Bins & Putaway" />
      <div className={`${PAGE_BODY} space-y-4`}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem]">
            <label className={LABEL} htmlFor="bp-wh">{t("Warehouse")}</label>
            <select id="bp-wh" className={INPUT} value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setBinForm(null); setMove(null); }}>
              {warehouses.length === 0 && <option value="">{t("No warehouses")}</option>}
              {warehouses.map((w) => <option key={w.id} value={String(w.id)}>{w.code ? `${w.code} · ` : ""}{w.name}{isOpen(w) ? "" : ` (${t("inactive")})`}</option>)}
            </select>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm dark:border-gray-700 dark:bg-[#191919]">
            {(["putaway", "bins", "find"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setTab(k)}
                className={`rounded-md px-3 py-1.5 font-medium ${tab === k ? "bg-cyan-600 text-white" : "text-slate-600 dark:text-gray-300"}`}>
                {t(k === "putaway" ? "Putaway" : k === "bins" ? "Bins" : "Find a product")}
                {k === "putaway" && unassigned.length > 0 && <span className="ms-1 rounded-full bg-amber-100 px-1.5 text-[11px] text-amber-800">{unassigned.length}</span>}
              </button>
            ))}
          </div>
        </div>

        {warehouse && !isOpen(warehouse) && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{t("This warehouse is inactive: its stock can be seen but not moved.")}</p>
        )}

        {tab === "putaway" && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="border-b border-slate-100 px-4 py-3 dark:border-gray-800">
              <h2 className={CARD_TITLE}>{t("Waiting to be put away")}</h2>
              <p className="text-xs text-slate-500">{t("Received stock is unassigned until it is put into a bin. Goods leaving the warehouse come out of unassigned first.")}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="bg-slate-50 dark:bg-[#222222]">
                  <tr><th className={TH}>{t("Product")}</th><th className={`${TH} text-end`}>{t("On hand")}</th><th className={`${TH} text-end`}>{t("Unassigned")}</th><th className={TH}>{t("In bins")}</th><th className={TH} aria-label={t("Actions")} /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {placements === null ? <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                    : unassigned.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-400">{t("Everything here is in a bin.")}</td></tr>
                    : unassigned.map((p) => (
                      <tr key={p.productId}>
                        <td className={TD}>{product(p.productId)}</td>
                        <td className={`${TD} text-end`}>{p.onHand}</td>
                        <td className={`${TD} text-end font-semibold text-amber-700`}>{p.unassigned}</td>
                        <td className={TD}>{p.bins.length ? p.bins.map((b) => `${b.binCode} (${b.quantity})`).join(", ") : "—"}</td>
                        <td className={`${TD} text-end`}>
                          {canUpdate && openBins.length > 0 && warehouse && isOpen(warehouse) && (
                            <button type="button" className={SECONDARY_BUTTON} onClick={() => startPutaway(p)}><PackageOpen className="h-4 w-4" /> {t("Put away")}</button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {bins !== null && openBins.length === 0 && <p className="px-4 py-3 text-xs text-slate-500">{t("Add bins on the Bins tab to put stock away.")}</p>}
          </div>
        )}

        {tab === "bins" && (
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <div className={`${CARD} overflow-hidden`}>
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-gray-800">
                <h2 className={CARD_TITLE}>{t("Bins")}</h2>
                {canCreate && warehouseId && (
                  <button type="button" className={PRIMARY_BUTTON} onClick={() => setBinForm({ id: null, code: "", description: "", zone: "", binType: "STORAGE", capacity: "", pickSequence: "", active: true })}>
                    <Plus className="h-4 w-4" /> {t("Add a bin")}
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                  <thead className="bg-slate-50 dark:bg-[#222222]">
                    <tr><th className={TH}>{t("Bin")}</th><th className={TH}>{t("Zone")}</th><th className={TH}>{t("Type")}</th><th className={`${TH} text-end`}>{t("Pick order")}</th>
                      <th className={`${TH} text-end`}>{t("Units")}</th><th className={`${TH} text-end`}>{t("Capacity")}</th><th className={TH} aria-label={t("Actions")} /></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                    {bins === null ? <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">{t("Loading...")}</td></tr>
                      : bins.length === 0 ? <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">{t("No bins yet.")}</td></tr>
                      : bins.map((b) => (
                        <tr key={b.id} className={b.active ? "" : "opacity-60"}>
                          <td className={TD}><span className="font-mono font-medium">{b.code}</span>{!b.active && <span className="ms-1 text-xs text-slate-400">({t("closed")})</span>}
                            {b.description && <span className="block text-xs text-slate-400">{b.description}</span>}</td>
                          <td className={TD}>{b.zone ?? "—"}</td>
                          <td className={TD}>{t(TYPES[b.binType] ?? b.binType)}</td>
                          <td className={`${TD} text-end`}>{b.pickSequence}</td>
                          <td className={`${TD} text-end`}>{b.units}{b.products > 1 && <span className="block text-xs text-slate-400">{t("{count} products", { count: b.products })}</span>}</td>
                          <td className={`${TD} text-end`}>{b.capacity ?? "—"}</td>
                          <td className={`${TD} whitespace-nowrap text-end`}>
                            {canUpdate && <button type="button" className={ROW_ICON_BUTTON} title={t("Edit")} aria-label={t("Edit")} onClick={() => setBinForm({ id: b.id, code: b.code,
                              description: b.description ?? "", zone: b.zone ?? "", binType: b.binType, capacity: b.capacity ? String(b.capacity) : "", pickSequence: String(b.pickSequence), active: b.active })}><Pencil className="h-4 w-4" /></button>}
                            {canDelete && b.units === 0 && <button type="button" className={ROW_ICON_BUTTON_DANGER} title={t("Delete")} aria-label={t("Delete")} onClick={() => deleteBin(b)}><Trash2 className="h-4 w-4" /></button>}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <BinContents placements={placements ?? []} bins={bins ?? []} product={product}
                onMove={canUpdate && warehouse && isOpen(warehouse) ? (productId, bin) => setMove({ productId, fromBinId: bin.binId, max: bin.quantity, toBinId: "", quantity: String(bin.quantity), note: "" }) : undefined} />
            </div>
            {binForm && (
              <div className={`${CARD} space-y-3 p-4`}>
                <h2 className={CARD_TITLE}>{binForm.id ? `${t("Bin")} ${binForm.code}` : t("Add a bin")}</h2>
                <div><label className={LABEL} htmlFor="bf-code">{t("Code")} *</label>
                  <input id="bf-code" className={`${INPUT} uppercase`} maxLength={30} placeholder="A-01-03" value={binForm.code} onChange={(e) => setBinForm({ ...binForm, code: e.target.value })} /></div>
                <div><label className={LABEL} htmlFor="bf-desc">{t("Description")}</label>
                  <input id="bf-desc" className={INPUT} maxLength={100} value={binForm.description} onChange={(e) => setBinForm({ ...binForm, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={LABEL} htmlFor="bf-zone">{t("Zone")}</label>
                    <input id="bf-zone" className={`${INPUT} uppercase`} maxLength={30} value={binForm.zone} onChange={(e) => setBinForm({ ...binForm, zone: e.target.value })} /></div>
                  <div><label className={LABEL} htmlFor="bf-type">{t("Type")}</label>
                    <select id="bf-type" className={INPUT} value={binForm.binType} onChange={(e) => setBinForm({ ...binForm, binType: e.target.value })}>
                      {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}
                    </select></div>
                  <div><label className={LABEL} htmlFor="bf-cap">{t("Capacity (units)")}</label>
                    <input id="bf-cap" type="number" min="1" className={INPUT} placeholder={t("No limit")} value={binForm.capacity} onChange={(e) => setBinForm({ ...binForm, capacity: e.target.value })} /></div>
                  <div><label className={LABEL} htmlFor="bf-seq">{t("Pick order")}</label>
                    <input id="bf-seq" type="number" min="0" className={INPUT} placeholder={t("Next")} value={binForm.pickSequence} onChange={(e) => setBinForm({ ...binForm, pickSequence: e.target.value })} /></div>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-gray-200">
                  <input type="checkbox" checked={binForm.active} onChange={(e) => setBinForm({ ...binForm, active: e.target.checked })} /> {t("Open (stock can be put here)")}
                </label>
                <p className="text-[11px] text-slate-500">{t("Picking goes through bins in pick order, lowest first; quarantine bins are never suggested.")}</p>
                <div className="flex justify-end gap-2">
                  <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => setBinForm(null)}>{t("Cancel")}</button>
                  <button type="button" className={PRIMARY_BUTTON} disabled={busy} onClick={saveBin}><Save className="h-4 w-4" /> {t("Save")}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "find" && <FindProduct products={products} product={product} />}

        {movements.length > 0 && tab !== "find" && (
          <div className={`${CARD} overflow-hidden`}>
            <h2 className={`${CARD_TITLE} border-b border-slate-100 px-4 py-3 dark:border-gray-800`}>{t("Recent bin moves")}</h2>
            <div className="max-h-72 overflow-auto">
              <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
                <thead className="sticky top-0 bg-slate-50 dark:bg-[#222222]">
                  <tr><th className={TH}>{t("When")}</th><th className={TH}>{t("Product")}</th><th className={TH}>{t("Move")}</th><th className={`${TH} text-end`}>{t("Qty")}</th><th className={TH}>{t("By")}</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className={`${TD} whitespace-nowrap`}>{formatDateTime(m.movedAt)}</td>
                      <td className={TD}>{product(m.productId)}</td>
                      <td className={TD}>{t(MOVE_TYPES[m.movementType] ?? m.movementType)}: {m.fromBinCode ?? t("unassigned")} → {m.toBinCode ?? t(m.movementType === "RELEASED" ? "out" : "unassigned")}
                        {m.note && <span className="block text-xs text-slate-400">{m.note}</span>}</td>
                      <td className={`${TD} text-end`}>{m.quantity}</td>
                      <td className={TD}>{m.movedBy ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {move && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={t(move.fromBinId == null ? "Put away" : "Move stock")}>
          <div className={`${CARD} w-full max-w-md space-y-3 p-4`}>
            <h2 className={CARD_TITLE}>{t(move.fromBinId == null ? "Put away" : "Move stock")}: {product(move.productId)}</h2>
            <p className="text-xs text-slate-500">{move.fromBinId == null ? t("{count} unassigned", { count: move.max })
              : t("{count} in bin {bin}", { count: move.max, bin: bins?.find((b) => b.id === move.fromBinId)?.code ?? "" })}</p>
            <div><label className={LABEL} htmlFor="mv-to">{t("To bin")}</label>
              <select id="mv-to" className={INPUT} value={move.toBinId} onChange={(e) => setMove({ ...move, toBinId: e.target.value })}>
                <option value="">{move.fromBinId == null ? t("Choose…") : t("Back to unassigned")}</option>
                {openBins.filter((b) => b.id !== move.fromBinId).map((b) => (
                  <option key={b.id} value={String(b.id)}>{b.code} · {t(TYPES[b.binType] ?? b.binType)}{b.capacity != null ? ` · ${t("room for {count}", { count: Math.max(b.capacity - b.units, 0) })}` : ""}</option>
                ))}
              </select></div>
            <div><label className={LABEL} htmlFor="mv-qty">{t("Quantity")}</label>
              <input id="mv-qty" type="number" min="1" max={move.max} className={INPUT} value={move.quantity} onChange={(e) => setMove({ ...move, quantity: e.target.value })} /></div>
            <div><label className={LABEL} htmlFor="mv-note">{t("Note")}</label>
              <input id="mv-note" className={INPUT} maxLength={200} value={move.note} onChange={(e) => setMove({ ...move, note: e.target.value })} /></div>
            <div className="flex justify-end gap-2">
              <button type="button" className={SECONDARY_BUTTON} disabled={busy} onClick={() => setMove(null)}>{t("Cancel")}</button>
              <button type="button" className={PRIMARY_BUTTON} disabled={busy || (move.fromBinId == null && !move.toBinId)} onClick={saveMove}>
                <ArrowRightLeft className="h-4 w-4" /> {t(move.fromBinId == null ? "Put away" : "Move")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** What each bin holds, product by product, with a move button per line. */
function BinContents({ placements, bins, product, onMove }: {
  placements: Placement[]; bins: Bin[]; product: (id: number) => string; onMove?: (productId: number, bin: BinQuantity) => void;
}) {
  const rows = bins.flatMap((b) => placements.flatMap((p) => p.bins.filter((q) => q.binId === b.id).map((q) => ({ bin: b, productId: p.productId, q }))));
  if (rows.length === 0) return null;
  return (
    <div className="border-t border-slate-100 dark:border-gray-800">
      <h3 className="px-4 pt-3 text-sm font-semibold text-slate-700 dark:text-gray-200">{t("What the bins hold")}</h3>
      <table className="mt-2 min-w-full divide-y divide-slate-100 dark:divide-gray-800">
        <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
          {rows.map(({ bin, productId, q }) => (
            <tr key={`${bin.id}-${productId}`}>
              <td className={`${TD} font-mono`}>{bin.code}</td>
              <td className={TD}>{product(productId)}</td>
              <td className={`${TD} text-end`}>{q.quantity}</td>
              <td className={`${TD} text-end`}>{onMove && <button type="button" className={ROW_ICON_BUTTON} title={t("Move stock")} aria-label={t("Move stock")} onClick={() => onMove(productId, q)}><ArrowRightLeft className="h-4 w-4" /></button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Where a product sits in every warehouse. */
function FindProduct({ products, product }: { products: Record<number, Product>; product: (id: number) => string }) {
  const [productId, setProductId] = useState("");
  const [rows, setRows] = useState<WarehousePlacement[] | null>(null);
  const find = () => {
    if (!productId) return;
    axios.get<WarehousePlacement[]>(`${API}/locations`, { params: { productId } }).then((r) => setRows(r.data))
      .catch((err) => ToasterService.error("Locations could not be loaded", errorText(err, "Please try again.")));
  };
  const options = Object.values(products).sort((a, b) => (a.productCode ?? "").localeCompare(b.productCode ?? ""));
  return (
    <div className={`${CARD} space-y-3 p-4`}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[16rem] flex-1">
          <label className={LABEL} htmlFor="fp-product">{t("Product")}</label>
          <select id="fp-product" className={INPUT} value={productId} onChange={(e) => { setProductId(e.target.value); setRows(null); }}>
            <option value="">{t("Choose…")}</option>
            {options.map((p) => <option key={p.id} value={String(p.id)}>{product(p.id)}</option>)}
          </select>
        </div>
        <button type="button" className={PRIMARY_BUTTON} disabled={!productId} onClick={find}><Search className="h-4 w-4" /> {t("Find")}</button>
      </div>
      {rows !== null && (rows.length === 0 ? <p className="text-sm text-slate-500">{t("None in stock anywhere.")}</p> : (
        <table className="min-w-full divide-y divide-slate-100 dark:divide-gray-800">
          <thead className="bg-slate-50 dark:bg-[#222222]"><tr><th className={TH}>{t("Warehouse")}</th><th className={`${TH} text-end`}>{t("On hand")}</th><th className={`${TH} text-end`}>{t("Unassigned")}</th><th className={TH}>{t("Bins")}</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
            {rows.map((w) => (
              <tr key={w.warehouseId}>
                <td className={TD}>{w.warehouseCode} · {w.warehouseName}</td>
                <td className={`${TD} text-end`}>{w.onHand}</td>
                <td className={`${TD} text-end`}>{w.unassigned}</td>
                <td className={TD}>{w.bins.length ? w.bins.map((b) => `${b.binCode} (${b.quantity})`).join(", ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}
