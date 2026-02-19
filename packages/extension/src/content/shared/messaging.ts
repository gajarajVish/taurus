type ContentMessage =
  | { type: 'GET_WALLET_STATE' }
  | { type: 'GET_POSITIONS' }
  | { type: 'GET_METRICS' }
  | { type: 'PLACE_BET'; payload: { marketId: string; side: 'yes' | 'no'; amount: string; price: number; outcomeId: string } }
  | { type: 'TOGGLE_SIDECAR' }
  | { type: 'GET_SIDECAR_STATE' }
  | { type: 'MARKETS_MATCH'; tweetText: string };

type BackgroundResponse<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function sendMessage<T>(message: ContentMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: BackgroundResponse<T>) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (response?.success) {
        resolve(response.data);
      } else {
        reject(new Error(response?.error || 'Unknown error'));
      }
    });
  });
}
