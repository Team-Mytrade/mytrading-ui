import React from "react";
import KeyMetrics from "./KeyMetrics";
import RecentInteractions from "./RecentInteractions";

const DashboardOverview: React.FC = () => {
  const upcomingActivities = [
    { id: 1, type: "Meeting", title: "Product demo with Acme", date: "2025-08-10", time: "10:00 AM" },
    { id: 2, type: "Call", title: "Follow-up with John", date: "2025-08-11", time: "2:00 PM" },
    { id: 3, type: "Task", title: "Prepare Q3 Report", date: "2025-08-12", time: "—" },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-3xl font-bold">📋 CRM Dashboard</h1>
        <p className="text-gray-500">Overview of your CRM performance and recent activity</p>
      </div>

      {/* Metrics Section */}
      <KeyMetrics />

      {/* Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Interactions */}
        <RecentInteractions />

        {/* Upcoming Activities */}
        <div className="bg-white shadow rounded p-6">
          <h2 className="text-xl font-bold mb-4">📅 Upcoming Activities</h2>
          <ul className="divide-y">
            {upcomingActivities.map((a) => (
              <li key={a.id} className="py-3">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">{a.title}</p>
                    <p className="text-sm text-gray-500">{a.type} on {a.date} at {a.time}</p>
                  </div>
                  <span className="text-sm text-gray-400">{a.date}</span>
                </div>
              </li>
            ))}
            {upcomingActivities.length === 0 && (
              <p className="text-gray-400 text-sm">No upcoming activities.</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
