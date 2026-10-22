import { forwardRef, type ButtonHTMLAttributes } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

type BackButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
  fallbackPath?: string;
};

export const BackButton = forwardRef<HTMLButtonElement, BackButtonProps>(
  ({ label = "Back", fallbackPath = "/", className = "", type = "button", onClick, ...props }, ref) => {
    const navigate = useNavigate();

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;

      // If there's no previous page in this app (e.g. opened from a link), go to fallback
      if (window.history.state?.idx > 0) {
        navigate(-1);
      } else {
        navigate(fallbackPath, { replace: true });
      }
    };

    return (
      <button
        ref={ref}
        type={type}
        onClick={handleClick}
        className={[
          "inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-blue-600 bg-[rgba(240,240,240,0.1)] px-4 py-2 font-medium text-blue-600 transition-colors",
          "hover:bg-blue-100",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        ].join(" ")}
        {...props}
      >
        <ArrowLeftIcon className="h-5 w-5" aria-hidden="true" />
        <span>{label}</span>
      </button>
    );
  }
);

BackButton.displayName = "BackButton";