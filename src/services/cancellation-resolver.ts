import { eq, and, isNull, gt } from 'drizzle-orm';
import { db } from '@/data/db/client';
import { tasks } from '@/data/db/schema';
import type { NotificationData } from '../../modules/notification-listener/src/types';

const CANCEL_PATTERN_EN =
  /\b(cancelled|cancel|called off|won't happen|not happening|no longer required|disregard|ignore previous|meeting off|skip today|not needed anymore)\b/i;

const CANCEL_PATTERN_HI =
  /\b(cancel ho gaya|cancel kar do|nahi hoga|rehne do|chhoddo|mat aao|band kar do|hone wala nahi)\b/i;

const STOP_WORDS = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'to',
  'for',
  'on',
  'at',
  'in',
  'of',
  'and',
  'or',
  'that',
]);

// Cancel verbs to remove from target phrase
const CANCEL_VERBS = new Set([
  'cancelled',
  'cancel',
  'called',
  'off',
  'postponed',
  'rescheduled',
  'moved',
  'meeting',
  'won',
  't',
  'happen',
  'not',
  'happening',
  'longer',
  'required',
  'disregard',
  'ignore',
  'previous',
  'skip',
  'today',
  'needed',
  'anymore',
  'ho',
  'gaya',
  'kar',
  'do',
  'nahi',
  'hoga',
  'rehne',
  'chhoddo',
  'mat',
  'aao',
  'band',
  'hone',
  'wala',
]);

function isCancellation(text: string): boolean {
  return CANCEL_PATTERN_EN.test(text) || CANCEL_PATTERN_HI.test(text);
}

function extractTargetTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w) && !CANCEL_VERBS.has(w));
}

function tokenizeTitle(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w));
}

function countSignificantOverlap(titleTokens: string[], targetTokens: string[]): number {
  const targetSet = new Set(targetTokens);
  return titleTokens.filter((t) => t.length > 2 && targetSet.has(t)).length;
}

export async function resolveCancellation(notification: NotificationData): Promise<boolean> {
  const latestMessage = (
    notification.bigText ||
    notification.text ||
    notification.title ||
    ''
  ).trim();

  if (!isCancellation(latestMessage)) return false;

  const targetTokens = extractTargetTokens(latestMessage);
  if (targetTokens.length === 0) return false;

  const cutoff = Date.now() - 86_400_000;

  let pendingTasks: Array<{ id: string; title: string }>;
  try {
    pendingTasks = (await db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(
        and(
          eq(tasks.sourceApp, notification.packageName),
          eq(tasks.sender, notification.title ?? ''),
          eq(tasks.status, 'PENDING'),
          isNull(tasks.deletedAt),
          gt(tasks.createdAt, cutoff)
        )
      )) as Array<{ id: string; title: string }>;
  } catch {
    return false;
  }

  if (pendingTasks.length === 0) return false;

  let matchedId: string | null = null;

  for (const task of pendingTasks) {
    const titleTokens = tokenizeTitle(task.title);
    const overlap = countSignificantOverlap(titleTokens, targetTokens);
    if (overlap >= 2) {
      matchedId = task.id;
      break;
    }
  }

  if (!matchedId) return false;

  try {
    await db
      .update(tasks)
      .set({ status: 'ARCHIVED', deletedAt: Date.now() })
      .where(eq(tasks.id, matchedId));
  } catch {
    return false;
  }

  return true;
}
