import React, { useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { TrashIcon, XMarkIcon, MagnifyingGlassIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import axios from 'axios';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { AddButton } from '../../components/common/AddButton';
import { BackButton } from '../../components/common/BackButton';

interface Salesperson {
  id: number;
  name: string;
  email: string;
  phone: string;
  region: string;
  status: 'Active' | 'Inactive';
  quota: number;
  currentSales: number;
}

const API_URL = 'http://localhost:5000/salespersons';
const PAGE_SIZE = 5;

export default function SalespersonPage() {
  const [salespersons, setSalespersons] = useState<Salesperson[]>([]);
  const [form, setForm] = useState<Partial<Salesperson>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof Salesperson>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Fetch salespersons
  useEffect(() => {
    fetchSalespersons();
  }, []);

  const fetchSalespersons = async () => {
    const res = await axios.get<Salesperson[]>(API_URL);
    setSalespersons(res.data);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: ['quota', 'currentSales'].includes(name) ? Number(value) : value
    }));
  };

  const handleSubmit = async () => {
    if (editingId !== null) {
      await axios.put(`${API_URL}/${editingId}`, form);
    } else {
      await axios.post(API_URL, form);
    }
    fetchSalespersons();
    setForm({});
    setEditingId(null);
    setDialogOpen(false);
  };

  const handleEdit = (sp: Salesperson) => {
    setForm(sp);
    setEditingId(sp.id);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (deleteId !== null) await axios.delete(`${API_URL}/${deleteId}`);
    fetchSalespersons();
    setDeleteId(null);
  };

  const handleSort = (key: keyof Salesperson) => {
    if (sortKey === key) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // Filter, sort, paginate
  const filtered = salespersons.filter(sp => sp.name.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === 'string' && typeof bVal === 'string')
      return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    if (typeof aVal === 'number' && typeof bVal === 'number')
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    return 0;
  });
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <PageMeta title="Salespersons" description="Manage salespersons" />
      <PageBreadcrumb pageTitle="Salespersons" />

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex items-center gap-4 -mt-1">
            <BackButton />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Salespersons</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your sales team members</p>
            </div>
          </div>
          <AddButton
            onClick={() => { setDialogOpen(true); setForm({}); setEditingId(null); }}
            label="Add Salesperson"
          />
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all duration-200"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 font-semibold text-gray-700">
            <tr>
              <th onClick={() => handleSort('name')} className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                Name {sortKey === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th onClick={() => handleSort('region')} className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100">
                Region {sortKey === 'region' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quota</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Sales</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">No records found.</td>
              </tr>
            ) : (
              paginated.map(sp => (
                <tr key={sp.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">{sp.name}</td>
                  <td className="px-6 py-4">{sp.region}</td>
                  <td className="px-6 py-4">{sp.phone}</td>
                  <td className="px-6 py-4">{sp.email}</td>
                  <td className="px-6 py-4">{sp.quota}</td>
                  <td className="px-6 py-4">{sp.currentSales}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      sp.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>{sp.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-2 rounded-lg hover:bg-cyan-50 text-cyan-600 transition-colors" onClick={() => handleEdit(sp)} title="Edit">
                        <PencilSquareIcon className="h-5 w-5" />
                      </button>
                      <button className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors" onClick={() => setDeleteId(sp.id)} title="Delete">
                        <TrashIcon className="h-5 w-5" />
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
            {filtered.length} results
          </p>
          <div className="flex gap-2">
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i}
                className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${page === i + 1 ? 'bg-cyan-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}
                onClick={() => setPage(i + 1)}>{i + 1}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Form Dialog */}
      <Transition show={dialogOpen}>
        <Dialog onClose={() => setDialogOpen(false)} className="fixed inset-0 z-10 flex items-center justify-center p-4">
          <Dialog.Panel className="fixed inset-0 bg-black/30" />
          <Transition.Child
            enter="transition ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="transition ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl p-6 relative">
              <button onClick={() => setDialogOpen(false)} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600">
                <XMarkIcon className="h-5 w-5" />
              </button>
              <Dialog.Title className="text-lg font-semibold mb-4">{editingId !== null ? 'Edit Salesperson' : 'Add Salesperson'}</Dialog.Title>
              <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" name="name" value={form.name || ''} onChange={handleChange} placeholder="Name" className="border rounded-md p-2" required />
                  <input type="text" name="email" value={form.email || ''} onChange={handleChange} placeholder="Email" className="border rounded-md p-2" required />
                  <input type="text" name="phone" value={form.phone || ''} onChange={handleChange} placeholder="Phone" className="border rounded-md p-2" required />
                  <input type="text" name="region" value={form.region || ''} onChange={handleChange} placeholder="Region" className="border rounded-md p-2" required />
                  <input type="number" name="quota" value={form.quota || ''} onChange={handleChange} placeholder="Quota" className="border rounded-md p-2" required />
                  <input type="number" name="currentSales" value={form.currentSales || ''} onChange={handleChange} placeholder="Current Sales" className="border rounded-md p-2" required />
                  <select name="status" value={form.status || 'Active'} onChange={handleChange} className="border rounded-md p-2">
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <button type="button" onClick={() => setDialogOpen(false)} className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50">Cancel</button>
                  <button type="submit" className="px-4 py-2 rounded-md bg-cyan-600 hover:bg-cyan-700 text-white">{editingId !== null ? 'Update' : 'Add'}</button>
                </div>
              </form>
            </div>
          </Transition.Child>
        </Dialog>
      </Transition>

      {/* Delete Confirmation */}
      {deleteId !== null && (
        <Transition show={deleteId !== null}>
          <Dialog onClose={() => setDeleteId(null)} className="fixed inset-0 z-10 flex items-center justify-center p-4">
            <Dialog.Panel className="fixed inset-0 bg-black/30" />
            <Transition.Child
              enter="transition ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="transition ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-6 relative">
                <Dialog.Title className="text-lg font-semibold mb-4">Delete Salesperson</Dialog.Title>
                <p>Are you sure you want to delete this salesperson?</p>
                <div className="flex justify-end gap-2 pt-4">
                  <button type="button" onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-md border border-gray-300 hover:bg-gray-50">Cancel</button>
                  <button type="button" onClick={handleDelete} className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white">Delete</button>
                </div>
              </div>
            </Transition.Child>
          </Dialog>
        </Transition>
      )}
    </div>
    </>
  );
}
