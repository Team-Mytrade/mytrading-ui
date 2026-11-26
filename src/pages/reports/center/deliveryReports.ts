// Delivery cost and failed deliveries (backlog DEL-4): the delivery-service report for a period, and each vehicle's cost
// from finance (expenses charged to the vehicle's cost centre), read with the person's own rights. Labels have their
// Arabic here (English wording is the key), so the shared dictionary stays untouched.
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { language, t } from "../../../i18n/i18n";
import { BOOKS_API } from "./booksShared";
import { Period } from "./reportKit";

export interface DeliveryRow {
  key: string;
  label: string;
  costCentreId?: number | null;
  trips: number;
  distanceKm: number;
  delivered: number;
  partial: number;
  failed: number;
  failedPercent: number;
}

export interface FailedDelivery {
  deliveryOrderId: number;
  number: string;
  at?: string | null;
  status: "RETURNED" | "CANCELLED";
  reason: string;
  customerId?: number | null;
  customerName?: string | null;
  vehicleId?: number | null;
  vehiclePlate?: string | null;
  driver: string;
  route: string;
  salesOrderId?: number | null;
  redeliveredBy?: string | null;
}

export interface DeliveryReport {
  from: string;
  to: string;
  summary: { trips: number; distanceKm: number; delivered: number; partial: number; failed: number; failedPercent: number; withProof: number; redelivered: number };
  vehicles: DeliveryRow[];
  drivers: DeliveryRow[];
  routes: DeliveryRow[];
  customers: DeliveryRow[];
  reasons: { reason: string; count: number; percent: number }[];
  failed: FailedDelivery[];
}

/** The period's delivery report, and the expenses per cost centre ("C<id>" → amount; null when finance can't be read). */
export const useDeliveryReport = (period: Period) => {
  const [report, setReport] = useState<DeliveryReport | null>(null);
  const [costs, setCosts] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [deliveries, expenses] = await Promise.allSettled([
      axios.get<DeliveryReport>("/v1/api/delivery/reports/deliveries", { params: { from: period.from, to: period.to }, skipSessionExpiredHandling: true } as object),
      axios.get<{ rows: { key: string; amount: number }[] }>(`${BOOKS_API}/expenses`, {
        params: { from: period.from, to: period.to, groupBy: "COST_CENTRE" },
        skipSessionExpiredHandling: true,
      } as object),
    ]);
    if (deliveries.status === "fulfilled") {
      setReport(deliveries.value.data);
    } else {
      setReport(null);
      const err = deliveries.reason as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? tr("Could not load the delivery report"));
    }
    setCosts(expenses.status === "fulfilled" && Array.isArray(expenses.value.data?.rows)
      ? Object.fromEntries(expenses.value.data.rows.map((r) => [r.key, Number(r.amount) || 0]))
      : null);
    setLoading(false);
  }, [period.from, period.to]);

  useEffect(() => {
    load();
  }, [load]);

  return { report, costs, loading, error };
};

/** A vehicle's cost in the period: its cost centre's expenses (undefined without a cost centre or finance rights). */
export const vehicleCost = (row: DeliveryRow, costs: Record<string, number> | null) =>
  costs && row.costCentreId != null ? costs[`C${row.costCentreId}`] ?? 0 : undefined;

export const ended = (r: { delivered: number; partial: number; failed: number }) => r.delivered + r.partial + r.failed;

const AR: Record<string, string> = {
  Delivery: "التوصيل",
  "Delivery Cost": "تكلفة التوصيل",
  "Failed Deliveries": "التوصيلات الفاشلة",
  "Trips, kilometres and deliveries per vehicle, with each vehicle's running cost per delivery and per km.":
    "الرحلات والكيلومترات والتوصيلات لكل مركبة، مع تكلفة تشغيل كل مركبة لكل توصيلة ولكل كم.",
  "Deliveries returned or cancelled on the road, by reason, driver, route, customer and vehicle, and whether they went out again.":
    "التوصيلات المرتجعة أو الملغاة على الطريق، حسب السبب والسائق والمسار والعميل والمركبة، وهل أُعيد إرسالها.",
  "Trips, cost and failed deliveries of your own fleet": "الرحلات والتكلفة والتوصيلات الفاشلة لأسطولك",
  "By vehicle": "حسب المركبة",
  "By driver": "حسب السائق",
  "By route": "حسب المسار",
  "By customer": "حسب العميل",
  "By reason": "حسب السبب",
  Vehicle: "المركبة",
  Driver: "السائق",
  Route: "المسار",
  Customer: "العميل",
  Reason: "السبب",
  Trips: "الرحلات",
  Km: "كم",
  km: "كم",
  Distance: "المسافة",
  Deliveries: "التوصيلات",
  Delivered: "تم التسليم",
  Partly: "جزئي",
  Failed: "فشل",
  "Failed %": "نسبة الفشل",
  Cost: "التكلفة",
  "Cost / delivery": "التكلفة / توصيلة",
  "Cost / km": "التكلفة / كم",
  "Fleet cost": "تكلفة الأسطول",
  "Cost per delivery": "التكلفة لكل توصيلة",
  "Expenses on the vehicles' cost centres": "المصروفات على مراكز تكلفة المركبات",
  "Delivered or part delivered": "مسلّمة كليًا أو جزئيًا",
  "With proof of delivery": "مع إثبات التسليم",
  "Returned, or cancelled on the road": "مرتجعة أو ملغاة على الطريق",
  "Sent again": "أُعيد إرسالها",
  "Re-delivery cost (estimate)": "تكلفة إعادة التسليم (تقديرية)",
  "Failed deliveries × the vehicle's cost per delivery": "التوصيلات الفاشلة × تكلفة التوصيلة للمركبة",
  "Delivery order": "أمر التوصيل",
  Date: "التاريخ",
  "Sent again on": "أُعيد إرسالها في",
  "Not yet": "ليس بعد",
  "Top reasons": "أهم الأسباب",
  "Cost per delivery by vehicle": "التكلفة لكل توصيلة حسب المركبة",
  "Nothing in this period": "لا شيء في هذه الفترة",
  "Loading…": "جارٍ التحميل…",
  "No cost centre": "بلا مركز تكلفة",
  "Cost centre": "مركز التكلفة",
  "Charge this vehicle's fuel, repairs and driver costs to its cost centre: the Delivery Cost report shows them per delivery and per km.":
    "حمّل الوقود والإصلاحات وتكاليف السائق لهذه المركبة على مركز تكلفتها: يعرضها تقرير تكلفة التوصيل لكل توصيلة ولكل كم.",
  "Costs need the Finance view right; trips and deliveries still show.": "التكاليف تحتاج صلاحية عرض المالية؛ وتظهر الرحلات والتوصيلات.",
  "Set each vehicle's cost centre (Vehicles page) and charge its fuel, repairs and driver costs to it; the cost here is what that cost centre's expense accounts took in the period.":
    "حدّد مركز التكلفة لكل مركبة (صفحة المركبات) وحمّل عليه الوقود والإصلاحات وتكاليف السائق؛ والتكلفة هنا هي ما سجّلته حسابات المصروفات لذلك المركز في الفترة.",
  "A delivery counts in the period its last status changed in. Failed: returned, or cancelled on the road with a reason. Sent again: a later delivery order for the same sales order.":
    "تُحتسب التوصيلة في الفترة التي تغيّرت فيها حالتها الأخيرة. الفاشلة: مرتجعة أو ملغاة على الطريق مع سبب. أُعيد إرسالها: أمر توصيل لاحق لأمر البيع نفسه.",
  "Could not load the delivery report": "تعذر تحميل تقرير التوصيل",
  "Not recorded": "غير مسجل",
  "No route": "بلا مسار",
  "No vehicle": "بلا مركبة",
  "No reason given": "لم يُذكر سبب",
  Returned: "مرتجعة",
  Cancelled: "ملغاة",
  Status: "الحالة",
  Total: "الإجمالي",
};

/** The text in the screen language (this report's Arabic first, then the shared dictionary). */
export const tr = (text: string, vars?: Record<string, string | number>): string => {
  const own = language() === "ar" ? AR[text] : undefined;
  if (!own) return t(text, vars);
  return vars ? own.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : own;
};
