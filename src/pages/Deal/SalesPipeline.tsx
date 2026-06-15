import React, { useState } from 'react';

interface Opportunity {
  id: number;
  title: string;
  account: string;
  amount: number;
  stage: string;
}

const STAGES = ['Prospecting', 'Qualified', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

const SalesPipeline: React.FC = () => {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([
    { id: 1, title: 'Website Redesign', account: 'Acme Corp', amount: 12000, stage: 'Prospecting' },
    { id: 2, title: 'CRM Integration', account: 'Globex Inc', amount: 25000, stage: 'Qualified' },
    { id: 3, title: 'API Support', account: 'Soylent Ltd', amount: 18000, stage: 'Proposal' },
  ]);

  const [formData, setFormData] = useState<Omit<Opportunity, 'id'>>({
    title: '',
    account: '',
    amount: 0,
    stage: 'Prospecting',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddOpportunity = (e: React.FormEvent) => {
    e.preventDefault();
    const newOpportunity: Opportunity = {
      id: Date.now(),
      ...formData,
      amount: Number(formData.amount),
    };
    setOpportunities([newOpportunity, ...opportunities]);
    setFormData({ title: '', account: '', amount: 0, stage: 'Prospecting' });
  };

  const groupByStage = (stage: string) => {
    return opportunities.filter((op) => op.stage === stage);
  };

  return (
    <div className="max-w-full mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Sales Pipeline</h2>

      {/* Add Opportunity Form */}
      <form onSubmit={handleAddOpportunity} className="mb-8 grid grid-cols-1 md:grid-cols-5 gap-4">
        <input
          type="text"
          name="title"
          placeholder="Title"
          value={formData.title}
          onChange={handleInputChange}
          className="input input-bordered w-full"
          required
        />
        <input
          type="text"
          name="account"
          placeholder="Account"
          value={formData.account}
          onChange={handleInputChange}
          className="input input-bordered w-full"
          required
        />
        <input
          type="number"
          name="amount"
          placeholder="Amount"
          value={formData.amount}
          onChange={handleInputChange}
          className="input input-bordered w-full"
          required
        />
        <select
          name="stage"
          value={formData.stage}
          onChange={handleInputChange}
          className="input input-bordered w-full"
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="bg-primary text-white px-4 py-2 rounded hover:bg-primary-dark"
        >
          Add Deal
        </button>
      </form>

      {/* Kanban-style Pipeline */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {STAGES.map((stage) => (
          <div
            key={stage}
            className="bg-white dark:bg-boxdark border border-gray-200 dark:border-stroke rounded shadow-sm p-3 flex flex-col max-h-[70vh] overflow-y-auto"
          >
            <h3 className="text-lg font-semibold mb-3 text-gray-700 dark:text-white">{stage}</h3>
            {groupByStage(stage).map((deal) => (
              <div
                key={deal.id}
                className="bg-gray-100 dark:bg-meta-4 p-3 rounded mb-3 shadow-sm text-sm"
              >
                <div className="font-medium text-gray-800 dark:text-white">{deal.title}</div>
                <div className="text-gray-500">{deal.account}</div>
                <div className="text-gray-600 font-semibold">${deal.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SalesPipeline;
