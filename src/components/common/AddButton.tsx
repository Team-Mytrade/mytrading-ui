import { forwardRef, type ButtonHTMLAttributes } from "react";
import { PlusIcon } from "@heroicons/react/24/solid";

type AddButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
};

export const AddButton = forwardRef<HTMLButtonElement, AddButtonProps>(
  ({ label = "Add", className = "", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={[
        "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-cyan-600 px-4 py-1.5 font-medium text-white transition-colors",
        "hover:bg-cyan-700",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      ].join(" ")}
      {...props}
    >
      <PlusIcon className="h-5 w-5" aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
);

AddButton.displayName = "AddButton";