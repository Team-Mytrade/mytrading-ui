import React, { useEffect, useState, ChangeEvent } from "react";
import axios from "axios";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import {
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from "../../components/common/AddButton";
import { BackButton } from "../../components/common/BackButton";

interface DeliverySchedule {
  id: number;
  orderId: number;
  customerId: number;
  deliveryDate: string;
  status: "Scheduled" | "Delivered" | "Delayed" | "Cancelled";
  quantity: number;
  address: string;
  notes?: string;
}

const API_URL = "http://localhost:5000/deliverySchedules";
const PAGE_SIZE = 10;
const steps = ["Basic Info", "Details"];

const statusColors: Record<string, string> = {
  Scheduled: "bg-blue-100 text-blue-800",
  Delivered: "bg-green-100 text-green-800",
  Delayed: "bg-yellow-100 text-yellow-800",
  Cancelled: "bg-red-100 text-red-800",
};

const DeliverySchedulePage: React.FC = () => {
  const [schedules, setSchedules] = useState<DeliverySchedule[]>([]);
  const [form, setForm] = useState<Partial<DeliverySchedule>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openForm, setOpenForm] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof DeliverySchedule>("deliveryDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchSchedules();
  }, []);

  const fetchSchedules = async () => {
    try {
      const res = await axios.get<DeliverySchedule[]>(API_URL);
      setSchedules(res.data);
    } catch (err) {
      console.error("Failed to fetch schedules", err);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        name === "quantity" || name === "orderId" || name === "customerId"
          ? Number(value)
          : value,
    }));
  };

  const handleSubmit = async () => {
    if (!form.orderId || !form.customerId || !form.deliveryDate || !form.status || !form.quantity || !form.address) {
      alert("Please fill all required fields.");
      return;
    }
    const data: DeliverySchedule = {
      id: editingId || Date.now(),
      orderId: form.orderId,
      customerId: form.customerId,
      deliveryDate: form.deliveryDate,
      status: form.status as DeliverySchedule["status"],
      quantity: form.quantity,
      address: form.address,
      notes: form.notes,
    };
    try {
      if (editingId) await axios.put(`${API_URL}/${editingId}`, data);
      else await axios.post(API_URL, data);
      fetchSchedules();
      setForm({});
      setEditingId(null);
      setOpenForm(false);
      setActiveStep(0);
    } catch (err) {
      console.error("Failed to save schedule", err);
    }
  };

  const handleEdit = (schedule: DeliverySchedule) => {
    setForm(schedule);
    setEditingId(schedule.id);
    setOpenForm(true);
    setActiveStep(0);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this schedule?")) return;
    try {
      await axios.delete(`${API_URL}/${id}`);
      fetchSchedules();
    } catch (err) {
      console.error("Failed to delete schedule", err);
    }
  };

  const handleSort = (key: keyof DeliverySchedule) => {
    if (sortKey === key) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortOrder("asc"); }
  };

  const filtered = schedules.filter(
    (s) =>
      s.address.toLowerCase().includes(search.toLowerCase()) ||
      s.status.toLowerCase().includes(search.toLowerCase())
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

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const SortIcon = ({ col }: { col: keyof DeliverySchedule }) =>
    sortKey === col ? (
      sortOrder === "asc" ? <ChevronUpIcon className="w-4 h-4 text-cyan-600" /> : <ChevronDownIcon className="w-4 h-4 text-cyan-600" />
    ) : null;

  return (
    <>
      <PageMeta title="Delivery Schedulessfdnsln" description="Manage delivery schedules" />
      <PageBreadcrumb pageTitle="Delivery Schedules" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div className="flex items-center gap-4 -mt-1">
              <BackButton />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Delivery Schedules</h1>
                <p className="text-sm text-gray-500 mt-1">Track and manage product delivery schedules</p>
              </div>
            </div>
            <AddButton
              onClick={() => { setOpenForm(true); setForm({}); setEditingId(null); setActiveStep(0); }}
              label="Add Schedule"
            />
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by address or status..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
                  {[
                    { key: "orderId", label: "Order ID" },
                    { key: "customerId", label: "Customer ID" },
                    { key: "deliveryDate", label: "Delivery Date" },
                    { key: "status", label: "Status" },
                  ].map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key as keyof DeliverySchedule)}
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {label}
                        <SortIcon col={key as keyof DeliverySchedule} />
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      No delivery schedules found.
                    </td>
                  </tr>
                ) : (
                  paginated.map((sch) => (
                    <tr key={sch.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-700">{sch.orderId}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{sch.customerId}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{new Date(sch.deliveryDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[sch.status] || "bg-gray-100 text-gray-700"}`}>
                          {sch.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{sch.quantity}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{sch.address}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{sch.notes || "—"}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(sch)}
                            className="p-2 rounded-lg hover:bg-cyan-50 text-cyan-600 hover:text-cyan-700 transition-colors"
                            title="Edit"
                          >
                            <PencilSquareIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(sch.id)}
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
          {totalPages > 1 && (
            <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
              <p className="text-sm text-gray-500">
                Showing {((page - 1) * PAGE_SIZE) + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} results
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${page === 1 ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"}`}
                >
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i + 1)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${page === i + 1 ? "bg-cyan-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"}`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${page === totalPages ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"}`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Form Dialog */}
      <Transition appear show={openForm} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setOpenForm(false)}>
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex items-center justify-center min-h-full p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
                  <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <div>
                      <Dialog.Title className="text-xl font-semibold text-gray-900">
                        {editingId ? "Edit Delivery Schedule" : "Add Delivery Schedule"}
                      </Dialog.Title>
                      <p className="text-sm text-gray-500 mt-1">
                        {editingId ? "Update schedule details" : "Create a new delivery schedule"}
                      </p>
                    </div>
                    <button onClick={() => setOpenForm(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <div className="p-6">
                    {/* Stepper */}
                    <div className="flex items-center mb-6">
                      {steps.map((label, idx) => (
                        <div key={label} className="flex items-center flex-1">
                          <div className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-medium ${activeStep === idx ? "bg-cyan-600 text-white" : "bg-gray-100 text-gray-500"}`}>
                            {idx + 1}
                          </div>
                          <span className="ml-2 text-sm text-gray-600">{label}</span>
                          {idx < steps.length - 1 && <div className="flex-1 h-0.5 bg-gray-200 mx-3" />}
                        </div>
                      ))}
                    </div>

                    {activeStep === 0 && (
                      <div className="space-y-4">
                        {[
                          { name: "orderId", placeholder: "Order ID", type: "number" },
                          { name: "customerId", placeholder: "Customer ID", type: "number" },
                          { name: "deliveryDate", placeholder: "Delivery Date", type: "date" },
                        ].map(({ name, placeholder, type }) => (
                          <input
                            key={name}
                            type={type}
                            name={name}
                            placeholder={placeholder}
                            value={(form as any)[name] || ""}
                            onChange={handleChange}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                          />
                        ))}
                        <select
                          name="status"
                          value={form.status || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                        >
                          <option value="">Select Status</option>
                          <option value="Scheduled">Scheduled</option>
                          <option value="Delivered">Delivered</option>
                          <option value="Delayed">Delayed</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>
                    )}

                    {activeStep === 1 && (
                      <div className="space-y-4">
                        <input
                          type="number"
                          name="quantity"
                          placeholder="Quantity"
                          value={form.quantity || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                        />
                        <input
                          type="text"
                          name="address"
                          placeholder="Address"
                          value={form.address || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
                        />
                        <textarea
                          name="notes"
                          placeholder="Notes (optional)"
                          value={form.notes || ""}
                          onChange={handleChange}
                          rows={3}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all resize-none"
                        />
                      </div>
                    )}

                    <div className="flex justify-between mt-6">
                      <button
                        disabled={activeStep === 0}
                        onClick={() => setActiveStep((prev) => prev - 1)}
                        className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        Back
                      </button>
                      {activeStep < steps.length - 1 ? (
                        <button
                          onClick={() => setActiveStep((prev) => prev + 1)}
                          className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-medium hover:from-cyan-700 hover:to-blue-700 transition-all"
                        >
                          Next
                        </button>
                      ) : (
                        <button
                          onClick={handleSubmit}
                          className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-medium hover:from-cyan-700 hover:to-blue-700 transition-all"
                        >
                          {editingId ? "Update" : "Create"}
                        </button>
                      )}
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default DeliverySchedulePage;
