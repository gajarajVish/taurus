// Chrome storage helpers
import type { AIInsightsSettings, AutoExitConfig, PendingExit } from '@taurus/types';
import { DEFAULT_AUTO_EXIT_CONFIG } from '@taurus/types';

export interface StorageData {
  overlayEnabled: boolean;
  apiEndpoint: string;
  authToken?: string;
  installId?: string;
  aiSettings?: AIInsightsSettings;
  autoExitConfig?: AutoExitConfig;
  pendingExits?: PendingExit[];
}

const STORAGE_DEFAULTS: StorageData = {
  overlayEnabled: true,
  apiEndpoint: 'http://localhost:3000',
};

const DEFAULT_AI_SETTINGS: AIInsightsSettings = {
  enabled: true,
  minTweetCount: 1,
  minSentimentScore: 0.4,
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

// Generate or retrieve a stable install ID for this extension instance
export async function getInstallId(): Promise<string> {
  const storage = await getStorage();
  if (storage.installId) {
    return storage.installId;
  }

  // Generate a new unique ID
  const installId = crypto.randomUUID();
  await setStorage({ installId });
  return installId;
}

// Get AI insights settings
export async function getAISettings(): Promise<AIInsightsSettings> {
  const storage = await getStorage();
  return storage.aiSettings ?? DEFAULT_AI_SETTINGS;
}

// Update AI insights settings
export async function setAISettings(settings: Partial<AIInsightsSettings>): Promise<AIInsightsSettings> {
  const current = await getAISettings();
  const updated = { ...current, ...settings };
  await setStorage({ aiSettings: updated });
  return updated;
}

// ── Auto-Exit Config ────────────────────────────────────────────────────────

export async function getAutoExitConfig(): Promise<AutoExitConfig> {
  const storage = await getStorage();
  return storage.autoExitConfig ?? DEFAULT_AUTO_EXIT_CONFIG;
}

export async function setAutoExitConfig(config: AutoExitConfig): Promise<void> {
  await setStorage({ autoExitConfig: config });
}

// ── Pending Exits ───────────────────────────────────────────────────────────

export async function getPendingExits(): Promise<PendingExit[]> {
  const storage = await getStorage();
  return storage.pendingExits ?? [];
}

export async function setPendingExits(exits: PendingExit[]): Promise<void> {
  await setStorage({ pendingExits: exits });
}

export async function dismissPendingExit(positionId: string): Promise<void> {
  const exits = await getPendingExits();
  await setPendingExits(exits.filter((e) => e.positionId !== positionId));
}
