import React, { useEffect, useState } from "react";
import { Dialog } from "@headlessui/react";
import { PencilSquareIcon, TrashIcon, XMarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import axios from "axios";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import { BackButton } from "../../components/common/BackButton";

interface PriceListEntry {
  id: number;
  productName: string;
  basePrice: number;
  discountPercent: number;
  validFrom: string;
  validTo: string;
}

const API_URL = "http://localhost:5000/priceList";
const PAGE_SIZE = 10;

export default function PriceListDiscountPage() {
  const [entries, setEntries] = useState<PriceListEntry[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<PriceListEntry | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Omit<PriceListEntry, "id">>({
    productName: "",
    basePrice: 0,
    discountPercent: 0,
    validFrom: "",
    validTo: "",
  });
  const [page, setPage] = useState(1);

  useEffect(() => { fetchEntries(); }, []);

  const fetchEntries = async () => {
    const res = await axios.get<PriceListEntry[]>(API_URL);
    setEntries(res.data);
  };

  useEffect(() => {
    if (editing) setForm(editing);
    else setForm({ productName: "", basePrice: 0, discountPercent: 0, validFrom: "", validTo: "" });
  }, [editing, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({
      ...f,
      [name]: name === "basePrice" || name === "discountPercent" ? Number(value) : value,
    }));
  };

  const saveEntry = async () => {
    if (editing) { await axios.put(`${API_URL}/${editing.id}`, form); }
    else { await axios.post(API_URL, form); }
    fetchEntries();
    setIsOpen(false);
    setEditing(null);
  };

  const deleteEntry = async (id: number) => {
    if (confirm("Delete this entry?")) {
      await axios.delete(`${API_URL}/${id}`);
      fetchEntries();
    }
  };

  const calculateFinalPrice = (price: number, discount: number) =>
    (price - price * (discount / 100)).toFixed(2);

  const filtered = entries.filter(e =>
    e.productName.toLowerCase().includes(search.toLowerCase())
  );
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <>
      <PageMeta title="Price List & Discounts" description="Manage product price list and discounts" />
      <PageBreadcrumb pageTitle="Price List & Discounts" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-4 -mt-1">
              <BackButton />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Price List & Discounts</h1>
                <p className="text-sm text-gray-500 mt-1">Manage product pricing and discount rules</p>
              </div>
            </div>
            <AddButton
              onClick={() => { setEditing(null); setIsOpen(true); }}
              label="Add Entry"
            />
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by product name..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
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
                  {["Product", "Base Price", "Discount %", "Final Price", "Valid From", "Valid To"].map(h => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">No entries found.</td>
                  </tr>
                ) : paginated.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{e.productName}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">${e.basePrice.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800">
                        {e.discountPercent}%
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-green-700">${calculateFinalPrice(e.basePrice, e.discountPercent)}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{e.validFrom}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{e.validTo}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setEditing(e); setIsOpen(true); }} className="p-2 rounded-lg hover:bg-cyan-50 text-cyan-600 hover:text-cyan-700 transition-colors" title="Edit">
                          <PencilSquareIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => deleteEntry(e.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors" title="Delete">
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Showing {((page - 1) * PAGE_SIZE) + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} results
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${page === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}>Previous</button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i} onClick={() => setPage(i + 1)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${page === i + 1 ? 'bg-cyan-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}>
                    {i + 1}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${page === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <Dialog open={isOpen} onClose={() => setIsOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <Dialog.Title className="text-xl font-semibold text-gray-900">{editing ? "Edit Entry" : "New Entry"}</Dialog.Title>
                <p className="text-sm text-gray-500 mt-0.5">{editing ? "Update price list entry" : "Add a new price list entry"}</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <input name="productName" placeholder="Product Name" value={form.productName} onChange={handleChange} className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
              <input type="number" name="basePrice" placeholder="Base Price" value={form.basePrice} onChange={handleChange} className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
              <input type="number" name="discountPercent" placeholder="Discount %" value={form.discountPercent} onChange={handleChange} className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
              <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center text-sm text-gray-600">
                Final: <span className="font-semibold text-green-700 ml-2">${calculateFinalPrice(form.basePrice, form.discountPercent)}</span>
              </div>
              <input type="date" name="validFrom" value={form.validFrom} onChange={handleChange} className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
              <input type="date" name="validTo" value={form.validTo} onChange={handleChange} className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" />
            </div>

            <div className="flex justify-end gap-3">
              <button onClick={() => setIsOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors">Cancel</button>
              <button onClick={saveEntry} className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-medium hover:from-cyan-700 hover:to-blue-700 transition-all shadow-md">
                {editing ? "Update" : "Create"}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  );
}
