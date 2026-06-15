import React, { useState, useMemo } from 'react';

interface Campaign {
  id: number;
  name: string;
  type: 'Email' | 'SMS' | 'Other';
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  date: string; // ISO date string
}

const sampleCampaigns: Campaign[] = [
  {
    id: 1,
    name: 'Summer Sale Email',
    type: 'Email',
    sent: 1500,
    opened: 800,
    clicked: 300,
    bounced: 50,
    unsubscribed: 10,
    date: '2025-07-10',
  },
  {
    id: 2,
    name: 'Welcome SMS Blast',
    type: 'SMS',
    sent: 2000,
    opened: 1900,
    clicked: 0,
    bounced: 30,
    unsubscribed: 0,
    date: '2025-07-05',
  },
  // Add more sample campaigns
];

const PAGE_SIZE = 5;

const CampaignReports: React.FC = () => {
  const [campaigns] = useState<Campaign[]>(sampleCampaigns);
  const [filterType, setFilterType] = useState<string>('All');
  const [sortField, setSortField] = useState<keyof Campaign>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);

  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns;
    if (filterType !== 'All') {
      filtered = filtered.filter((c) => c.type === filterType);
    }
    filtered = [...filtered].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (sortField === 'date') {
        aVal = new Date(aVal as string).getTime();
        bVal = new Date(bVal as string).getTime();
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return filtered;
  }, [campaigns, filterType, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredCampaigns.length / PAGE_SIZE);
  const pageCampaigns = filteredCampaigns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (field: keyof Campaign) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white dark:bg-boxdark border border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Campaign Reports</h2>

      {/* Filter */}
      <div className="mb-4 flex items-center gap-4">
        <label className="font-semibold">Filter by Type:</label>
        <select
          className="input input-bordered w-40"
          value={filterType}
          onChange={(e) => {
            setFilterType(e.target.value);
            setPage(1);
          }}
        >
          <option value="All">All</option>
          <option value="Email">Email</option>
          <option value="SMS">SMS</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4">
            <tr>
              <th
                onClick={() => toggleSort('name')}
                className="px-4 py-2 text-left cursor-pointer select-none"
              >
                Campaign Name {sortField === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                onClick={() => toggleSort('type')}
                className="px-4 py-2 text-left cursor-pointer select-none"
              >
                Type {sortField === 'type' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                onClick={() => toggleSort('sent')}
                className="px-4 py-2 text-right cursor-pointer select-none"
              >
                Sent {sortField === 'sent' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                onClick={() => toggleSort('opened')}
                className="px-4 py-2 text-right cursor-pointer select-none"
              >
                Opened {sortField === 'opened' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                onClick={() => toggleSort('clicked')}
                className="px-4 py-2 text-right cursor-pointer select-none"
              >
                Clicked {sortField === 'clicked' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                onClick={() => toggleSort('bounced')}
                className="px-4 py-2 text-right cursor-pointer select-none"
              >
                Bounced {sortField === 'bounced' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                onClick={() => toggleSort('unsubscribed')}
                className="px-4 py-2 text-right cursor-pointer select-none"
              >
                Unsubscribed {sortField === 'unsubscribed' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th
                onClick={() => toggleSort('date')}
                className="px-4 py-2 text-left cursor-pointer select-none"
              >
                Date {sortField === 'date' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {pageCampaigns.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-4 text-gray-500">
                  No campaigns found.
                </td>
              </tr>
            ) : (
              pageCampaigns.map((c) => (
                <tr key={c.id} className="border-t hover:bg-gray-50 dark:hover:bg-meta-3 cursor-pointer">
                  <td className="px-4 py-2">{c.name}</td>
                  <td className="px-4 py-2">{c.type}</td>
                  <td className="px-4 py-2 text-right">{c.sent.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{c.opened.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{c.clicked.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{c.bounced.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right">{c.unsubscribed.toLocaleString()}</td>
                  <td className="px-4 py-2">{new Date(c.date).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex justify-between items-center">
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
    </div>
  );
};

export default CampaignReports;
