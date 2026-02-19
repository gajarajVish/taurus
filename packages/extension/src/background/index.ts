// Background service worker for Taurus extension
import type { AutoExitConfig, PendingExit, Position, AutoSyncRequest } from '@taurus/types';
import { DEFAULT_AUTO_EXIT_CONFIG } from '@taurus/types';

const API_BASE = 'http://localhost:3000';
const ALARM_NAME = 'check-auto-exits';

chrome.runtime.onInstalled.addListener(() => {
  console.log('Taurus extension installed');

  chrome.storage.local.set({ overlayEnabled: true });

  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error(error));

  // Start the auto-exit polling alarm (every 15s = 0.25 min)
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.25 });
});

// Ensure alarm exists even after service worker restart
chrome.alarms.get(ALARM_NAME, (existing) => {
  if (!existing) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.25 });
  }
});

// ── Auto-Exit Alarm Handler ─────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;

  try {
    const storage = await chrome.storage.local.get([
      'autoExitConfig',
      'installId',
      'walletState',
      'localPositions',
    ]);

    const config: AutoExitConfig = storage.autoExitConfig ?? DEFAULT_AUTO_EXIT_CONFIG;
    if (!config.enabled) return;

    const installId: string | undefined = storage.installId;
    if (!installId) return;

    const walletState = storage.walletState as { connected: boolean; address: string | null } | undefined;
    const localPositions: Position[] = storage.localPositions ?? [];
    const isGuest = !walletState?.connected;

    // Build position list for sync
    const syncPositions: AutoSyncRequest['positions'] = [];

    // Add local (guest) positions
    for (const p of localPositions) {
      syncPositions.push({
        id: p.id,
        marketId: p.marketId,
        marketQuestion: p.marketQuestion,
        tokenId: p.outcomeId,
        side: p.outcomeName.toLowerCase() === 'yes' ? 'yes' : 'no',
        shares: p.shares,
        avgPrice: p.avgPrice,
        currentPrice: p.currentPrice,
        pnlPercent: p.pnlPercent,
      });
    }

    // Fetch real positions if wallet connected
    if (walletState?.connected && walletState.address) {
      try {
        const resp = await fetch(`${API_BASE}/api/positions?address=${encodeURIComponent(walletState.address)}`);
        if (resp.ok) {
          const realPositions: Position[] = await resp.json();
          for (const p of realPositions) {
            syncPositions.push({
              id: p.id,
              marketId: p.marketId,
              marketQuestion: p.marketQuestion,
              tokenId: p.outcomeId,
              side: p.outcomeName.toLowerCase() === 'yes' ? 'yes' : 'no',
              shares: p.shares,
              avgPrice: p.avgPrice,
              currentPrice: p.currentPrice,
              pnlPercent: p.pnlPercent,
            });
          }
        }
      } catch {
        // Backend may be down — skip this cycle
      }
    }

    if (syncPositions.length === 0) return;

    // Sync with backend and get pending exits
    const syncResp = await fetch(`${API_BASE}/api/automation/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ installId, positions: syncPositions, config }),
    });

    if (!syncResp.ok) return;

    const { pendingExits }: { pendingExits: PendingExit[] } = await syncResp.json();
    if (pendingExits.length === 0) return;

    if (isGuest) {
      // Guest mode: auto-execute exits by removing from localPositions
      handleGuestExits(pendingExits, localPositions);
    } else {
      // Authenticated mode: store pending exits for UI notification
      await chrome.storage.local.set({ pendingExits });
      // Notify sidepanel if open
      chrome.runtime.sendMessage({ type: 'PENDING_EXITS_UPDATED', pendingExits }).catch(() => {});
    }
  } catch (err) {
    console.warn('[Taurus:AutoExit] Alarm handler error:', (err as Error).message);
  }
});

function handleGuestExits(exits: PendingExit[], localPositions: Position[]): void {
  const exitIds = new Set(exits.map((e) => e.positionId));

  const updated = localPositions.filter((p) => {
    if (!exitIds.has(p.id)) return true;

    const exit = exits.find((e) => e.positionId === p.id);
    if (!exit) return true;

    if (exit.triggeredRule.action === 'exit_full') {
      console.log(`[Taurus:AutoExit] Guest auto-exit (full): ${p.marketQuestion}`);
      return false; // Remove position
    }

    // exit_half: reduce shares by half
    console.log(`[Taurus:AutoExit] Guest auto-exit (half): ${p.marketQuestion}`);
    const halfShares = parseFloat(p.shares) / 2;
    (p as Position).shares = halfShares.toString();
    return true;
  });

  chrome.storage.local.set({ localPositions: updated });

  // Dismiss processed exits on the backend
  chrome.storage.local.get(['installId'], (res) => {
    const installId = res.installId as string | undefined;
    if (!installId) return;
    for (const exit of exits) {
      fetch(`${API_BASE}/api/automation/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installId, positionId: exit.positionId }),
      }).catch(() => {});
    }
  });
}

// ── Shared signing helper ───────────────────────────────────────────────────
// Injects into a page's MAIN world to access window.ethereum for EIP-712 signing,
// then submits the signed order to the backend. Used by both BUY and SELL flows.

interface SignParams {
  tokenId: string;
  price: number;
  amount: number;
  address: string;
  side: 0 | 1; // 0 = BUY, 1 = SELL
}

function signAndSubmitOrder(
  tabId: number,
  params: SignParams,
  sendResponse: (response: { success: boolean; data?: unknown; error?: string }) => void
): void {
  const { tokenId, price, amount, address, side } = params;
  console.log('[Taurus:Background] signAndSubmitOrder:', { tabId, tokenId, price, amount, address, side });

  chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    args: [tokenId, price, amount, address, side],
    func: async (tokenId: string, price: number, amount: number, address: string, side: number) => {
      console.log('[Taurus:Trade] ===== INJECTED SCRIPT STARTED =====');
      console.log('[Taurus:Trade] Args:', { tokenId, price, amount, address, side });
      try {
        const ethereum = (window as any).ethereum;
        if (!ethereum) {
          return { success: false, error: 'No wallet detected' };
        }

        // Read live chainId
        let chainIdHex = await ethereum.request({ method: 'eth_chainId' });
        let chainId = parseInt(chainIdHex as string, 16);

        // Accept Polygon mainnet (137) or Polygon Amoy testnet (80002)
        // Prefer Amoy testnet as the primary transaction network
        const VALID_CHAINS = [137, 80002];
        if (!VALID_CHAINS.includes(chainId)) {
          try {
            await ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x13882' }], // 0x13882 = 80002 (Polygon Amoy testnet)
            });
            chainIdHex = await ethereum.request({ method: 'eth_chainId' });
            chainId = parseInt(chainIdHex as string, 16);
          } catch (switchErr: any) {
            // If Amoy isn't added to the wallet, add it first
            if (switchErr.code === 4902) {
              try {
                await ethereum.request({
                  method: 'wallet_addEthereumChain',
                  params: [{
                    chainId: '0x13882',
                    chainName: 'Polygon Amoy Testnet',
                    nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
                    rpcUrls: ['https://rpc-amoy.polygon.technology/'],
                    blockExplorerUrls: ['https://amoy.polygonscan.com/'],
                  }],
                });
                chainIdHex = await ethereum.request({ method: 'eth_chainId' });
                chainId = parseInt(chainIdHex as string, 16);
              } catch {
                return { success: false, error: 'Please add Polygon Amoy testnet to MetaMask and try again.' };
              }
            } else {
              return { success: false, error: 'Please switch MetaMask to Polygon Amoy and try again.' };
            }
          }
        }

        if (!VALID_CHAINS.includes(chainId)) {
          return { success: false, error: 'Still not on a supported network after switch attempt.' };
        }

        // ── Amoy testnet: execute a real on-chain POL transfer ──────────────
        // Polymarket CLOB doesn't exist on Amoy, so instead of EIP-712 signing
        // we send an actual transaction to deduct testnet POL from the wallet.
        if (chainId === 80002) {
          console.log('[Taurus:Trade] Amoy testnet detected — executing real on-chain transfer');
          // Taurus escrow address on Amoy (receives trade funds)
          const TAURUS_ESCROW = '0x000000000000000000000000000000000000dEaD';
          // Convert trade amount (USD) to POL in wei (1:1 ratio for testnet)
          const amountWei = '0x' + BigInt(Math.floor(amount * 1e18)).toString(16);

          const txHash = await ethereum.request({
            method: 'eth_sendTransaction',
            params: [{
              from: address,
              to: TAURUS_ESCROW,
              value: amountWei,
              chainId: '0x13882',
            }],
          });

          console.log('[Taurus:Trade] Amoy tx sent:', txHash);
          return {
            success: true,
            order: { tokenId, side, amount: amount.toString(), txHash },
            signature: txHash,
            l1Auth: { address, signature: '', timestamp: '', nonce: '' },
            chainId,
            txHash,
          };
        }

        // ── Mainnet: EIP-712 signing for Polymarket CLOB ────────────────────
        // L1 authentication: personal_sign(timestamp)
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = Math.random().toString(36).substring(2);
        const l1Sig = await ethereum.request({
          method: 'personal_sign',
          params: [timestamp, address],
        });

        // Build EIP-712 order struct
        const salt = Math.floor(Math.random() * 1e15).toString();

        // BUY: makerAmount = USDC, takerAmount = tokens
        // SELL: makerAmount = tokens, takerAmount = USDC
        let makerAmount: string;
        let takerAmount: string;
        if (side === 0) {
          // BUY
          makerAmount = Math.floor(amount * 1e6).toString();
          takerAmount = Math.floor((amount / price) * 1e6).toString();
        } else {
          // SELL: amount is the USDC value of shares being sold (shares * price)
          // tokens = amount / price, USDC = amount
          const tokens = amount / price;
          makerAmount = Math.floor(tokens * 1e6).toString();
          takerAmount = Math.floor(amount * 1e6).toString();
        }

        const order = {
          salt,
          maker: address,
          signer: address,
          taker: '0x0000000000000000000000000000000000000000',
          tokenId,
          makerAmount,
          takerAmount,
          expiration: '0',
          nonce: '0',
          feeRateBps: '0',
          side,
          signatureType: 0, // EOA
        };

        const typedData = {
          domain: {
            name: 'Polymarket CTF Exchange',
            version: '1',
            chainId,
            verifyingContract: '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E',
          },
          types: {
            EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
              { name: 'chainId', type: 'uint256' },
              { name: 'verifyingContract', type: 'address' },
            ],
            Order: [
              { name: 'salt', type: 'uint256' },
              { name: 'maker', type: 'address' },
              { name: 'signer', type: 'address' },
              { name: 'taker', type: 'address' },
              { name: 'tokenId', type: 'uint256' },
              { name: 'makerAmount', type: 'uint256' },
              { name: 'takerAmount', type: 'uint256' },
              { name: 'expiration', type: 'uint256' },
              { name: 'nonce', type: 'uint256' },
              { name: 'feeRateBps', type: 'uint256' },
              { name: 'side', type: 'uint8' },
              { name: 'signatureType', type: 'uint8' },
            ],
          },
          primaryType: 'Order',
          message: order,
        };

        console.log('[Taurus:Trade] Requesting eth_signTypedData_v4...');
        const orderSig = await ethereum.request({
          method: 'eth_signTypedData_v4',
          params: [address, JSON.stringify(typedData)],
        });

        console.log('[Taurus:Trade] ===== SIGNING COMPLETE =====');
        return {
          success: true,
          order,
          signature: orderSig,
          l1Auth: { address, signature: l1Sig, timestamp, nonce },
          chainId,
        };
      } catch (err: any) {
        console.error('[Taurus:Trade] Error in injected script:', err);
        return { success: false, error: (err as Error).message };
      }
    },
  }).then(async ([result]) => {
    const data = result.result as {
      success: boolean;
      order?: Record<string, unknown>;
      signature?: string;
      l1Auth?: { address: string; signature: string; timestamp: string; nonce: string };
      chainId?: number;
      txHash?: string;
      error?: string;
    } | null;

    if (!data?.success) {
      sendResponse({ success: false, error: data?.error ?? 'Signing failed' });
      return;
    }

    // Amoy testnet: real on-chain tx was already sent, just forward to backend
    if (data.chainId === 80002 && data.txHash) {
      try {
        const response = await fetch('http://localhost:3000/api/trades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order: data.order,
            signature: data.signature,
            orderType: 'GTC',
            chainId: data.chainId,
            l1Auth: data.l1Auth,
            txHash: data.txHash,
          }),
        });
        const json = await response.json() as { success: boolean; data?: unknown; error?: string };
        sendResponse({ success: true, data: { ...json.data as object, txHash: data.txHash } });
      } catch (err) {
        // Tx was already sent on-chain even if backend call fails
        sendResponse({ success: true, data: { txHash: data.txHash, status: 'matched' } });
      }
      return;
    }

    // Mainnet: submit signed order to backend CLOB
    if (!data.order || !data.signature || !data.l1Auth) {
      sendResponse({ success: false, error: data?.error ?? 'Signing failed' });
      return;
    }

    try {
      const response = await fetch('http://localhost:3000/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order: data.order,
          signature: data.signature,
          orderType: 'GTC',
          chainId: data.chainId,
          l1Auth: data.l1Auth,
        }),
      });
      const json = await response.json() as { success: boolean; data?: unknown; error?: string };
      if (json.success) {
        sendResponse({ success: true, data: json.data });
      } else {
        sendResponse({ success: false, error: json.error ?? 'Trade submission failed' });
      }
    } catch (err) {
      sendResponse({ success: false, error: (err as Error).message });
    }
  }).catch((err: Error) => {
    sendResponse({ success: false, error: err.message });
  });
}

// ── Find an X.com tab for wallet signing ────────────────────────────────────
async function findXTab(): Promise<number | null> {
  const tabs = await chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] });
  return tabs[0]?.id ?? null;
}

// ── Message listener ────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  if (message.type === 'PING') {
    sendResponse({ type: 'PONG', timestamp: Date.now() });
    return true;
  }

  if (message.type === 'CONNECT_WALLET') {
    const tabId: number | undefined = message.tabId;
    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID provided' });
      return true;
    }
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async () => {
        try {
          // Wait up to 3s for the wallet provider to inject (MetaMask fires 'ethereum#initialized')
          let ethereum = (window as any).ethereum;
          if (!ethereum) {
            await new Promise<void>((resolve) => {
              const t = setTimeout(resolve, 3000);
              window.addEventListener('ethereum#initialized', () => { clearTimeout(t); resolve(); }, { once: true });
            });
            ethereum = (window as any).ethereum;
          }
          if (!ethereum) {
            return { success: false, error: 'No Web3 wallet detected. Install MetaMask at metamask.io and reload X.com.' };
          }
          const [accounts, chainIdHex] = await Promise.all([
            ethereum.request({ method: 'eth_requestAccounts' }),
            ethereum.request({ method: 'eth_chainId' }),
          ]);
          let chainId = parseInt(chainIdHex as string, 16);

          // Auto-switch to Polygon Amoy testnet if not already on it
          if (chainId !== 80002) {
            try {
              await ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x13882' }], // 80002 = Polygon Amoy
              });
              chainId = 80002;
            } catch (switchErr: any) {
              // If Amoy isn't added to the wallet, add it
              if (switchErr.code === 4902) {
                try {
                  await ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                      chainId: '0x13882',
                      chainName: 'Polygon Amoy Testnet',
                      nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
                      rpcUrls: ['https://rpc-amoy.polygon.technology/'],
                      blockExplorerUrls: ['https://amoy.polygonscan.com/'],
                    }],
                  });
                  chainId = 80002;
                } catch {
                  // Fall through with current chain
                }
              }
            }
          }

          return { success: true, address: accounts[0] as string, chainId };
        } catch (err: any) {
          return { success: false, error: (err as Error).message };
        }
      },
    }).then(([result]) => {
      const data = result.result as { success: boolean; address?: string; chainId?: number; error?: string } | null;
      if (data?.success && data.address) {
        const state = { connected: true, address: data.address, chainId: data.chainId ?? null };
        chrome.storage.local.set({ walletState: state }, () => {
          sendResponse({ success: true, data: state });
        });
      } else {
        sendResponse({ success: false, error: data?.error ?? 'Connection failed' });
      }
    }).catch((err: Error) => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (message.type === 'DISCONNECT_WALLET') {
    const defaultState = { connected: false, address: null, chainId: null };
    chrome.storage.local.set({ walletState: defaultState }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'GET_WALLET_STATE') {
    chrome.storage.local.get(['walletState'], (result) => {
      sendResponse({
        success: true,
        data: result.walletState || { connected: false, address: null, chainId: null },
      });
    });
    return true;
  }

  // Re-read eth_chainId from the page's MAIN world and update storage.
  if (message.type === 'REFRESH_CHAIN_ID') {
    const tabId: number | undefined = sender.tab?.id;
    if (!tabId) {
      sendResponse({ success: false });
      return true;
    }
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: async () => {
        const ethereum = (window as any).ethereum;
        if (!ethereum) return null;
        const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
        return parseInt(chainIdHex as string, 16);
      },
    }).then(([result]) => {
      const chainId = result.result as number | null;
      if (chainId == null) { sendResponse({ success: false }); return; }
      chrome.storage.local.get(['walletState'], (res) => {
        const current = res.walletState;
        if (!current?.connected) { sendResponse({ success: false }); return; }
        const updated = { ...current, chainId };
        chrome.storage.local.set({ walletState: updated }, () => {
          sendResponse({ success: true, chainId });
        });
      });
    }).catch(() => sendResponse({ success: false }));
    return true;
  }

  // ── BUY order (from content script TradeModal or sidepanel BuyModal) ────
  if (message.type === 'SIGN_AND_TRADE') {
    const { tokenId, price, amount, address } = message.payload as {
      tokenId: string;
      price: number;
      amount: number;
      address: string;
    };

    const tabId: number | undefined = sender.tab?.id ?? message.tabId;
    if (tabId) {
      signAndSubmitOrder(tabId, { tokenId, price, amount, address, side: 0 }, sendResponse);
    } else {
      // Sidepanel has no tab context — find an X.com tab for wallet signing
      findXTab().then((foundTabId) => {
        if (!foundTabId) {
          sendResponse({ success: false, error: 'No X.com tab found. Please open X.com and try again.' });
          return;
        }
        signAndSubmitOrder(foundTabId, { tokenId, price, amount, address, side: 0 }, sendResponse);
      }).catch((err: Error) => {
        sendResponse({ success: false, error: err.message });
      });
    }
    return true;
  }

  // ── SELL order (from sidepanel SellModal) ───────────────────────────────
  if (message.type === 'SIGN_AND_SELL') {
    const { tokenId, price, amount, address } = message.payload as {
      tokenId: string;
      price: number;
      amount: number;
      address: string;
    };

    // Sidepanel has no tab context — find an X.com tab for wallet signing
    findXTab().then((tabId) => {
      if (!tabId) {
        sendResponse({ success: false, error: 'No X.com tab found. Please open X.com and try again.' });
        return;
      }
      signAndSubmitOrder(tabId, { tokenId, price, amount, address, side: 1 }, sendResponse);
    }).catch((err: Error) => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  return true; // Keep message channel open for async response
});

export {};
