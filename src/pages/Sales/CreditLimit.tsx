import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BanknotesIcon,
  CheckCircleIcon,
  CreditCardIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  XMarkIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import { AddButton } from "../../components/common/AddButton";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import StatsCard from "../../components/common/Statscard";
import { FloatingInput, FloatingSelect1 as FloatingSelect } from "../../components/inputfeild/FloatingInput";
import { ToasterService } from "../../Services/ToasterService";

type CreditCheckResponse = {
  sufficient: boolean;
  availableCredit: number;
};

type CreditLog = {
  id: number;
  action: string;
  customerId: number;
  amount?: number;
  sufficient?: boolean;
  availableCredit?: number;
  createdAt: string;
};

type CreditForm = {
  customerId: string;
  orderAmount: string;
  outstandingAmount: string;
};

type CustomerOption = {
  id: number;
  customerName?: string;
  tradeName?: string;
};

const API_URL = "/v1/api/sales/credit";
const PAGE_SIZE = 10;

function getStoredTenantId() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return user?.tenantId || "TENANT_1";
  } catch {
    return "TENANT_1";
  }
}

const emptyForm: CreditForm = {
  customerId: "",
  orderAmount: "",
  outstandingAmount: "",
};

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string") return data;
    if (String(data?.error || data?.message || "").includes("feign.Response$Body.asInputStream")) {
      return "Backend updated the request but returned an empty downstream response. Please use Get Available to verify the credit balance.";
    }
    return data?.message || data?.detail || data?.error || data?.title || fallback;
  }
  return fallback;
}

function money(value: number | string | undefined) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function isPositiveNumber(value: string) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function customerOptionLabel(customer: CustomerOption) {
  const name = customer.customerName || customer.tradeName || `Customer #${customer.id}`;
  return `${customer.id} - ${name}`;
}

function authHeaders(token: string | null) {
  if (!token) return undefined;
  const value = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  return { Authorization: value };
}

const CreditLimit: React.FC = () => {
  const token = localStorage.getItem("accessToken");
  const headers = authHeaders(token);

  const [form, setForm] = useState<CreditForm>(emptyForm);
  const [logs, setLogs] = useState<CreditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [lastAvailableCredit, setLastAvailableCredit] = useState<number | null>(null);
  const [lastCheck, setLastCheck] = useState<CreditCheckResponse | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [showFormModal, setShowFormModal] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await axios.get<CustomerOption[]>("/v1/api/crm/customers", { headers });
        setCustomers(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        ToasterService.error("Failed to load customers", getErrorMessage(error, "Please try again."));
      }
    };

    fetchCustomers();
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const pushLog = (log: Omit<CreditLog, "id" | "createdAt">) => {
    setLogs((current) => [
      {
        ...log,
        id: Date.now(),
        createdAt: new Date().toLocaleString(),
      },
      ...current,
    ]);
  };

  const validateBase = () => {
    if (!isPositiveNumber(form.customerId)) {
      ToasterService.error("Customer ID is required", "Enter a valid customer ID greater than zero.");
      return false;
    }
    return true;
  };

  const checkCredit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!validateBase()) return;
    if (!isPositiveNumber(form.orderAmount)) {
      ToasterService.error("Order amount is required", "Enter a valid order amount greater than zero.");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        tenantId: getStoredTenantId(),
        customerId: Number(form.customerId),
        orderAmount: Number(form.orderAmount),
      };
      const res = await axios.post<CreditCheckResponse>(`${API_URL}/check`, payload, { headers });
      setLastCheck(res.data);
      setLastAvailableCredit(Number(res.data.availableCredit || 0));
      pushLog({
        action: "CHECK",
        customerId: payload.customerId,
        amount: payload.orderAmount,
        sufficient: res.data.sufficient,
        availableCredit: Number(res.data.availableCredit || 0),
      });
      setShowFormModal(false);
      ToasterService.success(res.data.sufficient ? "Credit is sufficient" : "Credit is not sufficient");
    } catch (error) {
      ToasterService.error("Failed to check credit", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const getAvailableCredit = async (silent = false) => {
    if (!validateBase()) return;

    try {
      setLoading(true);
      const customerId = Number(form.customerId);
      const tenantId = getStoredTenantId();
      const res = await axios.get<number>(`${API_URL}/${customerId}/available`, {
        headers,
        params: { tenantId },
      });
      const availableCredit = Number(res.data || 0);
      setLastAvailableCredit(availableCredit);
      pushLog({
        action: "AVAILABLE",
        customerId,
        availableCredit,
      });
      if (!silent) ToasterService.success("Available credit loaded");
    } catch (error) {
      if (!silent) {
        ToasterService.error("Failed to load available credit", getErrorMessage(error, "Please try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  const addOutstanding = async () => {
    if (!validateBase()) return;
    if (!isPositiveNumber(form.outstandingAmount)) {
      ToasterService.error("Outstanding amount is required", "Enter a valid amount greater than zero.");
      return;
    }

    try {
      setLoading(true);
      const customerId = Number(form.customerId);
      const amount = Number(form.outstandingAmount);
      const tenantId = getStoredTenantId();
      await axios.put(`${API_URL}/${customerId}/add-outstanding`, null, {
        headers,
        params: { amount, tenantId },
        responseType: "text",
        transformResponse: [(data: unknown) => data],
        skipSessionExpiredHandling: true,
        validateStatus: (status: number) => status >= 200 && status < 300,
      } as any);
      pushLog({
        action: "ADD_OUTSTANDING",
        customerId,
        amount,
      });
      ToasterService.success("Outstanding amount added");
      void getAvailableCredit(true);
    } catch (error) {
      ToasterService.error("Failed to add outstanding", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const clearOutstanding = async () => {
    if (!validateBase()) return;

    try {
      setLoading(true);
      const customerId = Number(form.customerId);
      const tenantId = getStoredTenantId();
      await axios.put(`${API_URL}/${customerId}/clear-outstanding`, null, {
        headers,
        params: { tenantId },
        responseType: "text",
        transformResponse: [(data: unknown) => data],
        skipSessionExpiredHandling: true,
        validateStatus: (status: number) => status >= 200 && status < 300,
      } as any);
      pushLog({
        action: "CLEAR_OUTSTANDING",
        customerId,
      });
      ToasterService.success("Outstanding amount cleared");
      void getAvailableCredit(true);
    } catch (error) {
      ToasterService.error("Failed to clear outstanding", getErrorMessage(error, "Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((log) =>
      [log.action, log.customerId, log.amount, log.availableCredit, log.sufficient]
        .filter((value) => value !== undefined && value !== null)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [logs, search]);

  const stats = useMemo(() => ({
    actions: logs.length,
    availableCredit: lastAvailableCredit ?? 0,
    sufficient: lastCheck?.sufficient ? 1 : 0,
    insufficient: lastCheck && !lastCheck.sufficient ? 1 : 0,
  }), [lastAvailableCredit, lastCheck, logs.length]);

  const columns: ColumnDef<CreditLog>[] = [
    {
      key: "action",
      label: "Action",
      sortable: true,
      render: (log) => (
        <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-700">
          {log.action}
        </span>
      ),
    },
    { key: "customerId", label: "Customer", sortable: true },
    {
      key: "amount",
      label: "Amount",
      sortable: true,
      render: (log) => (log.amount === undefined ? "--" : money(log.amount)),
    },
    {
      key: "availableCredit",
      label: "Available Credit",
      sortable: true,
      render: (log) => (log.availableCredit === undefined ? "--" : money(log.availableCredit)),
    },
    {
      key: "sufficient",
      label: "Sufficient",
      sortable: true,
      render: (log) => (log.sufficient === undefined ? "--" : log.sufficient ? "Yes" : "No"),
    },
    { key: "createdAt", label: "Time", sortable: true },
  ];

  return (
    <>
      <PageMeta title="Credit Limit" description="Manage sales credit limit checks" />
      <PageBreadcrumb pageTitle="Credit Limit" />

      <div className="w-full max-w-none px-0 py-8 space-y-6">
        <div className="mb-6 flex justify-start sm:justify-end lg:-mt-[134px]">
          <AddButton onClick={() => setShowFormModal(true)} label="Add Credit Check" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard label="Actions" value={stats.actions} icon={<CreditCardIcon />} />
          <StatsCard
            label="Available Credit"
            value={money(stats.availableCredit)}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
            icon={<BanknotesIcon />}
          />
          <StatsCard
            label="Sufficient"
            value={stats.sufficient}
            gradient="from-blue-50 to-cyan-50"
            borderColor="border-blue-100"
            labelColor="text-blue-600"
            icon={<CheckCircleIcon />}
          />
          <StatsCard
            label="Insufficient"
            value={stats.insufficient}
            gradient="from-red-50 to-rose-50"
            borderColor="border-red-100"
            labelColor="text-red-600"
            icon={<XCircleIcon />}
          />
        </div>

        <form onSubmit={checkCredit} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <FloatingSelect
              label="Customer ID"
              name="customerId"
              value={form.customerId}
              onChange={handleChange}
              emptyOptionLabel="Select customer"
              options={customers.map((customer) => ({
                id: String(customer.id),
                name: customerOptionLabel(customer),
              }))}
              required
            />
            <FloatingInput label="Order Amount" name="orderAmount" type="number" value={form.orderAmount} onChange={handleChange} />
            <FloatingInput label="Outstanding Amount" name="outstandingAmount" type="number" value={form.outstandingAmount} onChange={handleChange} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="submit"
              disabled={loading}
              className="h-[42px] rounded-lg bg-cyan-600 px-4 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-70"
            >
              Check Credit
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => getAvailableCredit()}
              className="h-[42px] rounded-lg bg-gray-100 px-4 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-70"
            >
              Get Available
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={addOutstanding}
              className="h-[42px] rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70"
            >
              Add Outstanding
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={clearOutstanding}
              className="inline-flex h-[42px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-70"
            >
              <TrashIcon className="h-4 w-4" />
              Clear Outstanding
            </button>
          </div>
        </form>

        <div className="relative w-full sm:max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search credit actions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-10 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <ReusableTable
          data={filteredLogs}
          columns={columns}
          loading={loading}
          pageSize={PAGE_SIZE}
          defaultSortKey="createdAt"
          defaultSortOrder="desc"
          emptyState={
            <div className="flex flex-col items-center justify-center py-12">
              <CreditCardIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No credit actions yet</p>
            </div>
          }
        />

        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 p-4 backdrop-blur-sm sm:items-center">
            <div className="mx-auto w-full max-w-xl rounded-xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-100 p-5">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Create Credit Check</h3>
                  <p className="mt-0.5 text-xs text-gray-500">Submit credit check payload from the API schema</p>
                </div>
                <button type="button" onClick={() => setShowFormModal(false)} className="text-gray-400 hover:text-gray-600">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={checkCredit} className="p-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <FloatingSelect
                    label="Customer ID"
                    name="customerId"
                    value={form.customerId}
                    onChange={handleChange}
                    emptyOptionLabel="Select customer"
                    options={customers.map((customer) => ({
                      id: String(customer.id),
                      name: customerOptionLabel(customer),
                    }))}
                    required
                  />
                  <FloatingInput
                    label="Order Amount"
                    name="orderAmount"
                    type="number"
                    value={form.orderAmount}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div className="mt-5 flex flex-col justify-end gap-2 border-t border-gray-100 pt-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:from-cyan-700 hover:to-blue-700 disabled:opacity-70"
                  >
                    Check Credit
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CreditLimit;
