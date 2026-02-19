export interface DetectedTweet {
  element: Element;
  tweetId: string;
  textContent: string;
}

// Debug mode flag
let debugMode = false;
chrome.storage.local.get(['debugMode'], (result) => {
  debugMode = result.debugMode === true;
});

function debugLog(...args: unknown[]) {
  if (debugMode) {
    console.log('[Taurus:Debug]', ...args);
  }
}

// Strategy 1: Find time[datetime] element and traverse to parent link
function extractViaTimeElement(tweetElement: Element): string | null {
  debugLog('Strategy 1: Searching for time[datetime] element');
  const timeElement = tweetElement.querySelector('time[datetime]');
  if (!timeElement) {
    debugLog('Strategy 1: No time element found');
    return null;
  }

  // Traverse up to find parent link
  let currentElement = timeElement.parentElement;
  while (currentElement && currentElement !== tweetElement) {
    if (currentElement.tagName === 'A') {
      const href = currentElement.getAttribute('href');
      if (href?.includes('/status/')) {
        const match = href.match(/\/status\/(\d+)/);
        if (match) {
          debugLog('Strategy 1: Found tweet ID via time element:', match[1]);
          return match[1];
        }
      }
    }
    currentElement = currentElement.parentElement;
  }

  debugLog('Strategy 1: Time element found but no parent link');
  return null;
}

// Strategy 2: Find analytics link
function extractViaAnalyticsLink(tweetElement: Element): string | null {
  debugLog('Strategy 2: Searching for analytics link');
  const analyticsLink = tweetElement.querySelector('a[href$="/analytics"]');
  if (analyticsLink) {
    const href = analyticsLink.getAttribute('href');
    if (href) {
      const match = href.match(/\/status\/(\d+)\/analytics/);
      if (match) {
        debugLog('Strategy 2: Found tweet ID via analytics link:', match[1]);
        return match[1];
      }
    }
  }

  debugLog('Strategy 2: No analytics link found');
  return null;
}

// Strategy 3: Find any role=link with status URL (skip retweets/quotes)
function extractViaRoleLink(tweetElement: Element): string | null {
  debugLog('Strategy 3: Searching for role=link elements');
  const links = tweetElement.querySelectorAll('a[role="link"][href*="/status/"]');

  for (const link of Array.from(links)) {
    const href = link.getAttribute('href');
    if (!href) continue;

    // Skip quoted tweets (these usually have additional path segments)
    if (href.includes('/photo/') || href.includes('/video/')) {
      continue;
    }

    const match = href.match(/\/status\/(\d+)$/);
    if (match) {
      debugLog('Strategy 3: Found tweet ID via role link:', match[1]);
      return match[1];
    }
  }

  debugLog('Strategy 3: No valid role links found');
  return null;
}

// Strategy 4: Check for data-tweet-id or similar attributes
function extractViaDataAttributes(tweetElement: Element): string | null {
  debugLog('Strategy 4: Searching for data attributes');

  // Check various possible data attributes
  const attributes = ['data-tweet-id', 'data-item-id', 'data-id'];
  for (const attr of attributes) {
    const value = tweetElement.getAttribute(attr);
    if (value && /^\d+$/.test(value)) {
      debugLog('Strategy 4: Found tweet ID via attribute', attr, ':', value);
      return value;
    }
  }

  debugLog('Strategy 4: No data attributes found');
  return null;
}

export function detectTweet(tweetElement: Element): DetectedTweet | null {
  debugLog('Attempting to detect tweet from element:', tweetElement);

  // Try each strategy in order
  const tweetId =
    extractViaTimeElement(tweetElement) ||
    extractViaAnalyticsLink(tweetElement) ||
    extractViaRoleLink(tweetElement) ||
    extractViaDataAttributes(tweetElement);

  if (!tweetId) {
    console.warn('[Taurus] Failed to extract tweet ID. Enable debug mode for details.');
    debugLog('All strategies failed. Tweet HTML:', tweetElement.innerHTML.substring(0, 500));
    return null;
  }

  console.log('[Taurus] Tweet detected:', tweetId);
  return {
    element: tweetElement,
    tweetId,
    textContent: tweetElement.textContent || '',
  };
}
