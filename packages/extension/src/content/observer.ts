interface ObserverConfig {
  onTweetAdded?: (tweet: Element) => void;
  onTweetRemoved?: (tweet: Element) => void;
  onBodyMutation?: () => void;
}

const TWEET_SELECTOR = '[data-testid="tweet"]'; // Relaxed from article[data-testid="tweet"]
const DEBOUNCE_MS = 500; // Increased debounce
const POLLING_MS = 2000; // Fallback polling interval

export class TweetObserver {
  private observer: MutationObserver | null = null;
  private pollingInterval: number | null = null;
  private config: ObserverConfig;
  private debounceTimer: number | null = null;
  private processedTweets = new WeakSet<Element>();

  constructor(config: ObserverConfig) {
    this.config = config;
  }

  start() {
    if (this.observer) {
      return;
    }

    console.log('[Taurus] Starting observer with selector:', TWEET_SELECTOR);

    // Initial check
    this.checkForTweets();

    // Start Polling (Backup for MutationObserver)
    this.pollingInterval = window.setInterval(() => {
      this.checkForTweets();
    }, POLLING_MS);

    // Observe for new tweets
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private checkForTweets() {
    const tweets = document.querySelectorAll(TWEET_SELECTOR);
    if (tweets.length > 0) {
        // Only log if we find something to avoid spamming poll logs
        // console.log(`[Taurus] Polling/Check found ${tweets.length} tweets`);
    }
    
    tweets.forEach((tweet) => {
      if (!this.processedTweets.has(tweet)) {
        console.log('[Taurus] New tweet found via poll/check', tweet);
        this.processedTweets.add(tweet);
        this.config.onTweetAdded?.(tweet);
      }
    });
  }

  private handleMutations(mutations: MutationRecord[]) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.processMutations(mutations);
    }, DEBOUNCE_MS);
  }

  private processMutations(mutations: MutationRecord[]) {
    const addedTweets: Element[] = [];
    const removedTweets: Element[] = [];

    for (const mutation of mutations) {
      // Check added nodes
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;

          // Check if it's a tweet
          if (element.matches(TWEET_SELECTOR)) {
            if (!this.processedTweets.has(element)) {
              this.processedTweets.add(element);
              addedTweets.push(element);
            }
          }

          // Check children for tweets
          const childTweets = element.querySelectorAll(TWEET_SELECTOR);
          childTweets.forEach((tweet) => {
            if (!this.processedTweets.has(tweet)) {
              this.processedTweets.add(tweet);
              addedTweets.push(tweet);
            }
          });
        }
      });

      // Check removed nodes
      mutation.removedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;

          if (element.matches(TWEET_SELECTOR)) {
            removedTweets.push(element);
          }

          const childTweets = element.querySelectorAll(TWEET_SELECTOR);
          childTweets.forEach((tweet) => removedTweets.push(tweet));
        }
      });
    }

    // Notify callbacks
    addedTweets.forEach((tweet) => this.config.onTweetAdded?.(tweet));
    removedTweets.forEach((tweet) => this.config.onTweetRemoved?.(tweet));

    if (mutations.length > 0) {
      this.config.onBodyMutation?.();
    }
  }
}
