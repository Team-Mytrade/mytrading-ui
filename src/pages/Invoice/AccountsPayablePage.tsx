import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { useReactToPrint } from "react-to-print";
import {
  ArrowDownTrayIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  EyeIcon,
  PencilSquareIcon,
  PrinterIcon,
  ShareIcon,
  TrashIcon,
  UserGroupIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import StatsCard from "../../components/common/Statscard";
import ReusableTable, { ColumnDef } from "../../components/common/Table";
import DynamicPopup from "../../components/common/Popup";
import { AddButton } from "../../components/common/AddButton";
import { BackButton } from "../../components/common/BackButton";
import { ToasterService } from "../../Services/ToasterService";

interface Employee {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth?: string;
  employmentType?: string;
  designation?: string;
  location?: string;
  managerId?: string;
  joiningDate?: string;
  exitDate?: string | null;
  bankAccountNumber?: string;
  bankName?: string;
  ifscCode?: string;
  departmentName?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const ITEMS_PER_PAGE = 10;

const EmployeeRecordsPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [formData, setFormData] = useState<Partial<Employee>>({});
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    content: () => printRef.current!,
    documentTitle: "Employees",
  });

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const resp = await axios.get<Employee[]>("/api/employees");
      setEmployees(Array.isArray(resp.data) ? resp.data : []);
    } catch (err) {
      console.error("Error fetching employees", err);
      ToasterService.error("Failed to load employees");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(employees);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "Employees.xlsx");
    setShowExportMenu(false);
  };

  const exportCSV = () => {
    const ws = XLSX.utils.json_to_sheet(employees);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Employees.csv";
    a.click();
    window.URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const openCreate = () => {
    setEditing(null);
    setFormData({});
    setSelectedEmployee(null);
    setShowForm(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    const data = { ...emp };
    if (data.dateOfBirth) data.dateOfBirth = data.dateOfBirth.slice(0, 10);
    if (data.joiningDate) data.joiningDate = data.joiningDate.slice(0, 10);
    if (data.exitDate) data.exitDate = data.exitDate.slice(0, 10);
    setFormData(data);
    setShowDetailsModal(false);
    setShowForm(true);
  };

  const openDetails = (emp: Employee) => {
    setSelectedEmployee(emp);
    setShowDetailsModal(true);
  };

  const onFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const target = e.target;
    const name = target.name as keyof Employee;
    const value = target instanceof HTMLInputElement && target.type === "checkbox"
      ? target.checked
      : target.value;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async () => {
    try {
      if (editing) {
        await axios.put(`/api/employees/update/${editing.id}`, formData);
        ToasterService.success("Employee updated successfully");
      } else {
        await axios.post("/api/employees/create", formData);
        ToasterService.success("Employee created successfully");
      }
      await fetchEmployees();
      setShowForm(false);
      setEditing(null);
      setFormData({});
    } catch (err) {
      console.error("Save failed:", err);
      ToasterService.error("Failed to save employee.");
    }
  };

  const promptDelete = (emp: Employee) => {
    setEmployeeToDelete(emp);
    setShowDeletePopup(true);
  };

  const handleDelete = async () => {
    if (!employeeToDelete) return;
    try {
      await axios.delete(`/api/employees/delete/${employeeToDelete.id}`);
      setEmployees((prev) => prev.filter((e) => e.id !== employeeToDelete.id));
      setEmployeeToDelete(null);
      setShowDeletePopup(false);
      ToasterService.success("Employee deleted successfully");
    } catch (err) {
      console.error("Delete failed:", err);
      ToasterService.error("Failed to delete employee.");
    }
  };

  const totalActive = useMemo(
    () => employees.filter((employee) => employee.isActive).length,
    [employees]
  );

  const totalDepartments = useMemo(
    () => new Set(employees.map((employee) => employee.departmentName).filter(Boolean)).size,
    [employees]
  );

  const tableColumns = useMemo<ColumnDef<Employee>[]>(
    () => [
      {
        key: "employeeCode",
        label: "Employee",
        sortable: true,
        render: (employee) => (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-100">
              <UserGroupIcon className="h-5 w-5 text-cyan-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">
                {employee.firstName} {employee.lastName}
              </p>
              <p className="text-xs text-gray-500">{employee.employeeCode}</p>
            </div>
          </div>
        ),
      },
      {
        key: "email",
        label: "Contact",
        sortable: true,
        render: (employee) => (
          <div>
            <p className="text-sm text-gray-900">{employee.email || "--"}</p>
            <p className="text-xs text-gray-500">{employee.phone || "--"}</p>
          </div>
        ),
      },
      {
        key: "designation",
        label: "Role",
        sortable: true,
        render: (employee) => (
          <div>
            <p className="text-sm font-medium text-gray-700">{employee.designation || "--"}</p>
            <p className="text-xs text-gray-500">{employee.employmentType || "--"}</p>
          </div>
        ),
      },
      {
        key: "location",
        label: "Location",
        sortable: true,
        render: (employee) => (
          <div>
            <p className="text-sm text-gray-700">{employee.location || "--"}</p>
            <p className="text-xs text-gray-500">Dept: {employee.departmentName || "--"}</p>
          </div>
        ),
      },
      {
        key: "isActive",
        label: "Status",
        sortable: true,
        render: (employee) =>
          employee.isActive ? (
            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
              <CheckCircleIcon className="mr-1 h-4 w-4" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
              <XCircleIcon className="mr-1 h-4 w-4" />
              Inactive
            </span>
          ),
      },
      {
        key: "actions",
        label: "Actions",
        className: "w-40",
        render: (employee) => (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => openDetails(employee)}
              className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-cyan-600"
              title="View details"
            >
              <EyeIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => openEdit(employee)}
              className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-blue-600"
              title="Edit employee"
            >
              <PencilSquareIcon className="h-4 w-4" />
            </button>
            <button
              onClick={() => promptDelete(employee)}
              className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
              title="Delete employee"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    []
  );

  const tableToolbar = (
    <>
      <div className="relative">
        <button
          onClick={() => setShowExportMenu((prev) => !prev)}
          className="rounded-lg border border-gray-300 p-2 transition-colors hover:bg-gray-50"
          title="Export"
        >
          <ShareIcon className="h-5 w-5 text-gray-600" />
        </button>

        {showExportMenu && (
          <div className="absolute right-0 top-full z-20 mt-2 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            <button
              onClick={exportExcel}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <ArrowDownTrayIcon className="h-4 w-4 text-green-600" />
              Export Excel
            </button>
            <button
              onClick={exportCSV}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <ArrowDownTrayIcon className="h-4 w-4 text-blue-600" />
              Export CSV
            </button>
            <button
              onClick={handlePrint}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
            >
              <PrinterIcon className="h-4 w-4 text-gray-600" />
              Print
            </button>
          </div>
        )}
      </div>
    </>
  );

  const fieldConfigs: { label: string; name: keyof Employee; type: string }[] = [
    { label: "Employee Code", name: "employeeCode", type: "text" },
    { label: "First Name", name: "firstName", type: "text" },
    { label: "Last Name", name: "lastName", type: "text" },
    { label: "Email", name: "email", type: "email" },
    { label: "Phone", name: "phone", type: "text" },
    { label: "Gender", name: "gender", type: "text" },
    { label: "Date of Birth", name: "dateOfBirth", type: "date" },
    { label: "Employment Type", name: "employmentType", type: "text" },
    { label: "Designation", name: "designation", type: "text" },
    { label: "Location", name: "location", type: "text" },
    { label: "Manager ID", name: "managerId", type: "text" },
    { label: "Joining Date", name: "joiningDate", type: "date" },
    { label: "Exit Date", name: "exitDate", type: "date" },
    { label: "Bank Account Number", name: "bankAccountNumber", type: "text" },
    { label: "Bank Name", name: "bankName", type: "text" },
    { label: "IFSC Code", name: "ifscCode", type: "text" },
    { label: "Is Active", name: "isActive", type: "checkbox" },
  ];

  return (
    <>
      <PageMeta title="Accounts Payable" description="Manage employee records" />
      <PageBreadcrumb pageTitle="Accounts Payable" />

      <div className="mx-auto max-w-7xl p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
              <p className="mt-0.5 text-sm text-gray-500">
                Manage employee records without changing the current integration flow.
              </p>
            </div>
          </div>

          <AddButton label="Add Employee" onClick={openCreate} />
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            label="Total Employees"
            value={employees.length}
            gradient="from-blue-50 to-white"
            borderColor="border-blue-100"
            labelColor="text-blue-700"
            icon={<UserGroupIcon className="h-6 w-6 text-blue-600" />}
          />
          <StatsCard
            label="Active"
            value={totalActive}
            gradient="from-green-50 to-white"
            borderColor="border-green-100"
            labelColor="text-green-700"
            icon={<CheckCircleIcon className="h-6 w-6 text-green-600" />}
          />
          <StatsCard
            label="Departments"
            value={totalDepartments}
            gradient="from-purple-50 to-white"
            borderColor="border-purple-100"
            labelColor="text-purple-700"
            icon={<BriefcaseIcon className="h-6 w-6 text-purple-600" />}
          />
          <StatsCard
            label="Filtered Results"
            value={employees.length}
            gradient="from-cyan-50 to-white"
            borderColor="border-cyan-100"
            labelColor="text-cyan-700"
            icon={<UserGroupIcon className="h-6 w-6 text-cyan-600" />}
          />
        </div>

        <div ref={printRef}>
          <ReusableTable<Employee>
            data={employees}
            columns={tableColumns}
            loading={isLoading}
            searchable
            searchPlaceholder="Search by code, name, email..."
            searchFields={["employeeCode", "firstName", "lastName", "email"]}
            pageSize={ITEMS_PER_PAGE}
            defaultSortKey="employeeCode"
            defaultSortOrder="asc"
            toolbar={tableToolbar}
            onRowClick={openDetails}
            emptyState={
              <div className="flex flex-col items-center py-4 text-gray-400">
                <UserGroupIcon className="mb-3 h-12 w-12 text-gray-400" />
                <p className="text-sm font-medium text-gray-500">No employee records found</p>
                <p className="text-xs text-gray-400">Try adjusting your search</p>
              </div>
            }
          />
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-cyan-100 p-2">
                    <UserGroupIcon className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editing ? "Edit Employee" : "Add Employee"}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Update the employee details using the shared page pattern.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <XCircleIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                {fieldConfigs.map((field) => (
                  <div key={field.name} className={field.type === "checkbox" ? "md:col-span-2" : ""}>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{field.label}</label>
                    {field.type === "checkbox" ? (
                      <label className="flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                        <input
                          name={field.name}
                          type="checkbox"
                          checked={Boolean(formData[field.name])}
                          onChange={onFormChange}
                          className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        <span className="ml-2 text-sm text-gray-700">Active</span>
                      </label>
                    ) : (
                      <input
                        name={field.name}
                        type={field.type}
                        value={String(formData[field.name] ?? "")}
                        onChange={onFormChange}
                        className="w-full rounded-lg border border-gray-300 p-2 focus:border-transparent focus:ring-2 focus:ring-cyan-500"
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-white hover:bg-cyan-700"
                >
                  {editing ? "Update Employee" : "Create Employee"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDetailsModal && selectedEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-cyan-100 p-2">
                    <UserGroupIcon className="h-5 w-5 text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Employee Details</h3>
                    <p className="text-sm text-gray-500">
                      Quick summary from the current accounts payable record set.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                >
                  <XCircleIcon className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="mb-1 text-sm text-gray-500">Employee</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedEmployee.firstName} {selectedEmployee.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{selectedEmployee.employeeCode}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="mb-1 text-sm text-gray-500">Status</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {selectedEmployee.isActive ? "Active" : "Inactive"}
                  </p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="mb-1 text-sm text-gray-500">Email</p>
                  <p className="text-sm text-gray-900">{selectedEmployee.email || "--"}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="mb-1 text-sm text-gray-500">Phone</p>
                  <p className="text-sm text-gray-900">{selectedEmployee.phone || "--"}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="mb-1 text-sm text-gray-500">Designation</p>
                  <p className="text-sm text-gray-900">{selectedEmployee.designation || "--"}</p>
                </div>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="mb-1 text-sm text-gray-500">Location</p>
                  <p className="text-sm text-gray-900">{selectedEmployee.location || "--"}</p>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
                <button
                  onClick={() => {
                    if (selectedEmployee) openEdit(selectedEmployee);
                  }}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-white hover:bg-cyan-700"
                >
                  Edit Employee
                </button>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        <DynamicPopup
          isPopupOpen={showDeletePopup}
          setIsPopupOpen={setShowDeletePopup}
          icon={<TrashIcon className="h-6 w-6 text-red-600" />}
          iconBg="bg-red-100"
          innerText="Delete this employee?"
          subText={
            employeeToDelete
              ? `This will permanently remove ${employeeToDelete.firstName} ${employeeToDelete.lastName}.`
              : "This action cannot be undone."
          }
          confirmLabel="Delete"
          cancelLabel="Cancel"
          confirmBtnClass="bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white"
          onConfirm={handleDelete}
          onCancel={() => setEmployeeToDelete(null)}
        />
      </div>
    </>
  );
};

export default EmployeeRecordsPage;
