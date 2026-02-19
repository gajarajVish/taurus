import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createShadowRoot } from '../shared/createShadowRoot';
import { TweetButtons } from './TweetButtons';
import { tweetButtonStyles } from './styles';
import { api } from '../../lib/api';
import type { Market } from '@taurus/types';

interface InjectedTweet {
  container: HTMLElement;
  root: Root;
}

const injectedTweets = new WeakMap<Element, InjectedTweet>();

export async function injectTweetButtons(
  tweetElement: Element,
  tweetId: string,
  tweetText: string
): Promise<void> {
  // Guard 1 (sync): already injected — check before any async work
  if (injectedTweets.has(tweetElement)) {
    return;
  }

  try {
    // Call match API — only inject if a market match is found
    const response = await api.markets.match(tweetText);
    const match: Market | null = response.match;

    // Guard 2: no matching market — do not show widget
    if (!match) {
      return;
    }

    // Guard 3: tweet may have been removed from DOM during the async round-trip
    // (scroll, virtualization, SPA navigation)
    if (!document.contains(tweetElement)) {
      return;
    }

    // Guard 4: race condition — another concurrent call may have already injected
    if (injectedTweets.has(tweetElement)) {
      return;
    }

    // Create Shadow DOM container (CSS isolated from X.com)
    const { container, root } = createShadowRoot(tweetButtonStyles);

    // X tweets are flex-row containers — force wrap so our block spans full width
    const computedStyle = window.getComputedStyle(tweetElement);
    if (computedStyle.display === 'flex') {
      (tweetElement as HTMLElement).style.flexWrap = 'wrap';
    }

    tweetElement.prepend(container);

    const reactRoot = createRoot(root);
    reactRoot.render(
      React.createElement(TweetButtons, {
        tweetId,
        market: match,
      })
    );

    injectedTweets.set(tweetElement, { container, root: reactRoot });
    console.log('[Taurus] Injected widget for tweet', tweetId, '—', match.question);
  } catch (err) {
    // Swallow all errors — backend may not be running, network may fail.
    // The extension must never crash the host page.
    console.warn('[Taurus] Widget injection skipped:', (err as Error).message);
  }
}

export function removeTweetButtons(tweetElement: Element) {
  const injected = injectedTweets.get(tweetElement);
  if (injected) {
    if (injected.root) {
      injected.root.unmount();
    }
    injected.container.remove();
    injectedTweets.delete(tweetElement);
  }
}
