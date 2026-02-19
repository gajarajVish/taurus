import React, { useState, useEffect } from 'react';
import { getAISettings, setAISettings } from '../../lib/storage';

interface SlideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SlideMenu({ isOpen, onClose }: SlideMenuProps) {
  const [aiEnabled, setAiEnabled] = useState(true);
  const [minTweetCount, setMinTweetCount] = useState(3);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getAISettings().then((settings) => {
        setAiEnabled(settings.enabled);
        setMinTweetCount(settings.minTweetCount);
      });
    }
  }, [isOpen]);

  const handleAiToggle = async () => {
    const newValue = !aiEnabled;
    setAiEnabled(newValue);
    await setAISettings({ enabled: newValue });
  };

  const handleTweetCountChange = async (value: number) => {
    setMinTweetCount(value);
    await setAISettings({ minTweetCount: value });
  };

  const menuItems = ['Dashboard', 'Markets', 'History'];

  return (
    <>
      <div className={`overlay ${isOpen ? 'visible' : ''}`} onClick={onClose} />
      <div className={`slide-menu ${isOpen ? 'open' : ''}`}>
        <div className="menu-header">
          <div className="menu-title">Menu</div>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="menu-items">
          {menuItems.map((item) => (
            <div key={item} className="menu-item" onClick={() => console.log('Menu item clicked:', item)}>
              {item}
            </div>
          ))}
          <div
            className="menu-item"
            onClick={() => setShowSettings(!showSettings)}
          >
            Settings {showSettings ? '▼' : '▸'}
          </div>

          {showSettings && (
            <div className="settings-panel">
              <div className="settings-section">
                <div className="settings-section-title">AI Insights</div>

                <div className="setting-row">
                  <span className="setting-label">Enable AI Insights</span>
                  <button
                    className={`toggle-btn ${aiEnabled ? 'active' : ''}`}
                    onClick={handleAiToggle}
                  >
                    <span className="toggle-slider" />
                  </button>
                </div>

                {aiEnabled && (
                  <div className="setting-row">
                    <span className="setting-label">Min tweets before analysis</span>
                    <div className="setting-stepper">
                      <button
                        className="stepper-btn"
                        onClick={() => handleTweetCountChange(Math.max(1, minTweetCount - 1))}
                        disabled={minTweetCount <= 1}
                      >
                        −
                      </button>
                      <span className="stepper-value">{minTweetCount}</span>
                      <button
                        className="stepper-btn"
                        onClick={() => handleTweetCountChange(Math.min(10, minTweetCount + 1))}
                        disabled={minTweetCount >= 10}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
