import React from "react";
import StatsCard from "./Statscard";

export interface ReportSummaryItem {
  label: string;
  value: string | number;
  tone?: "blue" | "cyan" | "green" | "yellow" | "purple" | "red";
  icon?: React.ReactNode;
}

const toneClasses = {
  blue: ["from-blue-50 to-indigo-50", "border-blue-100", "text-blue-600"],
  cyan: ["from-cyan-50 to-blue-50", "border-cyan-100", "text-cyan-600"],
  green: ["from-green-50 to-emerald-50", "border-green-100", "text-green-600"],
  yellow: ["from-yellow-50 to-orange-50", "border-yellow-100", "text-yellow-600"],
  purple: ["from-purple-50 to-indigo-50", "border-purple-100", "text-purple-600"],
  red: ["from-red-50 to-rose-50", "border-red-100", "text-red-600"],
} as const;

const ReportSummaryGrid: React.FC<{ items: ReportSummaryItem[] }> = ({ items }) => (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {items.map(({ label, value, tone = "blue", icon }) => {
      const [gradient, borderColor, labelColor] = toneClasses[tone];
      return (
        <StatsCard
          key={label}
          label={label}
          value={value}
          gradient={gradient}
          borderColor={borderColor}
          labelColor={labelColor}
          icon={icon}
        />
      );
    })}
  </div>
);

export default ReportSummaryGrid;
