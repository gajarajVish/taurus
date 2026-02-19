import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { MetricsCard } from './components/MetricsCard';
import { PositionsCard } from './components/PositionsCard';
import { SlideMenu } from './components/SlideMenu';
import { Tabs } from './components/Tabs';
import { getWalletState, type WalletState } from '../lib/wallet';
import { api } from '../lib/api';
import type { Position } from '@taurus/types';

interface DisplayPosition {
    id: string;
    marketQuestion: string;
    side: 'yes' | 'no';
    size: string;
    pnlPercent: number;
}

interface Metrics {
    pnl: number;
    volume: number;
    streak: number;
}

function mapPosition(p: Position): DisplayPosition {
    return {
        id: p.id,
        marketQuestion: p.marketQuestion,
        side: p.outcomeName.toLowerCase() === 'yes' ? 'yes' : 'no',
        size: `$${(parseFloat(p.shares) * p.avgPrice).toFixed(2)}`,
        pnlPercent: p.pnlPercent,
    };
}

function deriveMetrics(positions: Position[]): Metrics {
    const pnl = positions.reduce((sum, p) => sum + p.pnl, 0);
    const volume = positions.reduce((sum, p) => sum + parseFloat(p.shares) * p.avgPrice, 0);
    return { pnl, volume: Math.round(volume), streak: 0 };
}

export function Sidecar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [walletState, setWalletState] = useState<WalletState>({ connected: false, address: null, chainId: null });
    const [activeTab, setActiveTab] = useState('dashboard');
    const [positions, setPositions] = useState<DisplayPosition[]>([]);
    const [metrics, setMetrics] = useState<Metrics>({ pnl: 0, volume: 0, streak: 0 });
    const [positionsLoading, setPositionsLoading] = useState(false);
    const [positionsError, setPositionsError] = useState<string | null>(null);
    const [localPositions, setLocalPositions] = useState<Position[]>([]);

    useEffect(() => {
        getWalletState().then(setWalletState);
        // Load locally saved trades
        chrome.storage.local.get(['localPositions'], (res) => {
            setLocalPositions((res.localPositions as Position[]) ?? []);
        });

        const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
            if (area === 'local' && changes.walletState) {
                setWalletState(changes.walletState.newValue ?? { connected: false, address: null, chainId: null });
            }
            if (area === 'local' && changes.localPositions) {
                setLocalPositions((changes.localPositions.newValue as Position[]) ?? []);
            }
        };
        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, []);

    // Fetch real positions whenever wallet address changes
    useEffect(() => {
        if (!walletState.connected || !walletState.address) {
            setPositions([]);
            setMetrics({ pnl: 0, volume: 0, streak: 0 });
            return;
        }

        setPositionsLoading(true);
        setPositionsError(null);
        api.positions.list(walletState.address)
            .then((rawPositions) => {
                setPositions(rawPositions.map(mapPosition));
                setMetrics(deriveMetrics(rawPositions));
            })
            .catch((err) => {
                console.warn('[Taurus] Failed to fetch positions:', err);
                setPositionsError((err as Error).message ?? 'Failed to load positions');
            })
            .finally(() => setPositionsLoading(false));
    }, [walletState.address]);

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
                    console.warn('[Taurus] Wallet connect failed:', response?.error);
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
                            pnl={metrics.pnl}
                            volume={metrics.volume}
                            streak={metrics.streak}
                        />
                        {positionsLoading ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#71767b' }}>
                                Loading positions...
                            </div>
                        ) : positionsError ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: '#f4212e', fontSize: '12px' }}>
                                {positionsError}
                            </div>
                        ) : (
                            <PositionsCard positions={[...localPositions.map(mapPosition), ...positions]} />
                        )}
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
