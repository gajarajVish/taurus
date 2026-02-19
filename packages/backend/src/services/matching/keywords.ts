import type { Market } from '@taurus/types';

// ── Stop words ───────────────────────────────────────────────────────────────
// Words that carry no semantic signal for market matching — filtered before scoring.
const STOP_WORDS = new Set([
  'will', 'the', 'a', 'an', 'in', 'on', 'at', 'by', 'for', 'of', 'to',
  'is', 'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had',
  'do', 'does', 'did', 'that', 'this', 'these', 'those', 'it', 'its',
  'or', 'and', 'but', 'not', 'no', 'yes', 'with', 'from', 'about',
  'what', 'when', 'where', 'who', 'how', 'than',
]);

// ── Tokenizer ────────────────────────────────────────────────────────────────
// Strips noise (URLs, @mentions, punctuation), splits on whitespace,
// filters short tokens and stop words. Returns a Set for O(1) intersection.
export function tokenize(text: string): Set<string> {
  const cleaned = text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')     // strip URLs
    .replace(/@\w+/g, ' ')               // strip @mentions
    .replace(/[^a-z0-9\s]/g, ' ');      // strip punctuation/special chars

  const tokens = cleaned.split(/\s+/).filter((token) => {
    if (token.length < 3) return false;
    if (STOP_WORDS.has(token)) return false;
    return true;
  });

  return new Set(tokens);
}

// ── Scorer ───────────────────────────────────────────────────────────────────
// Dice coefficient variant:
//   score = |intersection| / sqrt(|tweetTokens| × |marketTokens|)
//
// This formula handles imbalanced lengths fairly:
//   - A tweet with 3/3 market tokens matching = high score
//   - A tweet with 3/50 market tokens matching = lower score
// We iterate the smaller set for efficiency.
function scoreTweetAgainstMarket(
  tweetTokens: Set<string>,
  marketTokens: Set<string>
): number {
  if (tweetTokens.size === 0 || marketTokens.size === 0) return 0;

  const [smaller, larger] =
    tweetTokens.size <= marketTokens.size
      ? [tweetTokens, marketTokens]
      : [marketTokens, tweetTokens];

  let intersectionCount = 0;
  for (const token of smaller) {
    if (larger.has(token)) intersectionCount += 1;
  }

  return intersectionCount / Math.sqrt(tweetTokens.size * marketTokens.size);
}

// ── Public API ───────────────────────────────────────────────────────────────
// Minimum score to show a widget — tune up to reduce false positives,
// tune down to catch more matches.
const MATCH_THRESHOLD = 0.2;

/**
 * Find the single best-matching active market for a given tweet's text.
 * Returns null if no market scores above MATCH_THRESHOLD.
 */
export function findBestMatch(tweetText: string, markets: Market[]): Market | null {
  const tweetTokens = tokenize(tweetText);
  if (tweetTokens.size === 0) return null;

  let bestScore = 0;
  let bestMarket: Market | null = null;

  for (const market of markets) {
    const marketTokens = tokenize(market.question);
    const score = scoreTweetAgainstMarket(tweetTokens, marketTokens);

    if (score > bestScore) {
      bestScore = score;
      bestMarket = market;
    }
  }

  return bestScore >= MATCH_THRESHOLD ? bestMarket : null;
}
