// Background service worker for Taurus extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('Taurus extension installed');

  // Set default settings
  chrome.storage.local.set({
    overlayEnabled: true,
  });

  // Popup is the primary action; side panel opened from within the popup
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((error) => console.error(error));
});

// Listen for messages from popup or content scripts
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
          console.log('[Taurus] window.ethereum:', ethereum);
          if (!ethereum) {
            return { success: false, error: 'No Web3 wallet detected. Install MetaMask at metamask.io and reload X.com.' };
          }
          const [accounts, chainIdHex] = await Promise.all([
            ethereum.request({ method: 'eth_requestAccounts' }),
            ethereum.request({ method: 'eth_chainId' }),
          ]);
          return { success: true, address: accounts[0] as string, chainId: parseInt(chainIdHex as string, 16) };
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
  // Called by the TradeModal on mount to pick up network switches.
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

  if (message.type === 'GET_POSITIONS') {
    // Mock positions
    sendResponse({
      success: true,
      data: [
        {
          id: '1',
          marketQuestion: 'Will X happen?',
          side: 'yes',
          size: '$50.00',
          pnlPercent: 12.5,
        },
        {
          id: '2',
          marketQuestion: 'Market outcome Y?',
          side: 'no',
          size: '$25.00',
          pnlPercent: -5.2,
        },
      ],
    });
    return true;
  }

  if (message.type === 'GET_METRICS') {
    // Mock metrics
    sendResponse({
      success: true,
      data: {
        pnl: 127.50,
        volume: 2450,
        streak: 7,
      },
    });
    return true;
  }

  if (message.type === 'SIGN_AND_TRADE') {
    console.log('[Taurus:Background] SIGN_AND_TRADE received');
    console.log('[Taurus:Background] sender.tab?.id:', sender.tab?.id);
    console.log('[Taurus:Background] message.tabId:', message.tabId);

    const tabId: number | undefined = sender.tab?.id ?? message.tabId;
    if (!tabId) {
      console.error('[Taurus:Background] No tab ID available');
      sendResponse({ success: false, error: 'No tab ID available for signing' });
      return true;
    }
    console.log('[Taurus:Background] Using tabId:', tabId);

    const { tokenId, price, amount, address } = message.payload as {
      tokenId: string;
      price: number;
      amount: number;
      address: string;
    };
    console.log('[Taurus:Background] Payload:', { tokenId, price, amount, address });

    console.log('[Taurus:Background] About to call chrome.scripting.executeScript...');

    // Inject into MAIN world to access window.ethereum for EIP-712 signing.
    // Always read chainId live from MetaMask — never trust the stored value.
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      args: [tokenId, price, amount, address],
      func: async (tokenId: string, price: number, amount: number, address: string) => {
        console.log('[Taurus:Trade] ===== INJECTED SCRIPT STARTED =====');
        console.log('[Taurus:Trade] Args received:', { tokenId, price, amount, address });
        try {
          const ethereum = (window as any).ethereum;
          console.log('[Taurus:Trade] window.ethereum:', ethereum);
          console.log('[Taurus:Trade] typeof ethereum:', typeof ethereum);
          if (!ethereum) {
            console.error('[Taurus:Trade] No wallet detected!');
            return { success: false, error: 'No wallet detected' };
          }

          // Read live chainId — MetaMask v12+ uses per-site networks,
          // so this reflects X.com's connected network, not the global setting.
          console.log('[Taurus:Trade] Requesting eth_chainId...');
          let chainIdHex = await ethereum.request({ method: 'eth_chainId' });
          console.log('[Taurus:Trade] chainIdHex:', chainIdHex);
          let chainId = parseInt(chainIdHex as string, 16);
          console.log('[Taurus:Trade] chainId (decimal):', chainId);

          // Accept Polygon mainnet (137) or Polygon Amoy testnet (80002)
          const VALID_CHAINS = [137, 80002];
          if (!VALID_CHAINS.includes(chainId)) {
            console.log('[Taurus:Trade] Chain not valid, attempting switch to Polygon...');
            try {
              await ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x89' }], // 0x89 = 137 (Polygon mainnet)
              });
              // Re-read after the switch
              chainIdHex = await ethereum.request({ method: 'eth_chainId' });
              chainId = parseInt(chainIdHex as string, 16);
              console.log('[Taurus:Trade] After switch, chainId:', chainId);
            } catch (_switchErr) {
              console.error('[Taurus:Trade] Chain switch failed:', _switchErr);
              // User rejected the switch or Polygon isn't added yet
              return { success: false, error: 'Please switch MetaMask to Polygon or Polygon Amoy and try again.' };
            }
          }

          if (!VALID_CHAINS.includes(chainId)) {
            console.error('[Taurus:Trade] Still not on valid chain after switch');
            return { success: false, error: 'Still not on a supported network after switch attempt.' };
          }

          // L1 authentication: personal_sign(timestamp)
          console.log('[Taurus:Trade] Requesting personal_sign (L1 auth)...');
          const timestamp = Math.floor(Date.now() / 1000).toString();
          const nonce = Math.random().toString(36).substring(2);
          const l1Sig = await ethereum.request({
            method: 'personal_sign',
            params: [timestamp, address],
          });
          console.log('[Taurus:Trade] L1 signature obtained:', l1Sig?.slice(0, 20) + '...');

          // Build EIP-712 order struct
          const salt = Math.floor(Math.random() * 1e15).toString();
          const makerAmount = Math.floor(amount * 1e6).toString();
          const takerAmount = Math.floor((amount / price) * 1e6).toString();

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
            side: 0, // BUY
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

          console.log('[Taurus:Trade] Requesting eth_signTypedData_v4 (EIP-712 order)...');
          const orderSig = await ethereum.request({
            method: 'eth_signTypedData_v4',
            params: [address, JSON.stringify(typedData)],
          });
          console.log('[Taurus:Trade] Order signature obtained:', orderSig?.slice(0, 20) + '...');

          console.log('[Taurus:Trade] ===== SIGNING COMPLETE, RETURNING SUCCESS =====');
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
      console.log('[Taurus:Background] executeScript .then() called');
      console.log('[Taurus:Background] Raw result:', result);
      console.log('[Taurus:Background] result.result:', result?.result);
      const data = result.result as {
        success: boolean;
        order?: Record<string, unknown>;
        signature?: string;
        l1Auth?: { address: string; signature: string; timestamp: string; nonce: string };
        chainId?: number;
        error?: string;
      } | null;

      if (!data?.success || !data.order || !data.signature || !data.l1Auth) {
        console.error('[Taurus:Background] Signing failed or missing data');
        console.error('[Taurus:Background] data.success:', data?.success);
        console.error('[Taurus:Background] data.error:', data?.error);
        sendResponse({ success: false, error: data?.error ?? 'Signing failed' });
        return;
      }

      console.log('[Taurus:Background] Signing succeeded, submitting to backend...');

      // Submit signed order to backend
      try {
        console.log('[Taurus:Background] POSTing to http://localhost:3000/api/trades');
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
        console.log('[Taurus:Background] Backend response status:', response.status);
        const json = await response.json() as { success: boolean; data?: unknown; error?: string };
        console.log('[Taurus:Background] Backend response JSON:', json);
        if (json.success) {
          console.log('[Taurus:Background] Trade successful!');
          sendResponse({ success: true, data: json.data });
        } else {
          console.error('[Taurus:Background] Trade failed:', json.error);
          sendResponse({ success: false, error: json.error ?? 'Trade submission failed' });
        }
      } catch (err) {
        console.error('[Taurus:Background] Fetch error:', err);
        sendResponse({ success: false, error: (err as Error).message });
      }
    }).catch((err: Error) => {
      console.error('[Taurus:Background] executeScript .catch() error:', err);
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  return true; // Keep message channel open for async response
});

export {};
