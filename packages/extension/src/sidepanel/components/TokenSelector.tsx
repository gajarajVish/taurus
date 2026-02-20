import React, { useState, useRef, useEffect } from 'react';
import type { SwapToken } from '@taurus/types';

interface TokenSelectorProps {
  label: string;
  token: SwapToken;
  tokens: SwapToken[];
  onChange: (token: SwapToken) => void;
  disabled?: boolean;
}

export function TokenSelector({ label, token, tokens, onChange, disabled }: TokenSelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="sw-token-field" ref={ref}>
      <span className="sw-token-label">{label}</span>
      <button
        className="sw-token-pill"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
      >
        <span className="sw-token-symbol">{token.symbol}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="sw-token-dropdown">
          {tokens
            .filter((t) => t.address !== token.address)
            .map((t) => (
              <button
                key={t.address}
                className="sw-token-option"
                onClick={() => { onChange(t); setOpen(false); }}
              >
                <span className="sw-token-symbol">{t.symbol}</span>
                <span className="sw-token-name">{t.name}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
