import { useEffect, useRef, useState } from "react";
import { ArrowTrendingDownIcon, CubeIcon, ExclamationTriangleIcon, TruckIcon } from "@heroicons/react/24/outline";
import { formatDate, formatMoney, formatNumber } from "../../company/format";
import { CheckResult, LineCheck } from "../../sales/quoteCheckApi";
import { t } from "../../i18n/i18n";

/**
 * Asks the server about the lines while the user types (stock, promise date, price list, margin floor), a moment after
 * the last change. key: what the check depends on (a change re-asks); ask: the call, or null when there is nothing to ask.
 * Failures leave the last answer (the server still checks when the quotation is saved).
 */
export function useLineCheck(key: string, ask: (() => Promise<CheckResult>) | null, delay = 450) {
  const [result, setResult] = useState<CheckResult | null>(null);
  const latest = useRef(ask);
  latest.current = ask;
  useEffect(() => {
    if (!latest.current) {
      setResult(null);
      return;
    }
    let alive = true;
    const timer = window.setTimeout(async () => {
      try {
        const answer = await latest.current?.();
        if (alive && answer) setResult(answer);
      } catch {
        // No rights or a service down: nothing extra to show
      }
    }, delay);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [key, delay]);
  return result;
}

const chip = "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium";
const good = "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
const warn = "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
const bad = "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300";
const plain = "bg-slate-100 text-slate-700 dark:bg-gray-800 dark:text-gray-300";

const qty = (value: number | null | undefined) => formatNumber(Number(value) || 0, 3);

/** The promise for the quantity asked, in words. */
export const promiseText = (line: LineCheck): string | null => {
  const stock = line.stock;
  if (!stock) return null;
  switch (stock.promise) {
    case "NOW":
      return t("Can deliver now");
    case "ON_DATE":
      return t("Can promise {date}", { date: formatDate(stock.promiseDate) });
    case "NO_DATE":
      return t("Covered only by goods with no date yet");
    default:
      return t("Short by {quantity}", { quantity: qty(stock.shortBy) });
  }
};

/** Under one quote or deal line: free stock per warehouse, goods coming, the promise date, and margin / price flags. */
export function LineInsight({ line, currency, compact = false }: { line?: LineCheck | null; currency?: string | null; compact?: boolean }) {
  if (!line) return null;
  const stock = line.stock;
  const promise = promiseText(line);
  const tone = !stock ? plain : stock.promise === "NOW" ? good : stock.promise === "SHORT" ? bad : warn;
  const coming = stock?.incoming ?? [];
  const money = (value: number | null) => (value == null ? "—" : formatMoney(value, { currency }));
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5" data-line-insight>
      {stock && (
        <>
          <span className={`${chip} ${tone}`} title={stock.warehouses.map((w) => `${w.warehouseCode ?? w.warehouseName}: ${qty(w.free)}`).join(" · ")}>
            <CubeIcon className="h-3 w-3" />
            {t("Free {quantity}", { quantity: qty(stock.free) })}
            {!compact && stock.warehouses.length > 0 && (
              <span className="font-normal opacity-80">
                {" ("}
                {stock.warehouses.slice(0, 3).map((w) => `${w.warehouseCode ?? w.warehouseName} ${qty(w.free)}`).join(" · ")}
                {stock.warehouses.length > 3 ? " …" : ""}
                {")"}
              </span>
            )}
          </span>
          {promise && <span className={`${chip} ${tone}`}>{promise}</span>}
          {coming.slice(0, compact ? 1 : 2).map((c, i) => (
            <span key={i} className={`${chip} ${c.late ? warn : plain}`} title={c.reference ?? undefined}>
              <TruckIcon className="h-3 w-3" />
              {c.expectedDate
                ? t("{quantity} due {date}", { quantity: qty(c.quantity), date: formatDate(c.expectedDate) })
                : t("{quantity} on order, no date", { quantity: qty(c.quantity) })}
              {c.late && <span className="font-semibold">{t("late")}</span>}
              {!compact && c.reference && <span className="font-normal opacity-70">{c.reference}</span>}
            </span>
          ))}
          {coming.length > (compact ? 1 : 2) && (
            <span className={`${chip} ${plain}`}>{t("+{count} more coming", { count: String(coming.length - (compact ? 1 : 2)) })}</span>
          )}
          {!stock.incomingKnown && <span className={`${chip} ${plain}`}>{t("Incoming goods unknown (purchase not reachable)")}</span>}
        </>
      )}
      {line.costShown && line.costKnown && (
        <span className={`${chip} ${line.belowFloor ? bad : good}`} data-margin>
          <ArrowTrendingDownIcon className="h-3 w-3" />
          {t("Cost {cost}", { cost: money(line.unitCost) })}
          {" · "}
          {t("Margin {percent}%", { percent: formatNumber(line.marginPercent ?? 0, 2) })}
          {line.floorPrice != null && (
            <span className="font-normal opacity-80"> · {t("Floor price {price}", { price: money(line.floorPrice) })}</span>
          )}
        </span>
      )}
      {line.costShown && !line.costKnown && stock && <span className={`${chip} ${plain}`}>{t("Cost not known yet")}</span>}
      {!line.costShown && line.belowFloor && (
        <span className={`${chip} ${bad}`} data-margin>
          <ExclamationTriangleIcon className="h-3 w-3" />
          {t("Below the margin floor: needs approval")}
        </span>
      )}
      {line.belowList && (
        <span className={`${chip} ${bad}`}>
          <ExclamationTriangleIcon className="h-3 w-3" />
          {t("Below the price list ({price}): needs approval", { price: money(line.listPrice) })}
        </span>
      )}
    </div>
  );
}

/** The lines' answer for a line by its position among those sent (1-based). */
export const lineAt = (result: CheckResult | null, position: number) => result?.lines.find((l) => l.line === position) ?? null;
