import { XMarkIcon } from "@heroicons/react/24/outline";

type CloseButtonProps = {
  onClick: () => void;
  /** Read by screen readers, e.g. "Close details". */
  label?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Shared look for small icon buttons in drawer / popup headers (✕, Edit…).
 * Use it on any header icon so they all hover the same way, in light and dark mode.
 */
export const ICON_BUTTON_CLASS = [
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400",
  "hover:bg-indigo-50 hover:text-indigo-600 dark:text-gray-500 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-300",
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

/**
 * The one close (✕) button used everywhere: drawers, popups, dialogs.
 * Same hover as the Edit icon in the details drawer: a soft blue square and a blue icon.
 * No animation. Inside the drawers, the drawer's own header style applies (so ✕ and Edit match exactly).
 */
export default function CloseButton({ onClick, label = "Close", disabled, className = "" }: CloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title="Close"
      className={`${ICON_BUTTON_CLASS} ${className}`}
    >
      <XMarkIcon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
