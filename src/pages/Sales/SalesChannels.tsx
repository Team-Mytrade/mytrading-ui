import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ArrowPathIcon,
  BuildingStorefrontIcon,
  CheckCircleIcon,
  PencilSquareIcon,
  RadioIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import PaginatedPopup from "../../components/common/unpopup";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import {
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
  FloatingTextarea,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

// tenantId still arrives on the raw API record (multi-tenant backend), but
// the frontend no longer reads, displays, edits, or submits it — see the
// note above the payload builder for why.
type SalesChannel = {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  name: string;
  channelType: SalesChannelType | string;
  contactInfo: string;
};

type SalesChannelType =
  | "DIRECT"
  | "ONLINE"
  | "RETAIL"
  | "DISTRIBUTOR"
  | "PARTNER"
  | "MARKETPLACE"
  | "SOCIAL"
  | "TELESALES";

type ChannelForm = {
  channelName: string;
  channelType: SalesChannelType;
  contactInfo: string;
};

const API_URL = "/v1/api/sales/channels";
const PAGE_SIZE = 10;
const channelTypeOptions: SalesChannelType[] = [
  "DIRECT",
  "ONLINE",
  "RETAIL",
  "DISTRIBUTOR",
  "PARTNER",
  "MARKETPLACE",
  "SOCIAL",
  "TELESALES",
];

const emptyForm: ChannelForm = {
  channelName: "",
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

function friendlyChannelType(type: string) {
  return String(type || "")
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  // Tenant is deliberately NOT sent from here. A client-editable
  // localStorage value has no business being the thing that decides which
  // tenant's data a write lands in — that has to be derived/verified by the
  // backend from the authenticated session (JWT), not trusted from the
  // request body. See the message to backend below.
  const buildPayload = () => ({
    id: editingId || 0,
    name: form.channelName.trim(),
    channelType: form.channelType,
    contactInfo: form.contactInfo.trim(),
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!form.channelName.trim() || !form.channelType) {
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
    setForm(emptyForm);
    setShowFormModal(true);
  };

  const openEdit = (channel: SalesChannel) => {
    setEditingId(channel.id);
    setForm({
      channelName: channel.name || "",
      channelType: channelTypeOptions.includes(channel.channelType as SalesChannelType)
        ? (channel.channelType as SalesChannelType)
        : "DIRECT",
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

  const stats = useMemo(
    () => ({
      total: channels.length,
      direct: channels.filter((item) => item.channelType === "DIRECT").length,
      online: channels.filter((item) => item.channelType === "ONLINE").length,
      activeTypes: new Set(channels.map((item) => item.channelType).filter(Boolean)).size,
    }),
    [channels]
  );

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
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(
            channel.channelType
          )}`}
        >
          {channel.channelType || "N/A"}
        </span>
      ),
    },
    { key: "contactInfo", label: "Contact Info", sortable: true },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (channel) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openEdit(channel)}
            className="rounded-lg p-2 text-slate-400 transition-all hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteChannel(channel)}
            className="rounded-lg p-2 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
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
      <PageBreadcrumb
        pageTitle="Sales Channels"
        actions={<AddButton onClick={openCreate} label="Add Sales Channel" />}
      />

      <div className="w-full max-w-none px-0 py-8">
        <div className="mb-[17px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

        <ReusableTable
          data={channels}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="name"
          defaultSortOrder="asc"
          rowDetailsTitle={(channel) => channel.name || `Channel #${channel.id}`}
          rowDetailsSubtitle="Sales channel details"
          hiddenDetailKeys={["id", "tenantId"]}
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <BuildingStorefrontIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No sales channels found</p>
              <button
                type="button"
                onClick={() => fetchChannels()}
                className="inline-flex items-center gap-1 text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                <ArrowPathIcon className="h-3.5 w-3.5" />
                Reload all channels
              </button>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Sales Channel" : "Create Sales Channel"}
        subtitle="Enter sales channel details from the API schema"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Sales Channel" : "Create Sales Channel"}
        maxWidthClassName="max-w-2xl"
        tabs={[
          {
            label: "Channel Info",
            fields: [
              <FloatingInput
                key="channelName"
                label="Channel Name"
                name="channelName"
                value={form.channelName}
                onChange={handleChange}
                required
              />,
              <FloatingSelect
                key="channelType"
                label="Channel Type"
                name="channelType"
                value={form.channelType}
                onChange={handleChange}
                includeEmptyOption={false}
                options={channelTypeOptions.map((item) => ({ id: item, name: friendlyChannelType(item) }))}
                required
              />,
              <div key="contactInfo" className="md:col-span-2">
                <FloatingTextarea
                  label="Contact Info"
                  name="contactInfo"
                  value={form.contactInfo}
                  onChange={handleChange}
                  rows={3}
                />
              </div>,
            ],
          },
        ]}
      />

      <DynamicPopup
        isPopupOpen={!!deleteChannel}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteChannel(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Sales Channel"
        subText={
          deleteChannel
            ? `Are you sure you want to delete channel #${deleteChannel.id}?`
            : "Are you sure?"
        }
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
