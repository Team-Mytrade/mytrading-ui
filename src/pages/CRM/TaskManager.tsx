import React, { useEffect, useState, ChangeEvent, FormEvent } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  PencilSquareIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  EyeIcon,
  MagnifyingGlassIcon,
} from "@heroicons/react/24/outline";
import { FloatingInput, FloatingSelect1 as FloatingSelect, FloatingDatePicker, FloatingTextarea } from "../../components/inputfeild/FloatingInput";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { ToasterService } from "../../Services/ToasterService";
import StatsCard from "../../components/common/Statscard";
import { AddButton } from "../../components/common/AddButton";

interface Task {
  id: number;
  title: string;
  description: string;
  status: "Pending" | "InProgress" | "Completed";
  dueDate: string;
  assignedTo: string;
}

const statusColors: Record<string, string> = {
  Completed: "bg-green-100 text-green-800",
  Pending: "bg-gray-100 text-gray-800",
  InProgress: "bg-yellow-100 text-yellow-800",
  VIP: "bg-purple-100 text-purple-800",
};

const API_URL = "/v1/api/crm/tasks";
const PAGE_SIZE = 5;

const TaskManager: React.FC = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState<Partial<Task>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<keyof Task>("title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await axios.get<Task[]>(API_URL);
      setTasks(res.data);
    } catch (err) {
      console.error("Error fetching tasks", err);
      setTasks([]);
    }
  };

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingId !== null) {
        await axios.put(`${API_URL}/${editingId}`, form);
        ToasterService.success("Task updated successfully!");
      } else {
        await axios.post(API_URL, form);
        ToasterService.success("Task added successfully!");
      }
      setForm({});
      setEditingId(null);
      setShowFormModal(false);
      fetchTasks();
    } catch (err) {
      console.error("Error saving task", err);
      ToasterService.error("Failed to save task");
    }
  };

  const handleEdit = (task: Task) => {
    setForm(task);
    setEditingId(task.id);
    setShowFormModal(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${API_URL}/${id}`);
      ToasterService.success("Task deleted successfully!");
      fetchTasks();
    } catch (err) {
      console.error("Error deleting task", err);
      ToasterService.error("Failed to delete task");
    }
  };

  const handleSort = (key: keyof Task) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const filtered = tasks.filter((task) =>
    [task.title, task.description, task.assignedTo, task.status].some((field) =>
      field.toLowerCase().includes(search.toLowerCase())
    )
  );

  const sorted = [...filtered].sort((a, b) => {
    const valA = a[sortKey] ?? "";
    const valB = b[sortKey] ?? "";
    if (sortKey === "dueDate") {
      return sortOrder === "asc"
        ? new Date(valA as string).getTime() - new Date(valB as string).getTime()
        : new Date(valB as string).getTime() - new Date(valA as string).getTime();
    }
    if (typeof valA === "string" && typeof valB === "string") {
      return sortOrder === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return 0;
  });

  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pendingCount = tasks.filter((task) => task.status === "Pending").length;
  const inProgressCount = tasks.filter((task) => task.status === "InProgress").length;
  const completedCount = tasks.filter((task) => task.status === "Completed").length;

  return (
    <>
      <PageMeta title="Task Management" description="Manage CRM tasks" />
      <PageBreadcrumb pageTitle="Task Management" />

      <div className="max-w-7xl mx-auto px-6 pb-6 pt-0 space-y-6">
        <div className="mb-8 -mt-[100px] flex justify-end">
          <AddButton
            onClick={() => {
              setShowFormModal(true);
              setForm({});
              setEditingId(null);
            }}
            label="Add Task"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatsCard
            label="Total Tasks"
            value={tasks.length}
            gradient="from-cyan-50 to-blue-50"
            borderColor="border-cyan-100"
            labelColor="text-cyan-600"
          />
          <StatsCard
            label="Pending"
            value={pendingCount}
            gradient="from-green-50 to-emerald-50"
            borderColor="border-green-100"
            labelColor="text-green-600"
          />
          <StatsCard
            label="In Progress"
            value={inProgressCount}
            gradient="from-purple-50 to-pink-50"
            borderColor="border-purple-100"
            labelColor="text-purple-600"
          />
          <StatsCard
            label="Completed"
            value={completedCount}
            gradient="from-orange-50 to-yellow-50"
            borderColor="border-orange-100"
            labelColor="text-orange-600"
          />
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="relative w-full max-w-md">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4"
            />
          </div>
        </div>

        <div className="shadow overflow-visible border border-gray-200 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["title", "assignedTo", "status", "dueDate"].map((key) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key as keyof Task)}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-1">
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                      {sortKey === key &&
                        (sortOrder === "asc" ? (
                          <ChevronUpIcon className="w-4 h-4" />
                        ) : (
                          <ChevronDownIcon className="w-4 h-4" />
                        ))}
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginated.map((task) => (
                <tr key={task.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{task.title}</td>
                  <td className="px-6 py-4">{task.assignedTo}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[task.status]}`}
                    >
                      {task.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">{new Date(task.dueDate).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-right space-x-2 relative z-10">
                    <button
                      onClick={() => navigate(`/crm-view/tasks/${task.id}`, { state: { from: "tasks" } })}
                      className="text-gray-600 hover:text-gray-900"
                    >
                      <EyeIcon className="w-5 h-5 inline" />
                    </button>
                    <button
                      onClick={() => handleEdit(task)}
                      className="text-cyan-600 hover:text-cyan-900"
                    >
                      <PencilSquareIcon className="w-5 h-5 inline" />
                    </button>
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <TrashIcon className="w-5 h-5 inline" />
                    </button>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-gray-500">
                    No tasks found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`px-3 py-1 rounded ${page === i + 1
                  ? "bg-cyan-600 text-white"
                  : "bg-gray-200 text-gray-700"
                  }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}

        {showFormModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            <div className="bg-white rounded-lg shadow w-full max-w-2xl mx-4 max-h-screen overflow-y-auto">
              <div className="flex items-start justify-between p-5 border-b rounded-t">
                <h3 className="text-xl font-semibold">
                  {editingId !== null ? "Edit Task" : "Add Task"}
                </h3>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="text-gray-400 hover:bg-gray-200 hover:text-gray-900 rounded-lg p-1.5"
                >
                  x
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 grid grid-cols-6 gap-6 pt-6">
                <div className="col-span-6 sm:col-span-3">
                  <FloatingInput
                    label="Title"
                    name="title"
                    value={form.title || ""}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <FloatingInput
                    label="Assigned To"
                    name="assignedTo"
                    value={form.assignedTo || ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <FloatingSelect
                    label="Status"
                    name="status"
                    value={form.status || ""}
                    onChange={handleChange}
                    options={[
                      { id: "Pending", name: "Pending" },
                      { id: "InProgress", name: "In Progress" },
                      { id: "Completed", name: "Completed" },
                    ]}
                    required
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <FloatingDatePicker
                    label="Due Date"
                    name="dueDate"
                    value={form.dueDate || ""}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  />
                </div>
                <div className="col-span-6">
                  <FloatingTextarea
                    label="Description"
                    name="description"
                    value={form.description || ""}
                    onChange={handleChange}
                    rows={3}
                  />
                </div>
                <div className="col-span-6 flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-cyan-700 hover:to-blue-700 transition-all duration-200 shadow-sm"
                  >
                    {editingId !== null ? "Update Task" : "Add Task"}
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

export default TaskManager;
