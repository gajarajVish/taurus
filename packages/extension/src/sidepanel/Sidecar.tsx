import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { MetricsCard } from './components/MetricsCard';
import { PositionsCard } from './components/PositionsCard';
import { SlideMenu } from './components/SlideMenu';
import { Tabs } from './components/Tabs';
import { InsightsTab } from './components/InsightsTab';
import { PortfolioTab } from './components/PortfolioTab';
import { SellModal } from './components/SellModal';
import { TrendingMarketsTab, type BuySelection } from './components/TrendingMarketsTab';
import { BuyModal } from './components/BuyModal';
import { getWalletState, type WalletState } from '../lib/wallet';
import { api } from '../lib/api';
import type { Position, PortfolioPosition } from '@taurus/types';

export interface DisplayPosition {
    id: string;
    marketId: string;
    outcomeId: string;
    outcomeName: string;
    marketQuestion: string;
    side: 'yes' | 'no';
    size: string;
    shares: string;
    avgPrice: number;
    currentPrice: number;
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
        marketId: p.marketId,
        outcomeId: p.outcomeId,
        outcomeName: p.outcomeName,
        marketQuestion: p.marketQuestion,
        side: p.outcomeName.toLowerCase() === 'yes' ? 'yes' : 'no',
        size: `$${(parseFloat(p.shares) * p.avgPrice).toFixed(2)}`,
        shares: p.shares,
        avgPrice: p.avgPrice,
        currentPrice: p.currentPrice,
        pnlPercent: p.pnlPercent,
    };
}

function deriveMetrics(positions: Position[]): Metrics {
    const pnl = positions.reduce((sum, p) => sum + p.pnl, 0);
    const volume = positions.reduce((sum, p) => sum + parseFloat(p.shares) * p.avgPrice, 0);
    // Streak: consecutive positions with positive PnL
    let streak = 0;
    for (const p of positions) {
        if (p.pnl > 0) streak++;
        else break;
    }
    return { pnl, volume: Math.round(volume), streak };
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
    const [pnlHistory, setPnlHistory] = useState<number[]>([]);
    const [sellPosition, setSellPosition] = useState<DisplayPosition | null>(null);
    const [buySelection, setBuySelection] = useState<BuySelection | null>(null);
    const initialLoadDone = useRef(false);

    useEffect(() => {
        getWalletState().then(setWalletState);
        // Load locally saved trades + PnL history
        chrome.storage.local.get(['localPositions', 'pnlHistory'], (res) => {
            setLocalPositions((res.localPositions as Position[]) ?? []);
            setPnlHistory((res.pnlHistory as number[]) ?? []);
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

    // Refresh real positions from the backend
    const refreshPositions = useCallback(async (showLoading = false) => {
        if (!walletState.connected || !walletState.address) return;

        if (showLoading) {
            setPositionsLoading(true);
            setPositionsError(null);
        }
        try {
            const fetchedPositions = await api.positions.list(walletState.address);
            setRawPositions(fetchedPositions);
            setPositions(fetchedPositions.map(mapPosition));
            const newMetrics = deriveMetrics(fetchedPositions);
            setMetrics(newMetrics);

            // Append PnL to history for sparkline
            setPnlHistory((prev) => {
                const updated = [...prev, newMetrics.pnl].slice(-20);
                chrome.storage.local.set({ pnlHistory: updated });
                return updated;
            });
        } catch (err) {
            console.warn('[Taurus] Failed to fetch positions:', err);
            if (showLoading) {
                setPositionsError((err as Error).message ?? 'Failed to load positions');
            }
        } finally {
            if (showLoading) setPositionsLoading(false);
        }
    }, [walletState.address, walletState.connected]);

    // Refresh local position prices from the CLOB midpoint API (per token)
    const refreshLocalPositions = useCallback(async (positionsToRefresh?: Position[]) => {
        const source = positionsToRefresh ?? localPositions;
        if (source.length === 0) return;

        // Fetch midpoint for each unique token (outcomeId)
        const tokenIds = [...new Set(source.map((p) => p.outcomeId))];
        const tokenPrices = new Map<string, number>();

        await Promise.all(
            tokenIds.map(async (tokenId) => {
                try {
                    const data = await api.markets.midpoint(tokenId);
                    const mid = parseFloat(data.mid);
                    if (!isNaN(mid)) {
                        tokenPrices.set(tokenId, mid);
                    }
                } catch (err) {
                    console.warn('[Taurus] Failed to fetch midpoint for token', tokenId, err);
                }
            })
        );

        if (tokenPrices.size === 0) return;

        // Read-modify-write to avoid race conditions with new trades
        chrome.storage.local.get(['localPositions'], (res) => {
            const current: Position[] = res.localPositions ?? [];
            const updated = current.map((pos) => {
                const currentPrice = tokenPrices.get(pos.outcomeId);
                if (currentPrice === undefined) return pos;

                const shares = parseFloat(pos.shares);
                const pnl = (currentPrice - pos.avgPrice) * shares;
                const pnlPercent = pos.avgPrice > 0
                    ? ((currentPrice - pos.avgPrice) / pos.avgPrice) * 100
                    : 0;

                return { ...pos, currentPrice, pnl, pnlPercent };
            });

            chrome.storage.local.set({ localPositions: updated });
        });
    }, [localPositions]);

    // Initial fetch on wallet connect
    useEffect(() => {
        if (!walletState.connected || !walletState.address) {
            setPositions([]);
            setMetrics({ pnl: 0, volume: 0, streak: 0 });
            initialLoadDone.current = false;
            return;
        }
        initialLoadDone.current = false;
        refreshPositions(true).then(() => { initialLoadDone.current = true; });
    }, [walletState.address, refreshPositions]);

    // Refresh local position prices immediately when they change (new trade placed)
    useEffect(() => {
        if (localPositions.length === 0) return;
        refreshLocalPositions(localPositions);
    }, [localPositions.length]); // eslint-disable-line react-hooks/exhaustive-deps

    // Poll every 15s when dashboard is active
    useEffect(() => {
        if (activeTab !== 'dashboard') return;
        // Poll even without wallet for local positions
        if (!walletState.connected && localPositions.length === 0) return;

        const interval = setInterval(() => {
            if (walletState.connected) refreshPositions(false);
            refreshLocalPositions();
        }, 15_000);

        return () => clearInterval(interval);
    }, [walletState.connected, activeTab, localPositions.length, refreshPositions, refreshLocalPositions]);

    // Recompute metrics including local positions
    const allRawPositions = [...localPositions, ...rawPositions];
    const combinedMetrics: Metrics = {
        pnl: allRawPositions.reduce((sum, p) => sum + p.pnl, 0),
        volume: Math.round(allRawPositions.reduce((sum, p) => sum + parseFloat(p.shares) * p.avgPrice, 0)),
        streak: (() => { let s = 0; for (const p of allRawPositions) { if (p.pnl > 0) s++; else break; } return s; })(),
    };

    const allPositionsForPortfolio = toPortfolioPositions(allRawPositions);

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
                            pnl={combinedMetrics.pnl}
                            volume={combinedMetrics.volume}
                            streak={combinedMetrics.streak}
                            sparklineData={pnlHistory}
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
                            <PositionsCard
                                positions={[...localPositions.map(mapPosition), ...positions]}
                                onExitPosition={(pos) => setSellPosition(pos)}
                            />
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
                        <PortfolioTab
                            positions={allPositionsForPortfolio}
                            displayPositions={[...localPositions.map(mapPosition), ...positions]}
                            onExitPosition={(pos) => {
                                setActiveTab('dashboard');
                                setSellPosition(pos);
                            }}
                        />
                    </div>
                )}

                {activeTab === 'markets' && (
                    <div className="animate-fade-in">
                        <TrendingMarketsTab onBuy={setBuySelection} />
                    </div>
                )}
            </div>

            <SlideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

            {buySelection && walletState.address && (
                <BuyModal
                    market={buySelection.market}
                    side={buySelection.side}
                    walletAddress={walletState.address}
                    onClose={() => setBuySelection(null)}
                    onSuccess={() => setBuySelection(null)}
                />
            )}

            {sellPosition && walletState.address && (
                <SellModal
                    position={sellPosition}
                    walletAddress={walletState.address}
                    onClose={() => setSellPosition(null)}
                    onSuccess={() => {
                        setSellPosition(null);
                        refreshPositions(false);
                    }}
                />
            )}
        </div>
    );
}
