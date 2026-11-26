import { useState } from "react";
import { CalendarIcon, UserIcon } from "@heroicons/react/24/outline";
import { formatDate, companyCurrency } from "../../company/format";
import { formatMoney } from "../Dashboard/dashboardKit";
import { CreditChip, CustomerCredit, releaseActive } from "./dealCredit";
import { t } from "../../i18n/i18n";

// The pipeline board (backlog 8.3.4): one column per stage; dragging a card, or its "Move to" list, changes the stage.

export interface BoardDeal {
  id: number;
  dealName: string;
  amount?: number | null;
  currencyCode?: string | null;
  companyAmount?: number | null;
  stage: string;
  status?: string;
  expectedCloseDate?: string | null;
  closedOn?: string | null;
  lostReason?: string | null;
  lead?: { id: number; name: string } | null;
  customer?: { id: number; name?: string; customerName?: string } | null;
  owner?: string | null;
  ownerName?: string | null;
  creditReleasedAt?: string | null;
}

interface Props {
  deals: BoardDeal[];
  stages: { id: string; name: string }[];
  probabilityOf: (deal: BoardDeal) => number;
  // 8.4.16: the deal's customer credit (over the limit, overdue), for the card's chip
  creditOf?: (deal: BoardDeal) => CustomerCredit | undefined;
  canUpdate: boolean;
  updatingId: number | null;
  // Won asks for confirmation and Lost for the reason before the move is saved (the page decides)
  onMove: (deal: BoardDeal, stage: string) => void;
  onOpen: (deal: BoardDeal) => void;
}

const STAGE_ACCENT: Record<string, string> = {
  PROSPECTING: "border-t-blue-400",
  QUALIFIED: "border-t-cyan-500",
  NEGOTIATION: "border-t-amber-400",
  WON: "border-t-emerald-500",
  LOST: "border-t-rose-400",
};

const today = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};

const isOpenStage = (stage: string) => stage !== "WON" && stage !== "LOST";

// Earliest close date first; deals without one last
const byCloseDate = (a: BoardDeal, b: BoardDeal) =>
  (a.expectedCloseDate || "9999").localeCompare(b.expectedCloseDate || "9999") || a.dealName.localeCompare(b.dealName);

export default function DealsBoard({ deals, stages, probabilityOf, creditOf, canUpdate, updatingId, onMove, onOpen }: Props) {
  // The card being dragged (kept here, not only in the browser's drag data, so a drop always knows it)
  const [dragging, setDragging] = useState<BoardDeal | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const money = (value: number, currency?: string | null) => formatMoney(Number(value) || 0, currency || companyCurrency());
  const day = today();

  const drop = (stage: string) => {
    const deal = dragging;
    setDragging(null);
    setOverStage(null);
    if (deal && deal.stage !== stage) onMove(deal, stage);
  };

  return (
    // Columns side by side; on a narrow screen the board scrolls sideways
    <div className="overflow-x-auto pb-2" role="list" aria-label={t("Pipeline board")}>
      <div className="flex min-w-max gap-3 px-3 lg:min-w-0">
        {stages.map((stage) => {
          const cards = deals.filter((d) => d.stage === stage.id).sort(byCloseDate);
          // Cancelled deals stay in their column but aren't in its value
          const counted = cards.filter((d) => d.status !== "CANCELLED");
          const valued = counted.filter((d) => d.companyAmount != null);
          const total = valued.reduce((sum, d) => sum + Number(d.companyAmount), 0);
          const weighted = valued.reduce((sum, d) => sum + (Number(d.companyAmount) * probabilityOf(d)) / 100, 0);
          const unvalued = counted.filter((d) => d.companyAmount == null && d.amount != null && Number(d.amount) !== 0);
          const isOver = overStage === stage.id && dragging != null && dragging.stage !== stage.id;
          return (
            <section
              key={stage.id}
              role="listitem"
              aria-label={`${t(stage.name)}: ${cards.length}`}
              onDragOver={(e) => {
                if (!dragging) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overStage !== stage.id) setOverStage(stage.id);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverStage((s) => (s === stage.id ? null : s));
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(stage.id);
              }}
              className={`flex w-[264px] shrink-0 flex-col rounded-xl border border-t-4 bg-slate-50/80 transition-colors lg:w-auto lg:min-w-[200px] lg:flex-1 dark:bg-white/[0.03] ${
                STAGE_ACCENT[stage.id] ?? "border-t-slate-300"
              } ${isOver ? "border-cyan-400 bg-cyan-50/70 dark:bg-cyan-950/30" : "border-slate-200 dark:border-gray-800"}`}
            >
              <header className="border-b border-slate-200 px-3 py-2 dark:border-gray-800">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-gray-100">{t(stage.name)}</h3>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 shadow-sm dark:bg-gray-900 dark:text-gray-300">
                    {cards.length}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-slate-600 dark:text-gray-400">
                  {money(total)}
                  {isOpenStage(stage.id) && total > 0 && (
                    <span className="text-slate-400"> · {t("weighted")} {money(weighted)}</span>
                  )}
                </div>
                {unvalued.length > 0 && (
                  <div className="text-[11px] text-amber-700 dark:text-amber-400">
                    {t("+{count} without an exchange rate", { count: String(unvalued.length) })}
                  </div>
                )}
              </header>

              <div className="flex min-h-[120px] flex-1 flex-col gap-2 p-2">
                {cards.length === 0 && (
                  <p className="px-1 py-6 text-center text-xs text-slate-400">{t(canUpdate ? "Drop a deal here" : "No deals")}</p>
                )}
                {cards.map((deal) => {
                  const foreign = !!deal.currencyCode && deal.currencyCode !== companyCurrency();
                  const overdue = isOpenStage(deal.stage) && deal.status !== "CANCELLED" && !!deal.expectedCloseDate
                    && deal.expectedCloseDate.slice(0, 10) < day;
                  const party = deal.customer?.customerName || deal.customer?.name || deal.lead?.name || "";
                  return (
                    <article
                      key={deal.id}
                      draggable={canUpdate && updatingId !== deal.id}
                      onDragStart={(e) => {
                        setDragging(deal);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", String(deal.id));
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOverStage(null);
                      }}
                      className={`rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm transition dark:border-gray-700 dark:bg-gray-900 ${
                        canUpdate ? "cursor-grab active:cursor-grabbing" : ""
                      } ${dragging?.id === deal.id ? "opacity-50" : ""} ${updatingId === deal.id ? "opacity-60" : ""} ${
                        deal.status === "CANCELLED" ? "opacity-70" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onOpen(deal)}
                        className="block w-full text-start text-sm font-semibold text-slate-900 hover:text-cyan-700 hover:underline dark:text-gray-100"
                      >
                        {deal.dealName}
                      </button>
                      {party && (
                        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
                          <span className={`shrink-0 rounded px-1.5 py-px text-[10px] font-semibold ${deal.customer ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                            {t(deal.customer ? "Customer" : "Lead")}
                          </span>
                          <span className="truncate" title={party}>{party}</span>
                        </div>
                      )}
                      <div className="mt-1.5 flex items-baseline justify-between gap-2">
                        <span className="text-sm font-medium text-slate-800 dark:text-gray-200">
                          {deal.amount != null ? money(Number(deal.amount), deal.currencyCode) : "—"}
                        </span>
                        <span className="text-xs text-slate-500" title={t("Probability")}>{probabilityOf(deal)}%</span>
                      </div>
                      {foreign && deal.amount != null && (
                        <div className="text-[11px] text-slate-500">
                          {deal.companyAmount != null ? `≈ ${money(Number(deal.companyAmount))}` : t("No exchange rate")}
                        </div>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span className="inline-flex min-w-0 items-center gap-1" title={deal.owner || undefined}>
                          <UserIcon className="h-3 w-3 shrink-0" />
                          <span className="truncate">{deal.ownerName || deal.owner || t("Unassigned")}</span>
                        </span>
                        {isOpenStage(deal.stage) ? (
                          deal.expectedCloseDate && (
                            <span className={`inline-flex items-center gap-1 ${overdue ? "font-semibold text-rose-600" : ""}`}
                              title={overdue ? t("The expected close date has passed") : t("Expected close date")}>
                              <CalendarIcon className="h-3 w-3" />
                              {formatDate(deal.expectedCloseDate)}
                              {/* Not "overdue": in ar.ts that word means a payment is late */}
                              {overdue && ` · ${t("close date passed")}`}
                            </span>
                          )
                        ) : (
                          (deal.closedOn || deal.lostReason) && (
                            <span className="truncate" title={deal.lostReason || undefined}>
                              {[deal.closedOn ? formatDate(deal.closedOn) : null, deal.lostReason].filter(Boolean).join(" · ")}
                            </span>
                          )
                        )}
                        {deal.status === "CANCELLED" && (
                          <span className="rounded bg-slate-100 px-1.5 py-px font-semibold text-slate-600">{t("Cancelled")}</span>
                        )}
                        {creditOf && isOpenStage(deal.stage) && <CreditChip credit={creditOf(deal)} released={releaseActive(deal)} />}
                      </div>
                      {/* Without dragging (phones, keyboards): move it here */}
                      {canUpdate && (
                        <select
                          aria-label={`${t("Move to")}: ${deal.dealName}`}
                          value=""
                          disabled={updatingId === deal.id}
                          onChange={(e) => e.target.value && onMove(deal, e.target.value)}
                          className="mt-2 h-7 w-full rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0 text-[11px] leading-none text-slate-600 outline-none focus:border-cyan-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        >
                          <option value="">{t("Move to…")}</option>
                          {stages.filter((s) => s.id !== deal.stage).map((s) => (
                            <option key={s.id} value={s.id}>{t(s.name)}</option>
                          ))}
                        </select>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
