import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { MetricsCard } from './components/MetricsCard';
import { PositionsCard } from './components/PositionsCard';
import { SlideMenu } from './components/SlideMenu';
import { Tabs } from './components/Tabs';
import { InsightsTab } from './components/InsightsTab';
import { PortfolioTab } from './components/PortfolioTab';
import { getWalletState, type WalletState } from '../lib/wallet';
import { api } from '../lib/api';
import type { Position, PortfolioPosition } from '@taurus/types';

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

function toPortfolioPositions(positions: Position[]): PortfolioPosition[] {
    return positions.map((p) => ({
        marketQuestion: p.marketQuestion,
        side: p.outcomeName.toLowerCase() === 'yes' ? 'yes' as const : 'no' as const,
        size: parseFloat(p.shares) * p.avgPrice,
        avgPrice: p.avgPrice,
        currentPrice: p.currentPrice,
        pnlPercent: p.pnlPercent,
    }));
}

export function Sidecar() {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [walletState, setWalletState] = useState<WalletState>({ connected: false, address: null, chainId: null });
    const [activeTab, setActiveTab] = useState('dashboard');
    const [positions, setPositions] = useState<DisplayPosition[]>([]);
    const [metrics, setMetrics] = useState<Metrics>({ pnl: 0, volume: 0, streak: 0 });
    const [rawPositions, setRawPositions] = useState<Position[]>([]);
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
            .then((fetchedPositions) => {
                setRawPositions(fetchedPositions);
                setPositions(fetchedPositions.map(mapPosition));
                setMetrics(deriveMetrics(fetchedPositions));
            })
            .catch((err) => {
                console.warn('[Taurus] Failed to fetch positions:', err);
                setPositionsError((err as Error).message ?? 'Failed to load positions');
            })
            .finally(() => setPositionsLoading(false));
    }, [walletState.address]);

    const allPositionsForPortfolio = toPortfolioPositions([...localPositions, ...rawPositions]);

    const tabs = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'insights', label: 'Insights' },
        { id: 'risk', label: 'Risk' },
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
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <MetricsCard
                            pnl={metrics.pnl}
                            volume={metrics.volume}
                            streak={metrics.streak}
                        />
                        {positionsLoading ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '12.5px' }}>
                                Loading positions...
                            </div>
                        ) : positionsError ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-error)', fontSize: '12px' }}>
                                {positionsError}
                            </div>
                        ) : (
                            <PositionsCard positions={[...localPositions.map(mapPosition), ...positions]} />
                        )}
                    </div>
                )}

                {activeTab === 'insights' && (
                    <div className="animate-fade-in">
                        <InsightsTab />
                    </div>
                )}

                {activeTab === 'risk' && (
                    <div className="animate-fade-in">
                        <PortfolioTab positions={allPositionsForPortfolio} />
                    </div>
                )}

                {activeTab === 'markets' && (
                    <div className="animate-fade-in">
                        <div className="it-state">
                            <span className="it-state-title">Trending markets</span>
                            <span className="it-state-text">Top Polymarket markets will appear here as you browse X.</span>
                        </div>
                    </div>
                )}
            </div>

            <SlideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
        </div>
    );
}
