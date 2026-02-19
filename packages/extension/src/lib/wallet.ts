export interface WalletState {
  connected: boolean;
  address: string | null;
  chainId: number | null;
}

const KEY = 'walletState';
const DEFAULT: WalletState = { connected: false, address: null, chainId: null };

export function getWalletState(): Promise<WalletState> {
  return new Promise((resolve) => {
    chrome.storage.local.get([KEY], (result) => {
      resolve(result[KEY] ?? DEFAULT);
    });
  });
}

export function saveWalletState(state: WalletState): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [KEY]: state }, resolve);
  });
}

export function clearWalletState(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [KEY]: DEFAULT }, resolve);
  });
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
