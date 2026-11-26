import { useContext, useEffect, useState } from "react";
import axios from "axios";
import { AuthContext } from "../../context/AuthContext";
import { t } from "../../i18n/i18n";

// Owners of leads and deals, and what CRM → Settings says each person may see (backlog 8.3.1)

export const CRM_SETTINGS_API = "/v1/api/crm/settings";

export interface CrmSettings {
  // The company limits sales people to their own leads and deals (plus unassigned ones)
  ownRecordsOnly: boolean;
  // This person is a CRM admin and may change the settings
  canChange: boolean;
  // This person sees everyone's leads and deals
  seesAll: boolean;
  // The company's lists (8.3.2): where leads come from, why leads and deals are lost
  leadSources: string[];
  lostReasons: string[];
  // Remind a lead's or open deal's owner after this many days without a task or interaction; 0 = never
  idleDays: number;
  // Each stage's default win probability (8.3.3); Won 100 and Lost 0 always
  stageProbabilities: Record<string, number>;
  // 8.4.16: a deal moving to Negotiation or Won for a customer over its credit limit or overdue beyond
  // creditOverdueDays: OFF, WARN or BLOCK
  creditRule: "OFF" | "WARN" | "BLOCK";
  creditOverdueDays: number;
}

const DEFAULTS: CrmSettings = {
  ownRecordsOnly: false,
  canChange: false,
  seesAll: true,
  leadSources: ["Walk-in", "Phone", "Website", "Exhibition", "Referral", "WhatsApp", "Social media", "Marketplace", "Other"],
  lostReasons: ["Price", "Lost to competitor", "No budget", "No response", "Product not available", "Delivery time", "Other"],
  idleDays: 14,
  stageProbabilities: { PROSPECTING: 10, QUALIFIED: 25, NEGOTIATION: 60, WON: 100, LOST: 0 },
  creditRule: "WARN",
  creditOverdueDays: 30,
};

let cache: Promise<CrmSettings> | null = null;

/** The company's CRM settings as they apply to the signed-in person; loaded once per page load. */
export const loadCrmSettings = (): Promise<CrmSettings> => {
  if (!cache) {
    cache = axios
      .get<CrmSettings>(CRM_SETTINGS_API)
      .then((res) => ({ ...DEFAULTS, ...(res.data || {}) }))
      .catch(() => {
        cache = null; // try again next time
        return DEFAULTS;
      });
  }
  return cache;
};

/** After a change on CRM → Settings, every page reads the new values. */
export const rememberCrmSettings = (settings: CrmSettings) => {
  cache = Promise.resolve(settings);
};

export const useCrmSettings = () => {
  const [settings, setSettings] = useState<CrmSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    loadCrmSettings().then((value) => {
      if (active) {
        setSettings(value);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  return { settings, setSettings, loading };
};

/** The signed-in person's username (what owners and assignees are stored as). */
export const useMyUsername = (): string => {
  const { user } = useContext(AuthContext);
  return user?.username ?? "";
};

export const isMine = (person: string | null | undefined, me: string) =>
  !!person && !!me && person.toLowerCase() === me.toLowerCase();

/** "Mine" or "All" on a list, remembered on this browser. */
export const useMineOnly = (key: string): [boolean, (mine: boolean) => void] => {
  const storageKey = `crm.mineOnly.${key}`;
  const [mineOnly, setMineOnly] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });
  const change = (mine: boolean) => {
    setMineOnly(mine);
    try {
      localStorage.setItem(storageKey, mine ? "1" : "0");
    } catch {
      // storage unavailable: the choice lasts for this page only
    }
  };
  return [mineOnly, change];
};

/** Mine / All switch for a list's toolbar. */
export const MineAllToggle = ({
  mineOnly,
  onChange,
  mineLabel = "Mine",
}: {
  mineOnly: boolean;
  onChange: (mine: boolean) => void;
  mineLabel?: string;
}) => {
  const option = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
      active ? "bg-cyan-600 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
    }`;
  return (
    <div role="group" aria-label={t("Show")} className="inline-flex shrink-0 rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-transparent">
      <button type="button" aria-pressed={mineOnly} onClick={() => onChange(true)} className={option(mineOnly)}>
        {t(mineLabel)}
      </button>
      <button type="button" aria-pressed={!mineOnly} onClick={() => onChange(false)} className={option(!mineOnly)}>
        {t("All")}
      </button>
    </div>
  );
};

/** A line above a list when the company shows sales people only their own records. */
export const OwnRecordsNote = ({ settings }: { settings: CrmSettings }) =>
  settings.seesAll ? null : (
    <div className="mx-3 mb-4 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100">
      {t("You see the leads and deals you own and the unassigned ones. A CRM admin can change this in CRM → CRM Settings.")}
    </div>
  );

/** The owner's name for a table cell. */
export const OwnerCell = ({ owner, ownerName }: { owner?: string | null; ownerName?: string | null }) =>
  owner ? (
    <span className="truncate text-sm text-gray-700 dark:text-gray-300" title={owner}>
      {ownerName || owner}
    </span>
  ) : (
    <span className="text-xs italic text-gray-400">{t("Unassigned")}</span>
  );
