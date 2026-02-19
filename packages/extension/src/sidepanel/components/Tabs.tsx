import React, { useRef, useEffect, useState } from 'react';

interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLButtonElement>(`[data-tab="${activeTab}"]`);
    if (active) {
      setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
    }
  }, [activeTab]);

  return (
    <div className="tabs-bar" ref={containerRef}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          data-tab={tab.id}
          className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
      <div className="tab-ink" style={{ left: indicator.left, width: indicator.width }} />
    </div>
  );
}
