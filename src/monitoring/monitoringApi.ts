// Monitoring pages (user-service MonitoringService, docs/OBSERVABILITY.md): the platform's (Super Admin, Platform →
// Monitoring) and a company's own (company administrators, Settings → System health). Read from Prometheus on the
// server; when it can't be reached, available is false and message says why.
import axios from "axios";

export interface MonitoringAlert {
  name: string;
  severity: string | null;
  area: string | null;
  service: string | null;
  tenant: string | null;
  summary: string | null;
  description: string | null;
  /** Platform page only. */
  runbookUrl: string | null;
  state: string;
  since: string | null;
}

export interface WaitingItem {
  what: string;
  label: string;
  /** Something stuck that needs a look; otherwise normal work in progress. */
  problem: boolean;
  count: number;
  oldestSeconds: number | null;
}

export interface CompanyHealth {
  available: boolean;
  message: string | null;
  checkedAt: string;
  alerts: MonitoringAlert[];
  waiting: WaitingItem[];
  activity: { module: string; steps: number }[];
}

export interface DashboardLink {
  uid: string;
  title: string;
  folder: string;
  description: string;
}

export interface PlatformHealth {
  available: boolean;
  message: string | null;
  checkedAt: string;
  /** Where Grafana is opened (no trailing slash); null when not set up. */
  grafanaUrl: string | null;
  dashboards: DashboardLink[];
  services: { service: string; up: boolean }[];
  alerts: MonitoringAlert[];
  companies: { tenantId: string; tenantName: string | null; waiting: number; oldestSeconds: number | null; alerts: number }[];
}

export const monitoringApi = {
  company: () => axios.get<CompanyHealth>("/v1/api/user/company/health").then((r) => r.data),
  platform: () => axios.get<PlatformHealth>("/v1/api/user/platform/monitoring").then((r) => r.data),
  /** Just Grafana's address (null when not set up); Super Admin only. */
  grafanaUrl: () => axios.get<{ grafanaUrl: string | null }>("/v1/api/user/platform/monitoring/grafana").then((r) => r.data.grafanaUrl),
};

/** A Grafana dashboard's address, with its variables (e.g. { tenant: "T1" } → var-tenant=T1). */
export const grafanaLink = (grafanaUrl: string, uid: string, vars: Record<string, string> = {}) => {
  const query = Object.entries(vars).map(([k, v]) => `var-${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return `${grafanaUrl}/d/${uid}${query ? `?${query}` : ""}`;
};

/** 75 → "1 min", 5400 → "1 h 30 min", 200000 → "2 d 7 h". */
export const waitedFor = (seconds: number | null | undefined) => {
  if (seconds == null) return "";
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h${m % 60 ? ` ${m % 60} min` : ""}`;
  return `${Math.floor(h / 24)} d${h % 24 ? ` ${h % 24} h` : ""}`;
};
