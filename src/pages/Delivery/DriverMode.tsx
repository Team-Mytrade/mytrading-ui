import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  LogOutIcon,
  MapPinIcon,
  NavigationIcon,
  PackageIcon,
  PlayIcon,
  RefreshCwIcon,
  SquareIcon,
  TruckIcon,
  WifiOffIcon,
  XIcon,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import { AuthContext } from "../../context/AuthContext";
import { DeliveryOrder, DeliveryStatus, StatusBadge, apiError, formatDateTime } from "./deliveryShared";
import { DRIVER_API, DriverVehicle, LocationPoint, Trip, directionsUrl, timeAgo } from "./trackingApi";

// Driver Mode: the driver's phone shares the vehicle's location during a trip and updates deliveries.
// Browsers only give GPS to HTTPS pages (or localhost) and pause it when the page is in the background,
// so the screen is kept awake and the page asks the driver to keep it open.

const RECORD_EVERY_MS = 10_000;   // at most one fix per 10 s ...
const RECORD_MIN_MOVE_M = 25;     // ... unless the vehicle moved 25 m
const SEND_EVERY_MS = 15_000;
const SEND_BATCH = 100;
const MAX_QUEUE = 500;
const DELIVERIES_REFRESH_MS = 60_000;
const queueKey = (tripId: number) => `driverLocationQueue:${tripId}`;

type GpsState = "idle" | "watching" | "denied" | "unavailable";

interface StatusAction {
  order: DeliveryOrder;
  status: DeliveryStatus;
}

const ACTION_LABEL: Partial<Record<DeliveryStatus, string>> = {
  IN_TRANSIT: "Start delivery",
  DELIVERED: "Delivered",
  PARTIAL: "Partly delivered",
  RETURNED: "Not delivered",
};

const metresBetween = (a: LocationPoint, b: LocationPoint) => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
};

const readQueue = (tripId: number): LocationPoint[] => {
  try {
    return JSON.parse(localStorage.getItem(queueKey(tripId)) ?? "[]");
  } catch {
    return [];
  }
};

const writeQueue = (tripId: number, queue: LocationPoint[]) => {
  try {
    if (queue.length) localStorage.setItem(queueKey(tripId), JSON.stringify(queue));
    else localStorage.removeItem(queueKey(tripId));
  } catch {
    /* storage unavailable: the queue still lives in memory */
  }
};

const DriverMode: React.FC = () => {
  const { user, logout } = useContext(AuthContext);
  const secure = typeof window !== "undefined" && window.isSecureContext;
  const hasGps = typeof navigator !== "undefined" && "geolocation" in navigator;

  const [vehicles, setVehicles] = useState<DriverVehicle[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [gps, setGps] = useState<GpsState>("idle");
  const [lastFix, setLastFix] = useState<LocationPoint | null>(null);
  const [pending, setPending] = useState(0);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [sendFailing, setSendFailing] = useState(false);
  const [wasHidden, setWasHidden] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [action, setAction] = useState<StatusAction | null>(null);
  const [remarks, setRemarks] = useState("");
  const [reason, setReason] = useState("");
  const [, setTick] = useState(0);

  const watchIdRef = useRef<number | null>(null);
  const queueRef = useRef<LocationPoint[]>([]);
  const lastRecordedRef = useRef<LocationPoint | null>(null);
  const tripRef = useRef<Trip | null>(null);
  const sendingRef = useRef(false);
  const wakeLockRef = useRef<any>(null);

  // ================= Data =================

  const loadDeliveries = useCallback(async (forVehicle?: string) => {
    try {
      const { data } = await axios.get<DeliveryOrder[]>(`${DRIVER_API}/deliveries`, {
        params: forVehicle ? { vehicleId: forVehicle } : {},
      });
      setDeliveries(data);
    } catch (err) {
      setError(apiError(err, "Could not load your deliveries"));
    }
  }, []);

  const loadVehicles = useCallback(async () => {
    const { data } = await axios.get<DriverVehicle[]>(`${DRIVER_API}/vehicles`);
    setVehicles(data);
    return data;
  }, []);

  // ================= Location sharing =================

  const flush = useCallback(async () => {
    const current = tripRef.current;
    if (!current || sendingRef.current || queueRef.current.length === 0) return;
    sendingRef.current = true;
    const batch = queueRef.current.slice(0, SEND_BATCH);
    try {
      const { data } = await axios.post<Trip>(`${DRIVER_API}/trips/${current.id}/locations`, { points: batch });
      queueRef.current = queueRef.current.slice(batch.length);
      writeQueue(current.id, queueRef.current);
      setPending(queueRef.current.length);
      setTrip(data);
      tripRef.current = data;
      setLastSentAt(Date.now());
      setSendFailing(false);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        // Ended elsewhere (e.g. by a dispatcher)
        stopWatching();
        writeQueue(current.id, []);
        queueRef.current = [];
        setPending(0);
        setTrip(null);
        tripRef.current = null;
        setNotice("This trip was ended. Start a new trip to keep sharing your location.");
      } else {
        setSendFailing(true);
      }
    } finally {
      sendingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPosition = useCallback(
    (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy, speed, heading } = position.coords;
      const point: LocationPoint = {
        latitude,
        longitude,
        accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : undefined,
        speedKmh: speed != null && Number.isFinite(speed) ? Math.round(speed * 3.6 * 10) / 10 : undefined,
        heading: heading != null && Number.isFinite(heading) ? Math.round(heading) : undefined,
        timestamp: position.timestamp || Date.now(),
      };
      setGps("watching");
      setLastFix(point);
      const previous = lastRecordedRef.current;
      if (previous && point.timestamp - previous.timestamp < RECORD_EVERY_MS && metresBetween(previous, point) < RECORD_MIN_MOVE_M) {
        return;
      }
      lastRecordedRef.current = point;
      queueRef.current = [...queueRef.current, point].slice(-MAX_QUEUE);
      if (tripRef.current) writeQueue(tripRef.current.id, queueRef.current);
      setPending(queueRef.current.length);
      if (queueRef.current.length >= 10) flush();
    },
    [flush]
  );

  const onPositionError = useCallback((err: GeolocationPositionError) => {
    setGps(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable");
  }, []);

  const requestWakeLock = useCallback(async () => {
    try {
      wakeLockRef.current = await (navigator as any).wakeLock?.request("screen");
    } catch {
      /* not supported or refused: the driver keeps the screen on */
    }
  }, []);

  const startWatching = useCallback(
    (current: Trip) => {
      tripRef.current = current;
      queueRef.current = readQueue(current.id);
      setPending(queueRef.current.length);
      if (!secure || !hasGps) return;
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onPositionError, {
        enableHighAccuracy: true,
        maximumAge: 5_000,
        timeout: 30_000,
      });
      requestWakeLock();
    },
    [secure, hasGps, onPosition, onPositionError, requestWakeLock]
  );

  const stopWatching = () => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    wakeLockRef.current?.release?.().catch(() => undefined);
    wakeLockRef.current = null;
    setGps("idle");
  };

  // ================= Lifecycle =================

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, tripRes] = await Promise.all([loadVehicles(), axios.get<Trip | "">(`${DRIVER_API}/trip`)]);
        if (cancelled) return;
        const active = tripRes.status === 200 && tripRes.data ? (tripRes.data as Trip) : null;
        if (active) {
          // Page reloaded mid-trip: carry on
          setTrip(active);
          setVehicleId(String(active.vehicleId));
          startWatching(active);
          loadDeliveries();
        } else if (list.length === 1 && !list[0].trackedBy) {
          setVehicleId(String(list[0].id));
        }
      } catch (err) {
        if (!cancelled) setError(apiError(err, "Could not load your vehicles"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      wakeLockRef.current?.release?.().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Send queued fixes regularly; refresh deliveries; keep the "last sent" label ticking
  useEffect(() => {
    if (!trip) return;
    const send = window.setInterval(flush, SEND_EVERY_MS);
    const refresh = window.setInterval(() => loadDeliveries(), DELIVERIES_REFRESH_MS);
    const tick = window.setInterval(() => setTick((t) => t + 1), 5_000);
    return () => {
      window.clearInterval(send);
      window.clearInterval(refresh);
      window.clearInterval(tick);
    };
  }, [trip?.id, flush, loadDeliveries]); // eslint-disable-line react-hooks/exhaustive-deps

  // Browsers pause GPS in the background: on return, take the screen lock again and send what is queued
  useEffect(() => {
    const onVisibility = () => {
      if (!tripRef.current) return;
      if (document.visibilityState === "hidden") {
        setWasHidden(true);
      } else {
        requestWakeLock();
        flush();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", flush);
    };
  }, [flush, requestWakeLock]);

  // Before a trip, show the chosen vehicle's deliveries
  useEffect(() => {
    if (!trip && vehicleId) loadDeliveries(vehicleId);
    if (!trip && !vehicleId) setDeliveries([]);
  }, [vehicleId, trip, loadDeliveries]);

  // ================= Actions =================

  const startTrip = async () => {
    if (!vehicleId) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await axios.post<Trip>(`${DRIVER_API}/trips`, { vehicleId: Number(vehicleId) });
      setTrip(data);
      startWatching(data);
      loadDeliveries();
      loadVehicles();
    } catch (err) {
      setError(apiError(err, "Could not start the trip"));
    } finally {
      setBusy(false);
    }
  };

  const endTrip = async () => {
    if (!trip) return;
    setBusy(true);
    setError(null);
    await flush();
    try {
      await axios.put(`${DRIVER_API}/trips/${trip.id}/end`);
      stopWatching();
      writeQueue(trip.id, []);
      queueRef.current = [];
      setPending(0);
      setTrip(null);
      tripRef.current = null;
      setConfirmEnd(false);
      setWasHidden(false);
      setNotice(`Trip ended. ${trip.distanceKm.toFixed(1)} km recorded.`);
      loadVehicles();
    } catch (err) {
      setError(apiError(err, "Could not end the trip"));
    } finally {
      setBusy(false);
    }
  };

  const openAction = (order: DeliveryOrder, status: DeliveryStatus) => {
    setAction({ order, status });
    setRemarks("");
    setReason("");
  };

  const submitAction = async () => {
    if (!action) return;
    if (action.status === "RETURNED" && !reason.trim()) {
      setError("Say why the delivery did not go through");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await axios.put(`${DRIVER_API}/deliveries/${action.order.id}/status`, {
        status: action.status,
        remarks: remarks.trim() || undefined,
        failureReason: action.status === "RETURNED" ? reason.trim() : undefined,
        latitude: lastFix?.latitude,
        longitude: lastFix?.longitude,
      });
      setNotice(`${action.order.deliveryOrderNumber}: ${ACTION_LABEL[action.status]?.toLowerCase()}`);
      setAction(null);
      loadDeliveries();
    } catch (err) {
      setError(apiError(err, "Could not update the delivery"));
    } finally {
      setBusy(false);
    }
  };

  // ================= Render =================

  const selectedVehicle = vehicles.find((v) => String(v.id) === vehicleId);
  const openDeliveries = useMemo(
    () => deliveries.filter((d) => !["DELIVERED", "RETURNED", "CANCELLED"].includes(d.status)),
    [deliveries]
  );
  const doneCount = deliveries.length - openDeliveries.length;
  const sharingHealthy = trip && gps === "watching" && !sendFailing;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gray-950 text-slate-800 dark:text-gray-100">
      <PageMeta title="Driver Mode" description="Share your vehicle's location and update deliveries" />

      {/* Top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-white shadow">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/" className="rounded-lg p-1 hover:bg-white/10" title="Back to myTrading" aria-label="Back to myTrading">
            <ChevronLeftIcon className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Driver Mode</p>
            <p className="truncate text-xs text-slate-300">{user?.fullName || user?.username}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => logout()}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-300 hover:bg-white/10 hover:text-white"
        >
          <LogOutIcon className="h-4 w-4" /> Sign out
        </button>
      </header>

      <main className="mx-auto max-w-xl space-y-4 p-4 pb-24">
        {!secure && (
          <Banner tone="red" icon={<AlertTriangleIcon className="h-5 w-5" />}>
            Location sharing needs a secure (HTTPS) connection. Ask your administrator to enable HTTPS for myTrading.
            You can still update deliveries.
          </Banner>
        )}
        {secure && !hasGps && (
          <Banner tone="red" icon={<AlertTriangleIcon className="h-5 w-5" />}>This browser cannot share its location.</Banner>
        )}
        {error && (
          <Banner tone="red" icon={<AlertTriangleIcon className="h-5 w-5" />} onClose={() => setError(null)}>{error}</Banner>
        )}
        {notice && (
          <Banner tone="green" icon={<CheckCircle2Icon className="h-5 w-5" />} onClose={() => setNotice(null)}>{notice}</Banner>
        )}

        {loading ? (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm dark:bg-gray-900">Loading…</div>
        ) : trip ? (
          /* ===== On a trip ===== */
          <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">On trip</p>
                <p className="mt-0.5 flex items-center gap-2 text-xl font-bold">
                  <TruckIcon className="h-5 w-5 text-cyan-600" />
                  {trip.vehiclePlate}
                </p>
                <p className="text-xs text-slate-500">Since {new Date(trip.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <span
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                  sharingHealthy ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                }`}
              >
                <span className={`h-2 w-2 rounded-full ${sharingHealthy ? "animate-pulse bg-green-500" : "bg-amber-500"}`} />
                {sharingHealthy ? "Sharing location" : gps === "idle" ? "Starting GPS…" : "Check below"}
              </span>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat label="Distance" value={`${trip.distanceKm.toFixed(1)} km`} />
              <Stat label="GPS" value={lastFix?.accuracy != null ? `±${lastFix.accuracy} m` : "—"} />
              <Stat label="Last sent" value={lastSentAt ? timeAgo(new Date(lastSentAt).toISOString()) : pending ? "waiting" : "—"} />
            </dl>

            <div className="mt-3 space-y-2">
              {gps === "denied" && (
                <Banner tone="red" icon={<MapPinIcon className="h-5 w-5" />}>
                  Location is blocked for this site. Allow location in the browser settings, then reload this page.
                </Banner>
              )}
              {gps === "unavailable" && (
                <Banner tone="amber" icon={<MapPinIcon className="h-5 w-5" />}>
                  No GPS signal yet. Make sure location is switched on.
                </Banner>
              )}
              {sendFailing && (
                <Banner tone="amber" icon={<WifiOffIcon className="h-5 w-5" />}>
                  No connection. {pending} location{pending === 1 ? "" : "s"} waiting; they will be sent when you are back online.
                </Banner>
              )}
              {wasHidden && (
                <Banner tone="amber" icon={<AlertTriangleIcon className="h-5 w-5" />} onClose={() => setWasHidden(false)}>
                  Keep this page open while driving. Location is not shared while you use other apps.
                </Banner>
              )}
            </div>

            <button
              type="button"
              onClick={() => setConfirmEnd(true)}
              disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-base font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <SquareIcon className="h-4 w-4" /> End Trip
            </button>
          </section>
        ) : (
          /* ===== Before a trip ===== */
          <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
            <p className="text-base font-semibold">Start a trip</p>
            <p className="mt-0.5 text-sm text-slate-500">Choose your vehicle. Its location is shared until you end the trip.</p>
            <label className="mt-4 block text-xs font-medium text-slate-500" htmlFor="driver-vehicle">Vehicle</label>
            <select
              id="driver-vehicle"
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base dark:border-gray-700 dark:bg-gray-800"
            >
              <option value="">Choose a vehicle</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id} disabled={!!v.trackedBy && !v.trackedByMe}>
                  {v.licensePlate}
                  {v.model ? ` · ${v.model}` : ""}
                  {v.trackedBy && !v.trackedByMe ? ` (on a trip with ${v.trackedBy})` : ""}
                </option>
              ))}
            </select>
            {vehicles.length === 0 && <p className="mt-2 text-sm text-slate-500">No vehicles are set up yet. Ask the office to add one.</p>}
            <button
              type="button"
              onClick={startTrip}
              disabled={!vehicleId || busy || !!(selectedVehicle?.trackedBy && !selectedVehicle.trackedByMe)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3.5 text-base font-semibold text-white hover:bg-green-700 disabled:opacity-40"
            >
              <PlayIcon className="h-5 w-5" /> {busy ? "Starting…" : "Start Trip"}
            </button>
          </section>
        )}

        {/* ===== Deliveries ===== */}
        {(trip || vehicleId) && (
          <section>
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-sm font-semibold">
                Deliveries <span className="font-normal text-slate-500">· {openDeliveries.length} to go{doneCount ? `, ${doneCount} done today` : ""}</span>
              </p>
              <button type="button" onClick={() => loadDeliveries(trip ? undefined : vehicleId)} className="rounded-lg p-1.5 text-slate-500 hover:bg-white" title="Refresh" aria-label="Refresh deliveries">
                <RefreshCwIcon className="h-4 w-4" />
              </button>
            </div>
            {!trip && deliveries.length > 0 && (
              <p className="mb-2 px-1 text-xs text-slate-500">Start the trip to update these deliveries.</p>
            )}
            {deliveries.length === 0 ? (
              <div className="rounded-2xl bg-white p-5 text-center text-sm text-slate-500 shadow-sm dark:bg-gray-900">
                No deliveries are assigned to this vehicle.
              </div>
            ) : (
              <ul className="space-y-3">
                {deliveries.map((order) => (
                  <DeliveryCard key={order.id} order={order} canAct={!!trip && !busy} onAction={openAction} />
                ))}
              </ul>
            )}
          </section>
        )}
      </main>

      {/* End trip confirmation */}
      {confirmEnd && trip && (
        <Sheet onClose={() => setConfirmEnd(false)} title="End this trip?">
          <p className="text-sm text-slate-600 dark:text-gray-300">
            {trip.vehiclePlate} stops sharing its location. {openDeliveries.length > 0 && `${openDeliveries.length} deliver${openDeliveries.length === 1 ? "y is" : "ies are"} still open.`}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setConfirmEnd(false)} className="rounded-xl border border-slate-300 py-3 font-medium dark:border-gray-700">Keep going</button>
            <button type="button" onClick={endTrip} disabled={busy} className="rounded-xl bg-red-600 py-3 font-semibold text-white disabled:opacity-50">
              {busy ? "Ending…" : "End Trip"}
            </button>
          </div>
        </Sheet>
      )}

      {/* Delivery status */}
      {action && (
        <Sheet onClose={() => setAction(null)} title={`${ACTION_LABEL[action.status]} · ${action.order.deliveryOrderNumber}`}>
          <p className="text-sm text-slate-600 dark:text-gray-300">{action.order.customerName}</p>
          {action.status === "RETURNED" && (
            <>
              <label className="mt-4 block text-xs font-medium text-slate-500" htmlFor="driver-reason">Reason *</label>
              <input
                id="driver-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer not available, shop closed"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-3 text-base dark:border-gray-700 dark:bg-gray-800"
              />
            </>
          )}
          <label className="mt-4 block text-xs font-medium text-slate-500" htmlFor="driver-remarks">Note (optional)</label>
          <textarea
            id="driver-remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            rows={2}
            placeholder={action.status === "DELIVERED" ? "e.g. Signed by store manager" : ""}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base dark:border-gray-700 dark:bg-gray-800"
          />
          <p className="mt-2 text-xs text-slate-400">
            {lastFix ? "Your current location is saved with this update." : "No GPS fix yet; the trip's last position is used."}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setAction(null)} className="rounded-xl border border-slate-300 py-3 font-medium dark:border-gray-700">Cancel</button>
            <button
              type="button"
              onClick={submitAction}
              disabled={busy}
              className={`rounded-xl py-3 font-semibold text-white disabled:opacity-50 ${action.status === "RETURNED" ? "bg-orange-600" : "bg-green-600"}`}
            >
              {busy ? "Saving…" : "Confirm"}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
};

/* ================= Pieces ================= */

const DeliveryCard: React.FC<{
  order: DeliveryOrder;
  canAct: boolean;
  onAction: (order: DeliveryOrder, status: DeliveryStatus) => void;
}> = ({ order, canAct, onAction }) => {
  const done = ["DELIVERED", "RETURNED", "CANCELLED"].includes(order.status);
  const button = "rounded-xl px-3 py-2.5 text-sm font-semibold disabled:opacity-40";
  return (
    <li className={`rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900 ${done ? "opacity-70" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold">{order.customerName || `Customer #${order.customerId}`}</p>
          <p className="text-xs text-slate-500">
            {order.deliveryOrderNumber} · due {new Date(order.deliveryDate).toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {order.deliveryAddress && (
        <a
          href={directionsUrl(order.deliveryAddress)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 hover:bg-slate-100 dark:bg-gray-800 dark:text-gray-200"
        >
          <MapPinIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-600" />
          <span className="flex-1">{order.deliveryAddress}</span>
          <span className="flex items-center gap-1 text-xs font-semibold text-cyan-700"><NavigationIcon className="h-3.5 w-3.5" />Navigate</span>
        </a>
      )}

      <p className="mt-3 flex items-start gap-2 text-sm text-slate-600 dark:text-gray-300">
        <PackageIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
        <span>{order.items.map((i) => `${i.productName || `Product #${i.productId}`} × ${i.quantity}`).join(", ")}</span>
      </p>
      {order.remarks && <p className="mt-1 text-xs text-slate-500">Note: {order.remarks}</p>}

      {done ? (
        order.tracking && (
          <p className="mt-3 text-xs text-slate-500">
            {order.tracking.remarks || order.tracking.failureReason || "Done"} · {formatDateTime(order.tracking.statusUpdatedAt)}
          </p>
        )
      ) : order.status === "PENDING" || order.status === "CONFIRMED" ? (
        <button type="button" disabled={!canAct} onClick={() => onAction(order, "IN_TRANSIT")} className={`${button} mt-3 w-full bg-cyan-600 text-white`}>
          Start delivery
        </button>
      ) : (
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button type="button" disabled={!canAct} onClick={() => onAction(order, "DELIVERED")} className={`${button} bg-green-600 text-white`}>Delivered</button>
          <button type="button" disabled={!canAct} onClick={() => onAction(order, "PARTIAL")} className={`${button} bg-amber-100 text-amber-800`}>Partly</button>
          <button type="button" disabled={!canAct} onClick={() => onAction(order, "RETURNED")} className={`${button} bg-orange-100 text-orange-800`}>Not delivered</button>
        </div>
      )}
    </li>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 px-2 py-2 dark:bg-gray-800">
    <dt className="text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
    <dd className="mt-0.5 text-sm font-semibold">{value}</dd>
  </div>
);

const Banner: React.FC<{ tone: "red" | "amber" | "green"; icon: React.ReactNode; onClose?: () => void; children: React.ReactNode }> = ({
  tone,
  icon,
  onClose,
  children,
}) => {
  const styles = {
    red: "bg-red-50 text-red-800 border-red-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    green: "bg-green-50 text-green-800 border-green-200",
  }[tone];
  return (
    <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${styles}`} role={tone === "red" ? "alert" : "status"}>
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <span className="flex-1">{children}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="flex-shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

const Sheet: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
    <div
      className="w-full max-w-xl rounded-t-2xl bg-white p-5 pb-8 shadow-xl dark:bg-gray-900 sm:rounded-2xl sm:pb-5"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
          <XIcon className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-2">{children}</div>
    </div>
  </div>
);

export default DriverMode;
