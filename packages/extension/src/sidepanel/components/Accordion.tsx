import React, { useState } from 'react';

interface AccordionItem {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
}

export function Accordion({ items }: AccordionProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div className="accordion">
      {items.map((item) => (
        <div key={item.id} className={`accordion-item ${openId === item.id ? 'open' : ''}`}>
          <button className="accordion-header" onClick={() => toggle(item.id)}>
            {item.title}
            <span className="accordion-icon">{openId === item.id ? '−' : '+'}</span>
          </button>
          <div className="accordion-content" style={{ maxHeight: openId === item.id ? '200px' : '0' }}>
            <div className="accordion-content-inner">
              {item.content}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

