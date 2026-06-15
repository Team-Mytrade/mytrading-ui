import React, { useState } from 'react';

interface Account {
  id: number;
  name: string;
  type: string;
  industry: string;
  phone: string;
  email: string;
}

const AccountsPage: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [formMode, setFormMode] = useState<'view' | 'add' | 'edit'>('view');
  const [formData, setFormData] = useState<Omit<Account, 'id'>>({
    name: '',
    type: '',
    industry: '',
    phone: '',
    email: '',
  });
  const [editId, setEditId] = useState<number | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const resetForm = () => {
    setFormData({ name: '', type: '', industry: '', phone: '', email: '' });
    setEditId(null);
    setFormMode('view');
  };

  const handleAddAccount = () => {
    const newAccount: Account = {
      id: Date.now(),
      ...formData,
    };
    setAccounts([newAccount, ...accounts]);
    resetForm();
  };

  const handleUpdateAccount = () => {
    if (editId === null) return;
    const updatedAccounts = accounts.map((acc) =>
      acc.id === editId ? { id: editId, ...formData } : acc
    );
    setAccounts(updatedAccounts);
    resetForm();
  };

  const handleEditClick = (account: Account) => {
    setFormData({
      name: account.name,
      type: account.type,
      industry: account.industry,
      phone: account.phone,
      email: account.email,
    });
    setEditId(account.id);
    setFormMode('edit');
  };

  const handleDelete = (id: number) => {
    if (window.confirm('Delete this account?')) {
      setAccounts(accounts.filter((acc) => acc.id !== id));
    }
  };

  return (
    <div className="max-w-5xl mx-auto mt-10 p-6 bg-white rounded shadow border dark:bg-boxdark dark:border-stroke">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Accounts Manager</h2>

      {/* Controls */}
      <div className="mb-6 flex gap-4">
          <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          onClick={() => {
            resetForm();
            setFormMode('add');
          }}
          >
          Add Account
        </button>
        <button
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          onClick={() => setFormMode('view')}
        >
          View Accounts
        </button>
      </div>

      {/* Form */}
      {(formMode === 'add' || formMode === 'edit') && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            formMode === 'add' ? handleAddAccount() : handleUpdateAccount();
          }}
          className="space-y-4 mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Account Name"
              className="input input-bordered w-full"
              required
            />
            <select
              name="type"
              value={formData.type}
              onChange={handleInputChange}
              className="input input-bordered w-full"
              required
            >
              <option value="">Select Type</option>
              <option value="Customer">Customer</option>
              <option value="Partner">Partner</option>
              <option value="Vendor">Vendor</option>
            </select>
            <input
              name="industry"
              value={formData.industry}
              onChange={handleInputChange}
              placeholder="Industry"
              className="input input-bordered w-full"
            />
            <input
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="Phone"
              className="input input-bordered w-full"
            />
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Email"
              className="input input-bordered w-full"
            />
          </div>
          <div className="flex gap-4">
            <button
              type="submit"
              className="bg-success text-white px-6 py-2 rounded hover:bg-green-700"
            >
              {formMode === 'add' ? 'Add Account' : 'Update Account'}
            </button>
            <button type="button" onClick={resetForm} className="text-gray-500 underline">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Table */}
      {formMode === 'view' && (
        <div className="overflow-x-auto">
          {accounts.length === 0 ? (
            <p className="text-gray-600">No accounts found.</p>
          ) : (
            <table className="w-full text-left table-auto border-collapse">
              <thead className="bg-gray-100 text-sm">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Industry</th>
                  <th className="px-4 py-2">Phone</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-800">
                {accounts.map((account) => (
                  <tr key={account.id} className="border-t">
                    <td className="px-4 py-2">{account.name}</td>
                    <td className="px-4 py-2">{account.type}</td>
                    <td className="px-4 py-2">{account.industry}</td>
                    <td className="px-4 py-2">{account.phone}</td>
                    <td className="px-4 py-2">{account.email}</td>
                    <td className="px-4 py-2 space-x-2">
                      <button
                        onClick={() => handleEditClick(account)}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(account.id)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};

export default AccountsPage;
