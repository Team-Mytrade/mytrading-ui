import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { AlertTriangle, ArrowUpRight, Lock, RotateCcw, Send, Sparkles } from "lucide-react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { apiError } from "../../utils/apiError";
import { AuthContext } from "../../context/AuthContext";
import { hasPermission } from "../../access/access";
import { formatDate } from "../../company/format";
import { CARD, PAGE_BODY, PRIMARY_BUTTON, SECONDARY_BUTTON } from "../Payroll/hrmsUi";
import { t } from "../../i18n/i18n";

const API = "/v1/api/invoice/ask";

interface Source { tool: string; title: string; link: string; refused: boolean; note: string | null }
interface Status {
  configured: boolean; enabled: boolean; usedThisMonth: number; monthlyLimit: number | null; resetsOn: string | null; model: string;
  message: string | null; reports: Source[];
}
interface Answer { answer: string; sources: Source[]; model: string; usedThisMonth: number; monthlyLimit: number | null }
interface Turn { id: number; question: string; answer?: Answer; error?: string }

const EXAMPLES = [
  "Which customers owe us the most, and how much of it is overdue?",
  "What was our profit last month?",
  "What should we reorder this week?",
  "Will our cash drop below zero in the next 8 weeks?",
  "How are sales doing this month?",
];

/**
 * Ask MyTrade (backlog 7.2.3 step 3): questions in plain language, answered only from the company's own reports, each
 * opened as the person asking. The answer names the reports it used and links to them; nothing is changed.
 */
export default function AskPage() {
  const { access } = useContext(AuthContext);
  const isAdmin = hasPermission(access, "USERS:ADMIN");
  const [status, setStatus] = useState<Status | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const nextId = useRef(1);

  const loadStatus = useCallback(() => {
    axios.get<Status>(`${API}/status`).then((r) => setStatus(r.data)).catch(() => setStatus(null));
  }, []);
  useEffect(() => { loadStatus(); }, [loadStatus]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [turns, busy]);

  const ready = !!status && status.configured && status.enabled && !status.message;

  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    // The earlier questions and answers (the server keeps nothing between questions)
    const history = turns.flatMap((turn) => turn.answer
      ? [{ role: "user", text: turn.question }, { role: "assistant", text: turn.answer.answer }] : []);
    const id = nextId.current++;
    setTurns((all) => [...all, { id, question: q }]);
    setQuestion("");
    setBusy(true);
    try {
      const { data } = await axios.post<Answer>(API, { question: q, history });
      setTurns((all) => all.map((turn) => (turn.id === id ? { ...turn, answer: data } : turn)));
      setStatus((s) => (s ? { ...s, usedThisMonth: data.usedThisMonth } : s));
    } catch (err) {
      setTurns((all) => all.map((turn) => (turn.id === id ? { ...turn, error: apiError(err, t("Please try again.")) } : turn)));
      loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const allowed = status?.reports.filter((r) => !r.refused) ?? [];

  return (
    <>
      <PageMeta title={t("Ask MyTrade")} description="Questions answered from your company's reports" />
      <PageBreadcrumb pageTitle="Ask MyTrade" />
      <div className={`${PAGE_BODY} mx-auto flex max-w-4xl flex-col gap-4`}>
        <p className="text-sm text-slate-600 dark:text-gray-300">
          {t("Ask about sales, money owed, profit, cash or stock. Answers come only from the reports you can open, with a link to each; nothing is changed.")}
        </p>

        {status && !ready && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <span>
              {t(status.message ?? "AI questions aren't available.")}
              {isAdmin && status.configured && !status.enabled && <> <Link className="underline" to="/company-settings">{t("Open Company Settings")}</Link></>}
            </span>
          </div>
        )}

        {turns.length === 0 && (
          <div className={`${CARD} space-y-3 p-4`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{t("Try asking")}</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <button key={e} type="button" disabled={!ready || busy} className={`${SECONDARY_BUTTON} text-start`} onClick={() => ask(t(e))}>{t(e)}</button>
              ))}
            </div>
            {allowed.length > 0 && (
              <p className="text-xs text-slate-500 dark:text-gray-400">
                {t("Reports it can look at for you")}: {allowed.map((r) => t(r.title)).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3" aria-live="polite">
          {turns.map((turn) => (
            <div key={turn.id} className="flex flex-col gap-2">
              <div className="self-end max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-ee-sm bg-[rgb(var(--brand-600,0_151_167))] px-4 py-2 text-sm text-white" dir="auto">{turn.question}</div>
              {turn.answer ? (
                <div className={`${CARD} max-w-[92%] space-y-3 p-4`}>
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 flex-none text-[rgb(var(--brand-600,0_151_167))]" />
                    <div className="whitespace-pre-wrap text-sm leading-6 text-slate-800 dark:text-gray-100" dir="auto">{turn.answer.answer}</div>
                  </div>
                  {turn.answer.sources.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 dark:border-gray-800">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{t("From")}</span>
                      {turn.answer.sources.map((s) => s.refused ? (
                        <span key={s.tool} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-gray-800 dark:text-gray-400" title={t("You don't have access to this report")}>
                          <Lock className="h-3 w-3" /> {t(s.title)}
                        </span>
                      ) : (
                        <Link key={s.tool} to={s.link} className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-800 hover:bg-cyan-100 dark:bg-cyan-950/40 dark:text-cyan-200">
                          {t(s.title)} <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : turn.error ? (
                <div className="flex max-w-[92%] items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                  <span className="flex-1">{turn.error}</span>
                  <button type="button" className="inline-flex items-center gap-1 text-xs underline" disabled={busy || !ready}
                    onClick={() => { setTurns((all) => all.filter((x) => x.id !== turn.id)); ask(turn.question); }}>
                    <RotateCcw className="h-3 w-3" /> {t("Ask again")}
                  </button>
                </div>
              ) : (
                <div className={`${CARD} max-w-[92%] p-4 text-sm text-slate-500`}>
                  <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 animate-pulse" /> {t("Looking at your reports…")}</span>
                </div>
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <form className={`${CARD} sticky bottom-2 flex items-end gap-2 p-2`} onSubmit={(e) => { e.preventDefault(); ask(question); }}>
          <label htmlFor="ask-q" className="sr-only">{t("Your question")}</label>
          <textarea id="ask-q" rows={2} maxLength={1000} dir="auto" value={question} disabled={!ready}
            placeholder={t("Ask a question about your business…")}
            className="min-h-[2.75rem] flex-1 resize-none rounded-lg border-0 bg-transparent px-2 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-white"
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(question); } }} />
          <button type="submit" className={PRIMARY_BUTTON} disabled={!ready || busy || !question.trim()}><Send className="h-4 w-4" /> {t("Ask")}</button>
        </form>
        {status?.configured && status.enabled && (
          <p className="text-center text-[11px] text-slate-400">
            {status.monthlyLimit == null
              ? t("{n} AI uses this month", { n: status.usedThisMonth })
              : t("{n} of {limit} AI uses this month", { n: status.usedThisMonth, limit: status.monthlyLimit })}
            {status.resetsOn ? ` · ${t("resets")} ${formatDate(status.resetsOn)}` : ""} · {t("Answers can be wrong: check the figures in the report.")}
          </p>
        )}
      </div>
    </>
  );
}
