import React, { useState, useMemo } from 'react';

interface Article {
  id: number;
  title: string;
  category: string;
  content: string;
  createdAt: string; // ISO date
}

const sampleArticles: Article[] = [
  {
    id: 1,
    title: 'How to reset your password',
    category: 'Account',
    content: 'To reset your password, go to settings...',
    createdAt: '2025-07-10T12:00:00Z',
  },
  {
    id: 2,
    title: 'Getting started with the CRM',
    category: 'Getting Started',
    content: 'Welcome to our CRM. This guide helps you get started...',
    createdAt: '2025-07-12T09:30:00Z',
  },
];

const PAGE_SIZE = 5;

const KnowledgeBase: React.FC = () => {
  const [articles, setArticles] = useState<Article[]>(sampleArticles);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Form states
  const [formMode, setFormMode] = useState<'add' | 'edit' | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Omit<Article, 'id' | 'createdAt'>>({
    title: '',
    category: '',
    content: '',
  });

  const filteredArticles = useMemo(() => {
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.category.toLowerCase().includes(search.toLowerCase())
    );
  }, [articles, search]);

  const totalPages = Math.ceil(filteredArticles.length / PAGE_SIZE);
  const pageArticles = filteredArticles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const resetForm = () => {
    setFormData({ title: '', category: '', content: '' });
    setFormMode(null);
    setEditingId(null);
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      alert('Title is required');
      return;
    }
    if (!formData.category.trim()) {
      alert('Category is required');
      return;
    }
    if (formMode === 'add') {
      const newArticle: Article = {
        id: Date.now(),
        createdAt: new Date().toISOString(),
        ...formData,
      };
      setArticles((prev) => [newArticle, ...prev]);
    } else if (formMode === 'edit' && editingId !== null) {
      setArticles((prev) =>
        prev.map((a) => (a.id === editingId ? { ...a, ...formData } : a))
      );
    }
    resetForm();
  };

  const handleEdit = (article: Article) => {
    setFormData({
      title: article.title,
      category: article.category,
      content: article.content,
    });
    setEditingId(article.id);
    setFormMode('edit');
  };

  const handleDelete = (id: number) => {
    if (confirm('Delete this article?')) {
      setArticles((prev) => prev.filter((a) => a.id !== id));
      if (editingId === id) resetForm();
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white dark:bg-boxdark border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Knowledge Base</h2>

      {/* Search & Add */}
      <div className="flex items-center mb-4 gap-4">
        <input
          type="text"
          placeholder="Search by title or category..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="input input-bordered flex-grow"
        />
        <button
          onClick={() => {
            resetForm();
            setFormMode('add');
          }}
          className="btn btn-primary"
        >
          + Add Article
        </button>
      </div>

      {/* Articles Table */}
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4">
            <tr>
              <th className="px-4 py-2 text-left">Title</th>
              <th className="px-4 py-2 text-left">Category</th>
              <th className="px-4 py-2 text-left">Created At</th>
              <th className="px-4 py-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageArticles.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-4 text-gray-500">
                  No articles found.
                </td>
              </tr>
            ) : (
              pageArticles.map((article) => (
                <tr key={article.id} className="border-t hover:bg-gray-50 dark:hover:bg-meta-3">
                  <td className="px-4 py-2">{article.title}</td>
                  <td className="px-4 py-2">{article.category}</td>
                  <td className="px-4 py-2">{new Date(article.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2 flex gap-2">
                    <button
                      onClick={() => handleEdit(article)}
                      className="text-blue-600 hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(article.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center mb-6">
        <div>
          Page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="btn btn-sm"
          >
            Prev
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="btn btn-sm"
          >
            Next
          </button>
        </div>
      </div>

      {/* Add/Edit Article Form */}
      {(formMode === 'add' || formMode === 'edit') && (
        <form
          onSubmit={handleSubmit}
          className="border border-stroke rounded p-4 bg-gray-50 dark:bg-meta-2"
        >
          <h3 className="text-xl font-semibold mb-4">
            {formMode === 'add' ? 'Add New Article' : 'Edit Article'}
          </h3>

          <label className="block mb-2 font-semibold">Title</label>
          <input
            name="title"
            type="text"
            className="input input-bordered w-full mb-4"
            value={formData.title}
            onChange={handleInputChange}
            required
          />

          <label className="block mb-2 font-semibold">Category</label>
          <input
            name="category"
            type="text"
            className="input input-bordered w-full mb-4"
            value={formData.category}
            onChange={handleInputChange}
            required
          />

          <label className="block mb-2 font-semibold">Content</label>
          <textarea
            name="content"
            className="input input-bordered w-full mb-4 resize-y"
            rows={6}
            value={formData.content}
            onChange={handleInputChange}
          />

          <div className="flex gap-4">
            <button type="submit" className="btn btn-primary">
              {formMode === 'add' ? 'Add Article' : 'Update Article'}
            </button>
            <button type="button" onClick={resetForm} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default KnowledgeBase;
