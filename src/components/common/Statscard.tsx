import React from "react";
import {
  BanknotesIcon,
  BuildingOffice2Icon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

interface StatsCardProps {
  label: string;
  value: string | number;
  gradient?: string;
  borderColor?: string;
  labelColor?: string;
  icon?: React.ReactNode;
  collapsed?: boolean;
}

const getTone = (classes: string) => {
  const tone = classes.toLowerCase();

  if (tone.includes("green") || tone.includes("emerald")) {
    return {
      badge: "bg-green-100",
      iconColor: "text-green-600",
      Icon: CheckCircleIcon,
    };
  }

  if (tone.includes("yellow") || tone.includes("amber") || tone.includes("orange")) {
    return {
      badge: "bg-yellow-100",
      iconColor: "text-yellow-600",
      Icon: ClockIcon,
    };
  }

  if (tone.includes("red") || tone.includes("rose") || tone.includes("pink")) {
    return {
      badge: "bg-red-100",
      iconColor: "text-red-600",
      Icon: XCircleIcon,
    };
  }

  if (tone.includes("purple") || tone.includes("indigo")) {
    return {
      badge: "bg-purple-100",
      iconColor: "text-purple-600",
      Icon: BuildingOffice2Icon,
    };
  }

  if (tone.includes("cyan") || tone.includes("blue")) {
    return {
      badge: "bg-cyan-100",
      iconColor: "text-cyan-600",
      Icon: DocumentTextIcon,
    };
  }

  return {
    badge: "bg-gray-100",
    iconColor: "text-gray-600",
    Icon: BanknotesIcon,
  };
};

/* Original Implementation (Commented out):
const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  gradient = "from-gray-50 to-gray-100",
  borderColor = "border-gray-200",
  labelColor = "text-gray-600",
  icon,
  collapsed = false,
}) => {
  const tone = getTone(`${gradient} ${borderColor} ${labelColor}`);
  const FallbackIcon = tone.Icon;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-md">
      <div
        className={`transition-all duration-300 ease-in-out ${
          collapsed ? "max-h-0 opacity-0 py-0" : "max-h-48 opacity-100"
        }`}
      >
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="text-sm text-gray-600">{label}</p>
            <p className={`mt-1 text-2xl font-semibold leading-none ${labelColor}`}>{value}</p>
          </div>

          <div className={`flex shrink-0 rounded-full p-3 ${tone.badge}`}>
            {icon ? (
              <div className={tone.iconColor}>{icon}</div>
            ) : (
              <FallbackIcon className={`h-6 w-6 ${tone.iconColor}`} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
*/

const StatsCard: React.FC<StatsCardProps> = ({
  label,
  value,
  gradient = "from-gray-50 to-gray-100",
  borderColor = "border-gray-200",
  labelColor = "text-gray-600",
  icon,
  collapsed = false,
}) => {
  const tone = getTone(`${gradient} ${borderColor} ${labelColor}`);
  const FallbackIcon = tone.Icon;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md dark:border-gray-800 dark:bg-white/[0.03]">
      <div
        className={`transition-all duration-300 ease-in-out ${
          collapsed ? "max-h-0 opacity-0 py-0" : "max-h-48 opacity-100"
        }`}
      >
        {/* Extra compact, single line horizontal layout */}
        <div className="flex items-center justify-between gap-3 p-2.5 px-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Icon container - reduced padding and size */}
            <div className={`flex shrink-0 rounded-lg p-2 ${tone.badge}`}>
              {icon ? (
                <div className={`h-5 w-5 flex items-center justify-center [&>svg]:h-5 [&>svg]:w-5 ${tone.iconColor}`}>{icon}</div>
              ) : (
                <FallbackIcon className={`h-5 w-5 ${tone.iconColor}`} />
              )}
            </div>

            {/* Label - compact text size */}
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
              {label}
            </p>
          </div>

          {/* Value - compact text size */}
          <p className={`text-xl font-bold leading-none shrink-0 ${labelColor}`}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;


