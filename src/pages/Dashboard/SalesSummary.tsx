import React, { useEffect, useState } from 'react';
// -------------------------
// Types
// -------------------------
type DealStatus = 'Won' | 'Lost' | 'Open';

interface Deal {
  id: number;
  value: number;
  status: DealStatus;
}

interface Summary {
  totalDeals: number;
  totalRevenue: number;
  wonDeals: number;
  lostDeals: number;
  openDeals: number;
  averageDealSize: number;
  winRate: number;
}

// -------------------------
// Component
// -------------------------
const SalesSummary: React.FC = () => {
  const [summary, setSummary] = useState<Summary>({
    totalDeals: 0,
    totalRevenue: 0,
    wonDeals: 0,
    lostDeals: 0,
    openDeals: 0,
    averageDealSize: 0,
    winRate: 0,
  });




// useEffect(() => {
//   const fetchSummary = async () => {
//     try {
//       const res = await axios.get<Summary>('/api/sales/summary');
//       setSummary(res.data);
//     } catch (error) {
//       console.error('Failed to fetch sales summary', error);
//     }
//   };

//   fetchSummary();
// }, []);


  useEffect(() => {
    // Simulated API data
    const mockDeals: Deal[] = [
      { id: 1, value: 10000, status: 'Won' },
      { id: 2, value: 8000, status: 'Lost' },
      { id: 3, value: 12000, status: 'Open' },
      { id: 4, value: 9000, status: 'Won' },
    ];

    const totalDeals = mockDeals.length;
    const won = mockDeals.filter((d) => d.status === 'Won');
    const lost = mockDeals.filter((d) => d.status === 'Lost');
    const open = mockDeals.filter((d) => d.status === 'Open');

    const totalRevenue = won.reduce((sum, d) => sum + d.value, 0);
    const averageDealSize = won.length > 0 ? totalRevenue / won.length : 0;
    const winRate = totalDeals > 0 ? (won.length / totalDeals) * 100 : 0;

    setSummary({
      totalDeals,
      totalRevenue,
      wonDeals: won.length,
      lostDeals: lost.length,
      openDeals: open.length,
      averageDealSize,
      winRate,
    });
  }, []);
 return (
    <div className="rounded-lg border border-stroke bg-white px-6 py-5 shadow-sm dark:border-gray-700 dark:bg-boxdark">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Sales Summary
      </h2>
      <ul className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
        <li className="flex justify-between">
          <span>Total Deals:</span>
          <span>{summary.totalDeals}</span>
        </li>
        <li className="flex justify-between">
          <span>Total Revenue:</span>
          <span>${summary.totalRevenue.toLocaleString()}</span>
        </li>
        <li className="flex justify-between">
          <span>Won Deals:</span>
          <span>{summary.wonDeals}</span>
        </li>
        <li className="flex justify-between">
          <span>Lost Deals:</span>
          <span>{summary.lostDeals}</span>
        </li>
        <li className="flex justify-between">
          <span>Open Deals:</span>
          <span>{summary.openDeals}</span>
        </li>
        <li className="flex justify-between">
          <span>Avg Deal Size:</span>
          <span>${summary.averageDealSize.toFixed(2)}</span>
        </li>
        <li className="flex justify-between">
          <span>Win Rate:</span>
          <span>{summary.winRate.toFixed(1)}%</span>
        </li>
      </ul>
    </div>
  );
};

export default SalesSummary;