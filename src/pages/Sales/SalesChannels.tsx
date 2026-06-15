import React, { useState, useEffect, Fragment } from 'react';
import {
  PencilSquareIcon,
  TrashIcon,
  RadioIcon,
  BuildingStorefrontIcon,
  XMarkIcon,
  PhoneIcon,
  GlobeAltIcon,
  // EyeIcon,
} from "@heroicons/react/24/outline";
import { Transition, Dialog } from "@headlessui/react";
import axios from 'axios';
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { AddButton } from '../../components/common/AddButton';
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import StatsCard from "../../components/common/Statscard";
import { useNavigate } from 'react-router-dom';

interface Channel {
  id: number;
  name: string;
  channelType: string;
  contactInfo: string;
}

const API_URL = "/v1/api/sales/channels";

const channelTypes = [
  { value: 'DISTRIBUTTER', label: 'Distributor', icon: BuildingStorefrontIcon, color: 'bg-blue-500' },
  { value: 'RETAIL', label: 'Retail', icon: BuildingStorefrontIcon, color: 'bg-green-500' },
  { value: 'ONLINE', label: 'Online', icon: GlobeAltIcon, color: 'bg-purple-500' },
];

const getChannelTypeDetails = (type: string) =>
  channelTypes.find(ct => ct.value === type) || channelTypes[0];

const typeBadgeClass = (type: string) => {
  if (type === 'DISTRIBUTTER') return 'bg-blue-50 text-blue-700 border-blue-200';
  if (type === 'RETAIL') return 'bg-green-50 text-green-700 border-green-200';
  if (type === 'ONLINE') return 'bg-purple-50 text-purple-700 border-purple-200';
  return 'bg-gray-50 text-gray-700 border-gray-200';
};

// ─────────────────────────────────────────────────────────────────────────────

const SalesChannels: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem("accessToken");

  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: '', channelType: 'DISTRIBUTTER', contactInfo: '' });

  // Delete popup
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => { fetchChannels(); }, []);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const res = await axios.get(API_URL, { headers: { Authorization: `Bearer ${token}` } });
      setChannels(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditMode) {
        await axios.put(`${API_URL}/${editingId}`, formData, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(API_URL, formData, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
      }
      await fetchChannels();
      closeModal();
    } catch (err) {
      console.error(err);
      alert('Operation failed.');
    }
  };

  const promptDelete = (id: number) => { setDeletingId(id); setShowDeletePopup(true); };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await axios.delete(`${API_URL}/${deletingId}`, { headers: { Authorization: `Bearer ${token}` } });
      await fetchChannels();
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  const openAdd = () => {
    setIsEditMode(false);
    setFormData({ name: '', channelType: 'DISTRIBUTTER', contactInfo: '' });
    setEditingId(null);
    setIsModalOpen(true);
  };

  const openEdit = (ch: Channel) => {
    setIsEditMode(true);
    setFormData({ name: ch.name, channelType: ch.channelType, contactInfo: ch.contactInfo });
    setEditingId(ch.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ name: '', channelType: 'DISTRIBUTTER', contactInfo: '' });
    setEditingId(null);
  };

  // Stats
  const stats = {
    total: channels.length,
    distributors: channels.filter(c => c.channelType === 'DISTRIBUTTER').length,
    retail: channels.filter(c => c.channelType === 'RETAIL').length,
    online: channels.filter(c => c.channelType === 'ONLINE').length,
  };

  // ── Column definitions ──────────────────────────────────────────────────────
  const columns: ColumnDef<Channel>[] = [
    {
      key: 'name', label: 'Channel Name', sortable: true,
      render: (row) => {
        const td = getChannelTypeDetails(row.channelType);
        const Icon = td.icon;
        return (
          <div className="flex items-center gap-3">
            <div className={`h-9 w-9 rounded-lg ${td.color} bg-opacity-10 flex items-center justify-center shrink-0`}>
              <Icon className={`h-5 w-5 ${td.color.replace('bg-', 'text-')}`} />
            </div>
            <span className="text-sm font-medium text-gray-900">{row.name}</span>
          </div>
        );
      },
    },
    {
      key: 'channelType', label: 'Channel Type', sortable: true,
      render: (row) => {
        const td = getChannelTypeDetails(row.channelType);
        return (
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${typeBadgeClass(row.channelType)}`}>
            {td.label}
          </span>
        );
      },
    },
    {
      key: 'contactInfo', label: 'Contact Info', sortable: true,
      render: (_, value) => (
        <span className="text-sm text-gray-600 max-w-xs truncate block">{String(value)}</span>
      ),
    },
    {
      key: 'actions', label: 'Actions',
      headerClassName: '!text-right pr-8',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => navigate(`/sales/channels/view/${row.id}`)} title="View"
            className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            {/* <EyeIcon className="h-4 w-4" /> */}
          </button>
          <button onClick={() => openEdit(row)} title="Edit"
            className="p-2 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 transition-colors">
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button onClick={() => promptDelete(row.id)} title="Delete"
            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Sales Channels" description="Manage your sales channels" />
      <PageBreadcrumb pageTitle="Sales Channels" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* Header */}
        <div className="mb-8 -mt-[110px] flex justify-end">
          <AddButton label="Add Channel" onClick={openAdd} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <StatsCard label="Total Channels" value={stats.total} gradient="from-cyan-50 to-blue-50" borderColor="border-cyan-100" labelColor="text-cyan-600" />
          <StatsCard label="Distributors" value={stats.distributors} gradient="from-blue-50 to-indigo-50" borderColor="border-blue-100" labelColor="text-blue-600" />
          <StatsCard label="Retail" value={stats.retail} gradient="from-green-50 to-emerald-50" borderColor="border-green-100" labelColor="text-green-600" />
          <StatsCard label="Online" value={stats.online} gradient="from-purple-50 to-pink-50" borderColor="border-purple-100" labelColor="text-purple-600" />
        </div>

        {/* Table */}
        <ReusableTable<Channel>
          data={channels}
          columns={columns}
          loading={loading}
          onRowClick={(row) => navigate(`/sales/channels/view/${row.id}`)}
          searchable
          searchPlaceholder="Search channels by name, type, or contact..."
          searchFields={["name", "channelType", "contactInfo"]}
          pageSize={10}
          defaultSortKey="name"
          toolbar={
            <select
              onChange={e => {/* typeFilter handled internally via searchFields */ }}
              className="px-4 h-10 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all bg-white min-w-[160px]"
              defaultValue="ALL"
            >
              <option value="ALL">All Types</option>
              {channelTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          }
          emptyState={
            <div className="flex flex-col items-center py-4">
              <div className="h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <BuildingStorefrontIcon className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm font-medium mb-2">No channels found</p>
              <button onClick={openAdd} className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                Add your first channel →
              </button>
            </div>
          }
        />
      </div>

      {/* Delete popup */}
      <DynamicPopup
        isPopupOpen={showDeletePopup}
        setIsPopupOpen={setShowDeletePopup}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Channel"
        subText="Are you sure you want to delete this channel? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />

      {/* Form Modal */}
      <Transition show={isModalOpen} as={Fragment}>
        <Dialog onClose={closeModal} className="relative z-50">
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/50" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                <Dialog.Panel className="bg-white rounded-xl w-full max-w-2xl shadow-2xl">
                  <div className="flex justify-between items-center p-6 border-b">
                    <Dialog.Title className="text-xl font-semibold text-gray-900">
                      {isEditMode ? 'Edit Channel' : 'Add New Channel'}
                    </Dialog.Title>
                    <button onClick={closeModal} className="text-gray-400 hover:text-gray-500 rounded-lg p-1 hover:bg-gray-100 transition-colors">
                      <XMarkIcon className="h-6 w-6" />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Channel Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <BuildingStorefrontIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input type="text" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Enter channel name" required
                          className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Channel Type <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <RadioIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <select value={formData.channelType} onChange={e => setFormData({ ...formData, channelType: e.target.value })} required
                          className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent">
                          {channelTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Contact Info <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <PhoneIcon className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                        <textarea value={formData.contactInfo} onChange={e => setFormData({ ...formData, contactInfo: e.target.value })}
                          rows={3} required placeholder="Enter contact information (phone, email, address, etc.)"
                          className="w-full pl-10 p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent" />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                      <button type="button" onClick={closeModal}
                        className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium">
                        Cancel
                      </button>
                      <button type="submit"
                        className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white rounded-lg hover:from-cyan-700 hover:to-cyan-600 transition-colors font-medium shadow-lg shadow-cyan-500/25">
                        {isEditMode ? 'Update Channel' : 'Add Channel'}
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};

export default SalesChannels;
