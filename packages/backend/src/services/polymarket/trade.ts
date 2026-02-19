import { config } from '../../config/index.js';

// The signed order structure — all numeric fields are decimal strings (EIP-712 uint256)
export interface SignedOrder {
  salt: string;
  maker: string;
  signer: string;
  taker: string;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
  expiration: string;
  nonce: string;
  feeRateBps: string;
  side: number;          // 0 = BUY, 1 = SELL
  signatureType: number; // 0 = EOA
}

export interface TradeSubmission {
  order: SignedOrder;
  signature: string;    // EIP-712 signature from MetaMask
  orderType: string;    // 'GTC' | 'GTD' | 'FOK'
  l1Auth: {
    address: string;
    signature: string;  // personal_sign(timestamp) from MetaMask
    timestamp: string;
    nonce: string;
  };
}

export interface ClobOrderResponse {
  success: boolean;
  orderID?: string;
  errorMsg?: string;
  status?: string;
}

export async function submitTrade(submission: TradeSubmission): Promise<ClobOrderResponse> {
  const { order, signature, orderType, l1Auth } = submission;

  // CLOB API expects side as string 'BUY'/'SELL', not a number
  const body = {
    order: {
      ...order,
      side: order.side === 0 ? 'BUY' : 'SELL',
    },
    signature,
    orderType,
  };

  const response = await fetch(`${config.polymarket.clobBaseUrl}/order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      POLY_ADDRESS: l1Auth.address,
      POLY_SIGNATURE: l1Auth.signature,
      POLY_TIMESTAMP: l1Auth.timestamp,
      POLY_NONCE: l1Auth.nonce,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`CLOB API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<ClobOrderResponse>;
}
