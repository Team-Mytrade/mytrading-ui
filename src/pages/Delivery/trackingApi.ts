import { DELIVERY_API } from "./deliveryShared";

// Vehicle tracking from the driver's phone. Shapes follow the delivery-service tracking DTOs.

export const TRACKING_API = `${DELIVERY_API}/tracking`;
export const DRIVER_API = `${TRACKING_API}/driver`;

export interface Trip {
  id: number;
  vehicleId: number;
  vehiclePlate: string;
  vehicleModel?: string;
  driverUserId?: string;
  driverName?: string;
  status: "ACTIVE" | "ENDED";
  startedAt: string;
  endedAt?: string;
  endedBy?: string;
  lastLatitude?: number;
  lastLongitude?: number;
  lastAccuracy?: number;
  lastSpeedKmh?: number;
  lastHeading?: number;
  lastSeenAt?: string;
  distanceKm: number;
  pointCount: number;
  // Active but silent for 5+ minutes
  stale: boolean;
  openDeliveries?: number | null;
}

export interface RoutePoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speedKmh?: number;
  recordedAt: string;
}

export interface DriverVehicle {
  id: number;
  licensePlate: string;
  model?: string;
  type?: string;
  status?: string;
  trackedBy?: string | null;
  trackedByMe: boolean;
}

// What the phone sends; timestamp in epoch milliseconds
export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speedKmh?: number;
  heading?: number;
  timestamp: number;
}

export const timeAgo = (value?: string): string => {
  if (!value) return "never";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : new Date(value).toLocaleString();
};

// Moving / stopped / signal lost, for the live map and lists
export type TripState = "moving" | "stopped" | "lost" | "waiting";

export const tripState = (trip: Trip): TripState => {
  if (trip.stale) return "lost";
  if (trip.lastLatitude == null) return "waiting";
  return (trip.lastSpeedKmh ?? 0) >= 3 ? "moving" : "stopped";
};

export const TRIP_STATE_STYLE: Record<TripState, { label: string; dot: string; badge: string }> = {
  moving: { label: "Moving", dot: "#16a34a", badge: "bg-green-50 text-green-700 border-green-200" },
  stopped: { label: "Stopped", dot: "#d97706", badge: "bg-amber-50 text-amber-700 border-amber-200" },
  lost: { label: "Signal lost", dot: "#9ca3af", badge: "bg-gray-100 text-gray-600 border-gray-200" },
  waiting: { label: "Waiting for GPS", dot: "#3b82f6", badge: "bg-blue-50 text-blue-700 border-blue-200" },
};

export const directionsUrl = (address: string) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;

export const mapUrl = (latitude: number, longitude: number) =>
  `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
