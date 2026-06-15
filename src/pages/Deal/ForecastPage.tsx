import React, { useMemo } from 'react';

interface Opportunity {
  id: number;
  title: string;
  stage: string;
  amount: number;
  expectedClose: string; // YYYY-MM-DD
}

const FORECAST_STAGES = ['Qualified', 'Proposal', 'Negotiation', 'Closed Won'];

const opportunities: Opportunity[] = [
  { id: 1, title: 'CRM Deal', stage: 'Qualified', amount: 8000, expectedClose: '2025-08-15' },
  { id: 2, title: 'Website Project', stage: 'Proposal', amount: 12000, expectedClose: '2025-09-10' },
  { id: 3, title: 'Mobile App', stage: 'Negotiation', amount: 15000, expectedClose: '2025-08-25' },
  { id: 4, title: 'API Support', stage: 'Closed Won', amount: 10000, expectedClose: '2025-07-30' },
  { id: 5, title: 'Lost Project', stage: 'Closed Lost', amount: 20000, expectedClose: '2025-08-05' },
];

const ForecastPage: React.FC = () => {

  const forecastByMonth = useMemo(() => {
    const result: { [key: string]: number } = {};

    opportunities.forEach((opp) => {
      if (!FORECAST_STAGES.includes(opp.stage)) return;

      const closeDate = new Date(opp.expectedClose);
      const key = `${closeDate.getFullYear()}-${(closeDate.getMonth() + 1)
        .toString()
        .padStart(2, '0')}`;
      result[key] = (result[key] || 0) + opp.amount;
    });

    return result;
  }, []);

  const totalForecast = useMemo(() => {
    return opportunities
      .filter((opp) => FORECAST_STAGES.includes(opp.stage))
      .reduce((sum, opp) => sum + opp.amount, 0);
  }, []);

  const closedWonTotal = useMemo(() => {
    return opportunities
      .filter((opp) => opp.stage === 'Closed Won')
      .reduce((sum, opp) => sum + opp.amount, 0);
  }, []);

  return (
    <div className="max-w-5xl mx-auto mt-10 p-6 bg-white dark:bg-boxdark border border-stroke dark:border-stroke rounded shadow">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Forecast</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-100 dark:bg-meta-4 p-4 rounded shadow">
          <h4 className="text-sm text-gray-500">Forecasted Revenue</h4>
          <p className="text-xl font-semibold text-gray-800 dark:text-white">${totalForecast.toLocaleString()}</p>
        </div>
        <div className="bg-gray-100 dark:bg-meta-4 p-4 rounded shadow">
          <h4 className="text-sm text-gray-500">Closed Won</h4>
          <p className="text-xl font-semibold text-green-600">${closedWonTotal.toLocaleString()}</p>
        </div>
        <div className="bg-gray-100 dark:bg-meta-4 p-4 rounded shadow">
          <h4 className="text-sm text-gray-500">Gap</h4>
          <p className="text-xl font-semibold text-red-600">${(totalForecast - closedWonTotal).toLocaleString()}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead className="bg-gray-100 dark:bg-meta-4">
            <tr>
              <th className="px-4 py-2">Month</th>
              <th className="px-4 py-2">Forecasted Amount</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(forecastByMonth).map(([month, amount]) => (
              <tr key={month} className="border-t">
                <td className="px-4 py-2">{month}</td>
                <td className="px-4 py-2">${amount.toLocaleString()}</td>
              </tr>
            ))}
            {Object.keys(forecastByMonth).length === 0 && (
              <tr>
                <td colSpan={2} className="text-center text-gray-500 py-4">
                  No forecast data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ForecastPage;
