import React, { useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import { BackButton } from "../../components/common/BackButton";

interface LineItem {
  id: number;
  description: string;
  quantity: number;
  price: number;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  customer: string;
  date: string;
  dueDate: string;
  status: "Unpaid" | "Paid" | "Overdue" | "Cancelled";
  items: LineItem[];
}

const statusColors: Record<string, string> = {
  Unpaid: "bg-yellow-100 text-yellow-800",
  Paid: "bg-green-100 text-green-800",
  Overdue: "bg-red-100 text-red-800",
  Cancelled: "bg-gray-200 text-gray-700",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Omit<Invoice, "id">>({
    invoiceNumber: "",
    customer: "",
    date: new Date().toISOString().split("T")[0],
    dueDate: "",
    status: "Unpaid",
    items: [],
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const addLineItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { id: Date.now(), description: "", quantity: 1, price: 0 }],
    }));
  };

  const updateLineItem = (id: number, field: keyof LineItem, value: any) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    }));
  };

  const removeLineItem = (id: number) => {
    setForm((prev) => ({ ...prev, items: prev.items.filter((item) => item.id !== id) }));
  };

  const totalAmount = form.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const handleSubmit = () => {
    if (editingId !== null) {
      setInvoices((prev) => prev.map((inv) => (inv.id === editingId ? { ...inv, ...form } : inv)));
    } else {
      setInvoices([{ id: Date.now(), ...form }, ...invoices]);
    }
    resetForm();
    setDialogOpen(false);
  };

  const resetForm = () => {
    setForm({
      invoiceNumber: "",
      customer: "",
      date: new Date().toISOString().split("T")[0],
      dueDate: "",
      status: "Unpaid",
      items: [],
    });
    setEditingId(null);
  };

  const handleEdit = (invoice: Invoice) => {
    setForm({ ...invoice });
    setEditingId(invoice.id);
    setDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Delete this invoice?")) {
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
    }
  };

  const filtered = invoices.filter(
    (inv) =>
      inv.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <PageMeta title="Invoices" description="Manage sales invoices" />
      <PageBreadcrumb pageTitle="Invoices" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-4 -mt-1">
              <BackButton />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
                <p className="text-sm text-gray-500 mt-1">Create and manage sales invoices</p>
              </div>
            </div>
            <AddButton
              onClick={() => { resetForm(); setDialogOpen(true); }}
              label="New Invoice"
            />
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice number or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all duration-200"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {["Invoice #", "Customer", "Date", "Due Date", "Total", "Status"].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No invoices found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.invoiceNumber}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{inv.customer}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{inv.date}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{inv.dueDate}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        ${inv.items.reduce((sum, i) => sum + i.price * i.quantity, 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.status]}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(inv)}
                            className="p-2 rounded-lg hover:bg-cyan-50 text-cyan-600 hover:text-cyan-700 transition-colors"
                            title="Edit"
                          >
                            <PencilSquareIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(inv.id)}
                            className="p-2 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Invoice Modal */}
      <Transition show={dialogOpen}>
        <Dialog
          onClose={() => { resetForm(); setDialogOpen(false); }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />
          <Transition.Child
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6 relative z-10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Dialog.Title className="text-xl font-semibold text-gray-900">
                    {editingId !== null ? "Edit Invoice" : "New Invoice"}
                  </Dialog.Title>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {editingId !== null ? "Update invoice details" : "Create a new invoice"}
                  </p>
                </div>
                <button
                  onClick={() => { resetForm(); setDialogOpen(false); }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <input type="text" name="invoiceNumber" value={form.invoiceNumber} onChange={handleChange} placeholder="Invoice #" className="border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" required />
                  <input type="text" name="customer" value={form.customer} onChange={handleChange} placeholder="Customer" className="border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" required />
                  <input type="date" name="date" value={form.date} onChange={handleChange} className="border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
                  <input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} className="border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Line Items</h3>
                  {form.items.map((item) => (
                    <div key={item.id} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
                      <input type="text" value={item.description} onChange={(e) => updateLineItem(item.id, "description", e.target.value)} placeholder="Description" className="border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
                      <input type="number" value={item.quantity} onChange={(e) => updateLineItem(item.id, "quantity", Number(e.target.value))} placeholder="Qty" className="border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
                      <input type="number" value={item.price} onChange={(e) => updateLineItem(item.id, "price", Number(e.target.value))} placeholder="Price" className="border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
                      <button type="button" onClick={() => removeLineItem(item.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Remove</button>
                    </div>
                  ))}
                  <button type="button" onClick={addLineItem} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">+ Add Line Item</button>
                </div>

                <div className="flex justify-between items-center">
                  <select name="status" value={form.status} onChange={handleChange} className="border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500">
                    <option value="Unpaid">Unpaid</option>
                    <option value="Paid">Paid</option>
                    <option value="Overdue">Overdue</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                  <p className="font-semibold text-gray-900">Total: ${totalAmount.toFixed(2)}</p>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button type="button" onClick={() => { resetForm(); setDialogOpen(false); }} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-medium hover:from-cyan-700 hover:to-blue-700 transition-all shadow-md">
                    {editingId !== null ? "Update" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </Transition.Child>
        </Dialog>
      </Transition>
    </>
  );
}
