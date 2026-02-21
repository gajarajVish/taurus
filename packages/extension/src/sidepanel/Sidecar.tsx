import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Header } from './components/Header';
import { MetricsCard } from './components/MetricsCard';
import { PositionsCard } from './components/PositionsCard';
import { PortfolioStatsRow } from './components/PortfolioStatsRow';
import { Tabs } from './components/Tabs';
import { InsightsTab } from './components/InsightsTab';
import { SellModal } from './components/SellModal';
import { TrendingMarketsTab, type BuySelection } from './components/TrendingMarketsTab';
import { SwapTab } from './components/SwapTab';
import { BuyModal } from './components/BuyModal';
import { SlideMenu } from './components/SlideMenu';
import { PositionDetailModal } from './components/PositionDetailModal';
import { PortfolioRiskModal } from './components/PortfolioRiskModal';
import { getWalletState, type WalletState } from '../lib/wallet';
import { api } from '../lib/api';
import { getPendingExits, dismissPendingExit, getInstallId } from '../lib/storage';
import type { Position, PortfolioPosition, PendingExit, PortfolioAnalysis } from '@taurus/types';

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
    const [pendingExits, setPendingExits] = useState<PendingExit[]>([]);
    const [menuOpen, setMenuOpen] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<DisplayPosition | null>(null);
    const [swapPanelOpen, setSwapPanelOpen] = useState(false);
    const [usdcBalance, setUsdcBalance] = useState<number | null>(null);
    const [portfolioAnalysis, setPortfolioAnalysis] = useState<PortfolioAnalysis | null>(null);
    const [portfolioAnalysisLoading, setPortfolioAnalysisLoading] = useState(false);
    const [portfolioAnalysisError, setPortfolioAnalysisError] = useState<string | null>(null);
    const [insightsBadge, setInsightsBadge] = useState(0);
    const [portfolioRiskOpen, setPortfolioRiskOpen] = useState(false);
    const initialLoadDone = useRef(false);

    const isLowLiquidity = walletState.connected && usdcBalance !== null && usdcBalance < 5;

    useEffect(() => {
        getWalletState().then(setWalletState);
        chrome.storage.local.get(['localPositions', 'pnlHistory'], (res) => {
            setLocalPositions((res.localPositions as Position[]) ?? []);
            setPnlHistory((res.pnlHistory as number[]) ?? []);
        });

        // Load pending exits
        getPendingExits().then(setPendingExits);

        const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
            if (area === 'local' && changes.walletState) {
                setWalletState(changes.walletState.newValue ?? { connected: false, address: null, chainId: null });
            }
            if (area === 'local' && changes.localPositions) {
                setLocalPositions((changes.localPositions.newValue as Position[]) ?? []);
            }
            if (area === 'local' && changes.pendingExits) {
                setPendingExits((changes.pendingExits.newValue as PendingExit[]) ?? []);
            }
        };
        chrome.storage.onChanged.addListener(listener);

        // Listen for background messages about pending exits
        const msgListener = (message: { type: string; pendingExits?: PendingExit[] }) => {
            if (message.type === 'PENDING_EXITS_UPDATED' && message.pendingExits) {
                setPendingExits(message.pendingExits);
            }
        };
        chrome.runtime.onMessage.addListener(msgListener);

        return () => {
            chrome.storage.onChanged.removeListener(listener);
            chrome.runtime.onMessage.removeListener(msgListener);
        };
    }, []);

    // Fetch USDC balance when wallet connects
    useEffect(() => {
        if (!walletState.connected || !walletState.address) {
            setUsdcBalance(null);
            return;
        }
        chrome.runtime.sendMessage({ type: 'GET_USDC_BALANCE', address: walletState.address }, (response) => {
            if (chrome.runtime.lastError) return;
            if (response?.balance !== undefined) {
                setUsdcBalance(parseFloat(response.balance) || 0);
            }
        });
    }, [walletState.connected, walletState.address]);

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

        // Fetch midpoint for each unique token (outcomeId); skip empty/invalid ids
        const tokenIds = [...new Set(source.map((p) => p.outcomeId).filter(Boolean))];
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
                    const msg = (err as Error)?.message ?? '';
                    if (!msg.includes('502')) {
                        console.warn('[Taurus] Failed to fetch midpoint for token', tokenId, err);
                    }
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

    // Portfolio analysis — lifted from PortfolioTab
    const fetchPortfolioAnalysis = useCallback(async () => {
        const allRaw = [...localPositions, ...rawPositions];
        if (allRaw.length === 0) return;
        setPortfolioAnalysisLoading(true);
        setPortfolioAnalysisError(null);
        try {
            const installId = await getInstallId();
            const { insights } = await api.insights.getAll(installId);
            const portfolioPositions = toPortfolioPositions(allRaw);
            const res = await api.insights.analyzePortfolio({ positions: portfolioPositions, insights });
            setPortfolioAnalysis(res.analysis);
        } catch (err) {
            setPortfolioAnalysisError('Failed to analyze portfolio');
            console.error('[Sidecar] Portfolio analysis error:', err);
        } finally {
            setPortfolioAnalysisLoading(false);
        }
    }, [localPositions, rawPositions]);

    // Auto-trigger portfolio analysis when positions load and analysis is null
    useEffect(() => {
        const allRaw = [...localPositions, ...rawPositions];
        if (allRaw.length > 0 && !portfolioAnalysis && !portfolioAnalysisLoading && !portfolioAnalysisError) {
            fetchPortfolioAnalysis();
        }
    }, [localPositions.length, rawPositions.length]); // eslint-disable-line react-hooks/exhaustive-deps

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

    const allDisplayPositions = useMemo(
        () => [...localPositions.map(mapPosition), ...positions],
        [localPositions, positions]
    );

    const positionMarketIds = useMemo(
        () => new Set([...localPositions, ...rawPositions].map(p => p.marketId)),
        [localPositions, rawPositions]
    );

    const tabs = [
        { id: 'dashboard', label: 'Dashboard' },
        { id: 'insights', label: 'Insights' },
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
        chrome.runtime.sendMessage({ type: 'DISCONNECT_WALLET' }, () => {
            setWalletState({ connected: false, address: null, chainId: null });
        });
    };

    const handleConfirmExit = (exit: PendingExit) => {
        if (!walletState.address) return;

        // Pre-fill the sell modal with position data from the pending exit
        const sellPos: DisplayPosition = {
            id: exit.positionId,
            marketId: exit.marketId,
            outcomeId: exit.tokenId,
            outcomeName: exit.side === 'yes' ? 'Yes' : 'No',
            marketQuestion: exit.marketQuestion,
            side: exit.side,
            size: `$${(parseFloat(exit.shares) * exit.currentPrice).toFixed(2)}`,
            shares: exit.shares,
            avgPrice: exit.currentPrice,
            currentPrice: exit.currentPrice,
            pnlPercent: 0,
        };
        setSellPosition(sellPos);

        // Dismiss from pending exits
        handleDismissExit(exit.positionId);
    };

    const handleInsightBuy = useCallback(async (selection: BuySelection) => {
        setBuySelection(selection);
    }, []);

    const handleDismissExit = async (positionId: string) => {
        await dismissPendingExit(positionId);
        setPendingExits((prev) => prev.filter((e) => e.positionId !== positionId));
        try {
            const installId = await getInstallId();
            await api.automation.dismiss(installId, positionId);
        } catch {
            // Best-effort backend dismissal
        }
    };

    return (
        <div className="sidecar-container">
            <Header
                isWalletConnected={walletState.connected}
                address={walletState.address}
                onConnectWallet={handleConnectWallet}
                onDisconnectWallet={handleDisconnectWallet}
                onMenuOpen={() => setMenuOpen(true)}
                isLowLiquidity={isLowLiquidity}
                onOpenSwap={() => setSwapPanelOpen(true)}
            />

            <Tabs
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
            />

            <div className="sidecar-content">
                {activeTab === 'dashboard' && (
                    <div className="animate-fade-in dashboard-content">
                        <MetricsCard
                            pnl={combinedMetrics.pnl}
                            volume={combinedMetrics.volume}
                            streak={combinedMetrics.streak}
                            sparklineData={pnlHistory}
                        />
                        <PortfolioStatsRow
                            analysis={portfolioAnalysis}
                            loading={portfolioAnalysisLoading}
                            positionCount={allDisplayPositions.length}
                            onRefresh={fetchPortfolioAnalysis}
                            onShowDetails={portfolioAnalysis ? () => setPortfolioRiskOpen(true) : undefined}
                        />
                        {positionsLoading ? (
                            <div className="loading-state">
                                Loading positions...
                            </div>
                        ) : positionsError ? (
                            <div className="error-state">
                                {positionsError}
                            </div>
                        ) : (
                            <PositionsCard
                                positions={allDisplayPositions}
                                onExitPosition={(pos) => setSellPosition(pos)}
                                onSelectPosition={(pos) => setSelectedPosition(pos)}
                            />
                        )}
                    </div>
                )}

                {activeTab === 'insights' && (
                    <div className="animate-fade-in">
                        <InsightsTab
                            positions={allDisplayPositions}
                            onExitSignalCount={setInsightsBadge}
                            onBuy={handleInsightBuy}
                            onExitPosition={(pos) => setSellPosition(pos)}
                            pendingExits={pendingExits}
                            onConfirmExit={handleConfirmExit}
                            onDismissExit={handleDismissExit}
                        />
                    </div>
                )}

                {activeTab === 'markets' && (
                    <div className="animate-fade-in">
                        <TrendingMarketsTab onBuy={setBuySelection} positionMarketIds={positionMarketIds} />
                    </div>
                )}
            </div>

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

            {portfolioRiskOpen && portfolioAnalysis && (
                <PortfolioRiskModal
                    analysis={portfolioAnalysis}
                    onClose={() => setPortfolioRiskOpen(false)}
                />
            )}

            {selectedPosition && (
                <PositionDetailModal
                    position={selectedPosition}
                    portfolioAnalysis={portfolioAnalysis}
                    portfolioAnalysisLoading={portfolioAnalysisLoading}
                    positionIndex={allDisplayPositions.indexOf(selectedPosition)}
                    walletAddress={walletState.address}
                    chainId={walletState.chainId}
                    onClose={() => setSelectedPosition(null)}
                    onExitPosition={(pos) => { setSelectedPosition(null); setSellPosition(pos); }}
                    onIncreasePosition={(market, side) => { setSelectedPosition(null); setBuySelection({ market, side }); }}
                />
            )}

            {swapPanelOpen && (
                <div className="sm-overlay" onClick={() => setSwapPanelOpen(false)}>
                    <div className="sm-container" onClick={(e) => e.stopPropagation()}>
                        <div className="sm-handle" />
                        <div className="sm-header">
                            <span className="sm-title">Fund Your Wallet</span>
                            <button className="sm-close" onClick={() => setSwapPanelOpen(false)}>✕</button>
                        </div>
                        <SwapTab walletAddress={walletState.address} chainId={walletState.chainId} />
                    </div>
                </div>
            )}

            <SlideMenu
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                onNavigate={setActiveTab}
            />
        </div>
    );
}
