import React from "react";
import KeyMetrics from "./KeyMetrics";
import RecentInteractions from "./RecentInteractions";

type Activity = {
  id: number;
  type: string;
  title: string;
  date: string;
  time: string;
};

interface DashboardOverviewProps {
  upcomingActivities?: Activity[];
}

const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  upcomingActivities = [],
}) => {
  return (
    <div className="p-6 space-y-6">
      {/* Heading */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          <span aria-hidden="true">📋</span> CRM Dashboard
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          Overview of your CRM performance and recent activity
        </p>
      </div>

      {/* Metrics Section */}
      <KeyMetrics />

      {/* Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Interactions */}
        <RecentInteractions />

        {/* Upcoming Activities */}
        <div className="bg-white dark:bg-gray-900 shadow rounded p-6">
          <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            <span aria-hidden="true">📅</span> Upcoming Activities
          </h2>
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {upcomingActivities.map((a) => (
              <li key={a.id} className="py-3">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {a.title}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {a.type} on {a.date} at {a.time}
                    </p>
                  </div>
                  <span className="text-sm text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {a.time}
                  </span>
                </div>
              </li>
            ))}
            {upcomingActivities.length === 0 && (
              <li className="py-3 text-gray-400 dark:text-gray-500 text-sm">
                No upcoming activities.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
