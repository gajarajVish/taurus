// Chrome storage helpers

export interface StorageData {
  overlayEnabled: boolean;
  apiEndpoint: string;
  authToken?: string;
  installId?: string;
  // AI Insights settings
  aiInsightsEnabled: boolean;
  aiMinTweetCount: number;
  aiMinSentimentScore: number;
}

const STORAGE_DEFAULTS: StorageData = {
  overlayEnabled: true,
  apiEndpoint: 'http://localhost:3000',
  aiInsightsEnabled: true,
  aiMinTweetCount: 3,
  aiMinSentimentScore: 0.6,
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

// Get or generate install ID
export async function getInstallId(): Promise<string> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_INSTALL_ID' }, (response) => {
      if (response?.success && response.installId) {
        resolve(response.installId);
      } else {
        // Fallback: try to get from storage directly
        chrome.storage.local.get(['installId'], (result) => {
          if (result.installId) {
            resolve(result.installId);
          } else {
            // Generate locally as last resort
            const id = 'taurus_' + crypto.randomUUID();
            chrome.storage.local.set({ installId: id });
            resolve(id);
          }
        });
      }
    });
  });
}

// Get AI settings
export async function getAISettings(): Promise<{
  enabled: boolean;
  minTweetCount: number;
  minSentimentScore: number;
}> {
  const storage = await getStorage();
  return {
    enabled: storage.aiInsightsEnabled,
    minTweetCount: storage.aiMinTweetCount,
    minSentimentScore: storage.aiMinSentimentScore,
  };
}

// Update AI settings
export async function setAISettings(settings: Partial<{
  enabled: boolean;
  minTweetCount: number;
  minSentimentScore: number;
}>): Promise<void> {
  const updates: Partial<StorageData> = {};
  if (settings.enabled !== undefined) updates.aiInsightsEnabled = settings.enabled;
  if (settings.minTweetCount !== undefined) updates.aiMinTweetCount = settings.minTweetCount;
  if (settings.minSentimentScore !== undefined) updates.aiMinSentimentScore = settings.minSentimentScore;
  return setStorage(updates);
}
