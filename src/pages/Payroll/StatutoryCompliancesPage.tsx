import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Search,
  FileDown,
  Plus,
  ChevronRight,
  ChevronLeft,
  X,
  Shield,
  Calendar,
  FileText,
  Download,
  User,
  Hash,
  Tag,
  CheckCircle,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";

type StatutoryIdentifier = {
  id: number;
  identifierType: string;
  identifierLabel: string;
  identifierValue: string;
  employeeId?: number;
  employeeName?: string;
  employeeCode?: string;
};

type IdentifierInput = {
  identifierType: string;
  value: string;
};

type StatutoryComponentForm = {
  employeeId: number;
  countryCode: string;
  pfApplicable: boolean;
  esiApplicable: boolean;
  gratuityApplicable: boolean;
  professionalTaxApplicable: boolean;
  identifiers: IdentifierInput[];
};

type MonthlySummary = {
  month: string;
  totalEmployees: number;
  totalPF: number;
  totalESI: number;
  totalPT: number;
};

const StatutoryCompliancesPage: React.FC = () => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  const employeeIdFromUrl = searchParams.get('id') || '';
  const employeeCode = searchParams.get('employeeCode') || '';
  const employeeName = searchParams.get('employeeName') || '';
  const designation = searchParams.get('designation') || '';
  const countryCodeFromUrl = searchParams.get('countryCode') || 'IN';

  const [identifiers, setIdentifiers] = useState<StatutoryIdentifier[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<{
    id: string;
    name: string;
    code: string;
  } | null>(null);

  const [form, setForm] = useState<StatutoryComponentForm>({
    employeeId: parseInt(employeeIdFromUrl) || 0,
    countryCode: countryCodeFromUrl,
    pfApplicable: true,
    esiApplicable: true,
    gratuityApplicable: true,
    professionalTaxApplicable: true,
    identifiers: []
  });

  const isHR = designation?.toUpperCase() === 'HR';
  const pageSize = 10;

  useEffect(() => {
    fetchStatutoryData();
    fetchMonthlySummary();
  }, [employeeIdFromUrl, designation, selectedEmployee]);

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      employeeId: parseInt(employeeIdFromUrl) || (selectedEmployee ? parseInt(selectedEmployee.id) : 0),
      countryCode: countryCodeFromUrl,
    }));
  }, [employeeIdFromUrl, countryCodeFromUrl, selectedEmployee]);

  const fetchStatutoryData = async () => {
    setLoading(true);
    try {
      let url = '/v1/api/payroll/statutory/components';

      if (isHR && selectedEmployee?.id) {
        url = `/v1/api/payroll/statutory/employee/${selectedEmployee.id}`;
      } else if (!isHR && employeeIdFromUrl) {
        url = `/v1/api/payroll/statutory/employee/${employeeIdFromUrl}`;
      }

      const res = await axios.get(url);

      // Handle different response structures
      const data = res.data;
      if (Array.isArray(data)) {
        setIdentifiers(data);
      } else if (data && typeof data === 'object') {
        // If response is an object, check for common properties
        if (Array.isArray(data.identifiers)) {
          setIdentifiers(data.identifiers);
        } else if (Array.isArray(data.data)) {
          setIdentifiers(data.data);
        } else if (Array.isArray(data.items)) {
          setIdentifiers(data.items);
        } else {
          console.warn('Unexpected API response structure:', data);
          setIdentifiers([]);
        }
      } else {
        console.warn('Invalid API response:', data);
        setIdentifiers([]);
      }
    } catch (error) {
      console.error("Error fetching statutory data:", error);
      ToasterService.error("Error fetching statutory data");
      setIdentifiers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMonthlySummary = async () => {
    try {
      const res = await axios.get('/v1/api/payroll/statutory/monthly-summary', {
        params: { month: selectedMonth }
      });

      const data = res.data;
      if (data && typeof data === 'object') {
        setMonthlySummary(data);
      } else {
        console.warn('Invalid monthly summary response:', data);
        ToasterService.warning("Invalid monthly summary response");
        setMonthlySummary(null);
      }
    } catch (error) {
      console.error("Error fetching monthly summary:", error);
      ToasterService.error("Error fetching monthly summary");
      setMonthlySummary(null);
    }
  };

  const handleDownloadECR = async () => {
    try {
      const res = await axios.get('/v1/api/payroll/statutory/form/pf-ecr', {
        params: { month: selectedMonth },
        responseType: 'blob'
      });

      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      saveAs(blob, `PF_ECR_${selectedMonth}.xlsx`);
      setShowDownloadModal(false);
      ToasterService.success("ECR downloaded successfully");
    } catch (error) {
      console.error("Error downloading ECR:", error);
      ToasterService.error("Error downloading ECR");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.employeeId) {
      alert("Please select an employee");
      return;
    }

    try {
      const url = isEditMode
        ? '/v1/api/payroll/statutory/components/update'
        : '/v1/api/payroll/statutory/components/create';

      await axios.post(url, form);
      fetchStatutoryData();
      closeForm();
      ToasterService.success("Statutory data submitted successfully");
    } catch (error) {
      console.error("Error submitting form:", error);
      ToasterService.error("Error submitting statutory data");
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setIsEditMode(false);
    setForm({
      employeeId: parseInt(employeeIdFromUrl) || (selectedEmployee ? parseInt(selectedEmployee.id) : 0),
      countryCode: countryCodeFromUrl,
      pfApplicable: true,
      esiApplicable: true,
      gratuityApplicable: true,
      professionalTaxApplicable: true,
      identifiers: []
    });
  };

  const addIdentifier = () => {
    setForm({
      ...form,
      identifiers: [...form.identifiers, { identifierType: "", value: "" }]
    });
  };

  const removeIdentifier = (index: number) => {
    setForm({
      ...form,
      identifiers: form.identifiers.filter((_, i) => i !== index)
    });
  };

  const updateIdentifier = (index: number, field: 'identifierType' | 'value', value: string) => {
    const updated = [...form.identifiers];
    updated[index][field] = value;
    setForm({ ...form, identifiers: updated });
  };

  const filtered = useMemo(() => {
    if (!Array.isArray(identifiers)) {
      console.error('identifiers is not an array:', identifiers);
      return [];
    }

    return identifiers.filter(i => {
      if (!i || typeof i !== 'object') return false;

      const searchLower = search.toLowerCase();
      return (
        (i.identifierType && i.identifierType.toLowerCase().includes(searchLower)) ||
        (i.identifierValue && i.identifierValue.toLowerCase().includes(searchLower)) ||
        (i.employeeName && i.employeeName.toLowerCase().includes(searchLower))
      );
    });
  }, [identifiers, search]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportExcel = () => {
    if (!Array.isArray(filtered) || filtered.length === 0) {
      ToasterService.warning("No data to export");
      return;
    }

    const data = filtered.map(i => ({
      "ID": i.id || 'N/A',
      "Employee": i.employeeName || 'N/A',
      "Employee Code": i.employeeCode || 'N/A',
      "Type": i.identifierType || 'N/A',
      "Label": i.identifierLabel || 'N/A',
      "Value": i.identifierValue || 'N/A'
    }));

    try {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Statutory_Compliance");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      saveAs(new Blob([buf], { type: "application/octet-stream" }), `Statutory_Compliance_${selectedMonth}.xlsx`);
      ToasterService.success("Data exported successfully");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      ToasterService.error("Error exporting data");
    }
  };

  const getMonthName = (monthString: string) => {
    try {
      const [year, month] = monthString.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1);
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch (error) {
      return monthString;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PageMeta title="Statutory Compliances" description="Manage statutory compliance identifiers" />

      {/* Header */}
      <div className="sticky top-0 z-10 border-b bg-white">
        <div className="px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <PageBreadcrumb pageTitle="Statutory Compliances" />
              <h1 className="text-xl font-semibold text-gray-900 mt-1">
                {isHR ? 'Statutory Management' : 'My Statutory Details'}
              </h1>
              {!isHR && (employeeName || employeeCode) && (
                <p className="text-sm text-gray-600 mt-1">
                  {employeeName} {employeeCode && `(${employeeCode})`}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isHR && (
                <button
                  onClick={() => setShowDownloadModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download size={16} />
                  ECR Report
                </button>
              )}
              <button
                onClick={exportExcel}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <FileDown size={16} />
                Export
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <Plus size={16} />
                {isHR ? 'Add Record' : 'Add Identifier'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto">
          {/* Stats and Filters */}
          <div className="mb-6">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Month Selection */}
              <div className="flex-1">
                <div className="flex items-center gap-4">
                  <div className="flex-1 max-w-xs">
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => {
                          setSelectedMonth(e.target.value);
                          fetchMonthlySummary();
                        }}
                        className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>

                  {/* HR Employee Selection */}
                  {isHR && (
                    <div className="flex-1 max-w-xs">
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                        <select
                          value={selectedEmployee?.id || ''}
                          onChange={(e) => {
                            const selected = e.target.value;
                            if (selected) {
                              setSelectedEmployee({
                                id: selected,
                                name: 'Employee Name',
                                code: selected
                              });
                            } else {
                              setSelectedEmployee(null);
                            }
                          }}
                          className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                        >
                          <option value="">All Employees</option>
                          <option value="1">EMP001 - John Doe</option>
                          <option value="2">EMP002 - Jane Smith</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Search */}
              <div className="lg:w-64">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search..."
                    className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Stats */}
            {monthlySummary && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Employees</p>
                      <p className="text-2xl font-semibold text-gray-900">{monthlySummary.totalEmployees || 0}</p>
                    </div>
                    <User className="text-gray-400" size={20} />
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total PF</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        ₹{((monthlySummary.totalPF || 0) / 1000).toFixed(0)}k
                      </p>
                    </div>
                    <Shield className="text-gray-400" size={20} />
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total ESI</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        ₹{((monthlySummary.totalESI || 0) / 1000).toFixed(0)}k
                      </p>
                    </div>
                    <FileText className="text-gray-400" size={20} />
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">Total PT</p>
                      <p className="text-2xl font-semibold text-gray-900">
                        ₹{((monthlySummary.totalPT || 0) / 1000).toFixed(0)}k
                      </p>
                    </div>
                    <Tag className="text-gray-400" size={20} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    {isHR && (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Employee
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Code
                        </th>
                      </>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Label
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={isHR ? 5 : 3} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-8 h-8 border-4 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-sm text-gray-500">Loading...</p>
                        </div>
                      </td>
                    </tr>
                  ) : Array.isArray(paginated) && paginated.length > 0 ? (
                    paginated.map((identifier, idx) => (
                      <motion.tr
                        key={identifier.id || idx}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        {isHR && (
                          <>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">
                                {identifier.employeeName || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-600">
                                {identifier.employeeCode || 'N/A'}
                              </div>
                            </td>
                          </>
                        )}
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {identifier.identifierType || 'N/A'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">
                          {identifier.identifierLabel || 'N/A'}
                        </td>
                        <td className="px-6 py-4">
                          <code className="text-sm font-mono text-gray-900 bg-gray-50 px-2 py-1 rounded">
                            {identifier.identifierValue || 'N/A'}
                          </code>
                        </td>
                      </motion.tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isHR ? 5 : 3} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle className="text-gray-400" size={24} />
                          <p className="text-sm text-gray-500">No records found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {((page - 1) * pageSize) + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    className="p-2 text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Download Modal */}
      <AnimatePresence>
        {showDownloadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-lg w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Download ECR Report</h3>
                <button
                  onClick={() => setShowDownloadModal(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Month
                  </label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    {getMonthName(selectedMonth)}
                  </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    The ECR report will include all statutory compliance data for the selected month.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDownloadModal(false)}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDownloadECR}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors inline-flex items-center justify-center gap-2"
                  >
                    <Download size={16} />
                    Download
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {isEditMode ? 'Update' : 'Add'} Statutory Record
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Configure statutory compliance settings
                  </p>
                </div>
                <button
                  onClick={closeForm}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Employee Selection for HR */}
                  {isHR && !employeeIdFromUrl && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Employee
                      </label>
                      <select
                        value={form.employeeId || ''}
                        onChange={(e) => setForm({ ...form, employeeId: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                        required
                      >
                        <option value="">Select an employee</option>
                        <option value="1">EMP001 - John Doe</option>
                        <option value="2">EMP002 - Jane Smith</option>
                      </select>
                    </div>
                  )}

                  {/* Applicability Settings */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Applicability
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { key: 'pfApplicable', label: 'PF Applicable', icon: <Shield size={16} /> },
                        { key: 'esiApplicable', label: 'ESI Applicable', icon: <FileText size={16} /> },
                        { key: 'gratuityApplicable', label: 'Gratuity Applicable', icon: <CheckCircle size={16} /> },
                        { key: 'professionalTaxApplicable', label: 'PT Applicable', icon: <Tag size={16} /> }
                      ].map(({ key, label, icon }) => (
                        <label
                          key={key}
                          className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={form[key as keyof StatutoryComponentForm] as boolean}
                            onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                            className="w-4 h-4 text-gray-900 rounded focus:ring-gray-900"
                          />
                          <span className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            {icon}
                            {label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Identifiers */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Identifiers
                      </label>
                      <button
                        type="button"
                        onClick={addIdentifier}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-800 transition-colors"
                      >
                        <Plus size={14} />
                        Add Identifier
                      </button>
                    </div>

                    <div className="space-y-3">
                      {form.identifiers.map((identifier, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                          <div className="flex-1 space-y-2">
                            <input
                              type="text"
                              placeholder="Type (e.g., PAN)"
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none uppercase"
                              value={identifier.identifierType}
                              onChange={(e) => updateIdentifier(index, 'identifierType', e.target.value.toUpperCase())}
                              required
                            />
                            <input
                              type="text"
                              placeholder="Value"
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
                              value={identifier.value}
                              onChange={(e) => updateIdentifier(index, 'value', e.target.value)}
                              required
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeIdentifier(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      ))}

                      {form.identifiers.length === 0 && (
                        <div className="text-center py-8 bg-gray-50 rounded-lg">
                          <Hash className="mx-auto text-gray-400 mb-2" size={24} />
                          <p className="text-sm text-gray-500">No identifiers added</p>
                        </div>
                      )}
                    </div>
                  </div>
                </form>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    onClick={handleSubmit}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    {isEditMode ? 'Update' : 'Save'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StatutoryCompliancesPage;