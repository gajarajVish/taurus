import React from 'react';
import { shortAddress } from '../../lib/wallet';

const LOGO_URL = chrome.runtime.getURL('taurus_logo_inverted.png');

interface HeaderProps {
  isWalletConnected: boolean;
  address?: string | null;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
}

export function Header({ isWalletConnected, address, onConnectWallet, onDisconnectWallet }: HeaderProps) {
  return (
    <div className="sidecar-header">
      <div className="header-left">
        <div className="sidecar-logo">
          <img src={LOGO_URL} alt="Taurus" />
        </div>
        {isWalletConnected && address && (
          <span className="header-address">{shortAddress(address)}</span>
        )}
      </div>
      <div className="header-right">
        {isWalletConnected ? (
          <button type="button" className="disconnect-wallet-btn" onClick={onDisconnectWallet}>
            Disconnect
          </button>
        ) : (
          <button className="connect-wallet-btn" onClick={onConnectWallet}>
            Connect
          </button>
        )}
      </div>
    </div>
  );
}
