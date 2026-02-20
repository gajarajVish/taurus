import React, { useState, useEffect } from 'react';

interface SlideMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
}

export function SlideMenu({ isOpen, onClose, onNavigate }: SlideMenuProps) {
  const [overlayEnabled, setOverlayEnabled] = useState(true);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(['overlayEnabled', 'debugMode'], (res) => {
      if (res.overlayEnabled !== undefined) setOverlayEnabled(res.overlayEnabled);
      if (res.debugMode !== undefined) setDebugMode(res.debugMode);
    });
  }, []);

  const handleToggleOverlay = () => {
    const next = !overlayEnabled;
    setOverlayEnabled(next);
    chrome.storage.local.set({ overlayEnabled: next });
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_OVERLAY', enabled: next });
      }
    });
  };

  const handleToggleDebug = () => {
    const next = !debugMode;
    setDebugMode(next);
    chrome.storage.local.set({ debugMode: next });
  };

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      iconBg: '#0a84ff',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      ),
    },
    {
      id: 'insights',
      label: 'Insights',
      iconBg: '#bf5af2',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
      ),
    },
    {
      id: 'risk',
      label: 'Risk',
      iconBg: '#ff9f0a',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    },
    {
      id: 'markets',
      label: 'Markets',
      iconBg: '#30d158',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      ),
    },
    {
      id: 'swap',
      label: 'Swap',
      iconBg: '#ff6b9d',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
          <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 014-4h14" />
          <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 01-4 4H3" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <div className={`overlay ${isOpen ? 'visible' : ''}`} onClick={onClose} />
      <div className={`slide-menu ${isOpen ? 'open' : ''}`}>
        <div className="menu-header">
          <div className="menu-title">Settings</div>
          <button className="close-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="menu-items">
          <div className="menu-section">
            <div className="menu-section-title">Navigation</div>
            <div className="menu-group">
              {navItems.map((item) => (
                <div
                  key={item.id}
                  className="menu-item"
                  onClick={() => { onNavigate(item.id); onClose(); }}
                >
                  <div className="menu-item-icon" style={{ background: item.iconBg }}>
                    {item.icon}
                  </div>
                  <span className="menu-item-label">{item.label}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              ))}
            </div>
          </div>

          <div className="menu-section">
            <div className="menu-section-title">Preferences</div>
            <div className="menu-group">
              <div className="menu-item">
                <div className="menu-item-icon" style={{ background: '#5e5ce6' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <span className="menu-item-label">Overlay on X</span>
                <button
                  className={`ios-toggle ${overlayEnabled ? 'ios-toggle--on' : ''}`}
                  onClick={(e) => { e.stopPropagation(); handleToggleOverlay(); }}
                >
                  <span className="ios-toggle-thumb" />
                </button>
              </div>
              <div className="menu-item">
                <div className="menu-item-icon" style={{ background: '#ff453a' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4z" />
                  </svg>
                </div>
                <span className="menu-item-label">Debug Mode</span>
                <button
                  className={`ios-toggle ${debugMode ? 'ios-toggle--on' : ''}`}
                  onClick={(e) => { e.stopPropagation(); handleToggleDebug(); }}
                >
                  <span className="ios-toggle-thumb" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
