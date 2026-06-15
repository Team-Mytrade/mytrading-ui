import React from "react";

interface Metric {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}

const KeyMetrics: React.FC = () => {
  const metrics: Metric[] = [
    { title: "Total Leads", value: 320, icon: "🧲", color: "bg-blue-100 text-blue-800" },
    { title: "Active Accounts", value: 112, icon: "🧑‍💼", color: "bg-green-100 text-green-800" },
    { title: "Open Opportunities", value: 54, icon: "📂", color: "bg-yellow-100 text-yellow-800" },
    { title: "Closed Won Deals", value: 23, icon: "✅", color: "bg-emerald-100 text-emerald-800" },
    { title: "Total Revenue", value: "$48,000", icon: "💰", color: "bg-indigo-100 text-indigo-800" },
    { title: "Tasks This Week", value: 28, icon: "📆", color: "bg-pink-100 text-pink-800" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
      {metrics.map((metric, index) => (
        <div
          key={index}
          className="flex items-center justify-between p-5 bg-white shadow rounded border hover:shadow-md transition"
        >
          <div>
            <p className="text-sm text-gray-500">{metric.title}</p>
            <h3 className="text-2xl font-semibold">{metric.value}</h3>
          </div>
          <div className={`w-12 h-12 flex items-center justify-center rounded-full ${metric.color} text-xl`}>
            {metric.icon}
          </div>
        </div>
      ))}
    </div>
  );
};

export default KeyMetrics;
