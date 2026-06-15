interface ComponentCardProps {
  title: string;
  children: React.ReactNode;
  className?: string; // Additional custom classes for styling
  desc?: string; // Description text
}

// Original Implementation (Commented out as requested):
// const ComponentCard: React.FC<ComponentCardProps> = ({
//   title,
//   children,
//   className = "",
//   desc = "",
// }) => {
//   return (
//     <div
//       className={`rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] ${className}`}
//     >
//       {/* Card Header */}
//       <div className="px-6 py-5">
//         <h3 className="text-base font-medium text-gray-800 dark:text-white/90">
//           {title}
//         </h3>
//         {desc && (
//           <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
//             {desc}
//           </p>
//         )}
//       </div>
// 
//       {/* Card Body */}
//       <div className="p-4 border-t border-gray-100 dark:border-gray-800 sm:p-6">
//         <div className="space-y-6">{children}</div>
//       </div>
//     </div>
//   );
// };

// New Premium Layout with sleek typography, modern shadow-hover transitions, and interactive design
const ComponentCard: React.FC<ComponentCardProps> = ({
  title,
  children,
  className = "",
  desc = "",
}) => {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_12px_30px_-6px_rgba(0,0,0,0.08)] dark:border-gray-800 dark:bg-white/[0.03] dark:shadow-none ${className}`}
    >
      {/* Subtle top indicator/accent line */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500 opacity-80" />

      {/* Card Header */}
      <div className="px-6 py-5 border-b border-gray-100/80 dark:border-gray-800/60">
        <h3 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white/90">
          {title}
        </h3>
        {desc && (
          <p className="mt-1.5 text-sm font-normal text-gray-500 dark:text-gray-400 leading-relaxed">
            {desc}
          </p>
        )}
      </div>

      {/* Card Body */}
      <div className="p-6 sm:p-7">
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
};

export default ComponentCard;

