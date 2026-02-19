import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { MetricsCard } from './components/MetricsCard';
import { PositionsCard } from './components/PositionsCard';
import { SlideMenu } from './components/SlideMenu';
import { Tabs } from './components/Tabs';
import { getWalletState, type WalletState } from '../lib/wallet';

export function Sidecar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [walletState, setWalletState] = useState<WalletState>({ connected: false, address: null, chainId: null });
    const [activeTab, setActiveTab] = useState('dashboard');

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

    // Mock data
    const mockMetrics = {
        pnl: 127.50,
        volume: 2450,
        streak: 7,
    };

    const mockPositions = [
        {
            id: '1',
            marketQuestion: 'Will Bitcoin hit $100k in 2024?',
            side: 'yes' as const,
            size: '$50.00',
            pnlPercent: 12.5,
        },
        {
            id: '2',
            marketQuestion: 'Fed interest rate cut in March?',
            side: 'no' as const,
            size: '$25.00',
            pnlPercent: -5.2,
        },
        {
            id: '3',
            marketQuestion: 'Taylor Swift album release date?',
            side: 'yes' as const,
            size: '$100.00',
            pnlPercent: 3.1,
        }
    ];

    const tabs = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'activity', label: 'Activity' },
        { id: 'markets', label: 'Markets' },
    ];

    const handleConnectWallet = () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab?.id) return;
            chrome.runtime.sendMessage({ type: 'CONNECT_WALLET', tabId: tab.id }, (response) => {
                if (!response?.success) {
                    console.warn('[PolyOverlay] Wallet connect failed:', response?.error);
                }
            });
        });
    };

    const handleDisconnectWallet = () => {
        chrome.runtime.sendMessage({ type: 'DISCONNECT_WALLET' });
    };

    return (
        <div className="sidecar-container">
            <Header
                isWalletConnected={walletState.connected}
                address={walletState.address}
                onConnectWallet={handleConnectWallet}
                onDisconnectWallet={handleDisconnectWallet}
                onMenuToggle={() => setIsMenuOpen(true)}
            />
            
            <Tabs 
                tabs={tabs} 
                activeTab={activeTab} 
                onChange={setActiveTab} 
            />

            <div className="sidecar-content">
                {activeTab === 'dashboard' && (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <MetricsCard
                            pnl={mockMetrics.pnl}
                            volume={mockMetrics.volume}
                            streak={mockMetrics.streak}
                        />
                        <PositionsCard positions={mockPositions} />
                    </div>
                )}

                {activeTab === 'activity' && (
                    <div className="animate-fade-in">
                        <div style={{ padding: '20px', textAlign: 'center', color: '#71767b' }}>
                            No recent activity
                        </div>
                    </div>
                )}

                {activeTab === 'markets' && (
                    <div className="animate-fade-in">
                        <div style={{ padding: '20px', textAlign: 'center', color: '#71767b' }}>
                            Trending markets will appear here
                        </div>
                    </div>
                )}
            </div>

            <SlideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
        </div>
    );
}
