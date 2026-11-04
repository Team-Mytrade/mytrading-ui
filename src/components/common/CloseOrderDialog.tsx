import { FormEvent, useState } from "react";
import PaginatedPopup from "./unpopup";
import { ToasterService } from "../../Services/ToasterService";
import { t } from "../../i18n/i18n";

/** Asks why an order is cancelled or closed short; the reason is kept on the order (sales and purchase orders). */
export default function CloseOrderDialog({
  title,
  subtitle,
  submitLabel,
  onSubmit,
  onClose,
}: {
  title: string;
  subtitle: string;
  submitLabel: string;
  onSubmit: (reason: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!reason.trim()) {
      ToasterService.error(t("Say why"), t("The reason is kept on the order."));
      return;
    }
    setSaving(true);
    try {
      await onSubmit(reason.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <PaginatedPopup
      isOpen
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={submitLabel}
      submitting={saving}
      maxWidthClassName="max-w-md"
      fields={[
        <label key="reason" className="col-span-full block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-gray-300">{t("Reason")} *</span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={3}
            autoFocus
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 dark:border-gray-700 dark:bg-[#222222] dark:text-white"
          />
        </label>,
      ]}
    />
  );
}
