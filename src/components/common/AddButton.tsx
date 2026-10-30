import { forwardRef, type ButtonHTMLAttributes } from "react";
import { PlusIcon } from "@heroicons/react/24/solid";
import { PermissionAction, usePermissions } from "../../access/usePermissions";
import { t } from "../../i18n/i18n";

/**
 * The one colour for every "Add / New / Create" button in the app (#4DD0E1). Dark text, because white on
 * this light cyan is unreadable (contrast ~1.8:1). The darker border and soft shadow keep the button standing
 * out on the pale cyan page background. Pages with their own add buttons use this too.
 */
export const ADD_BUTTON_COLORS =
  "border border-[rgb(var(--brand-400,38_198_218))] bg-[rgb(var(--brand-300,77_208_225))] text-[rgb(var(--brand-950,8_51_68))] shadow-[0_1px_3px_rgb(var(--brand-600,0_151_167)/0.35)] " +
  "hover:border-[rgb(var(--brand-600,0_172_193))] hover:bg-[rgb(var(--brand-400,38_198_218))] hover:shadow-[0_2px_6px_rgb(var(--brand-600,0_151_167)/0.4)] focus-visible:ring-[rgb(var(--brand-300,77_208_225))] " +
  "dark:bg-[rgb(var(--brand-300,77_208_225))] dark:text-[rgb(var(--brand-950,8_51_68))] dark:hover:bg-[rgb(var(--brand-400,38_198_218))]";

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
        <span>{t(label)}</span>
      </button>
    );
  }
);

AddButton.displayName = "AddButton";
