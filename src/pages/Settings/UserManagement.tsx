import React, { useState, useMemo } from "react";

interface User {
  id: number;
  name: string;
  email: string;
  role: "Admin" | "Manager" | "User";
  status: "Active" | "Inactive";
}

const initialUsers: User[] = [
  { id: 1, name: "Alice Johnson", email: "alice@example.com", role: "Admin", status: "Active" },
  { id: 2, name: "Bob Smith", email: "bob@example.com", role: "Manager", status: "Inactive" },
  { id: 3, name: "Charlie Davis", email: "charlie@example.com", role: "User", status: "Active" },
  // more...
];

const PAGE_SIZE = 5;

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<keyof User>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  // Form state
  const [formData, setFormData] = useState<Omit<User, "id">>({
    name: "",
    email: "",
    role: "User",
    status: "Active",
  });

  // Sorting logic
  const sortedUsers = useMemo(() => {
    return [...users].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === "string" && typeof bVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [users, sortField, sortDirection]);

  // Pagination slice
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedUsers.slice(start, start + PAGE_SIZE);
  }, [sortedUsers, page]);

  const totalPages = Math.ceil(users.length / PAGE_SIZE);

  const changeSort = (field: keyof User) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Open modal for add or edit
  const openModal = (user?: User) => {
    if (user) {
      setEditUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      });
    } else {
      setEditUser(null);
      setFormData({ name: "", email: "", role: "User", status: "Active" });
    }
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => setShowModal(false);

  // Handle form input changes
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Save user (add or update)
  const saveUser = () => {
    if (!formData.name || !formData.email) {
      alert("Name and Email are required.");
      return;
    }
    if (editUser) {
      // Update
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editUser.id ? { ...u, ...formData } : u
        )
      );
    } else {
      // Add new
      const newUser: User = {
        id: users.length ? users[users.length - 1].id + 1 : 1,
        ...formData,
      };
      setUsers((prev) => [...prev, newUser]);
    }
    closeModal();
  };

  // Delete user
  const deleteUser = (id: number) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6">User Management</h2>

      <button
        className="btn btn-primary mb-4"
        onClick={() => openModal()}
      >
        Add New User
      </button>

      <table className="w-full text-sm border-collapse">
        <thead className="bg-gray-100 cursor-pointer select-none">
          <tr>
            <th
              className="px-4 py-2 text-left"
              onClick={() => changeSort("name")}
            >
              Name {sortField === "name" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th
              className="px-4 py-2 text-left"
              onClick={() => changeSort("email")}
            >
              Email {sortField === "email" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th
              className="px-4 py-2 text-left"
              onClick={() => changeSort("role")}
            >
              Role {sortField === "role" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th
              className="px-4 py-2 text-center"
              onClick={() => changeSort("status")}
            >
              Status {sortField === "status" && (sortDirection === "asc" ? "▲" : "▼")}
            </th>
            <th className="px-4 py-2 text-center">Actions</th>
          </tr>
        </thead>

        <tbody>
          {paginatedUsers.length === 0 ? (
            <tr>
              <td colSpan={5} className="text-center py-4 text-gray-500">
                No users found.
              </td>
            </tr>
          ) : (
            paginatedUsers.map(({ id, name, email, role, status }) => (
              <tr key={id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{name}</td>
                <td className="px-4 py-2">{email}</td>
                <td className="px-4 py-2">{role}</td>
                <td className="px-4 py-2 text-center">{status}</td>
                <td className="px-4 py-2 text-center space-x-2">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => openModal(users.find(u => u.id === id))}
                    title="Edit User"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn btn-sm btn-error"
                    onClick={() => deleteUser(id)}
                    title="Delete User"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div className="mt-4 flex justify-center space-x-2">
        <button
          className="btn btn-outline px-3 py-1 disabled:opacity-50"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          Prev
        </button>
        {[...Array(totalPages)].map((_, i) => (
          <button
            key={i}
            className={`btn px-3 py-1 ${
              page === i + 1 ? "btn-primary" : "btn-outline"
            }`}
            onClick={() => setPage(i + 1)}
          >
            {i + 1}
          </button>
        ))}
        <button
          className="btn btn-outline px-3 py-1 disabled:opacity-50"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          Next
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center z-50">
          <div className="bg-white rounded shadow-lg w-96 p-6 relative">
            <h3 className="text-xl font-semibold mb-4">
              {editUser ? "Edit User" : "Add New User"}
            </h3>

            <div className="space-y-3">
              <label className="block">
                <span className="text-sm font-medium">Name</span>
                <input
                  type="text"
                  name="name"
                  className="form-input mt-1 w-full"
                  value={formData.name}
                  onChange={handleChange}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">Email</span>
                <input
                  type="email"
                  name="email"
                  className="form-input mt-1 w-full"
                  value={formData.email}
                  onChange={handleChange}
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium">Role</span>
                <select
                  name="role"
                  className="form-select mt-1 w-full"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="Admin">Admin</option>
                  <option value="Manager">Manager</option>
                  <option value="User">User</option>
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium">Status</span>
                <select
                  name="status"
                  className="form-select mt-1 w-full"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={closeModal}
                className="btn btn-outline px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={saveUser}
                className="btn btn-primary px-4 py-2"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
