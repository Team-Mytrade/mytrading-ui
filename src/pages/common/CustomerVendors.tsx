import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { PencilSquareIcon, TrashIcon, BuildingOffice2Icon, PhoneIcon, EnvelopeIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import DynamicPopup from "../../components/common/Popup";
import Dragger from "../../components/common/Dragger";
import StatsCardFilter, { StatsCardOption, useStatsCardFilter } from "../../components/common/StatsCardFilter";
import { AddButton } from "../../components/common/AddButton";
import { ICON_BUTTON_CLASS } from "../../components/common/CloseButton";
import ReusableTable, { ColumnDef, formatDisplayDate, formatMoney } from "../../components/common/Table";
import { FloatingInput, FloatingTextarea } from "../../components/inputfeild/FloatingInput";
import { usePermissions } from "../../access/usePermissions";
import { apiError } from "../../utils/apiError";

/* ------------------------------------------------------------------ */
/* Types (match the Swagger for /v1/api/invoice/vendors)               */
/* ------------------------------------------------------------------ */

interface VendorBill {
  id: number;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount?: number;
  purchaseInvoiceStatus?: string;
}

interface VendorPayable {
  id: number;
  invoiceAmount?: number;
  amountPaid?: number;
  balance?: number;
  accountsPayableStatus?: string;
  dueDate?: string;
}

interface Vendor {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxIdentificationNumber?: string;
  creditLimit?: number;
  invoices?: VendorBill[];
  accountsPayables?: VendorPayable[];
  // Worked out here for the table, cards, sorting and export
  billCount?: number;
  outstanding?: number;
}

/**
 * POST / PUT body: only the vendor's own fields.
 * The vendor's `invoices` and `accountsPayables` lists (returned by GET) are never sent back,
 * so editing a vendor cannot overwrite or drop its bills and payables.
 */
interface VendorPayload {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  taxIdentificationNumber?: string;
  creditLimit?: number;
}

type VendorForm = {
  name: string;
  email: string;
  phone: string;
  address: string;
  taxIdentificationNumber: string;
  creditLimit: string;
};

/* ------------------------------------------------------------------ */
/* Settings and helpers                                                */
/* ------------------------------------------------------------------ */

const API_URL = "/v1/api/invoice/vendors";
const PAGE_SIZE = 10;
const EMPTY_FORM: VendorForm = { name: "", email: "", phone: "", address: "", taxIdentificationNumber: "", creditLimit: "" };

/** Indian GSTIN: 2-digit state code + PAN + entity number + Z + check character. */
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const asArray = <T,>(value: any): T[] => {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.content)) return value.content;
  return [];
};

const toPaise = (value: unknown) => Math.round((Number(value) || 0) * 100);

/** What is still owed to the vendor = sum of the balances of its payables. */
const outstandingOf = (v: Vendor) => (v.accountsPayables || []).reduce((t, p) => t + toPaise(p.balance), 0) / 100;
const isOverLimit = (v: Vendor) => Number(v.creditLimit || 0) > 0 && Number(v.outstanding || 0) > Number(v.creditLimit || 0);

/* Clickable contact details with an icon. Phone opens the dialer, email opens the mail app. */
const LINK_CLASS = "group inline-flex min-w-0 max-w-full items-center gap-1 text-sm text-slate-600 hover:text-cyan-700";
const ICON_CLASS = "h-3.5 w-3.5 flex-shrink-0 text-slate-400 group-hover:text-cyan-600";

const PhoneLink = ({ value }: { value?: string }) =>
  value ? (
    <a href={`tel:${value.replace(/[^\d+]/g, "")}`} className={LINK_CLASS} title={`Call ${value}`}>
      <PhoneIcon className={ICON_CLASS} />
      <span className="truncate">{value}</span>
    </a>
  ) : (
    <span className="text-sm text-slate-400">--</span>
  );

const EmailLink = ({ value }: { value?: string }) =>
  value ? (
    <a href={`mailto:${value}`} className={LINK_CLASS} title={`Email ${value}`}>
      <EnvelopeIcon className={ICON_CLASS} />
      <span className="truncate">{value}</span>
    </a>
  ) : (
    <span className="text-sm text-slate-400">--</span>
  );

/** Address box that starts as one line and grows as you type. */
const AutoGrowTextarea = (props: React.ComponentProps<typeof FloatingTextarea>) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const resize = () => {
    const textarea = wrapperRef.current?.querySelector("textarea");
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(52, textarea.scrollHeight + 2)}px`;
  };
  useLayoutEffect(resize, [props.value]);
  return (
    <div ref={wrapperRef} onInput={resize}>
      <FloatingTextarea {...props} rows={1} />
    </div>
  );
};

/** The vendor's bills and payables, shown in the row details drawer. */
const VendorActivity = ({ vendor }: { vendor: Vendor }) => {
  const bills = vendor.invoices || [];
  const payables = vendor.accountsPayables || [];
  if (!bills.length && !payables.length) return <span className="text-gray-400">No bills or payables yet</span>;
  return (
    <div className="w-full space-y-3">
      {bills.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-3 py-2">Bill</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2 text-right">Amount</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
              {bills.map((b) => (
                <tr key={b.id}>
                  <td className="px-3 py-2 font-medium text-slate-800 dark:text-gray-100">{b.invoiceNumber || `#${b.id}`}</td>
                  <td className="px-3 py-2 text-slate-600">{b.invoiceDate ? formatDisplayDate(b.invoiceDate) : "--"}</td>
                  <td className="px-3 py-2 text-slate-600">{b.dueDate ? formatDisplayDate(b.dueDate) : "--"}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{formatMoney(Number(b.totalAmount || 0))}</td>
                  <td className="px-3 py-2 text-slate-600">{String(b.purchaseInvoiceStatus || "--").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {payables.length > 0 && (
        <p className="text-xs text-slate-500">
          {payables.length} payable{payables.length === 1 ? "" : "s"} · still owed {formatMoney(outstandingOf(vendor))}
        </p>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const Vendors: React.FC = () => {
  const { canCreate, canUpdate, canDelete } = usePermissions();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<VendorForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [toDelete, setToDelete] = useState<Vendor | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* ---------------- Load ---------------- */

  const fetchVendors = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(API_URL);
      setVendors(
        asArray<Vendor>(res.data).map((v) => ({
          ...v,
          billCount: (v.invoices || []).length,
          outstanding: outstandingOf(v),
        }))
      );
    } catch (err) {
      console.error("Error fetching vendors", err);
      ToasterService.error("Failed to load vendors");
      setVendors([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
    // Toolbar Refresh icon reloads the list
    const reload = () => fetchVendors();
    window.addEventListener("reusable-table:refresh", reload);
    return () => window.removeEventListener("reusable-table:refresh", reload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- Cards ---------------- */

  const cards = useMemo<StatsCardOption<Vendor>[]>(
    () => [
      { key: "ALL", label: "Total Vendors", match: () => true, tone: "cyan" },
      { key: "OWED", label: "We Owe Money", match: (v) => Number(v.outstanding || 0) > 0, tone: "amber" },
      { key: "OVER", label: "Over Credit Limit", match: (v) => isOverLimit(v), tone: "red" },
      { key: "NO_TAX", label: "No GSTIN", match: (v) => !v.taxIdentificationNumber, tone: "slate" },
    ],
    []
  );
  const { filteredRows, cardFilterProps, selected } = useStatsCardFilter(vendors, cards);

  /* ---------------- Form ---------------- */

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (v: Vendor) => {
    setForm({
      name: v.name || "",
      email: v.email || "",
      phone: v.phone || "",
      address: v.address || "",
      taxIdentificationNumber: v.taxIdentificationNumber || "",
      creditLimit: v.creditLimit != null ? String(v.creditLimit) : "",
    });
    setEditingId(v.id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.replace(/[\s-]/g, "");
    const gstin = form.taxIdentificationNumber.trim().toUpperCase();
    if (!name) return ToasterService.error("Vendor name is required");
    if (vendors.some((v) => v.id !== editingId && (v.name || "").trim().toLowerCase() === name.toLowerCase())) {
      return ToasterService.error(`A vendor called "${name}" already exists`);
    }
    if (email && !EMAIL_PATTERN.test(email)) return ToasterService.error("Enter a valid email address");
    if (phone && !/^\+?\d{10,15}$/.test(phone)) return ToasterService.error("Enter a valid phone number (10 to 15 digits)");
    if (gstin && !GSTIN_PATTERN.test(gstin)) return ToasterService.error("GSTIN must be 15 characters, e.g. 27AAPFU0939F1ZV");
    if (form.creditLimit !== "" && (Number(form.creditLimit) < 0 || !Number.isFinite(Number(form.creditLimit)))) {
      return ToasterService.error("Credit limit cannot be negative");
    }

    const payload: VendorPayload = {
      name,
      email: email || undefined,
      phone: phone || undefined,
      address: form.address.trim() || undefined,
      taxIdentificationNumber: gstin || undefined,
      creditLimit: form.creditLimit === "" ? undefined : Number(form.creditLimit),
    };

    setSubmitting(true);
    try {
      if (editingId !== null) await axios.put(`${API_URL}/${editingId}`, payload);
      else await axios.post(API_URL, payload);
      ToasterService.success(editingId !== null ? `${name} updated` : `${name} added`);
      closeForm();
      fetchVendors();
    } catch (err) {
      console.error("Error saving vendor", err);
      ToasterService.error(apiError(err, "Failed to save vendor"));
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------------- Delete ---------------- */

  /** A vendor with bills or payables can't be deleted (it would break those records). */
  const hasActivity = (v: Vendor) => Number(v.billCount || 0) > 0 || (v.accountsPayables || []).length > 0;

  const confirmDelete = async () => {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/${toDelete.id}`);
      ToasterService.success(`${toDelete.name || "Vendor"} deleted`);
      setShowDelete(false);
      setToDelete(null);
      fetchVendors();
    } catch (err) {
      ToasterService.error(apiError(err, "Failed to delete vendor"));
      console.error("Error deleting vendor", err);
      ToasterService.error(apiError(err, "Failed to delete vendor"));
    } finally {
      setDeleting(false);
    }
  };

  /* ---------------- Table ---------------- */

  const tableColumns: ColumnDef<Vendor>[] = [
    {
      key: "name",
      label: "Vendor",
      sortable: true,
      render: (v) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-cyan-500/10 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 shadow-sm">
            <span className="text-sm font-semibold text-cyan-700">{v.name ? v.name.charAt(0).toUpperCase() : "V"}</span>
          </div>
          <span className="truncate text-sm font-semibold leading-snug text-slate-900">{v.name || "--"}</span>
        </div>
      ),
    },
    {
      // Click to send an email
      key: "email",
      label: "Email",
      sortable: true,
      detailFormatter: (v) => <EmailLink value={v.email} />,
      render: (v) => <EmailLink value={v.email} />,
    },
    {
      // Click to call
      key: "phone",
      label: "Phone",
      sortable: true,
      detailFormatter: (v) => <PhoneLink value={v.phone} />,
      render: (v) => <PhoneLink value={v.phone} />,
    },
    {
      key: "taxIdentificationNumber",
      label: "GSTIN",
      sortable: true,
      render: (v) => <span className="font-mono text-xs text-slate-600">{v.taxIdentificationNumber || "--"}</span>,
    },
    {
      key: "billCount",
      label: "Bills",
      sortable: true,
      filterable: false,
      sortValueGetter: (v) => Number(v.billCount || 0),
      // Details drawer: the vendor's bills
      detailFormatter: (v) => <VendorActivity vendor={v} />,
      render: (v) => <span className="text-sm text-slate-600">{v.billCount || 0}</span>,
    },
    {
      // Outstanding against the credit limit, with a small bar
      key: "outstanding",
      label: "Owed / Credit Limit",
      sortable: true,
      filterable: false,
      sortValueGetter: (v) => Number(v.outstanding || 0),
      detailFormatter: (v) =>
        `${formatMoney(Number(v.outstanding || 0))} owed${Number(v.creditLimit || 0) > 0 ? ` of ${formatMoney(Number(v.creditLimit))} limit` : " (no credit limit)"}`,
      exportValueGetter: (v) => formatMoney(Number(v.outstanding || 0)),
      render: (v) => {
        const limit = Number(v.creditLimit || 0);
        const owed = Number(v.outstanding || 0);
        const percent = limit > 0 ? Math.min(100, Math.round((owed / limit) * 100)) : 0;
        return (
          <div className="min-w-0">
            <span className={`text-sm font-semibold ${isOverLimit(v) ? "text-red-600" : "text-slate-700"}`}>{formatMoney(owed)}</span>
            <span className="text-xs text-slate-400"> / {limit > 0 ? formatMoney(limit) : "no limit"}</span>
            {limit > 0 && (
              <div className="mt-1 h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-slate-100 dark:bg-gray-800" title={`${percent}% of the credit limit used`}>
                <div className={`h-full rounded-full ${percent >= 100 ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${percent}%` }} />
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "creditLimit",
      label: "Credit Limit",
      sortable: true,
      filterable: false,
      excludeFromDetails: true,
      sortValueGetter: (v) => Number(v.creditLimit || 0),
      exportValueGetter: (v) => (Number(v.creditLimit || 0) > 0 ? formatMoney(Number(v.creditLimit)) : ""),
      render: (v) => <span className="text-sm text-slate-600">{Number(v.creditLimit || 0) > 0 ? formatMoney(Number(v.creditLimit)) : "--"}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "w-[10%] text-right pr-4",
      className: "w-[10%] text-right",
      render: (v) => (
        <div className="flex items-center justify-end gap-0.5">
          {canUpdate && (
            <button type="button" onClick={() => openEdit(v)} className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600" title="Edit Vendor">
              <PencilSquareIcon className="h-4 w-4" />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => {
                if (hasActivity(v)) {
                  ToasterService.error(`${v.name} has bills or payables, so it cannot be deleted.`);
                  return;
                }
                setToDelete(v);
                setShowDelete(true);
              }}
              className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
              title={hasActivity(v) ? "Has bills – cannot be deleted" : "Delete Vendor"}
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Invoice Vendors" description="Vendors used for purchase invoices and payables" />
      <PageBreadcrumb
        className="mr-4"
        pageTitle="Invoice Vendors"
        actions={canCreate ? <AddButton className="-mr-5" label="Add Vendor" onClick={openCreate} /> : undefined}
      />

      {/* Same wrapper as the Invoice pages (no py), so the spacing matches */}
      <div className="w-full max-w-none px-0">
        <div className="px-3">
          <StatsCardFilter {...cardFilterProps} />

          <ReusableTable
            data={filteredRows}
            columns={tableColumns}
            pageSize={PAGE_SIZE}
            defaultSortKey="name"
            defaultSortOrder="asc"
            loading={isLoading}
            rowDetailsTitle={(v) => v.name || "Vendor"}
            rowDetailsSubtitle="Vendor details, bills and what we owe"
            // The raw lists are replaced by the Bills table and the Owed column
            hiddenDetailKeys={["invoices", "accountsPayables"]}
            suspendRowDetails={showForm || showDelete}
            rowDetailsActions={(v: Vendor) =>
              canUpdate ? (
                <button type="button" onClick={() => openEdit(v)} className={ICON_BUTTON_CLASS} title="Edit" aria-label="Edit this record">
                  <PencilSquareIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : null
            }
            emptyState={
              <div className="flex flex-col items-center justify-center py-12">
                <BuildingOffice2Icon className="mb-3 h-12 w-12 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">No vendors found</p>
                {selected !== "ALL" ? (
                  <p className="text-xs text-gray-400">Click the selected card again to show all vendors</p>
                ) : (
                  canCreate && (
                    <button type="button" onClick={openCreate} className="mt-1 text-xs font-medium text-cyan-600 hover:text-cyan-700">
                      Create your first vendor
                    </button>
                  )
                )}
              </div>
            }
          />
        </div>

        <Dragger
          isOpen={showForm}
          variant="modal"
          title={editingId !== null ? "Edit Vendor" : "Add Vendor"}
          subtitle="Who you buy from. Used on purchase invoices, payables and vendor payments."
          onClose={closeForm}
          onSubmit={handleSubmit}
          submitting={submitting}
          submitLabel={editingId !== null ? "Update" : "Create"}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <FloatingInput label="Vendor Name" name="name" value={form.name} onChange={handleChange} maxLength={150} required />
            </div>
            <FloatingInput label="Email" name="email" type="email" value={form.email} onChange={handleChange} maxLength={150} />
            <FloatingInput label="Phone" name="phone" type="tel" inputMode="tel" value={form.phone} onChange={handleChange} maxLength={20} />
            <FloatingInput
              label="GSTIN"
              name="taxIdentificationNumber"
              value={form.taxIdentificationNumber}
              onChange={(e) => setForm({ ...form, taxIdentificationNumber: e.target.value.toUpperCase().replace(/\s/g, "") })}
              maxLength={15}
            />
            <FloatingInput
              label="Credit Limit (₹)"
              name="creditLimit"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              value={form.creditLimit}
              onChange={handleChange}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
              onWheel={(e: React.WheelEvent<HTMLInputElement>) => e.currentTarget.blur()}
            />
            <div className="md:col-span-2">
              <AutoGrowTextarea label="Address" name="address" value={form.address} onChange={handleChange} />
            </div>
          </div>
        </Dragger>

        <DynamicPopup
          isPopupOpen={showDelete}
          setIsPopupOpen={setShowDelete}
          icon={<TrashIcon className="h-6 w-6 text-red-600" />}
          iconBg="bg-red-100"
          innerText="Delete Vendor"
          subText={toDelete ? `Delete "${toDelete.name}"? This cannot be undone.` : ""}
          confirmLabel={deleting ? "Deleting..." : "Delete"}
          cancelLabel="Cancel"
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
        />
      </div>
    </>
  );
};

export default Vendors;
