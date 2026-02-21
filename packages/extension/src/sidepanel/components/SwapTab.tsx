import React, { useState } from 'react';
import { TokenSelector } from './TokenSelector';
import { api } from '../../lib/api';
import type { SwapToken, SwapQuoteResponse, SwapStep } from '@taurus/types';

interface SwapTabProps {
  walletAddress: string | null;
  chainId: number | null;
}

const SEPOLIA_TOKENS: SwapToken[] = [
  { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', name: 'Ethereum', decimals: 18, chainId: 11155111 },
  { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', symbol: 'USDC', name: 'USD Coin', decimals: 6, chainId: 11155111 },
  { address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18, chainId: 11155111 },
];

const AMOUNT_PRESETS = [0.001, 0.005, 0.01, 0.05];
const SWAP_CHAIN_ID = 11155111;

export function SwapTab({ walletAddress }: SwapTabProps) {
  const [tokenIn, setTokenIn] = useState<SwapToken>(SEPOLIA_TOKENS[0]);
  const [tokenOut, setTokenOut] = useState<SwapToken>(SEPOLIA_TOKENS[1]);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<SwapQuoteResponse | null>(null);
  const [swapStep, setSwapStep] = useState<SwapStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const numericAmount = parseFloat(amount) || 0;
  const isBusy = swapStep !== 'idle' && swapStep !== 'success' && swapStep !== 'error';

  const handleSwapDirection = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setQuote(null);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      setAmount(val);
      setQuote(null);
    }
  };

  const handleGetQuote = async () => {
    if (!walletAddress || numericAmount <= 0) return;

    setSwapStep('quoting');
    setError(null);
    setQuote(null);

    try {
      // Convert amount to smallest unit
      const amountSmallest = BigInt(Math.floor(numericAmount * (10 ** tokenIn.decimals))).toString();

      const result = await api.swap.quote({
        type: 'EXACT_INPUT',
        tokenIn: tokenIn.address,
        tokenInChainId: SWAP_CHAIN_ID,
        tokenOut: tokenOut.address,
        tokenOutChainId: SWAP_CHAIN_ID,
        amount: amountSmallest,
        swapper: walletAddress,
      });

      // Validate that we got a usable quote shape
      if (!result || !result.quote) {
        setError('Unexpected quote response — try again');
        setSwapStep('error');
        return;
      }

      setQuote(result);
      setSwapStep('idle');
    } catch (err) {
      setError((err as Error).message || 'Failed to get quote');
      setSwapStep('error');
    }
  };

  const handleSwap = () => {
    if (!walletAddress || !quote?.quote) return;

    setSwapStep('signing');
    setError(null);

    chrome.runtime.sendMessage(
      {
        type: 'SWAP_EXECUTE',
        payload: {
          quote: quote.quote,
          walletAddress,
          chainId: SWAP_CHAIN_ID,
          tokenIn: tokenIn.address,
          tokenOut: tokenOut.address,
          amount: BigInt(Math.floor(numericAmount * (10 ** tokenIn.decimals))).toString(),
          routing: (quote as unknown as Record<string, unknown>).routing || 'CLASSIC',
        },
      },
      (response: { success: boolean; data?: unknown; error?: string } | undefined) => {
        if (chrome.runtime.lastError) {
          setSwapStep('error');
          setError(chrome.runtime.lastError.message ?? 'Extension error');
          return;
        }
        if (response?.success) {
          setSwapStep('success');
          setTimeout(() => {
            setSwapStep('idle');
            setQuote(null);
            setAmount('');
          }, 2500);
        } else {
          setSwapStep('error');
          setError(response?.error ?? 'Swap failed');
        }
      }
    );
  };

  const getButtonLabel = () => {
    switch (swapStep) {
      case 'quoting': return 'Getting quote...';
      case 'checking_approval': return 'Checking approval...';
      case 'approving': return 'Approving...';
      case 'signing': return 'Waiting for signature...';
      case 'submitting': return 'Submitting swap...';
      case 'success': return 'Swap submitted!';
      default: return quote ? 'Swap' : 'Get Quote';
    }
  };

  return (
    <div className="sw-container">
      {/* Swap Section */}
      <div className="sw-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span className="sw-section-title">Fund Your Trades</span>
            <span className="sw-section-subtitle" style={{ margin: 0 }}>
              Swap tokens → Get USDC → Trade
            </span>
          </div>
          <span className="sw-chain-badge">Sepolia</span>
        </div>

        {/* Token Pair */}
        <div className="sw-token-row">
          <TokenSelector
            label="From"
            token={tokenIn}
            tokens={SEPOLIA_TOKENS}
            onChange={(t) => { setTokenIn(t); setQuote(null); }}
            disabled={isBusy}
          />

          <button
            className="sw-swap-btn"
            onClick={handleSwapDirection}
            disabled={isBusy}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <polyline points="17 1 21 5 17 9" />
              <path d="M3 11V9a4 4 0 014-4h14" />
              <polyline points="7 23 3 19 7 15" />
              <path d="M21 13v2a4 4 0 01-4 4H3" />
            </svg>
          </button>

          <TokenSelector
            label="To"
            token={tokenOut}
            tokens={SEPOLIA_TOKENS}
            onChange={(t) => { setTokenOut(t); setQuote(null); }}
            disabled={isBusy}
          />
        </div>

        {/* Amount */}
        <div className="sm-input-section">
          <span className="sm-input-label">Amount ({tokenIn.symbol})</span>
          <div className="sm-input-row">
            <input
              type="text"
              inputMode="decimal"
              className="sm-input"
              value={amount}
              onChange={handleAmountChange}
              placeholder="0"
              disabled={isBusy}
            />
            <span className="bm-currency">{tokenIn.symbol}</span>
          </div>
        </div>

        <div className="bm-presets">
          {AMOUNT_PRESETS.map((preset) => (
            <button
              key={preset}
              className={`bm-preset ${numericAmount === preset ? 'active' : ''}`}
              onClick={() => { setAmount(String(preset)); setQuote(null); }}
              disabled={isBusy}
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Quote */}
        {quote?.quote && (
          <div className="sw-quote">
            <div className="sw-quote-highlight">
              {quote.quote.amountOutReadable || quote.quote.amountOut || '\u2014'} {tokenOut.symbol}
            </div>
            <div className="sw-quote-row">
              <span>Gas Fee</span>
              <span className="sw-quote-value">
                {quote.quote.gasFeeUSD ? `$${quote.quote.gasFeeUSD}` : (quote.quote.gasEstimate || '\u2014')}
              </span>
            </div>
            {quote.quote.priceImpact && quote.quote.priceImpact !== '0' && (
              <div className="sw-quote-row">
                <span>Price Impact</span>
                <span className="sw-quote-value">{quote.quote.priceImpact}%</span>
              </div>
            )}
            {quote.quote.route && (
              <div className="sw-quote-row">
                <span>Route</span>
                <span className="sw-quote-value">{quote.quote.route}</span>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {swapStep === 'error' && error && (
          <div className="sm-error">{error}</div>
        )}

        {/* Success */}
        {swapStep === 'success' && (
          <div className="sm-success">
            <span className="sm-success-icon">&#10003;</span>
            <span className="sm-success-text">Swap submitted!</span>
          </div>
        )}

        {/* Action Button */}
        {!walletAddress ? (
          <div className="sw-section-subtitle" style={{ textAlign: 'center', padding: '8px 0' }}>
            Connect your wallet to swap tokens
          </div>
        ) : (
          <button
            className="bm-confirm yes"
            onClick={quote ? handleSwap : handleGetQuote}
            disabled={numericAmount <= 0 || isBusy}
          >
            {getButtonLabel()}
          </button>
        )}
      </div>

    </div>
  );
}
