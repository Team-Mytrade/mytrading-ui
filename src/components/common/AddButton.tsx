import { forwardRef, type ButtonHTMLAttributes } from "react";
import { PlusIcon } from "@heroicons/react/24/solid";
import { PermissionAction, usePermissions } from "../../access/usePermissions";

/**
 * The one colour for every "Add / New / Create" button in the app (#4DD0E1). Dark text, because white on
 * this light cyan is unreadable (contrast ~1.8:1). The darker border and soft shadow keep the button standing
 * out on the pale cyan page background. Pages with their own add buttons use this too.
 */
export const ADD_BUTTON_COLORS =
  "border border-[#26C6DA] bg-[#4DD0E1] text-[#083344] shadow-[0_1px_3px_rgba(0,151,167,0.35)] " +
  "hover:border-[#00ACC1] hover:bg-[#26C6DA] hover:shadow-[0_2px_6px_rgba(0,151,167,0.4)] focus-visible:ring-[#4DD0E1] " +
  "dark:bg-[#4DD0E1] dark:text-[#083344] dark:hover:bg-[#26C6DA]";

type AddButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
  // Permission (in the page's module) the button needs; hidden without it. null shows it to everyone.
  permission?: PermissionAction | null;
};

export const AddButton = forwardRef<HTMLButtonElement, AddButtonProps>(
  ({ label = "Add", className = "", type = "button", permission = "CREATE", ...props }, ref) => {
    const { can } = usePermissions();
    if (permission && !can(permission)) return null;
    return (
      <button
        ref={ref}
        type={type}
        className={[
          "inline-flex h-7 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-colors",
          ADD_BUTTON_COLORS,
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        ].join(" ")}
        {...props}
      >
        <PlusIcon className="h-4 w-4" aria-hidden="true" />
        <span>{label}</span>
      </button>
    );
  }
);

AddButton.displayName = "AddButton";
