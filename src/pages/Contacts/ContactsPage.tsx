import React, { useState } from 'react';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';

interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
}

const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [formMode, setFormMode] = useState<'view' | 'add' | 'edit'>('view');
  const [formData, setFormData] = useState<Omit<Contact, 'id'>>({
    name: '',
    email: '',
    phone: '',
  });
  const [editId, setEditId] = useState<number | null>(null);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Add contact
  const handleAddContact = () => {
    const newContact: Contact = {
      id: Date.now(),
      ...formData,
    };
    setContacts([newContact, ...contacts]);
    resetForm();
  };

  // Edit contact
  const handleUpdateContact = () => {
    if (editId === null) return;
    const updated = contacts.map((c) =>
      c.id === editId ? { id: editId, ...formData } : c
    );
    setContacts(updated);
    resetForm();
  };

  // Set form to edit mode
  const handleEditClick = (contact: Contact) => {
    setFormData({
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
    });
    setEditId(contact.id);
    setFormMode('edit');
  };

  // Delete contact
  const handleDelete = (id: number) => {
    if (window.confirm('Delete this contact?')) {
      setContacts(contacts.filter((c) => c.id !== id));
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({ name: '', email: '', phone: '' });
    setEditId(null);
    setFormMode('view');
  };

  return (
    <>
      <PageMeta
        title="React.js Contacts Dashboard | TailAdmin - Next.js Admin Dashboard Template"
        description="This is React.js Contacts Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="Contacts" />
    <div className="max-w-4xl mx-auto mt-10 p-6 bg-white rounded shadow border dark:bg-boxdark dark:border-stroke">
      <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-white">Contacts Manager</h2>

      {/* Button panel */}
      <div className="mb-6 flex gap-4">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          onClick={() => {
            resetForm();
            setFormMode('add');
          }}
        >
          Add Contact
        </button>
        <button
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          onClick={() => setFormMode('view')}
        >
          View Contacts
        </button>
      </div>

      {/* Form */}
      {(formMode === 'add' || formMode === 'edit') && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            formMode === 'add' ? handleAddContact() : handleUpdateContact();
          }}
          className="space-y-4 mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Full Name"
              className="border px-4 py-2 rounded w-full"
              required
            />
            <input
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Email"
              type="email"
              className="border px-4 py-2 rounded w-full"
              required
            />
            <input
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="Phone"
              className="border px-4 py-2 rounded w-full"
            />
          </div>
          <div className="flex gap-4">
            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
            >
              {formMode === 'add' ? 'Add Contact' : 'Update Contact'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="text-gray-600 underline"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Contacts Table */}
      {formMode === 'view' && (
        <div className="overflow-x-auto">
          {contacts.length === 0 ? (
            <p className="text-gray-500">No contacts available.</p>
          ) : (
            <table className="w-full table-auto text-left border-collapse">
              <thead className="bg-gray-100 text-sm">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Phone</th>
                  <th className="px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="text-sm text-gray-800">
                {contacts.map((contact) => (
                  <tr key={contact.id} className="border-t">
                    <td className="px-4 py-2">{contact.name}</td>
                    <td className="px-4 py-2">{contact.email}</td>
                    <td className="px-4 py-2">{contact.phone}</td>
                    <td className="px-4 py-2 space-x-2">
                      <button
                        onClick={() => handleEditClick(contact)}
                        className="text-blue-600 hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
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
    </>
  );
};

export default ContactsPage;
