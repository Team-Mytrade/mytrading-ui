'use client';

import { useState, ReactNode } from 'react';

export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
};

interface TabsProps {
  tabs: TabItem[];
  defaultActiveId?: string;
  onChange?: (tabId: string) => void;
  className?: string;
  tabClassName?: string;
  activeTabClassName?: string;
  contentClassName?: string;
}

export default function Tabs({
  tabs,
  defaultActiveId,
  onChange,
  className = '',
  tabClassName = '',
  activeTabClassName = '',
  contentClassName = ''
}: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultActiveId || tabs[0]?.id);

  const handleTabClick = (tabId: string, disabled?: boolean) => {
    if (disabled) return;
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeContent = tabs.find(tab => tab.id === activeTab)?.content;

  return (
    <div className={`w-full ${className}`}>
      {/* Tab Headers */}
      <div className="border-b border-gray-200">
        <ul className="flex flex-wrap -mb-px">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isDisabled = tab.disabled;

            return (
              <li key={tab.id} className="mr-2">
                <button
                  onClick={() => handleTabClick(tab.id, tab.disabled)}
                  disabled={isDisabled}
                  className={`
                    inline-block py-2 px-4 border-b-2 rounded-t-lg text-sm font-medium transition-colors
                    ${isDisabled 
                      ? 'text-gray-400 cursor-not-allowed border-transparent' 
                      : isActive
                        ? `text-blue-600 border-blue-600 ${activeTabClassName}`
                        : `text-gray-500 hover:text-gray-700 hover:border-gray-300 border-transparent ${tabClassName}`
                    }
                  `}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {tab.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Tab Content */}
      <div className={`p-4 ${contentClassName}`}>
        {activeContent}
      </div>
    </div>
  );
}




// if we wanna use this component in any other pages 1st import the component and alla the component like below 

{/* <Tabs
  tabs={[
    {
      id: 'communication-history',
      label: 'Communication History',
      content: null // This tab is already the main content, so you can leave it null or empty
    },
    {
      id: 'another-tab',
      label: 'Another Tab',
      content: <div>Content for another tab would go here</div>
    },
    // Add more tabs as needed
  ]}
  defaultActiveId="communication-history"
/> */}

// if you wanna add tabs 
// {
//       id: 'another-tab',
//       label: 'Another Tab',
//       content: <div>Content for another tab would go here</div>
//     },

// give the below code inside the page 