import React, { useState } from 'react';
import { shortAddress } from '../../lib/wallet';

const LOGO_URL = chrome.runtime.getURL('taurus_logo_inverted.png');

interface HeaderProps {
  isWalletConnected: boolean;
  address?: string | null;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  onMenuOpen: () => void;
  isLowLiquidity?: boolean;
  onOpenSwap?: () => void;
}

export function Header({ isWalletConnected, address, onConnectWallet, onDisconnectWallet, onMenuOpen, isLowLiquidity, onOpenSwap }: HeaderProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div className="sidecar-header" style={{ flexDirection: 'column', alignItems: 'stretch', padding: 0 }}>
      <div className="header-row">
        <div className="header-left">
          <div className="sidecar-logo">
            <img src={LOGO_URL} alt="Taurus" />
          </div>
          <span className="header-brand">Taurus</span>
        </div>
        <div className="header-right">
          {onOpenSwap && (
            <button className="header-menu-btn" onClick={onOpenSwap} aria-label="Swap ETH to USDC">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" />
                <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
              </svg>
            </button>
          )}
          <button className="header-menu-btn" onClick={onMenuOpen} aria-label="Settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
          </button>
          {isWalletConnected && address ? (
            <button
              type="button"
              className="wallet-pill wallet-pill--connected"
              onClick={onDisconnectWallet}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
            >
              <span className="wallet-pill-dot" />
              {hovered ? 'Disconnect' : shortAddress(address)}
            </button>
          ) : (
            <button className="wallet-pill wallet-pill--disconnected" onClick={onConnectWallet}>
              Connect
            </button>
          )}
        </div>
      </div>
      {isLowLiquidity && (
        <div className="header-liquidity-alert">
          ⚠ Low USDC balance — fund your wallet to trade
          <button className="header-liquidity-cta" onClick={onOpenSwap}>Fund</button>
        </div>
      )}
    </div>
  );
}
