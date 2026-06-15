import React, { useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { PencilSquareIcon, TrashIcon, XMarkIcon, MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { AddButton } from '../../components/common/AddButton';
import { BackButton } from '../../components/common/BackButton';

interface PaymentTerm {
  id: number;
  name: string;
  description?: string;
  dueDays: number;
  discountPercent?: number;
  discountDays?: number;
  penaltyPercent?: number;
}

const API_URL = 'http://localhost:5000/paymentTerms';
const PAGE_SIZE = 10;
const steps = ['Basic Info', 'Discounts & Penalties'];

export default function PaymentTermsPage() {
  const [terms, setTerms] = useState<PaymentTerm[]>([]);
  const [form, setForm] = useState<Partial<PaymentTerm>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof PaymentTerm>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => { fetchTerms(); }, []);

  const fetchTerms = async () => {
    try {
      const res = await axios.get<PaymentTerm[]>(API_URL);
      setTerms(res.data);
    } catch (err) { console.error(err); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: ['dueDays', 'discountPercent', 'discountDays', 'penaltyPercent'].includes(name) ? Number(value) : value
    }));
  };

  const handleSubmit = async () => {
    if (!form.name || form.dueDays === undefined) { alert('Name and Due Days are required.'); return; }
    const data: PaymentTerm = {
      id: editingId || Date.now(),
      name: form.name!,
      description: form.description,
      dueDays: form.dueDays!,
      discountPercent: form.discountPercent,
      discountDays: form.discountDays,
      penaltyPercent: form.penaltyPercent
    };
    try {
      if (editingId) await axios.put(`${API_URL}/${editingId}`, data);
      else await axios.post(API_URL, data);
      fetchTerms();
      setForm({});
      setEditingId(null);
      setDialogOpen(false);
      setActiveStep(0);
    } catch (err) { console.error(err); }
  };

  const handleEdit = (term: PaymentTerm) => { setForm(term); setEditingId(term.id); setDialogOpen(true); setActiveStep(0); };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure to delete this payment term?')) return;
    try { await axios.delete(`${API_URL}/${id}`); fetchTerms(); } catch (err) { console.error(err); }
  };

  const handleSort = (key: keyof PaymentTerm) => {
    if (sortKey === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortOrder('asc'); }
  };

  const filtered = terms.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortKey], bVal = b[sortKey];
    if (typeof aVal === 'string' && typeof bVal === 'string') return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    if (typeof aVal === 'number' && typeof bVal === 'number') return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    return 0;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const SortIcon = ({ col }: { col: keyof PaymentTerm }) =>
    sortKey === col ? (sortOrder === 'asc' ? <ChevronUpIcon className="w-4 h-4 text-cyan-600" /> : <ChevronDownIcon className="w-4 h-4 text-cyan-600" />) : null;

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
                <p className="text-sm text-gray-500 mt-1">Configure payment terms and discount policies</p>
              </div>
            </div>
            <AddButton
              onClick={() => { setDialogOpen(true); setForm({}); setEditingId(null); setActiveStep(0); }}
              label="Add Term"
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
                  {[
                    { key: 'name', label: 'Name' },
                    { key: 'description', label: 'Description' },
                    { key: 'dueDays', label: 'Due Days' },
                    { key: 'discountPercent', label: 'Discount %' },
                    { key: 'discountDays', label: 'Discount Days' },
                    { key: 'penaltyPercent', label: 'Penalty %' },
                  ].map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key as keyof PaymentTerm)}
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {label}
                        <SortIcon col={key as keyof PaymentTerm} />
                      </div>
                    </th>
                  ))}
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">No payment terms found.</td>
                  </tr>
                ) : paginated.map(term => (
                  <tr key={term.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{term.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{term.description || '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{term.dueDays}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{term.discountPercent ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{term.discountDays ?? '—'}</td>
                    <td className="px-6 py-4 text-sm text-gray-700">{term.penaltyPercent ?? '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(term)} className="p-2 rounded-lg hover:bg-cyan-50 text-cyan-600 hover:text-cyan-700 transition-colors" title="Edit">
                          <PencilSquareIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(term.id)} className="p-2 rounded-lg hover:bg-red-50 text-red-500 hover:text-red-600 transition-colors" title="Delete">
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
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${page === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}>
                  Previous
                </button>
                {Array.from({ length: totalPages }, (_, i) => (
                  <button key={i} onClick={() => setPage(i + 1)}
                    className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${page === i + 1 ? 'bg-cyan-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}>
                    {i + 1}
                  </button>
                ))}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${page === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}>
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialog */}
      <Transition show={dialogOpen}>
        <Dialog onClose={() => setDialogOpen(false)} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm" />
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{editingId ? 'Edit Payment Term' : 'Add Payment Term'}</h2>
                <p className="text-sm text-gray-500 mt-0.5">{editingId ? 'Update term details' : 'Create a new payment term'}</p>
              </div>
              <button onClick={() => setDialogOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Stepper */}
            <div className="flex items-center mb-6">
              {steps.map((s, i) => (
                <div key={s} className="flex items-center flex-1">
                  <div className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-medium ${activeStep === i ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</div>
                  <span className="ml-2 text-sm text-gray-600">{s}</span>
                  {i < steps.length - 1 && <div className="flex-1 h-0.5 bg-gray-200 mx-3" />}
                </div>
              ))}
            </div>

            <div className="space-y-4">
              {activeStep === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" name="name" placeholder="Name" className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" value={form.name || ''} onChange={handleChange} required />
                  <input type="text" name="description" placeholder="Description" className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" value={form.description || ''} onChange={handleChange} />
                  <input type="number" name="dueDays" placeholder="Due Days" className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" value={form.dueDays || ''} onChange={handleChange} required />
                </div>
              )}
              {activeStep === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input type="number" name="discountPercent" placeholder="Discount %" className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" value={form.discountPercent || ''} onChange={handleChange} />
                  <input type="number" name="discountDays" placeholder="Discount Days" className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" value={form.discountDays || ''} onChange={handleChange} />
                  <input type="number" name="penaltyPercent" placeholder="Penalty %" className="border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500" value={form.penaltyPercent || ''} onChange={handleChange} />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button disabled={activeStep === 0} onClick={() => setActiveStep(prev => prev - 1)} className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50">Back</button>
              {activeStep < steps.length - 1 ? (
                <button onClick={() => setActiveStep(prev => prev + 1)} className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-medium hover:from-cyan-700 hover:to-blue-700 transition-all">Next</button>
              ) : (
                <button onClick={handleSubmit} className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-medium hover:from-cyan-700 hover:to-blue-700 transition-all">{editingId ? 'Update' : 'Add'}</button>
              )}
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
}
