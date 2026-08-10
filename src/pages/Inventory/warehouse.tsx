import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  BuildingOffice2Icon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
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

type WarehouseLocationType = "MAIN" | "DISTRIBUTION" | "TRANSIT" | "RETURN_CENTER";

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
};

type WarehouseForm = {
  name: string;
  locationType: WarehouseLocationType;
};

const API_URL = "/v1/api/inventory/warehouses";
const PAGE_SIZE = 10;

const locationTypeOptions: WarehouseLocationType[] = [
  "MAIN",
  "DISTRIBUTION",
  "TRANSIT",
  "RETURN_CENTER",
];

const emptyForm: WarehouseForm = {
  name: "",
  locationType: "MAIN",
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

function getLocationTypeColor(type: WarehouseLocationType) {
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

const WarehousePage: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = token ? { Authorization: token.startsWith("Bearer ") ? token : `Bearer ${token}` } : undefined;

  const navigate = useNavigate();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState<WarehouseForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [deleteWarehouse, setDeleteWarehouse] = useState<Warehouse | null>(null);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  const fetchWarehouses = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await axios.get<Warehouse[]>(API_URL, { headers });
      const data = Array.isArray(response.data) ? response.data : [];
      
      const enrichedData = await Promise.all(
        data.map(async (warehouse) => {
          const detailRes = await axios.get(`${API_URL}/${warehouse.id}`, { headers });
          const fullData = detailRes.data;
    
       
          const stockCount = fullData.stockLevels?.reduce(
            (sum: number, level: any) => sum + (level.quantity || 0), 0
          ) || 0;
          
          return {
            ...fullData,
            stockCount,
          };
        })
      );
      
      setWarehouses(enrichedData);
    } catch (error) {
      setWarehouses([]);
      ToasterService.error("Failed to load warehouses", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const openCreate = (): void => {
    setEditingId(null);
    setForm(emptyForm);
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
    });
    setShowFormModal(true);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const buildPayload = () => {
    if (!editingId) {
      return {
        name: form.name.trim(),
        locationType: form.locationType,
      };
    }
    return {
      id: editingId,
      name: form.name.trim(),
      locationType: form.locationType,
    };
  };

  const handleSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
//Validations
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
        setWarehouses((prev) =>
          prev.map((w) => {
            if (w.id === editingId) {
              return {
                ...w,
                name: payload.name,
                locationType: payload.locationType,
              };
            }
            return w;
          })
        );
      } else {
        const response = await axios.post(API_URL, payload, { headers });
        ToasterService.success("Warehouse created successfully");
        setWarehouses((prev) => [response.data, ...prev]);
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
    //Basic info
    id: warehouse.id,
    code: warehouse.code,
    name: warehouse.name,
    locationType: warehouse.locationType,
    stockCount: warehouse.stockCount || 0,
   
    //Summary Count
    batchCount: warehouse.batches?.length || 0,
    serialCount: warehouse.serialNumbers?.length || 0,
    movementCount: warehouse.stockMovements?.length || 0,
    adjustmentCount: warehouse.stockAdjustments?.length || 0,
    //  stockEntries: warehouse.stockEntries?.length || 0,

     //Metadata
      createdDate: warehouse.createdDate,
    updatedDate: warehouse.updatedDate,
    createdBy: warehouse.createdBy,
    tenantId: warehouse.tenantId,
    
};};

  //Only fields show in the popup
  


  const filteredWarehouses = useMemo(() => {
    const term = searchableText(search);
    return warehouses.filter((warehouse) => {
      const matchesType = typeFilter === "" || warehouse.locationType === typeFilter;
      const searchString = `${warehouse.id} ${warehouse.code} ${warehouse.name} ${warehouse.locationType}`.toLowerCase();
      const matchesSearch = !term || searchString.includes(term);
      return matchesType && matchesSearch;
    })
     .map((warehouse) => getCleanWarehouseData(warehouse));
  }, [warehouses, search, typeFilter]);

  const stats = useMemo(
    () => ({
      total: warehouses.length,
      main: warehouses.filter((w) => w.locationType === "MAIN").length,
      distribution: warehouses.filter((w) => w.locationType === "DISTRIBUTION").length,
      transit: warehouses.filter((w) => w.locationType === "TRANSIT").length,
      returnCenter: warehouses.filter((w) => w.locationType === "RETURN_CENTER").length,
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
        <span className="text-sm text-slate-700 ml-10">{warehouse.name}</span>
      ),
    },
    {
      key: "locationType",
      label: "Location Type",
      sortable: true,
      render: (warehouse) => (
        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ml-20 ${getLocationTypeColor(warehouse.locationType)}`}>
          {warehouse.locationType}
        </span>
      ),
    },
    {
      key: "stockCount",
      label: "Stock Items",
      sortable: true,
      render: (warehouse) => (
         <button
      onClick={() => navigate(`/products?warehouseId=${warehouse.id}`)}
      className="text-sm text-cyan-600 hover:text-cyan-800 hover:underline cursor-pointer font-medium ml-20"
    >
      {warehouse.stockCount || 0} items
    </button>
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

  return (
    <>
      <PageMeta title="Warehouses" description="Manage warehouses" />
      <PageBreadcrumb pageTitle="Warehouses" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
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
            label="Main"
            value={stats.main}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
            icon={<BuildingOffice2Icon className="h-5 w-5" />}
          />
          <StatsCard
            label="Distribution"
            value={stats.distribution}
            gradient="from-blue-50 to-indigo-50"
            borderColor="border-blue-100"
            labelColor="text-blue-600"
            icon={<BuildingOffice2Icon className="h-5 w-5" />}
          />
          <StatsCard
            label="Transit / Return"
            value={stats.transit + stats.returnCenter}
            gradient="from-yellow-50 to-orange-50"
            borderColor="border-yellow-100"
            labelColor="text-yellow-600"
            icon={<BuildingOffice2Icon className="h-5 w-5" />}
          />
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
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

          <FilterPopover
            title="Filter Warehouses"
            buttonLabel="Filters"
            label="Location Type"
            value={typeFilter}
            options={[
              { label: "All Types", value: "" },
              ...locationTypeOptions.map((type) => ({
                label: type,
                value: type,
              })),
            ]}
            onChange={setTypeFilter}
            onReset={() => setTypeFilter("")}
            onApply={() => undefined}
          />
        </div>

        {/*  Use built-in table popup - enableRowDetails is true by default */}
        <ReusableTable
          data={filteredWarehouses}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="id"
          defaultSortOrder="desc"
          enableRowDetails={true}  // ← This enables the built-in popup
          rowDetailsTitle="Warehouse Details"
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

      {/* Form Popup */}
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
            ],
          },
        ]}
      />

      {/* Delete Popup */}
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