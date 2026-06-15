import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

export const BackButton: React.FC = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(-1)}
          className=" flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-600 text-blue-600 bg-[rgba(240,240,240,0.1)] hover:bg-blue-100 font-medium transition-colors"

    >
      <ArrowLeftIcon className="w-5 h-5" />
      Back
    </button>
  );
};
