// Uniswap Trading API swap types

// ── Token definitions ───────────────────────────────────────────────────────

export interface SwapToken {
  address: string;       // Contract address (0x0...0 for native ETH)
  symbol: string;        // e.g. "ETH", "USDC", "WETH"
  name: string;          // e.g. "Ethereum", "USD Coin"
  decimals: number;      // 18 for ETH, 6 for USDC
  logoUrl?: string;
  chainId: number;       // 11155111 for Sepolia
}

// ── Check Approval ──────────────────────────────────────────────────────────

export interface CheckApprovalRequest {
  token: string;
  amount: string;         // Amount in smallest unit (wei)
  walletAddress: string;
  chainId: number;
}

export interface CheckApprovalResponse {
  approval: {
    gasFee: string;
    gasEstimate: string;
  } | null;               // null means already approved
}

// ── Quote ───────────────────────────────────────────────────────────────────

export interface SwapQuoteRequest {
  type: 'EXACT_INPUT';
  tokenIn: string;
  tokenInChainId: number;
  tokenOut: string;
  tokenOutChainId: number;
  amount: string;         // In smallest unit of tokenIn
  swapper: string;        // Wallet address
  slippageTolerance?: number;
}

export interface SwapQuoteResponse {
  quote: {
    amountOut: string;
    amountOutReadable: string;
    gasEstimate: string;
    gasFeeUSD: string;
    priceImpact: string;
    route: string;
    permit2Data?: {
      domain: Record<string, unknown>;
      types: Record<string, unknown[]>;
      primaryType: string;
      message: Record<string, unknown>;
    };
    routeData: unknown;   // Opaque — pass back to /order
  };
  requestId: string;
}

// ── Order Submission ────────────────────────────────────────────────────────

export interface SwapOrderRequest {
  quote: unknown;         // The full quote object from step 2
  signature: string;      // Permit2 signature
  chainId: number;
}

export interface SwapOrderResponse {
  orderHash: string;
  status: 'pending' | 'filled' | 'failed';
  txHash?: string;
}

// ── Swap State Machine ──────────────────────────────────────────────────────

export type SwapStep =
  | 'idle'
  | 'checking_approval'
  | 'approving'
  | 'quoting'
  | 'signing'
  | 'submitting'
  | 'success'
  | 'error';

// ── Sentiment Swap Recommendation ───────────────────────────────────────────

export interface SentimentSwapRecommendation {
  tokenIn: SwapToken;
  tokenOut: SwapToken;
  rationale: string;
  sentiment: 'bullish' | 'bearish';
  confidence: number;     // 0-1
  suggestedAmount?: string;
  source: '0g' | 'local';
  timestamp: string;
}

export interface SentimentSwapRequest {
  tweetText: string;
  walletAddress: string;
}

export interface SentimentSwapResponse {
  recommendation: SentimentSwapRecommendation | null;
}
