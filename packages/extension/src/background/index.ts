// Background service worker for PolyOverlay extension

chrome.runtime.onInstalled.addListener(() => {
  console.log('PolyOverlay extension installed');

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
          console.log('[PolyOverlay] window.ethereum:', ethereum);
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

  if (message.type === 'PLACE_BET') {
    // Mock bet placement
    console.log('Placing bet:', message.payload);
    sendResponse({
      success: true,
      data: { orderId: 'mock-order-123', status: 'pending' },
    });
    return true;
  }

  return true; // Keep message channel open for async response
});

export {};
