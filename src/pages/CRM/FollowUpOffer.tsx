import React, { useEffect, useState } from "react";
import axios from "axios";
import { CheckCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { ToasterService } from "../../Services/ToasterService";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import { ACTIVITY_TYPE_OPTIONS, apiError, crmDateTime, toDateTimeInput, toLocalDateTime } from "./crmShared";
import { t } from "../../i18n/i18n";

// After an interaction is logged (backlog 8.3.5): close the open tasks on the same lead or customer
// and plan the next follow-up, so the follow-up reminder has nothing to chase.

const ACTIVITIES_API = "/v1/api/crm/activities";

interface OpenTask {
  id: number;
  title: string;
  description?: string;
  activityType?: string;
  priority?: string;
  status?: string;
  scheduledTime?: string;
  completedTime?: string;
  assignedTo?: string;
  lead?: { id: number } | null;
  customer?: { id: number } | null;
  contact?: { id: number } | null;
}

export interface FollowUpTarget {
  leadId?: number | null;
  customerId?: number | null;
  contactId?: number | null;
  name: string;
  // The interaction's subject, a starting point for the next task's title
  subject: string;
}

const inDays = (days: number) => {
  const when = new Date();
  when.setDate(when.getDate() + days);
  when.setHours(10, 0, 0, 0);
  return toDateTimeInput(toLocalDateTime(when));
};

/** The open tasks on a lead (or customer), or [] when they can't be read. */
export const openTasksOf = async (target: FollowUpTarget): Promise<OpenTask[]> => {
  const path = target.leadId ? `lead/${target.leadId}` : target.customerId ? `customer/${target.customerId}` : null;
  if (!path) return [];
  try {
    const res = await axios.get<OpenTask[]>(`${ACTIVITIES_API}/${path}`);
    return (Array.isArray(res.data) ? res.data : [])
      .filter((a) => a.status === "PENDING")
      .sort((a, b) => String(a.scheduledTime ?? "").localeCompare(String(b.scheduledTime ?? "")));
  } catch {
    return [];
  }
};

const linkQuery = (task: OpenTask) => {
  const params = new URLSearchParams();
  if (task.lead?.id) params.set("leadId", String(task.lead.id));
  if (task.customer?.id) params.set("customerId", String(task.customer.id));
  if (task.contact?.id) params.set("contactId", String(task.contact.id));
  return params.toString() ? `?${params.toString()}` : "";
};

interface Props {
  target: FollowUpTarget | null;
  openTasks: OpenTask[];
  me: string;
  onClose: () => void;
}

const FollowUpOffer: React.FC<Props> = ({ target, openTasks, me, onClose }) => {
  const [done, setDone] = useState<Set<number>>(new Set());
  const [planNext, setPlanNext] = useState(true);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("CALL");
  const [when, setWhen] = useState(inDays(7));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!target) return;
    // Every open task is ticked: the conversation usually covered them
    setDone(new Set(openTasks.map((task) => task.id)));
    setPlanNext(true);
    setTitle(target.subject ? `${t("Follow up:")} ${target.subject}` : t("Follow up"));
    setType("CALL");
    setWhen(inDays(7));
  }, [target, openTasks]);

  if (!target) return null;

  const toggle = (id: number) =>
    setDone((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    if (planNext && (!title.trim() || !when)) {
      ToasterService.warning("Enter the next follow-up's title and date");
      return;
    }
    setSaving(true);
    let completed = 0;
    let failed = 0;
    try {
      for (const task of openTasks.filter((item) => done.has(item.id))) {
        try {
          await axios.put(`${ACTIVITIES_API}/${task.id}${linkQuery(task)}`, {
            title: task.title,
            description: task.description,
            activityType: task.activityType,
            priority: task.priority,
            status: "COMPLETED",
            scheduledTime: task.scheduledTime || undefined,
            completedTime: undefined,
            assignedTo: task.assignedTo,
          });
          completed++;
        } catch (err) {
          console.error("Error completing task:", err);
          failed++;
        }
      }
      if (planNext) {
        const params = new URLSearchParams();
        if (target.leadId) params.set("leadId", String(target.leadId));
        if (target.customerId) params.set("customerId", String(target.customerId));
        if (target.contactId) params.set("contactId", String(target.contactId));
        await axios.post(`${ACTIVITIES_API}?${params.toString()}`, {
          title: title.trim(),
          activityType: type,
          priority: "MEDIUM",
          status: "PENDING",
          scheduledTime: `${when.slice(0, 16)}:00`,
          assignedTo: me || undefined,
        });
      }
      if (failed) {
        ToasterService.warning(t("{n} task(s) couldn't be marked done").replace("{n}", String(failed)));
      }
      if (planNext) ToasterService.success("Next follow-up planned");
      else if (completed) ToasterService.success("Tasks marked done");
      onClose();
    } catch (err) {
      console.error("Error planning the follow-up:", err);
      ToasterService.error(apiError(err, "Couldn't plan the next follow-up"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-overlay-dim data-overlay className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 backdrop-blur-sm p-4 sm:items-center">
      <div data-overlay-panel className="w-full max-w-lg mx-auto max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-[#272727]">
        <div data-overlay-header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-[#272727]">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t("Follow up")}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{target.name}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("Close")} className="text-gray-400 hover:text-gray-600">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {openTasks.length > 0 && (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-200">{t("Open tasks — mark done")}</h4>
              <ul className="space-y-1.5">
                {openTasks.map((task) => (
                  <li key={task.id}>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-white/5">
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                        checked={done.has(task.id)}
                        onChange={() => toggle(task.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-gray-800 dark:text-gray-100">{task.title}</span>
                        <span className="block text-xs text-gray-500 dark:text-gray-400">
                          {task.scheduledTime ? crmDateTime(task.scheduledTime) : t("No date")}
                          {task.assignedTo ? ` · ${task.assignedTo}` : ""}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <label className="mb-3 flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-gray-800 dark:text-gray-200">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                checked={planNext}
                onChange={(e) => setPlanNext(e.target.checked)}
              />
              {t("Plan the next follow-up")}
            </label>
            {planNext && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <FloatingInput label={t("Title")} name="followUpTitle" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <FloatingSelect label={t("Type")} name="followUpType" value={type} onChange={(e) => setType(e.target.value)} options={ACTIVITY_TYPE_OPTIONS} />
                <FloatingInput type="datetime-local" label={t("When")} name="followUpWhen" value={when} onChange={(e) => setWhen(e.target.value)} required />
                <p className="text-xs text-gray-500 sm:col-span-2 dark:text-gray-400">{t("The task is assigned to you and shows on Tasks.")}</p>
              </div>
            )}
          </section>
        </div>

        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-100 bg-white p-5 dark:border-gray-700 dark:bg-[#272727]">
          <button type="button" onClick={onClose} className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-200">
            {t("Skip")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || (!planNext && done.size === 0)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:opacity-50"
          >
            <CheckCircleIcon className="h-4 w-4" />
            {saving ? t("Saving...") : t("Save")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FollowUpOffer;
