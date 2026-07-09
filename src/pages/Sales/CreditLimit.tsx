import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BanknotesIcon,
  CheckCircleIcon,
  CreditCardIcon,
  MagnifyingGlassIcon,
  TrashIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
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
  return customer.customerName || customer.tradeName || "Unknown customer";
}

function customerDisplayName(customer?: CustomerOption) {
  return customer?.customerName || customer?.tradeName || "--";
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
    return logs.filter((log) => {
      const customer = customers.find((item) => Number(item.id) === Number(log.customerId));
      return [log.action, log.customerId, customerDisplayName(customer), log.amount, log.availableCredit, log.sufficient]
        .filter((value) => value !== undefined && value !== null)
        .some((value) => String(value).toLowerCase().includes(term))
    });
  }, [customers, logs, search]);

  const stats = useMemo(() => ({
    actions: logs.length,
    availableCredit: lastAvailableCredit ?? 0,
    sufficient: lastCheck?.sufficient ? 1 : 0,
    insufficient: lastCheck && !lastCheck.sufficient ? 1 : 0,
  }), [lastAvailableCredit, lastCheck, logs.length]);

  const selectedCustomer = useMemo(
    () => customers.find((customer) => String(customer.id) === form.customerId),
    [customers, form.customerId]
  );

  return (
    <>
      <PageMeta title="Credit Limit" description="Manage sales credit limit checks" />
      <PageBreadcrumb pageTitle="Credit Limit" />

      <div className="-mt-3 w-full max-w-none px-0 pt-0 pb-8 space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-slate-900">Credit Checker</h2>
            <p className="mt-1 text-sm text-slate-500">Check available credit and manage outstanding amounts for a customer.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Available Credit</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{money(stats.availableCredit)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Checks Passed</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-700">{stats.sufficient}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Checks Failed</div>
              <div className="mt-2 text-2xl font-semibold text-rose-700">{stats.insufficient}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-slate-500">Selected Customer</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {selectedCustomer ? customerOptionLabel(selectedCustomer) : "--"}
              </div>
            </div>
          </div>
        </section>

        <form onSubmit={checkCredit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 md:grid-cols-3">
            <FloatingSelect
              label="Customer"
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
            />
            <FloatingInput
              label="Outstanding Amount"
              name="outstandingAmount"
              type="number"
              value={form.outstandingAmount}
              onChange={handleChange}
            />
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-70"
            >
              Check Credit
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => getAvailableCredit()}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-70"
            >
              Get Available
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={addOutstanding}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-70"
            >
              Add Outstanding
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={clearOutstanding}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-70"
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

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Recent credit actions</h3>
            </div>
            <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600">
              {filteredLogs.length} items
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">Loading credit activity...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CreditCardIcon className="mb-3 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-sm text-gray-500">No credit actions yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.slice(0, PAGE_SIZE).map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  {(() => {
                    const customer = customers.find((item) => Number(item.id) === Number(log.customerId));
                    return (
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700">
                        {log.action}
                      </span>
                      <span className="text-sm font-medium text-slate-900">{customerDisplayName(customer)}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{log.createdAt}</div>
                  </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-3 sm:flex sm:items-center sm:gap-6">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Amount</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {log.amount === undefined ? "--" : money(log.amount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Available</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {log.availableCredit === undefined ? "--" : money(log.availableCredit)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Result</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {log.sufficient === undefined ? "--" : log.sufficient ? "Sufficient" : "Insufficient"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
};

export default CreditLimit;
