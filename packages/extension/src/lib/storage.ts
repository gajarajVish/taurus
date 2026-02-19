// Chrome storage helpers

export interface StorageData {
  overlayEnabled: boolean;
  apiEndpoint: string;
  authToken?: string;
}

const STORAGE_DEFAULTS: StorageData = {
  overlayEnabled: true,
  apiEndpoint: 'http://localhost:3000',
};

export async function getStorage(): Promise<StorageData> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_DEFAULTS, (result) => {
      resolve(result as StorageData);
    });
  });
}

export async function setStorage(data: Partial<StorageData>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, resolve);
  });
}

export async function clearStorage(): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.local.clear(resolve);
  });
}
