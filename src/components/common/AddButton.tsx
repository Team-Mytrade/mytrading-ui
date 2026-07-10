import { PlusIcon } from "@heroicons/react/24/solid";

export const AddButton: React.FC<{
  onClick?: () => void;
  label?: string;
  className?: string;
}> = ({ onClick, label = "Add", className = "" }) => {
  return (
    <button
      onClick={onClick}
      className={`${className} my-[3px] flex h-9 items-center gap-2 rounded-lg bg-cyan-600 px-4 py-1.5 font-medium !text-white transition-colors hover:bg-cyan-700 whitespace-nowrap`}
    >
      <PlusIcon className="w-5 h-5 text-white" />
      <span className="text-white">{label}</span>
    </button>
  );
};
