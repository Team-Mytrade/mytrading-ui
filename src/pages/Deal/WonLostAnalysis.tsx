import React, { useMemo } from 'react';

interface Opportunity {
  id: number;
  title: string;
  stage: 'Closed Won' | 'Closed Lost' | string;
  amount: number;
  closedDate: string; // YYYY-MM-DD
}

const opportunities: Opportunity[] = [
  { id: 1, title: 'CRM Deal', stage: 'Closed Won', amount: 10000, closedDate: '2025-08-01' },
  { id: 2, title: 'Website Project', stage: 'Closed Lost', amount: 15000, closedDate: '2025-08-02' },
  { id: 3, title: 'Mobile App', stage: 'Closed Won', amount: 12000, closedDate: '2025-07-25' },
  { id: 4, title: 'Legacy System', stage: 'Closed Lost', amount: 18000, closedDate: '2025-07-30' },
  { id: 5, title: 'API Integration', stage: 'Closed Won', amount: 20000, closedDate: '2025-08-04' },
];

const WonLostAnalysis: React.FC = () => {
  const wonDeals = useMemo(() => opportunities.filter((o) => o.stage === 'Closed Won'), []);
  const lostDeals = useMemo(() => opportunities.filter((o) => o.stage === 'Closed Lost'), []);

  const totalWon = useMemo(() => wonDeals.reduce((sum, o) => sum + o.amount, 0), [wonDeals]);
  const totalLost = useMemo(() => lostDeals.reduce((sum, o) => sum + o.amount, 0), [lostDeals]);
  const winRate = useMemo(() => {
    const total = wonDeals.length + lostDeals.length;
    return total > 0 ? ((wonDeals.length / total) * 100).toFixed(1) : '0';
  }, [wonDeals, lostDeals]);

  return (
    <div className="max-w-5xl mx-auto mt-10 p-6 bg-white dark:bg-boxdark border border-stroke dark:border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Won / Lost Analysis</h2>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-100 dark:bg-meta-4 p-4 rounded shadow">
          <h4 className="text-sm text-gray-500">Deals Won</h4>
          <p className="text-xl font-bold text-green-600">${totalWon.toLocaleString()}</p>
          <p className="text-sm">{wonDeals.length} deals</p>
        </div>
        <div className="bg-gray-100 dark:bg-meta-4 p-4 rounded shadow">
          <h4 className="text-sm text-gray-500">Deals Lost</h4>
          <p className="text-xl font-bold text-red-600">${totalLost.toLocaleString()}</p>
          <p className="text-sm">{lostDeals.length} deals</p>
        </div>
        <div className="bg-gray-100 dark:bg-meta-4 p-4 rounded shadow">
          <h4 className="text-sm text-gray-500">Win Rate</h4>
          <p className="text-2xl font-semibold text-primary">{winRate}%</p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Stage</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Closed Date</th>
            </tr>
          </thead>
          <tbody>
            {opportunities.map((o) => (
              <tr key={o.id} className="border-t">
                <td className="px-4 py-2">{o.title}</td>
                <td className={`px-4 py-2 font-medium ${o.stage === 'Closed Won' ? 'text-green-600' : 'text-red-600'}`}>
                  {o.stage}
                </td>
                <td className="px-4 py-2">${o.amount.toLocaleString()}</td>
                <td className="px-4 py-2">{o.closedDate}</td>
              </tr>
            ))}
            {opportunities.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-gray-500 py-4">
                  No opportunities yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WonLostAnalysis;
