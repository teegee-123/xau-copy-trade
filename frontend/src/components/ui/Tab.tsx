import React from 'react';

interface TabProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}

export function Tab({ active, onClick, children, count }: TabProps) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors relative ${
        active
          ? 'bg-primary-600 text-white'
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      {children}
      {count !== undefined && count > 0 && (
        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
          active ? 'bg-white/20' : 'bg-slate-700'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

export default Tab;
