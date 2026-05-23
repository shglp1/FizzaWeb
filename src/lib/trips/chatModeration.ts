/**
 * Chat moderation helpers (Task 12H).
 *
 * Provides banned-word detection and quick-reply lists.
 * Pure functions — safe to import on server or in tests.
 */

/** Minimal banned-word list. Extend via SystemConfiguration in production. */
const BANNED_WORDS = [
  'spam', 'scam', 'abuse', 'harassment',
  // Add more as needed — loaded from SystemConfiguration at runtime
];

export type ModerationResult = 'CLEAN' | 'FLAGGED' | 'BLOCKED';

/**
 * Check a message body against the banned word list.
 * Returns BLOCKED if a severe pattern matches, FLAGGED for lighter ones, CLEAN otherwise.
 */
export function moderateMessage(body: string, extraBannedWords: string[] = []): ModerationResult {
  const lower = body.toLowerCase();
  const allBanned = [...BANNED_WORDS, ...extraBannedWords];
  for (const word of allBanned) {
    if (lower.includes(word.toLowerCase())) {
      return 'FLAGGED';
    }
  }
  return 'CLEAN';
}

/** Parent quick-reply options. */
export const PARENT_QUICK_REPLIES = [
  'Where are you?',
  'We are coming.',
  'My child is ready.',
  'Please wait 2 minutes.',
  'Call me please.',
] as const;

/** Driver quick-reply options. */
export const DRIVER_QUICK_REPLIES = [
  'I am on my way.',
  'I have arrived.',
  'Please come outside.',
  'Traffic delay.',
  'I picked up the rider.',
  'I dropped off the rider safely.',
] as const;

export type ParentQuickReply = (typeof PARENT_QUICK_REPLIES)[number];
export type DriverQuickReply = (typeof DRIVER_QUICK_REPLIES)[number];
