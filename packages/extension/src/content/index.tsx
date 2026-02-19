import { TweetObserver } from './observer';
import { detectTweet } from './tweet/detector';
import { injectTweetButtons, removeTweetButtons } from './tweet/injector';
let observer: TweetObserver | null = null;

// Wait for DOM to be ready
function init() {
  console.log('[PolyOverlay] Content script initialized');

  // Check if overlay is enabled
  chrome.storage.local.get(['overlayEnabled'], (result) => {
    const enabled = result.overlayEnabled !== false; // Default to true
    console.log('[PolyOverlay] Overlay enabled status:', enabled);

    if (!enabled) {
      console.log('[PolyOverlay] Overlay disabled in settings');
      return;
    }

    // Start observing tweets
    observer = new TweetObserver({
      onTweetAdded: (tweetElement) => {
        const detected = detectTweet(tweetElement);
        if (detected) {
          console.log('[PolyOverlay] Tweet detected:', detected.tweetId);
          injectTweetButtons(tweetElement, detected.tweetId, detected.textContent);
        } else {
          console.log('[PolyOverlay] Element matched selector but detectTweet returned null', tweetElement);
        }
      },
      onTweetRemoved: (tweetElement) => {
        console.log('[PolyOverlay] Tweet removed');
        removeTweetButtons(tweetElement);
      },
    });

    observer.start();

    // Listen for settings changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.overlayEnabled) {
        if (changes.overlayEnabled.newValue === false) {
          console.log('[PolyOverlay] Overlay disabled, reloading page recommended');
        } else {
          console.log('[PolyOverlay] Overlay enabled, reloading page recommended');
        }
      }
    });
  });

}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
