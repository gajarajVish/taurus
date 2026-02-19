import React, { useState, useEffect } from 'react';
import { getWalletState, shortAddress, type WalletState } from '../lib/wallet';

export function Popup() {
  const [isConnected, setIsConnected] = useState(false);
  const [isOnXPage, setIsOnXPage] = useState(false);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
      if (response?.type === 'PONG') {
        setIsConnected(true);
      }
    });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.url?.includes('x.com') || tab?.url?.includes('twitter.com')) {
        setIsOnXPage(true);
        setActiveTabId(tab.id ?? null);
      }
    });
  }, []);

  const handleOpenSidecar = () => {
    if (activeTabId) {
      (chrome.sidePanel as any).open({ tabId: activeTabId });
      // Close popup so both are not open; small delay so side panel open is processed first
      setTimeout(() => window.close(), 0);
    }
  };

  const logoUrl = chrome.runtime.getURL('taurus_logo_inverted.png');

  return (
    <div className="popup-container">
      <header className="popup-header">
        <div className="popup-header-brand">
          <img src={logoUrl} alt="Taurus" className="popup-logo" />
          <h1>Taurus</h1>
        </div>
        <div className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </header>

      {isOnXPage && (
        <div className="sidecar-toggle-section">
          <button className="sidecar-toggle-btn" onClick={handleOpenSidecar}>
            Open Sidecar
          </button>
        </div>
      )}

      <main className="popup-content">
        <WalletCard isOnXPage={isOnXPage} activeTabId={activeTabId} />
        <MarketsCard />
        <PositionsCard />
        <SettingsCard />
      </main>

      <footer className="popup-footer">
        <span>Powered by Polymarket</span>
      </footer>
    </div>
  );
}

function WalletCard({ isOnXPage, activeTabId }: { isOnXPage: boolean; activeTabId: number | null }) {
  const [walletState, setWalletState] = useState<WalletState>({ connected: false, address: null, chainId: null });
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getWalletState().then(setWalletState);

    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.walletState) {
        setWalletState(changes.walletState.newValue ?? { connected: false, address: null, chainId: null });
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const handleConnect = () => {
    if (!activeTabId) return;
    setConnecting(true);
    setError(null);
    chrome.runtime.sendMessage({ type: 'CONNECT_WALLET', tabId: activeTabId }, (response) => {
      setConnecting(false);
      if (!response?.success) {
        setError(response?.error ?? 'Connection failed');
      }
    });
  };

  const handleDisconnect = () => {
    chrome.runtime.sendMessage({ type: 'DISCONNECT_WALLET' }, () => {
      setWalletState({ connected: false, address: null, chainId: null });
    });
  };

  return (
    <div className="section-card">
      <div className="section-header">
        <span>💰</span>
        <span>Wallet Status</span>
      </div>
      {walletState.connected && walletState.address ? (
        <>
          <p className="placeholder-text" style={{ color: '#22c55e' }}>
            {shortAddress(walletState.address)}
          </p>
          <button className="connect-wallet-btn" onClick={handleDisconnect}>
            Disconnect
          </button>
        </>
      ) : (
        <>
          <p className="placeholder-text">
            {isOnXPage ? 'Connect your wallet to start trading.' : 'Navigate to X.com to connect.'}
          </p>
          {error && <p style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px' }}>{error}</p>}
          <button
            className="connect-wallet-btn"
            onClick={handleConnect}
            disabled={!isOnXPage || connecting}
          >
            {connecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </>
      )}
    </div>
  );
}

function MarketsCard() {
  return (
    <div className="section-card">
      <div className="section-header">
        <span>📊</span>
        <span>Trending Markets</span>
      </div>
      <p className="placeholder-text">
        Market data will appear here once connected to the backend.
      </p>
      <div className="market-list">
        <MarketCard
          title="Sample Market"
          probability={65}
          volume="$1.2M"
        />
        <MarketCard
          title="Another Market"
          probability={42}
          volume="$850K"
        />
      </div>
    </div>
  );
}

function MarketCard({ title, probability, volume }: { title: string; probability: number; volume: string }) {
  return (
    <div className="market-card">
      <div className="market-title">{title}</div>
      <div className="market-stats">
        <span className="probability">{probability}% Yes</span>
        <span className="volume">{volume}</span>
      </div>
      <div className="probability-bar">
        <div className="probability-fill" style={{ width: `${probability}%` }} />
      </div>
    </div>
  );
}

function PositionsCard() {
  return (
    <div className="section-card">
      <div className="section-header">
        <span>📈</span>
        <span>Your Positions</span>
      </div>
      <p className="placeholder-text">
        Connect your wallet to view positions.
      </p>
    </div>
  );
}

function SettingsCard() {
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(['overlayEnabled', 'debugMode'], (result) => {
      setOverlayEnabled(result.overlayEnabled !== false);
      setDebugMode(result.debugMode === true);
    });
  }, []);

  const handleOverlayToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked;
    setOverlayEnabled(value);
    chrome.storage.local.set({ overlayEnabled: value });
  };

  const handleDebugToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked;
    setDebugMode(value);
    chrome.storage.local.set({ debugMode: value });
    // Reload page to apply debug mode
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  };

  return (
    <div className="section-card">
      <div className="section-header">
        <span>⚙️</span>
        <span>Settings</span>
      </div>
      <div className="setting-item">
        <label>
          <input
            type="checkbox"
            checked={overlayEnabled}
            onChange={handleOverlayToggle}
          />
          Enable tweet overlays
        </label>
      </div>
      <div className="setting-item">
        <label>
          <input
            type="checkbox"
            checked={debugMode}
            onChange={handleDebugToggle}
          />
          Enable debug logging
        </label>
      </div>
      <div className="setting-item">
        <label>API Endpoint</label>
        <input
          type="text"
          placeholder="http://localhost:3000"
          className="setting-input"
        />
      </div>
    </div>
  );
}
