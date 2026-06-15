import React, { useEffect, useState } from "react";
import axios from "axios";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon, PencilSquareIcon, TrashIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import { BackButton } from "../../components/common/BackButton";

interface PaymentTerm {
  id: number;
  name: string;
  description?: string;
  dueDays: number;
  discountPercent?: number;
  discountDays?: number;
  penaltyPercent?: number;
}

const API_URL = "http://localhost:5000/paymentTerms";
const PAGE_SIZE = 5;
const steps = ["Basic Info", "Discounts & Penalties"];

export default function PaymentTermsPage() {
  const [terms, setTerms] = useState<PaymentTerm[]>([]);
  const [form, setForm] = useState<Partial<PaymentTerm>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof PaymentTerm>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    try {
      const res = await axios.get<PaymentTerm[]>(API_URL);
      setTerms(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm({
      ...form,
      [name]:
        ["dueDays", "discountPercent", "discountDays", "penaltyPercent"].includes(
          name
        )
          ? Number(value)
          : value,
    });
  };

  const handleSubmit = async () => {
    if (!form.name || form.dueDays === undefined) {
      alert("Name and Due Days are required.");
      return;
    }

    const data: PaymentTerm = {
      id: editingId || Date.now(),
      name: form.name,
      description: form.description,
      dueDays: form.dueDays,
      discountPercent: form.discountPercent,
      discountDays: form.discountDays,
      penaltyPercent: form.penaltyPercent,
    };

    try {
      if (editingId) await axios.put(`${API_URL}/${editingId}`, data);
      else await axios.post(API_URL, data);
      fetchTerms();
      setForm({});
      setEditingId(null);
      setDialogOpen(false);
      setActiveStep(0);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEdit = (term: PaymentTerm) => {
    setForm(term);
    setEditingId(term.id);
    setDialogOpen(true);
    setActiveStep(0);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure to delete this payment term?")) return;
    try {
      await axios.delete(`${API_URL}/${id}`);
      fetchTerms();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSort = (key: keyof PaymentTerm) => {
    if (sortKey === key) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const filtered = terms.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageMeta title="Payment Terms" description="Manage payment terms" />
      <PageBreadcrumb pageTitle="Payment Terms" />

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex items-center gap-4 -mt-1">
            <BackButton />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payment Terms</h1>
              <p className="text-sm text-gray-500 mt-1">Configure payment terms and conditions</p>
            </div>
          </div>
          <AddButton
            onClick={() => { setDialogOpen(true); setForm({}); setEditingId(null); setActiveStep(0); }}
            label="Add Payment Term"
          />
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all duration-200"
          />
        </div>
      </div>

        {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm text-gray-700">
          <thead className="bg-gray-50 font-semibold">
            <tr>
              <th
                className="px-6 py-4 cursor-pointer text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                onClick={() => handleSort("name")}
              >
                Name {sortKey === "name" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
              <th
                className="px-6 py-4 cursor-pointer text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                onClick={() => handleSort("dueDays")}
              >
                Due Days {sortKey === "dueDays" && (sortOrder === "asc" ? "↑" : "↓")}
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount %</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount Days</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Penalty %</th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No payment terms found.
                </td>
              </tr>
            ) : (
              paginated.map((term) => (
                <tr key={term.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">{term.name}</td>
                  <td className="px-6 py-4">{term.description}</td>
                  <td className="px-6 py-4">{term.dueDays}</td>
                  <td className="px-6 py-4">{term.discountPercent ?? "—"}</td>
                  <td className="px-6 py-4">{term.discountDays ?? "—"}</td>
                  <td className="px-6 py-4">{term.penaltyPercent ?? "—"}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(term)}
                        className="p-2 rounded-lg hover:bg-cyan-50 text-cyan-600 hover:text-cyan-700 transition-colors"
                        title="Edit"
                      >
                        <PencilSquareIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDelete(term.id)}
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

        {/* Pagination */}
        <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Showing {((page - 1) * PAGE_SIZE) + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} results
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${page === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}>
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setPage(i + 1)}
                className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${
                  page === i + 1 ? 'bg-cyan-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                }`}>{i + 1}</button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${page === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}>
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      <Transition show={dialogOpen}>
        <Dialog
          onClose={() => setDialogOpen(false)}
          className="fixed inset-0 z-10 flex items-center justify-center p-4"
        >
          <Dialog.Panel className="fixed inset-0 bg-black/30" />
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6 relative z-20">
            <button
              onClick={() => setDialogOpen(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-semibold mb-6">
              {editingId ? "Edit Payment Term" : "Add Payment Term"}
            </h2>

            {/* Stepper */}
            <div className="flex justify-between mb-6">
              {steps.map((label, idx) => (
                <div key={label} className="flex-1 text-center">
                  <div
                    className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                      activeStep === idx
                        ? "bg-cyan-600 text-white"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="text-xs">{label}</div>
                </div>
              ))}
            </div>

            {/* Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="space-y-4"
            >
              {activeStep === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    name="name"
                    placeholder="Name"
                    className="border p-2 rounded-md"
                    value={form.name || ""}
                    onChange={handleChange}
                    required
                  />
                  <input
                    type="text"
                    name="description"
                    placeholder="Description"
                    className="border p-2 rounded-md"
                    value={form.description || ""}
                    onChange={handleChange}
                  />
                  <input
                    type="number"
                    name="dueDays"
                    placeholder="Due Days"
                    className="border p-2 rounded-md"
                    value={form.dueDays || ""}
                    onChange={handleChange}
                    required
                  />
                </div>
              )}

              {activeStep === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    type="number"
                    name="discountPercent"
                    placeholder="Discount %"
                    className="border p-2 rounded-md"
                    value={form.discountPercent || ""}
                    onChange={handleChange}
                  />
                  <input
                    type="number"
                    name="discountDays"
                    placeholder="Discount Days"
                    className="border p-2 rounded-md"
                    value={form.discountDays || ""}
                    onChange={handleChange}
                  />
                  <input
                    type="number"
                    name="penaltyPercent"
                    placeholder="Penalty %"
                    className="border p-2 rounded-md"
                    value={form.penaltyPercent || ""}
                    onChange={handleChange}
                  />
                </div>
              )}

              {/* Live Preview */}
              <div className="mt-4 p-4 border rounded-md bg-gray-50">
                <h3 className="font-semibold text-gray-700 mb-2">Live Preview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-800">
                  <div>
                    <span className="font-medium">Name:</span> {form.name || "-"}
                  </div>
                  <div>
                    <span className="font-medium">Due Days:</span>{" "}
                    {form.dueDays ?? "-"}
                  </div>
                  <div>
                    <span className="font-medium">Discount:</span>{" "}
                    {form.discountPercent ? `${form.discountPercent}%` : "-"}{" "}
                    {form.discountDays ? `(within ${form.discountDays} days)` : ""}
                  </div>
                  <div>
                    <span className="font-medium">Penalty:</span>{" "}
                    {form.penaltyPercent ? `${form.penaltyPercent}%` : "-"}
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between mt-6">
                <button
                  type="button"
                  disabled={activeStep === 0}
                  onClick={() => setActiveStep((prev) => prev - 1)}
                  className="px-4 py-2 border rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Back
                </button>
                {activeStep < steps.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setActiveStep((prev) => prev + 1)}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md shadow"
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-md shadow"
                  >
                    {editingId ? "Update" : "Add"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </Dialog>
      </Transition>
    </div>
    </>
  );
}
