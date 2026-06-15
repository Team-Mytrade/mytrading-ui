import React, { useEffect, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type AttendanceLog = {
  id: number;
  employeeId: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: string;
};

const AttendanceTrackingPage: React.FC = () => {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [form, setForm] = useState<Omit<AttendanceLog, "id">>({
    employeeId: "",
    date: "",
    checkIn: "",
    checkOut: "",
    status: "Present",
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchId, setSearchId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const API = "/api/attendance"; // Replace with your real endpoint

  useEffect(() => {
    axios.get(API).then(res => setLogs(res.data));
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    const { employeeId, date, checkIn, checkOut } = form;
    if (!employeeId || !date || !checkIn || !checkOut) {
      return alert("Please fill in all required fields.");
    }

    try {
      if (editingId !== null) {
        await axios.put(`${API}/${editingId}`, form);
      } else {
        await axios.post(API, form);
      }
      const res = await axios.get(API);
      setLogs(res.data);
      resetForm();
    } catch {
      alert("Error saving record.");
    }
  };

  const handleEdit = (log: AttendanceLog) => {
    setForm({
      employeeId: log.employeeId,
      date: log.date,
      checkIn: log.checkIn,
      checkOut: log.checkOut,
      status: log.status,
    });
    setEditingId(log.id);
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    if (confirm("Delete this record?")) {
      await axios.delete(`${API}/${id}`);
      setLogs(prev => prev.filter(l => l.id !== id));
    }
  };

  const resetForm = () => {
    setForm({ employeeId: "", date: "", checkIn: "", checkOut: "", status: "Present" });
    setEditingId(null);
    setShowForm(false);
  };

  // Filter logic
  const filtered = logs.filter(log => {
    const matchesId = searchId.trim() ? log.employeeId.includes(searchId.trim()) : true;
    const inDateFrom = dateFrom ? log.date >= dateFrom : true;
    const inDateTo = dateTo ? log.date <= dateTo : true;
    return matchesId && inDateFrom && inDateTo;
  });

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filtered);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf]), "Attendance.xlsx");
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Attendance Logs", 14, 16);
    autoTable(doc, {
      head: [["Emp ID", "Date", "In", "Out", "Status"]],
      body: filtered.map(l => [l.employeeId, l.date, l.checkIn, l.checkOut, l.status]),
      startY: 20,
    });
    doc.save("Attendance.pdf");
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Attendance Tracking</h1>

      {/* Filters and controls */}
      <div className="flex flex-wrap gap-4 items-end mb-4 print:hidden">
        <input
          type="text"
          placeholder="Employee ID"
          value={searchId}
          onChange={e => { setSearchId(e.target.value); setPage(1); }}
          className="border p-2 rounded"
        />
        <div>
          <label className="block text-sm">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }}
            className="border p-2 rounded"
          />
        </div>
        <div>
          <label className="block text-sm">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1); }}
            className="border p-2 rounded"
          />
        </div>
        <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded">
          📊 Excel
        </button>
        <button onClick={exportPDF} className="bg-red-600 text-white px-4 py-2 rounded">
          🧾 PDF
        </button>
        <button onClick={() => window.print()} className="bg-gray-700 text-white px-4 py-2 rounded">
          🖨️ Print
        </button>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="bg-blue-600 text-white px-4 py-2 rounded">
          {showForm ? "Close Form" : "+ Add Attendance"}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-100 p-4 mb-4 rounded print:hidden">
          <div className="grid grid-cols-2 gap-4">
            {(() => ["employeeId", "date", "checkIn", "checkOut"].map(field => (
              <div key={field}>
                <label className="block font-medium capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
                <input
                  type={field === "date" ? "date" : "time"}
                  name={field}
                  value={(form as any)[field]}
                  onChange={handleInput}
                  className="border p-2 rounded w-full"
                />
              </div>
            )))()}
            <div>
              <label className="block font-medium">Status</label>
              <select name="status" value={form.status} onChange={handleInput} className="border p-2 rounded w-full">
                <option>Present</option>
                <option>Absent</option>
                <option>Late</option>
              </select>
            </div>
          </div>
          <div className="text-right mt-4">
            <button onClick={handleSubmit} className="bg-blue-700 text-white px-4 py-2 rounded">
              {editingId !== null ? "Update" : "Add"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border text-sm print:text-xs">
          <thead className="bg-gray-200 print:bg-white">
            <tr>
              {["Employee ID", "Date", "Check-In", "Check-Out", "Status", "Actions"].map(h => (
                <th key={h} className="border px-2 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map(log => (
              <tr key={log.id} className="border hover:bg-gray-50">
                <td className="px-2 py-2">{log.employeeId}</td>
                <td className="px-2 py-2">{log.date}</td>
                <td className="px-2 py-2">{log.checkIn}</td>
                <td className="px-2 py-2">{log.checkOut}</td>
                <td className="px-2 py-2">{log.status}</td>
                <td className="px-2 py-2 space-x-2 print:hidden">
                  <button onClick={() => handleEdit(log)} className="text-blue-600">Edit</button>
                  <button onClick={() => handleDelete(log.id)} className="text-red-600">Delete</button>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-4 text-gray-500">No records found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mt-4 print:hidden">
        <button
          disabled={page === 1}
          onClick={() => setPage(p => p - 1)}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Prev
        </button>
        <span>Page {page} of {totalPages || 1}</span>
        <button
          disabled={page === totalPages}
          onClick={() => setPage(p => p + 1)}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default AttendanceTrackingPage;
