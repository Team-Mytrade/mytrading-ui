import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ClipboardDocumentIcon, GlobeAltIcon } from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { userOptions, useUserDirectory } from "../../access/useUserDirectory";
import { apiError } from "./crmShared";
import { t } from "../../i18n/i18n";

// CRM Settings → Website form (backlog 8.3.6): a form key and an HTML snippet for the company's website; each
// submission becomes a New lead with source Website for the chosen owner.

const API = "/v1/api/crm/settings/web-form";

interface Setup {
  enabled: boolean;
  key: string | null;
  owner: string | null;
  ownerName: string | null;
  path: string | null;
  honeypot: string;
  fields: string[];
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The snippet a web designer pastes: a plain form (no script needed), the hidden field bots fill, and labels. */
export const snippetFor = (url: string, honeypot: string) => `<form method="POST" action="${escapeHtml(url)}" accept-charset="UTF-8">
  <label>Name <input name="name" required maxlength="150"></label>
  <label>Email <input name="email" type="email" maxlength="254"></label>
  <label>Phone <input name="phone" type="tel" maxlength="30"></label>
  <label>Company <input name="company" maxlength="150"></label>
  <label>How can we help? <textarea name="message" maxlength="2000"></textarea></label>
  <!-- Leave this hidden field in: people never see it, spam robots fill it in -->
  <div style="position:absolute;left:-9999px" aria-hidden="true">
    <input name="${honeypot}" tabindex="-1" autocomplete="off">
  </div>
  <button type="submit">Send</button>
</form>`;

export default function CrmWebForm() {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState(false);
  const { users } = useUserDirectory();

  useEffect(() => {
    axios
      .get<Setup>(API)
      .then((res) => {
        setSetup(res.data);
        setOwner(res.data.owner ?? "");
      })
      .catch(() => setSetup(null));
  }, []);

  const url = setup?.path ? `${window.location.origin}${setup.path}` : "";
  const snippet = useMemo(() => (setup?.enabled && url ? snippetFor(url, setup.honeypot) : ""), [setup, url]);

  const save = async (newKey = false) => {
    setBusy(true);
    try {
      const res = await axios.put<Setup>(API, { owner, newKey });
      const wasOn = setup?.enabled;
      setSetup(res.data);
      ToasterService.success(t(!wasOn ? "Website form switched on" : newKey ? "New form key made: update your website" : "Website form saved"));
    } catch (err) {
      ToasterService.error(apiError(err, "Couldn't save the website form"));
    } finally {
      setBusy(false);
    }
  };

  const switchOff = async () => {
    setBusy(true);
    try {
      const res = await axios.delete<Setup>(API);
      setSetup(res.data);
      ToasterService.success(t("Website form switched off"));
    } catch (err) {
      ToasterService.error(apiError(err, "Couldn't save the website form"));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      ToasterService.success(t("Copied"));
    } catch {
      ToasterService.info(t("Select the text and copy it"));
    }
  };

  // Only CRM admins can read the form's setup; for everyone else the card isn't shown
  if (!setup) return null;

  return (
    <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">
          <GlobeAltIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t("Website form")}</h2>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {t("Put an enquiry form on your website: each one sent becomes a New lead with source Website, for the owner you choose here.")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="block min-w-[14rem] flex-1">
          <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-gray-300">{t("Leads go to")}</span>
          <select
            value={owner}
            disabled={busy}
            onChange={(e) => setOwner(e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-cyan-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          >
            {userOptions(users, owner).map((o) => (
              <option key={o.id} value={o.id}>
                {o.id === "" ? t("Unassigned (anyone can take them)") : o.name}
              </option>
            ))}
          </select>
        </label>
        {!setup.enabled ? (
          <button type="button" disabled={busy} onClick={() => save()}
            className="h-9 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50">
            {t("Switch on")}
          </button>
        ) : (
          <>
            <button type="button" disabled={busy || owner === (setup.owner ?? "")} onClick={() => save()}
              className="h-9 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-cyan-700 disabled:opacity-50">
              {t("Save")}
            </button>
            <button type="button" disabled={busy} onClick={switchOff}
              className="h-9 rounded-lg border border-gray-300 px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200">
              {t("Switch off")}
            </button>
          </>
        )}
      </div>

      {setup.enabled && (
        <div className="mt-5 space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-gray-300">{t("Form address")}</span>
              <button type="button" onClick={() => copy(url)} className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:underline">
                <ClipboardDocumentIcon className="h-4 w-4" /> {t("Copy")}
              </button>
            </div>
            <code dir="ltr" className="block break-all rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-800 dark:bg-gray-900 dark:text-gray-200">{url}</code>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-gray-300">{t("HTML to paste on your website")}</span>
              <button type="button" onClick={() => copy(snippet)} className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 hover:underline">
                <ClipboardDocumentIcon className="h-4 w-4" /> {t("Copy")}
              </button>
            </div>
            <pre dir="ltr" className="max-h-64 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">{snippet}</pre>
          </div>
          <ul className="list-disc space-y-1 ps-5 text-xs text-gray-500 dark:text-gray-400">
            <li>{t("The fields it can send: name (required), email or phone (one is required), company, jobTitle, country, city, interest and message. Rename the labels freely; keep the field names.")}</li>
            <li>{t("Keep the hidden field: a submission that fills it is dropped as spam. One address can send 5 enquiries an hour, and the form 200 an hour.")}</li>
            <li>{t("The visitor sees a short thank-you page. A script can post the same fields as JSON instead.")}</li>
            <li>{t("A new key stops the old address working; the HTML on your website must then be replaced.")}</li>
          </ul>
          <button type="button" disabled={busy} onClick={() => save(true)} className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50">
            {t("Make a new key")}
          </button>
        </div>
      )}
    </section>
  );
}
