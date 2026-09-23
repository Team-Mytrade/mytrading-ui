import React, { useMemo, useState } from "react";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export type Customer = {
  id: number | string;
  name: string;
  email?: string;
  phone?: string;
  code?: string;
};

type Props = {
  /** Customers currently attached to the parent record. */
  attached: Customer[];
  /** Customers that can still be added. */
  available: Customer[];
  /** Called when the user clicks Save with the final selection. */
  onSave: (next: Customer[]) => void | Promise<void>;
  /** Optional: close the modal (called by Cancel / header X). */
  onCancel?: () => void;
  saving?: boolean;
  title?: string;
  subtitle?: string;
};

export default function ManageCustomersPanel({
  attached,
  available,
  onSave,
  onCancel,
  saving = false,
  title = "Manage Customers",
  subtitle = "Assign or remove customers for this record",
}: Props) {
  const [current, setCurrent] = useState<Customer[]>(attached);
  const [search, setSearch] = useState("");

  const attachedIds = useMemo(
    () => new Set(current.map((c) => String(c.id))),
    [current]
  );

  const filteredAvailable = useMemo(() => {
    const term = search.trim().toLowerCase();
    return available
      .filter((c) => !attachedIds.has(String(c.id)))
      .filter((c) =>
        !term
          ? true
          : [c.name, c.email, c.phone, c.code]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(term))
      );
  }, [available, attachedIds, search]);

  const add = (customer: Customer) => setCurrent((prev) => [...prev, customer]);
  const remove = (customer: Customer) =>
    setCurrent((prev) => prev.filter((c) => String(c.id) !== String(customer.id)));

  const handleSave = async () => {
    await onSave(current);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
      {/* ───────── Header ───────── */}
      <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5 dark:border-gray-800">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* ───────── Body ───────── */}
      <div className="space-y-6 px-6 py-5">
        {/* Attached section */}
        <section className="record-detail-dashboard__section">
          <div className="record-detail-dashboard__section-heading">
            <div>
              <p>Customers in record</p>
              <h3>Assigned</h3>
            </div>
            <span>
              {current.length} {current.length === 1 ? "customer" : "customers"}
            </span>
          </div>

          {current.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-800/30 dark:text-gray-400">
              No customers assigned yet. Use the list below to add customers.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
              <table className="min-w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/70">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Customer
                    </th>
                    <th className="hidden px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 sm:table-cell dark:text-gray-400">
                      Email
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {current.map((customer) => (
                    <tr
                      key={customer.id}
                      className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    >
                      <td className="px-3 py-2.5 text-sm text-gray-700 dark:text-gray-300">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {customer.name}
                        </div>
                        {customer.code && (
                          <div className="text-xs text-gray-400">{customer.code}</div>
                        )}
                      </td>
                      <td className="hidden px-3 py-2.5 text-sm text-gray-600 sm:table-cell dark:text-gray-400">
                        {customer.email || "--"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => remove(customer)}
                          className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-950/50"
                        >
                          <XMarkIcon className="h-3.5 w-3.5" />
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Available section */}
        <section className="record-detail-dashboard__section">
          <div className="record-detail-dashboard__section-heading">
            <div>
              <p>Add customers</p>
              <h3>Available</h3>
            </div>
            <span>
              {filteredAvailable.length}{" "}
              {filteredAvailable.length === 1 ? "customer" : "customers"}
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-3 w-full max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers..."
              className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-9 text-sm text-gray-900 transition-all placeholder:text-gray-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:placeholder:text-gray-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          {filteredAvailable.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-8 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-800/30 dark:text-gray-400">
              {available.length === 0
                ? "No customers available to add."
                : search
                  ? "No customers match your search."
                  : "All available customers are already assigned."}
            </div>
          ) : (
            <div className="max-h-[280px] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-800">
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredAvailable.map((customer) => (
                  <li
                    key={customer.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {customer.name}
                      </div>
                      {customer.email && (
                        <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {customer.email}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => add(customer)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-100 dark:border-cyan-800/50 dark:bg-cyan-950/40 dark:text-cyan-300 dark:hover:bg-cyan-950/60"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      {/* ───────── Footer ───────── */}
      <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-800">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cyan-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}