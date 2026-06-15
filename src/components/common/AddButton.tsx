import { PlusIcon } from "@heroicons/react/24/solid";

export const AddButton: React.FC<{
  onClick?: () => void;
  label?: string;
  className?: string;
}> = ({ onClick, label = "Add", className = "" }) => {
  return (
    <button
      onClick={onClick}
      className={`${className} flex items-center gap-2 px-4 py-2 bg-cyan-600 !text-white rounded-lg hover:bg-cyan-700 transition-colors font-medium`}
    >
      <PlusIcon className="w-5 h-5 text-white" />
      <span className="text-white">{label}</span>
    </button>
  );
};