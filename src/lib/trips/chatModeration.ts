/**
 * Chat moderation helpers (Task 12H).
 *
 * Provides banned-word detection and quick-reply lists.
 * Pure functions — safe to import on server or in tests.
 */

/** Words that block delivery immediately. */
const BLOCKED_WORDS = ['fuck', 'shit'];

/** Words that flag for admin review. */
const FLAGGED_WORDS = [
  'damn',
  'spam',
  'scam',
  'abuse',
  'harassment',
];

export type ModerationStatus = 'CLEAN' | 'FLAGGED' | 'BLOCKED';

export type ModerationSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type ModerateResult = {
  status: ModerationStatus;
  matchedWords: string[];
  severity?: ModerationSeverity;
};

function findMatchedWords(text: string, words: string[]): string[] {
  const lower = text.toLowerCase();
  const matched = new Set<string>();
  for (const word of words) {
    const w = word.toLowerCase();
    if (w && lower.includes(w)) matched.add(word);
  }
  return [...matched];
}

/**
 * Check a message body against banned word lists.
 * BLOCKED: severe terms or multiple matches; FLAGGED: lighter terms; CLEAN otherwise.
 */
export function moderateMessage(body: string, extraBannedWords: string[] = []): ModerateResult {
  const trimmed = body.trim();
  if (!trimmed) {
    return { status: 'CLEAN', matchedWords: [] };
  }

  const blockedHits = findMatchedWords(trimmed, BLOCKED_WORDS);
  const flaggedHits = findMatchedWords(trimmed, [...FLAGGED_WORDS, ...extraBannedWords]);
  const matchedWords = [...new Set([...blockedHits, ...flaggedHits])];

  if (matchedWords.length === 0) {
    return { status: 'CLEAN', matchedWords: [] };
  }

  if (blockedHits.length > 0 || matchedWords.length >= 2) {
    return {
      status: 'BLOCKED',
      matchedWords,
      severity: 'HIGH',
    };
  }

  return {
    status: 'FLAGGED',
    matchedWords,
    severity: 'MEDIUM',
  };
}

/** Parent quick-reply options. */
export const PARENT_QUICK_REPLIES = [
  'Where are you?',
  'We are coming.',
  'My child is ready.',
  'Please wait 2 minutes.',
  'Call me please.',
] as const;

/** Driver quick-reply options (Task 13.4.2). */
export const DRIVER_QUICK_REPLIES = [
  'I have arrived.',
  'I am on my way.',
  'Please come to the pickup point.',
  'There is a short delay.',
  'I cannot find the pickup location.',
] as const;

export type ParentQuickReply = (typeof PARENT_QUICK_REPLIES)[number];
export type DriverQuickReply = (typeof DRIVER_QUICK_REPLIES)[number];
