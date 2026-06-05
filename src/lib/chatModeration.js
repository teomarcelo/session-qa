/**
 * chatModeration.js — shared utilities for chat profanity and question detection.
 *
 * Profanity: leo-profanity word-list filter (client-side, zero cost, zero latency).
 * Question detection: heuristic used on the instructor side to prompt escalation,
 *   and on the student side to suggest posting to Q&A instead.
 */
import leoProfanity from 'leo-profanity';

// Load the full English dictionary (included in the package)
leoProfanity.loadDictionary('en');

/**
 * Returns true if the message contains profanity or hate-speech keywords.
 * Uses leo-profanity's check(), which replaces matched words with *** internally.
 */
export function containsProfanity(text) {
  if (!text || typeof text !== 'string') return false;
  return leoProfanity.check(text);
}

/**
 * Returns the message with profanity replaced by ***.
 * Used to preview what would be censored (not applied to stored text — we warn, not autocensor).
 */
export function censorText(text) {
  if (!text || typeof text !== 'string') return text;
  return leoProfanity.clean(text);
}

/**
 * Returns true if the message looks like a question that could go on the Q&A board.
 * Heuristic: ends with '?' OR starts with a question word.
 */
export function looksLikeQuestion(text) {
  const t = String(text || '').trim();
  if (!t || t.length < 8) return false;
  if (t.endsWith('?')) return true;
  const lower = t.toLowerCase();
  return /^(how|what|why|when|where|who|which|can|could|is|are|does|do|will|would|should|has|have)\b/.test(lower);
}
