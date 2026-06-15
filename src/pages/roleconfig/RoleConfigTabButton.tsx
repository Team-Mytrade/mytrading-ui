import React from "react";
import { PAGE_ICONS, PAGE_LABELS, PageType } from "./RoleConfigTabConfig";

type TabButtonProps = {
  page: PageType;
  activePage: PageType;
  onChange: (page: PageType) => void;
};

const RoleConfigTabButton: React.FC<TabButtonProps> = ({ page, activePage, onChange }) => {
  const label = PAGE_LABELS[page];
  const icon = PAGE_ICONS[page];

  return (
    <button
      onClick={() => onChange(page)}
      className={`pb-4 px-1 inline-flex items-center gap-2 border-b-2 font-medium text-sm transition-colors ${
        activePage === page
          ? "border-cyan-500 text-cyan-600"
          : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
      }`}
    >
      {icon}
      {label}
    </button>
  );
};

export default RoleConfigTabButton;
