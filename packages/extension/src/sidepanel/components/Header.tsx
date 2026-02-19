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
        <div className="user-avatar">
          {userAvatar ? <img src={userAvatar} alt="User" /> : 'U'}
        </div>
        {isWalletConnected && address && (
          <button
            onClick={onDisconnectWallet}
            title="Click to disconnect"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '13px',
              fontWeight: 600,
              color: '#22c55e',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '6px',
            }}
          >
            {shortAddress(address)}
          </button>
        )}
      </div>
      <div className="header-right">
        {!isWalletConnected && (
          <button className="connect-wallet-btn" onClick={onConnectWallet}>
            Connect
          </button>
        )}
        <button className="hamburger-btn" onClick={onMenuToggle}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  );
}
