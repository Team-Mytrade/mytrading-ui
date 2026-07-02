import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import {
  BuildingStorefrontIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  RadioIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import {
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
  FloatingTextarea,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

type SalesChannel = {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId: string;
  name: string;
  channelType: string;
  contactInfo: string;
};

type ChannelForm = {
  tenantId: string;
  name: string;
  channelType: string;
  contactInfo: string;
};

const API_URL = "/v1/api/sales/channels";
const PAGE_SIZE = 10;
const channelTypeOptions = ["DIRECT", "DISTRIBUTOR", "RETAIL", "ONLINE"];

function getStoredTenantId() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.tenantId || "";
  } catch {
    return "";
  }
}

const emptyForm: ChannelForm = {
  tenantId: getStoredTenantId(),
  name: "",
  channelType: "DIRECT",
  contactInfo: "",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.detail || data?.error || data?.title || fallback;
  }
  return fallback;
}

const badgeClass = (type: string) => {
  if (type === "DIRECT") return "bg-blue-50 text-blue-700 border-blue-200";
  if (type === "DISTRIBUTOR") return "bg-purple-50 text-purple-700 border-purple-200";
  if (type === "RETAIL") return "bg-green-50 text-green-700 border-green-200";
  if (type === "ONLINE") return "bg-cyan-50 text-cyan-700 border-cyan-200";
  return "bg-gray-50 text-gray-700 border-gray-200";
};

const SalesChannels: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

  const [channels, setChannels] = useState<SalesChannel[]>([]);
  const [form, setForm] = useState<ChannelForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [lookupId, setLookupId] = useState("");
  const [deleteChannel, setDeleteChannel] = useState<SalesChannel | null>(null);

  useEffect(() => {
    fetchChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const res = await axios.get<SalesChannel[]>(API_URL, { headers });
      const data = Array.isArray(res.data) ? res.data : [];
      setChannels(data);
      if (data.length === 0) ToasterService.noData("No sales channels found");
    } catch (error) {
      ToasterService.error("Failed to load sales channels", getErrorMessage(error, "Please try again."));
      setChannels([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchById = async () => {
    if (!lookupId) {
      ToasterService.error("Channel ID is required");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.get<SalesChannel>(`${API_URL}/${lookupId}`, { headers });
      setChannels([res.data]);
      ToasterService.success("Sales channel loaded");
    } catch (error) {
      ToasterService.error("Failed to load sales channel", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const buildPayload = () => ({
    id: editingId || 0,
    tenantId: form.tenantId.trim(),
    name: form.name.trim(),
    channelType: form.channelType,
    contactInfo: form.contactInfo.trim(),
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.name.trim() || !form.channelType) {
      ToasterService.error("Required fields missing", "Name and channel type are required.");
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();
      const res = editingId
        ? await axios.put<SalesChannel>(`${API_URL}/${editingId}`, payload, { headers })
        : await axios.post<SalesChannel>(API_URL, payload, { headers });

      setChannels((current) => {
        const exists = current.some((item) => item.id === res.data.id);
        if (exists) return current.map((item) => (item.id === res.data.id ? res.data : item));
        return [res.data, ...current];
      });
      ToasterService.success(editingId ? "Sales channel updated" : "Sales channel created");
      closeForm();
    } catch (error) {
      ToasterService.error("Failed to save sales channel", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, tenantId: getStoredTenantId() });
    setShowFormModal(true);
  };

  const openEdit = (channel: SalesChannel) => {
    setEditingId(channel.id);
    setForm({
      tenantId: channel.tenantId || getStoredTenantId(),
      name: channel.name || "",
      channelType: channel.channelType || "DIRECT",
      contactInfo: channel.contactInfo || "",
    });
    setShowFormModal(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(false);
  };

  const confirmDelete = async () => {
    if (!deleteChannel) return;

    try {
      await axios.delete(`${API_URL}/${deleteChannel.id}`, {
        headers,
        skipSessionExpiredHandling: true,
      } as any);
      setChannels((current) => current.filter((item) => item.id !== deleteChannel.id));
      ToasterService.success("Sales channel deleted");
    } catch (error) {
      ToasterService.error("Failed to delete sales channel", getErrorMessage(error, "Please try again."));
    } finally {
      setDeleteChannel(null);
    }
  };

  const filteredChannels = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return channels;
    return channels.filter((channel) =>
      [channel.id, channel.name, channel.channelType, channel.contactInfo, channel.tenantId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [channels, search]);

  const stats = useMemo(() => ({
    total: channels.length,
    direct: channels.filter((item) => item.channelType === "DIRECT").length,
    online: channels.filter((item) => item.channelType === "ONLINE").length,
    activeTypes: new Set(channels.map((item) => item.channelType).filter(Boolean)).size,
  }), [channels]);

  const columns: ColumnDef<SalesChannel>[] = [
    {
      key: "name",
      label: "Channel",
      sortable: true,
      render: (channel) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-500/10 bg-cyan-50">
            <BuildingStorefrontIcon className="h-4 w-4 text-cyan-700" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">{channel.name || "Unnamed"}</div>
            <div className="text-xs text-slate-500">ID: {channel.id}</div>
          </div>
        </div>
      ),
    },
    {
      key: "channelType",
      label: "Type",
      sortable: true,
      render: (channel) => (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(channel.channelType)}`}>
          {channel.channelType || "N/A"}
        </span>
      ),
    },
    { key: "contactInfo", label: "Contact Info", sortable: true },
    { key: "tenantId", label: "Tenant", sortable: true },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (channel) => (
        <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openEdit(channel)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteChannel(channel)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageMeta title="Sales Channels" description="Manage sales channels" />
      <PageBreadcrumb pageTitle="Sales Channels" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={openCreate} label="Add Sales Channel" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Channels" value={stats.total} icon={<BuildingStorefrontIcon />} />
          <StatsCard
            label="Direct"
            value={stats.direct}
            gradient="from-blue-50 to-cyan-50"
            borderColor="border-blue-100"
            labelColor="text-blue-600"
            icon={<RadioIcon />}
          />
          <StatsCard
            label="Online"
            value={stats.online}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<CheckCircleIcon />}
          />
          <StatsCard
            label="Active Types"
            value={stats.activeTypes}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
            icon={<BuildingStorefrontIcon />}
          />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <FloatingInput
              label="Channel ID"
              type="number"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
            />
            <button
              type="button"
              onClick={fetchById}
              className="h-[52px] rounded-lg bg-cyan-600 px-5 text-sm font-medium text-white transition hover:bg-cyan-700"
            >
              Get By ID
            </button>
            <button
              type="button"
              onClick={fetchChannels}
              className="h-[52px] rounded-lg bg-gray-100 px-5 text-sm font-medium text-gray-700 transition hover:bg-gray-200"
            >
              Load All
            </button>
          </div>
        </div>

        <div className="relative w-full sm:max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search sales channels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        <ReusableTable
          data={filteredChannels}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="name"
          defaultSortOrder="asc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <BuildingStorefrontIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No sales channels found</p>
              <button type="button" onClick={openCreate} className="text-xs font-medium text-cyan-600 hover:text-cyan-700">
                Create your first sales channel
              </button>
            </div>
          }
        />
      </div>

      {showFormModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 p-4 backdrop-blur-sm sm:items-center">
            <div className="mx-auto max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 p-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {editingId ? "Edit Sales Channel" : "Create Sales Channel"}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500">Enter sales channel details from the API schema</p>
                </div>
                <button type="button" onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-5">
                <div className="grid grid-cols-1 gap-4 pt-2 md:grid-cols-2">
                  <FloatingInput label="Name" name="name" value={form.name} onChange={handleChange} required />
                  <FloatingSelect
                    label="Channel Type"
                    name="channelType"
                    value={form.channelType}
                    onChange={handleChange}
                    includeEmptyOption={false}
                    options={channelTypeOptions.map((item) => ({ id: item, name: item }))}
                    required
                  />
                </div>
                <FloatingTextarea
                  label="Contact Info"
                  name="contactInfo"
                  value={form.contactInfo}
                  onChange={handleChange}
                  rows={3}
                />

                <div className="mt-4 flex flex-col justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-cyan-700 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {submitting ? "Saving..." : editingId ? "Update Sales Channel" : "Create Sales Channel"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

      <DynamicPopup
        isPopupOpen={!!deleteChannel}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteChannel(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Sales Channel"
        subText={deleteChannel ? `Are you sure you want to delete channel #${deleteChannel.id}?` : "Are you sure?"}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteChannel(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default SalesChannels;
