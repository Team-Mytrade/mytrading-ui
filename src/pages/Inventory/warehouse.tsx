import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BuildingOffice2Icon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import DynamicPopup from "../../components/common/Popup";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import FilterPopover from "../../components/common/filter";
import PaginatedPopup from "../../components/common/unpopup";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import {
  FloatingInput,
  FloatingSelect1 as FloatingSelect,
} from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

//  Types
type WarehouseLocationType = string;
type WarehouseStatus = string;

type Warehouse = {
  id: number;
  createdDate?: string;
  updatedDate?: string;
  createdBy?: string;
  tenantId?: string;
  code: string;
  name: string;
  locationType: WarehouseLocationType;
  stockLevels?: any[];
  batches?: any[];
  serialNumbers?: any[];
  stockMovements?: any[];
  stockAdjustments?: any[];
  stockEntries?: any[];
  stockCount?: number;
  active?: boolean;
  status?: WarehouseStatus;
};

type WarehouseForm = {
  name: string;
  locationType: string;
  status: string;
};

const API_URL = "/v1/api/inventory/warehouses";
const ENUM_API_URL = "/v1/api/inventory/enums";
const PAGE_SIZE = 10;

// Fallback values
const FALLBACK_LOCATION_TYPES = ["MAIN", "DISTRIBUTION", "TRANSIT", "RETURN_CENTER"];
const FALLBACK_STATUS = ["ACTIVE", "INACTIVE"];

const emptyForm: WarehouseForm = {
  name: "",
  locationType: "",
  status: "ACTIVE",
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    return data?.message || data?.detail || data?.error || fallback;
  }
  return fallback;
}

function searchableText(value: unknown) {
  if (value === null || value === undefined) return "";
  return String(value).toLowerCase().trim();
}

function getLocationTypeColor(type: string) {
  switch (type) {
    case "MAIN":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "DISTRIBUTION":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "TRANSIT":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "RETURN_CENTER":
      return "bg-orange-100 text-orange-800 border-orange-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-800 border-green-200";
    case "INACTIVE":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "ACTIVE":
      return <CheckCircleIcon className="h-3 w-3" />;
    case "INACTIVE":
      return <XCircleIcon className="h-3 w-3" />;
    default:
      return null;
  }
}

const WarehousePage: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState<WarehouseForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteWarehouse, setDeleteWarehouse] = useState<Warehouse | null>(null);
  
  const [locationTypeOptions, setLocationTypeOptions] = useState<string[]>(FALLBACK_LOCATION_TYPES);
  const [enumLoading, setEnumLoading] = useState(true);

  useEffect(() => {
    fetchEnums();
    fetchWarehouses();
  }, []);

  // Fetch enums from backend
  const fetchEnums = async (): Promise<void> => {
    try {
      setEnumLoading(true);
      const locationRes = await axios.get(`${ENUM_API_URL}?type=LOCATION_TYPE`, { headers });
      
      let locationCodes: string[] = [];
      const rawData = locationRes.data;
      
      if (Array.isArray(rawData)) {
        if (rawData.length > 0 && typeof rawData[0] === 'object' && rawData[0].code) {
          locationCodes = rawData.map((item: any) => item.code);
        } else {
          locationCodes = rawData;
        }
      }
      
      setLocationTypeOptions(locationCodes.length > 0 ? locationCodes : FALLBACK_LOCATION_TYPES);
      
      setForm((prev) => ({ 
        ...prev, 
        locationType: locationCodes.length > 0 ? locationCodes[0] : FALLBACK_LOCATION_TYPES[0],
        status: "ACTIVE",
      }));
      
    } catch (error) {
      console.error("Failed to fetch enums:", error);
      setLocationTypeOptions(FALLBACK_LOCATION_TYPES);
    } finally {
      setEnumLoading(false);
    }
  };

  //  Fetch warehouses with code fallback
  const fetchWarehouses = async (): Promise<void> => {
    try {
      setLoading(true);
      
      const response = await axios.get<Warehouse[]>(API_URL, { headers });
      const data = Array.isArray(response.data) ? response.data : [];
      
      const enrichedData = await Promise.all(
        data.map(async (warehouse) => {
          try {
            const detailRes = await axios.get(`${API_URL}/${warehouse.id}`, { headers });
            const fullData = detailRes.data;
            
            const stockCount = fullData.stockLevels?.reduce(
              (sum: number, level: any) => sum + (level.quantity || 0), 0
            ) || 0;
            
            const isActive = fullData.active === true;
            const status = isActive ? "ACTIVE" : "INACTIVE";
            
            // Generate fallback code if backend returns null
            let code = fullData.code || warehouse.code;
            if (!code || code === 'null' || code === 'undefined' || code.trim() === '') {
              code = `WH-${String(warehouse.id).padStart(6, '0')}`;
            }
            
            return {
              ...fullData,
              code: code,
              locationType: fullData.locationType || warehouse.locationType || "MAIN",
              stockCount,
              status: status,
            };
          } catch (detailError) {
            // Fallback if detail fetch fails
            let code = warehouse.code;
            if (!code || code === 'null' || code === 'undefined' || code.trim() === '') {
              code = `WH-${String(warehouse.id).padStart(6, '0')}`;
            }
            
            return {
              ...warehouse,
              code: code,
              stockCount: 0,
              status: warehouse.active ? "ACTIVE" : "INACTIVE",
              locationType: warehouse.locationType || "MAIN",
            };
          }
        })
      );
      
      setWarehouses(enrichedData);
    } catch (error) {
      console.error("Failed to load warehouses:", error);
      setWarehouses([]);
      ToasterService.error("Failed to load warehouses", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const openCreate = (): void => {
    setEditingId(null);
    setForm({
      name: "",
      locationType: locationTypeOptions[0] || "",
      status: "ACTIVE",
    });
    setShowFormModal(true);
  };

  const closeForm = (): void => {
    setEditingId(null);
    setForm(emptyForm);
    setShowFormModal(false);
  };

  const openEdit = (warehouse: Warehouse): void => {
    setEditingId(warehouse.id);
    setForm({
      name: warehouse.name,
      locationType: warehouse.locationType,
      status: warehouse.status || "ACTIVE",
    });
    setShowFormModal(true);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  //  Handle table inline updates
  const handleTableUpdate = async (id: number, field: string, value: string) => {
    const warehouse = warehouses.find(w => w.id === id);
    if (!warehouse) return;

    // Optimistic update
    const updatedWarehouse = { 
      ...warehouse, 
      [field]: value, 
      ...(field === 'status' && { active: value === 'ACTIVE' })
    };
    
    setWarehouses(prev => prev.map(w => 
      w.id === id ? updatedWarehouse : w
    ));

    try {
      await axios.put(`${API_URL}/${id}`, {
        id,
        name: warehouse.name,
        locationType: field === 'locationType' ? value : warehouse.locationType,
        active: field === 'status' ? value === 'ACTIVE' : warehouse.status === 'ACTIVE',
      }, { headers });
      
      ToasterService.success(`${field} updated successfully`);
      
      //  Don't refresh - keep local changes
    } catch (error) {
      // Revert on error
      await fetchWarehouses();
      ToasterService.error(`Failed to update ${field}`, getErrorMessage(error, "Please try again."));
    }
  };

  const buildPayload = () => {
    const isActive = form.status === "ACTIVE";
    
    if (!editingId) {
      return {
        name: form.name.trim(),
        locationType: form.locationType,
        active: isActive,
      };
    }
    return {
      id: editingId,
      name: form.name.trim(),
      locationType: form.locationType,
      active: isActive,
    };
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();

    if (!form.name || !form.name.trim()) {
      ToasterService.error("Warehouse Name is required");
      return;
    }
    
    if (form.name.trim().length < 2) {
      ToasterService.error("Warehouse Name must be at least 2 characters");
      return;
    }

    if (!form.locationType) {
      ToasterService.error("Location Type is required");
      return;
    }

    const duplicate = warehouses.find(
      (w) => 
        w.name.toLowerCase() === form.name.trim().toLowerCase() && 
        w.id !== editingId
    );
    if (duplicate) {
      ToasterService.error("A warehouse with this name already exists");
      return;
    }

    try {
      setSubmitting(true);
      const payload = buildPayload();

      if (editingId) {
        await axios.put(`${API_URL}/${editingId}`, payload, { headers });
        ToasterService.success("Warehouse updated successfully");
        
        //  Update local state with payload values
        setWarehouses((prev) =>
          prev.map((w) => {
            if (w.id === editingId) {
              let code = w.code;
              if (!code || code === 'null' || code === 'undefined' || code.trim() === '') {
                code = `WH-${String(w.id).padStart(6, '0')}`;
              }
              
              return {
                ...w,
                name: payload.name,
                locationType: payload.locationType,
                active: payload.active,
                status: payload.active ? "ACTIVE" : "INACTIVE",
                code: code,
              };
            }
            return w;
          })
        );
      } else {
        const response = await axios.post(API_URL, payload, { headers });
        ToasterService.success("Warehouse created successfully");
        
        //  Generate code if backend returns null
        let code = response.data.code;
        if (!code || code === 'null' || code === 'undefined' || code.trim() === '') {
          code = `WH-${String(response.data.id).padStart(6, '0')}`;
        }
        
        const newWarehouse = {
          ...response.data,
          code: code,
          locationType: payload.locationType,
          status: form.status || "ACTIVE",
        };
        setWarehouses((prev) => [newWarehouse, ...prev]);
      }

      closeForm();
      
    } catch (error) {
      ToasterService.error("Failed to save warehouse", getErrorMessage(error, "Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteWarehouse?.id) return;

    try {
      await axios.delete(`${API_URL}/${deleteWarehouse.id}?cascade=true`, { headers });
      ToasterService.success("Warehouse deleted successfully");
      setDeleteWarehouse(null);
      await fetchWarehouses();
    } catch (error) {
      ToasterService.error("Failed to delete warehouse", getErrorMessage(error, "Please try again."));
    }
  };

  const getCleanWarehouseData = (warehouse: Warehouse): any => {
    return {
      id: warehouse.id,
      code: warehouse.code,
      name: warehouse.name,
      locationType: warehouse.locationType,
      stockCount: warehouse.stockCount || 0,
      status: warehouse.status || "ACTIVE",
      createdDate: warehouse.createdDate,
      updatedDate: warehouse.updatedDate,
      createdBy: warehouse.createdBy,
      tenantId: warehouse.tenantId,
    };
  };

  const filteredWarehouses = useMemo(() => {
    const term = searchableText(search);
    
    return warehouses
      .filter((warehouse) => {
        const matchesType = typeFilter === "" || warehouse.locationType === typeFilter;
        const matchesStatus = statusFilter === "" || warehouse.status === statusFilter;
        const searchString = `${warehouse.id} ${warehouse.code} ${warehouse.name} ${warehouse.locationType} ${warehouse.status}`.toLowerCase();
        const matchesSearch = !term || searchString.includes(term);
        return matchesType && matchesStatus && matchesSearch;
      })
      .map((warehouse) => getCleanWarehouseData(warehouse));
  }, [warehouses, search, typeFilter, statusFilter]);

  const stats = useMemo(
    () => ({
      total: warehouses.length,
      main: warehouses.filter((w) => w.locationType === "MAIN").length,
      distribution: warehouses.filter((w) => w.locationType === "DISTRIBUTION").length,
      transit: warehouses.filter((w) => w.locationType === "TRANSIT").length,
      returnCenter: warehouses.filter((w) => w.locationType === "RETURN_CENTER").length,
      active: warehouses.filter((w) => w.status === "ACTIVE").length,
      inactive: warehouses.filter((w) => w.status === "INACTIVE").length,
    }),
    [warehouses]
  );

  const columns: ColumnDef<Warehouse>[] = [
    {
      key: "code",
      label: "Code",
      sortable: true,
      render: (warehouse) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-100 bg-cyan-50">
            <BuildingOffice2Icon className="h-4 w-4 text-cyan-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{warehouse.code}</p>
            <p className="text-xs text-slate-400">ID: #{warehouse.id}</p>
          </div>
        </div>
      ),
    },
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (warehouse) => (
        <span className="text-sm text-slate-700">{warehouse.name}</span>
      ),
    },
    {
      key: "locationType",
      label: "Location Type",
      sortable: true,
      render: (warehouse) => (
        <select
          value={warehouse.locationType}
          onChange={(e) => handleTableUpdate(warehouse.id, 'locationType', e.target.value)}
          className={`rounded-lg border w-[150px] px-2.5 py-1 text-xs font-medium ${getLocationTypeColor(warehouse.locationType)}`}
        >
          {locationTypeOptions.map(type => <option key={type} value={type}>{type}</option>)}
        </select>
      ),
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (warehouse) => {
        const status = warehouse.status || "ACTIVE";
        return (
          <select
            value={status}
            onChange={(e) => handleTableUpdate(warehouse.id, 'status', e.target.value)}
            className={`rounded-lg border w-[100px] px-2.5 py-1 text-xs font-medium ${getStatusColor(status)}`}
          >
            {FALLBACK_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        );
      },
    },
    {
      key: "stockCount",
      label: "Stock Items",
      sortable: true,
      render: (warehouse) => (
        <span className="text-sm text-slate-600">
          {warehouse.stockCount || 0}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      headerClassName: "text-right",
      className: "text-right",
      render: (warehouse) => (
        <div className="flex justify-end gap-1">
          <button
            type="button"
            onClick={() => openEdit(warehouse)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-cyan-50 hover:text-cyan-600"
            title="Edit"
          >
            <PencilSquareIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteWarehouse(warehouse)}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const typeFilterOptions = useMemo(() => {
    return [
      { label: "All Types", value: "" },
      ...locationTypeOptions.map((type) => ({
        label: type,
        value: type,
      })),
    ];
  }, [locationTypeOptions]);

  const statusFilterOptions = useMemo(() => {
    return [
      { label: "All Status", value: "" },
      { label: "ACTIVE", value: "ACTIVE" },
      { label: "INACTIVE", value: "INACTIVE" },
    ];
  }, []);

  return (
    <>
      <PageMeta title="Warehouses" description="Manage warehouses" />
      <PageBreadcrumb pageTitle="Warehouses" />

      <div className="w-full max-w-none px-0 py-8">
        <div className="mb-6 flex justify-end -mt-12">
          <AddButton onClick={openCreate} label="Add Warehouse" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Total Warehouses"
            value={stats.total}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
            icon={<BuildingOffice2Icon className="h-5 w-5" />}
          />
          <StatsCard
            label="Active"
            value={stats.active}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<CheckCircleIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Inactive"
            value={stats.inactive}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
            icon={<XCircleIcon className="h-5 w-5" />}
          />
          <StatsCard
            label="Main / Distribution"
            value={`${stats.main} / ${stats.distribution}`}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
            icon={<BuildingOffice2Icon className="h-5 w-5" />}
          />
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full -mt-8 sm:max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search warehouses..."
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

          <div className="flex items-center gap-2">
            <FilterPopover
              title="Filter Warehouses"
              buttonLabel="Filter"
              label="Location Type"
              value={typeFilter}
              options={typeFilterOptions}
              onChange={setTypeFilter}
              onReset={() => {
                setTypeFilter("");
                setStatusFilter("");
              }}
              onApply={() => undefined}
              widthClassName="w-72"
            >
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Location Type</label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="">All Types</option>
                    {locationTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                  >
                    <option value="">All Status</option>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </select>
                </div>
              </div>
            </FilterPopover>
          </div>
        </div>

        <ReusableTable
          data={filteredWarehouses}
          columns={columns}
          loading={loading || enumLoading}
          pageSize={PAGE_SIZE}
          defaultSortKey="id"
          defaultSortOrder="desc"
          enableRowDetails={true}
          rowDetailsTitle="Warehouse Details"
          className="md:-mt-4"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <BuildingOffice2Icon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No warehouses found</p>
              <button
                type="button"
                onClick={openCreate}
                className="text-xs font-medium text-cyan-600 hover:text-cyan-700"
              >
                Create your first warehouse
              </button>
            </div>
          }
        />
      </div>

      <PaginatedPopup
        isOpen={showFormModal}
        title={editingId ? "Edit Warehouse" : "Create Warehouse"}
        subtitle="Enter warehouse information"
        onClose={closeForm}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitLabel={editingId ? "Update Warehouse" : "Create Warehouse"}
        maxWidthClassName="max-w-2xl"
        tabs={[
          {
            label: "Warehouse Details",
            fields: [
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FloatingInput
                  label="Name"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>,
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FloatingSelect
                  label="Location Type"
                  name="locationType"
                  value={form.locationType}
                  onChange={handleChange}
                  includeEmptyOption={false}
                  options={locationTypeOptions.map((type) => ({
                    id: type,
                    name: type,
                  }))}
                />
              </div>,
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FloatingSelect
                  label="Status"
                  name="status"
                  value={form.status}
                  onChange={handleChange}
                  includeEmptyOption={false}
                  options={FALLBACK_STATUS.map((status) => ({
                    id: status,
                    name: status,
                  }))}
                />
              </div>,
            ],
          },
        ]}
      />

      <DynamicPopup
        isPopupOpen={!!deleteWarehouse}
        setIsPopupOpen={(open) => {
          if (!open) setDeleteWarehouse(null);
        }}
        icon={<TrashIcon className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100"
        innerText="Delete Warehouse"
        subText={
          deleteWarehouse
            ? `Are you sure you want to delete "${deleteWarehouse.name}"?`
            : "Are you sure?"
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteWarehouse(null)}
        confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
      />
    </>
  );
};

export default WarehousePage;