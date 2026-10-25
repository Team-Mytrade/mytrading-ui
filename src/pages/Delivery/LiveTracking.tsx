import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  ClockIcon,
  CopyIcon,
  HistoryIcon,
  RadioIcon,
  RefreshCwIcon,
  RouteIcon,
  SmartphoneIcon,
  SquareIcon,
  TruckIcon,
  UserIcon,
} from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { todayIso } from "../../utils/localDate";
import { DELIVERY_API, apiError } from "./deliveryShared";
import { RoutePoint, TRACKING_API, TRIP_STATE_STYLE, Trip, mapUrl, timeAgo, tripState } from "./trackingApi";
import { usePermissions } from "../../access/usePermissions";

// Live map of vehicles whose drivers are on a trip (Driver Mode on their phone), plus past trips' routes.
// Map tiles: OpenStreetMap (free; for heavy use switch to a commercial tile provider).

const REFRESH_MS = 15_000;
const DEFAULT_VIEW: L.LatLngTuple = [20.59, 78.96]; // India

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const vehicleIcon = (plate: string, color: string, selected: boolean) =>
  L.divIcon({
    className: "vt-icon",
    iconSize: [140, 44],
    iconAnchor: [70, 44],
    popupAnchor: [0, -40],
    html: `<div class="vt-pin${selected ? " vt-selected" : ""}">
      <div class="vt-label" style="border-color:${color}"><span class="vt-dot" style="background:${color}"></span>${escapeHtml(plate)}</div>
      <div class="vt-stem" style="background:${color}"></div>
    </div>`,
  });

const durationLabel = (from?: string, to?: string) => {
  if (!from) return "-";
  const minutes = Math.max(0, Math.round(((to ? new Date(to).getTime() : Date.now()) - new Date(from).getTime()) / 60000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

const LiveTracking: React.FC = () => {
  const { canUpdate } = usePermissions();
  const [tab, setTab] = useState<"live" | "history">("live");
  const [live, setLive] = useState<Trip[]>([]);
  const [loadingLive, setLoadingLive] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<number | null>(null);
  const [history, setHistory] = useState<Trip[]>([]);
  const [historyDate, setHistoryDate] = useState(todayIso());
  const [historyVehicle, setHistoryVehicle] = useState("");
  const [vehicles, setVehicles] = useState<{ id: number; licensePlate: string }[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [copied, setCopied] = useState(false);

  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const routeRef = useRef<L.LayerGroup | null>(null);
  const fittedLiveRef = useRef(false);
  const fittedRouteRef = useRef<number | null>(null);

  const trips = tab === "live" ? live : history;
  const selected = trips.find((t) => t.id === selectedId) ?? null;
  const driverLink = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/driver`;

  // ================= Map =================

  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current).setView(DEFAULT_VIEW, 5);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    routeRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    // Leaflet measures its box once; measure again after the layout settles and on resize
    const resize = () => map.invalidateSize();
    const timer = window.setTimeout(resize, 250);
    window.addEventListener("resize", resize);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", resize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ================= Data =================

  const loadLive = useCallback(async () => {
    try {
      const { data } = await axios.get<Trip[]>(`${TRACKING_API}/live`);
      setLive(data);
      setLastRefresh(Date.now());
      setError(null);
    } catch (err) {
      setError(apiError(err, "Could not load live vehicles"));
    } finally {
      setLoadingLive(false);
    }
  }, []);

  useEffect(() => {
    loadLive();
    const timer = window.setInterval(loadLive, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadLive]);

  useEffect(() => {
    axios.get(`${DELIVERY_API}/vehicles`).then(({ data }) => setVehicles(data)).catch(() => setVehicles([]));
  }, []);

  useEffect(() => {
    if (tab !== "history") return;
    axios
      .get<Trip[]>(`${TRACKING_API}/trips`, { params: { date: historyDate, vehicleId: historyVehicle || undefined } })
      .then(({ data }) => setHistory(data))
      .catch((err) => setError(apiError(err, "Could not load trips")));
  }, [tab, historyDate, historyVehicle]);

  // The selected trip's trail; reloaded with each live refresh so it keeps growing
  const liveVersion = tab === "live" ? lastRefresh : null;
  useEffect(() => {
    if (selectedId == null) {
      setRoute([]);
      return;
    }
    let cancelled = false;
    axios
      .get<RoutePoint[]>(`${TRACKING_API}/trips/${selectedId}/route`)
      .then(({ data }) => !cancelled && setRoute(data))
      .catch((err) => !cancelled && setError(apiError(err, "Could not load the route")));
    return () => {
      cancelled = true;
    };
  }, [selectedId, liveVersion]);

  // ================= Drawing =================

  useEffect(() => {
    const layer = markersRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    if (tab !== "live") return;
    const positioned = live.filter((t) => t.lastLatitude != null && t.lastLongitude != null);
    positioned.forEach((t) => {
      const style = TRIP_STATE_STYLE[tripState(t)];
      L.marker([t.lastLatitude!, t.lastLongitude!], { icon: vehicleIcon(t.vehiclePlate, style.dot, t.id === selectedId), zIndexOffset: t.id === selectedId ? 1000 : 0 })
        .bindPopup(
          `<strong>${escapeHtml(t.vehiclePlate)}</strong><br/>${escapeHtml(t.driverName)}<br/>` +
            `${escapeHtml(style.label)}${t.lastSpeedKmh != null ? ` · ${Math.round(t.lastSpeedKmh)} km/h` : ""}<br/>` +
            `<span style="color:#64748b">Updated ${escapeHtml(timeAgo(t.lastSeenAt))}</span>`
        )
        .on("click", () => setSelectedId(t.id))
        .addTo(layer);
    });
    if (!fittedLiveRef.current && positioned.length) {
      map.fitBounds(L.latLngBounds(positioned.map((t) => [t.lastLatitude!, t.lastLongitude!] as L.LatLngTuple)), {
        padding: [50, 50],
        maxZoom: 14,
      });
      fittedLiveRef.current = true;
    }
  }, [live, tab, selectedId]);

  useEffect(() => {
    const layer = routeRef.current;
    const map = mapRef.current;
    if (!layer || !map) return;
    layer.clearLayers();
    if (route.length === 0) return;
    const points = route.map((p) => [p.latitude, p.longitude] as L.LatLngTuple);
    L.polyline(points, { color: "#0891b2", weight: 4, opacity: 0.85 }).addTo(layer);
    L.circleMarker(points[0], { radius: 7, color: "#fff", weight: 2, fillColor: "#16a34a", fillOpacity: 1 })
      .bindTooltip(`Start · ${new Date(route[0].recordedAt).toLocaleTimeString()}`)
      .addTo(layer);
    if (tab === "history") {
      const last = route[route.length - 1];
      L.circleMarker(points[points.length - 1], { radius: 7, color: "#fff", weight: 2, fillColor: "#dc2626", fillOpacity: 1 })
        .bindTooltip(`End · ${new Date(last.recordedAt).toLocaleTimeString()}`)
        .addTo(layer);
    }
    if (fittedRouteRef.current !== selectedId) {
      map.fitBounds(L.latLngBounds(points), { padding: [50, 50], maxZoom: 16 });
      fittedRouteRef.current = selectedId;
    }
  }, [route, tab, selectedId]);

  // ================= Actions =================

  const choose = (trip: Trip) => {
    if (trip.id === selectedId) {
      setSelectedId(null);
      fittedRouteRef.current = null;
      return;
    }
    setSelectedId(trip.id);
    if (trip.lastLatitude != null && trip.lastLongitude != null && mapRef.current) {
      mapRef.current.setView([trip.lastLatitude, trip.lastLongitude], Math.max(mapRef.current.getZoom(), 14));
    }
  };

  const switchTab = (next: "live" | "history") => {
    setTab(next);
    setSelectedId(null);
    fittedRouteRef.current = null;
  };

  const endTrip = async (trip: Trip) => {
    if (!window.confirm(`End ${trip.driverName}'s trip on ${trip.vehiclePlate}? Their phone stops sharing its location.`)) return;
    setEnding(true);
    try {
      await axios.put(`${TRACKING_API}/trips/${trip.id}/end`);
      setSelectedId(null);
      await loadLive();
    } catch (err) {
      setError(apiError(err, "Could not end the trip"));
    } finally {
      setEnding(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(driverLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the link is shown anyway */
    }
  };

  const counts = useMemo(() => {
    const byState = { moving: 0, stopped: 0, lost: 0, waiting: 0 };
    live.forEach((t) => (byState[tripState(t)] += 1));
    return byState;
  }, [live]);

  // ================= Render =================

  return (
    <>
      <PageMeta title="Live Tracking" description="Live location of delivery vehicles" />
      <PageBreadcrumb pageTitle="Live Tracking" />
      <style>{`
        .vt-icon { background: transparent; border: 0; }
        .vt-pin { display: flex; flex-direction: column; align-items: center; width: 140px; }
        .vt-label { display: flex; align-items: center; gap: 6px; max-width: 136px; padding: 3px 8px; border: 2px solid; border-radius: 9999px;
          background: #fff; color: #0f172a; font: 600 12px/1.2 system-ui, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          box-shadow: 0 2px 6px rgba(15,23,42,.25); }
        .vt-dot { width: 8px; height: 8px; border-radius: 9999px; flex: none; }
        .vt-stem { width: 3px; height: 14px; border-radius: 0 0 2px 2px; }
        .vt-selected .vt-label { background: #0f172a; color: #fff; }
      `}</style>

      <div className="flex flex-col gap-4 py-4 lg:h-[calc(100cqh-48px)]">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 dark:border-gray-700 dark:bg-gray-900">
            <button type="button" onClick={() => switchTab("live")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${tab === "live" ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-gray-300"}`}>
              <RadioIcon className="h-4 w-4" /> Live <span className="text-xs opacity-80">({live.length})</span>
            </button>
            <button type="button" onClick={() => switchTab("history")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${tab === "history" ? "bg-cyan-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-gray-300"}`}>
              <HistoryIcon className="h-4 w-4" /> Trip history
            </button>
          </div>

          {tab === "live" ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {(["moving", "stopped", "lost"] as const).map((s) => (
                <span key={s} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-semibold ${TRIP_STATE_STYLE[s].badge}`}>
                  <span className="h-2 w-2 rounded-full" style={{ background: TRIP_STATE_STYLE[s].dot }} />
                  {TRIP_STATE_STYLE[s].label} {counts[s]}
                </span>
              ))}
              <button type="button" onClick={loadLive} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300" title="Refresh now">
                <RefreshCwIcon className="h-3.5 w-3.5" /> {lastRefresh ? `Updated ${timeAgo(new Date(lastRefresh).toISOString())}` : "Refresh"}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={historyDate} max={todayIso()} onChange={(e) => setHistoryDate(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" aria-label="Trip date" />
              <select value={historyVehicle} onChange={(e) => setHistoryVehicle(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-900" aria-label="Vehicle">
                <option value="">All vehicles</option>
                {vehicles.map((v) => <option key={v.id} value={v.id}>{v.licensePlate}</option>)}
              </select>
            </div>
          )}
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
          {/* List */}
          <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-gray-700 dark:bg-gray-900">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-gray-800">
              {tab === "live" ? "Vehicles on a trip" : `Trips on ${new Date(historyDate).toLocaleDateString()}`}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === "live" && loadingLive ? (
                <p className="p-4 text-sm text-slate-500">Loading…</p>
              ) : trips.length === 0 ? (
                <div className="p-5 text-sm text-slate-500">
                  {tab === "live" ? (
                    <>
                      <SmartphoneIcon className="mb-2 h-8 w-8 text-slate-300" />
                      <p className="font-medium text-slate-700 dark:text-gray-200">No vehicles are on a trip right now.</p>
                      <p className="mt-1">Drivers open Driver Mode on their phone, choose a vehicle and tap Start Trip:</p>
                      <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs dark:bg-gray-800">
                        <span className="flex-1 break-all font-mono">{driverLink}</span>
                        <button type="button" onClick={copyLink} className="flex items-center gap-1 font-semibold text-cyan-700" title="Copy link">
                          <CopyIcon className="h-3.5 w-3.5" /> {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </>
                  ) : (
                    "No trips on this day."
                  )}
                </div>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-gray-800">
                  {trips.map((t) => {
                    const state = TRIP_STATE_STYLE[tripState(t)];
                    const active = t.id === selectedId;
                    return (
                      <li key={t.id}>
                        <button type="button" onClick={() => choose(t)}
                          className={`w-full px-4 py-3 text-left transition-colors ${active ? "bg-cyan-50 dark:bg-cyan-900/20" : "hover:bg-slate-50 dark:hover:bg-gray-800"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-gray-100">
                              <TruckIcon className="h-4 w-4 text-slate-400" /> {t.vehiclePlate}
                            </span>
                            {t.status === "ACTIVE" ? (
                              <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${state.badge}`}>{state.label}</span>
                            ) : (
                              <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Ended</span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" />{t.driverName}</span>
                            <span className="flex items-center gap-1"><RouteIcon className="h-3 w-3" />{t.distanceKm.toFixed(1)} km</span>
                            {t.status === "ACTIVE" ? (
                              <span className="flex items-center gap-1"><ClockIcon className="h-3 w-3" />{timeAgo(t.lastSeenAt)}</span>
                            ) : (
                              <span className="flex items-center gap-1"><ClockIcon className="h-3 w-3" />{new Date(t.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {durationLabel(t.startedAt, t.endedAt)}</span>
                            )}
                            {t.openDeliveries != null && <span>{t.openDeliveries} open deliver{t.openDeliveries === 1 ? "y" : "ies"}</span>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Selected trip */}
            {selected && (
              <div className="border-t border-slate-100 p-4 text-sm dark:border-gray-800">
                <p className="font-semibold text-slate-800 dark:text-gray-100">{selected.vehiclePlate} · {selected.driverName}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-gray-300">
                  <dt className="text-slate-400">Started</dt><dd>{new Date(selected.startedAt).toLocaleString()}</dd>
                  <dt className="text-slate-400">Duration</dt><dd>{durationLabel(selected.startedAt, selected.endedAt)}</dd>
                  <dt className="text-slate-400">Distance</dt><dd>{selected.distanceKm.toFixed(2)} km</dd>
                  <dt className="text-slate-400">GPS fixes</dt><dd>{selected.pointCount}</dd>
                  {selected.status === "ACTIVE" && (
                    <>
                      <dt className="text-slate-400">Speed</dt><dd>{selected.lastSpeedKmh != null ? `${Math.round(selected.lastSpeedKmh)} km/h` : "-"}</dd>
                      <dt className="text-slate-400">Accuracy</dt><dd>{selected.lastAccuracy != null ? `±${Math.round(selected.lastAccuracy)} m` : "-"}</dd>
                    </>
                  )}
                  {selected.endedBy && (<><dt className="text-slate-400">Ended by</dt><dd>{selected.endedBy === "system" ? "System (no updates)" : selected.endedBy}</dd></>)}
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.lastLatitude != null && selected.lastLongitude != null && (
                    <a href={mapUrl(selected.lastLatitude, selected.lastLongitude)} target="_blank" rel="noreferrer"
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-gray-700 dark:text-gray-300">
                      Open in OpenStreetMap
                    </a>
                  )}
                  {selected.status === "ACTIVE" && (
                    canUpdate && <button type="button" onClick={() => endTrip(selected)} disabled={ending}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                      title="For a trip the driver forgot to end">
                      <SquareIcon className="h-3 w-3" /> End trip
                    </button>
                  )}
                </div>
                {route.length === 0 && <p className="mt-2 text-xs text-slate-400">No GPS fixes recorded for this trip yet.</p>}
              </div>
            )}
          </aside>

          {/* Map */}
          <div className="relative min-h-[420px] overflow-hidden rounded-xl border border-slate-200 dark:border-gray-700">
            <div ref={mapEl} className="absolute inset-0 z-0" aria-label="Vehicle map" role="region" />
          </div>
        </div>
      </div>
    </>
  );
};

export default LiveTracking;
