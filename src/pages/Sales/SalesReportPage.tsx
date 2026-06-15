import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import PageMeta from '../../components/common/PageMeta';
import PageBreadcrumb from '../../components/common/PageBreadCrumb';
import { BackButton } from '../../components/common/BackButton';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface ReportData {
  salesPerson: string;
  totalSales: number;
  dealsWon: number;
  dealsLost: number;
}

const mockData: ReportData[] = [
  { salesPerson: 'Alice', totalSales: 45000, dealsWon: 10, dealsLost: 2 },
  { salesPerson: 'Bob', totalSales: 32000, dealsWon: 8, dealsLost: 4 },
  { salesPerson: 'Charlie', totalSales: 27000, dealsWon: 7, dealsLost: 3 },
];

const SalesReportPage: React.FC = () => {
  const [filter, setFilter] = useState('Monthly');

  const chartData = {
    labels: mockData.map((d) => d.salesPerson),
    datasets: [
      {
        label: 'Total Sales ($)',
        data: mockData.map((d) => d.totalSales),
        backgroundColor: '#3b82f6',
      },
    ],
  };

  return (
    <>
      <PageMeta title="Sales Reports" description="View sales performance reports" />
      <PageBreadcrumb pageTitle="Sales Reports" />
    <div className="max-w-6xl mx-auto mt-6 px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <BackButton />
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sales Reports</h2>
          <p className="text-sm text-gray-500 mt-1">View and analyze sales performance</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="input input-bordered"
        >
          <option value="Monthly">This Month</option>
          <option value="Quarterly">This Quarter</option>
          <option value="Yearly">This Year</option>
        </select>
        {/* Add additional filters like sales person or region */}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-blue-100 dark:bg-meta-4 rounded">
          <p className="text-sm">Total Sales</p>
          <h3 className="text-xl font-bold">
            ${mockData.reduce((sum, d) => sum + d.totalSales, 0).toLocaleString()}
          </h3>
        </div>
        <div className="p-4 bg-green-100 dark:bg-meta-4 rounded">
          <p className="text-sm">Deals Won</p>
          <h3 className="text-xl font-bold">
            {mockData.reduce((sum, d) => sum + d.dealsWon, 0)}
          </h3>
        </div>
        <div className="p-4 bg-red-100 dark:bg-meta-4 rounded">
          <p className="text-sm">Deals Lost</p>
          <h3 className="text-xl font-bold">
            {mockData.reduce((sum, d) => sum + d.dealsLost, 0)}
          </h3>
        </div>
      </div>

      {/* Sales by Person Chart */}
      <div className="bg-gray-50 dark:bg-meta-4 p-4 rounded shadow">
        <h4 className="font-semibold mb-2">Sales by Salesperson</h4>
        <Bar data={chartData} options={{ responsive: true }} />
      </div>
    </div>
    </>
  );
};

export default SalesReportPage;
