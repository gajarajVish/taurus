import React from 'react';
import { shortAddress } from '../../lib/wallet';

interface HeaderProps {
  userAvatar?: string;
  isWalletConnected: boolean;
  address?: string | null;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  onMenuToggle: () => void;
}

export function Header({ userAvatar, isWalletConnected, address, onConnectWallet, onDisconnectWallet, onMenuToggle }: HeaderProps) {
  return (
    <div className="sidecar-header">
      <div className="header-left">
        <div className="header-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="var(--color-brand)" opacity="0.9"/>
            <path d="M2 17l10 5 10-5" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" fill="none"/>
            <path d="M2 12l10 5 10-5" stroke="var(--color-brand)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.5"/>
          </svg>
          <span className="header-brand">Taurus</span>
        </div>
      </div>
      <div className="header-right">
        {isWalletConnected && address ? (
          <button className="header-wallet connected" onClick={onDisconnectWallet} title="Click to disconnect">
            <span className="header-wallet-dot" />
            {shortAddress(address)}
          </button>
        ) : (
          <button className="header-wallet connect" onClick={onConnectWallet}>Connect</button>
        )}
        <button className="header-menu" onClick={onMenuToggle} aria-label="Menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
