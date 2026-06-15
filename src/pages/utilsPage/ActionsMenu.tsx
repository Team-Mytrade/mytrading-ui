import React, { useState } from "react";

interface ActionsMenuProps {
  userRole?: string; // optional, for role-based visibility
  onEdit?: () => void;
  onDelete?: () => void;
  onView?: () => void;
  onAssign?: () => void;
}

export const ActionsMenu: React.FC<ActionsMenuProps> = ({
  onEdit,
  onDelete,
  onView,
  onAssign,
}) => {
  const [open, setOpen] = useState(false);

  const toggleMenu = () => setOpen((prev) => !prev);

  return (
    <div className="relative inline-block text-left">
      {/* Kebab / three dots button */}
      <button
        onClick={toggleMenu}
        className="p-1 rounded hover:bg-gray-200"
        title="More actions"
      >
        ⋮
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-32 bg-white border rounded shadow-lg z-10"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="flex flex-col">
            {onView && (
              <button
                onClick={() => {
                  onView();
                  setOpen(false);
                }}
                className="text-left px-4 py-2 hover:bg-gray-100"
              >
                View
              </button>
            )}
            {onEdit && (
              <button
                onClick={() => {
                  onEdit();
                  setOpen(false);
                }}
                className="text-left px-4 py-2 hover:bg-gray-100"
              >
                Edit
              </button>
            )}
            {onAssign && (
              <button
                onClick={() => {
                  onAssign();
                  setOpen(false);
                }}
                className="text-left px-4 py-2 hover:bg-gray-100"
              >
                Assign
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => {
                  onDelete();
                  setOpen(false);
                }}
                className="text-left px-4 py-2 text-red-600 hover:bg-gray-100"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
