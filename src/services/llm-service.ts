/**
 * llama.rn wrappers for both on-device LLMs.
 *
 * Two contexts, mutually exclusive (RAM constraint):
 *   llamaCtxSmall — Qwen3-0.6B, fast notification classifier, stays loaded
 *   llamaCtxLarge — Qwen3-1.7B, rich extractor for screenshots/transcripts, on-demand
 *
 * Loading one automatically unloads the other.
 */

import { initLlama, type LlamaContext } from 'llama.rn';
import { getLlmModelPath, getSmallLlmModelPath } from './llm-manager';
import { logLlmLoad, logLlmInference } from './analytics-logger';
import type { Priority } from '@/domain/types';

// ── State ─────────────────────────────────────────────────────────────────────

let llamaCtxSmall: LlamaContext | null = null;
let llamaCtxLarge: LlamaContext | null = null;
let lastSmallLoadError: string | null = null;
let lastLargeLoadError: string | null = null;

// ── Status queries ────────────────────────────────────────────────────────────

export function isSmallLlmLoaded(): boolean {
  return llamaCtxSmall !== null;
}

export function isLlmLoaded(): boolean {
  return llamaCtxLarge !== null;
}

export function getSmallLlmLoadError(): string | null {
  return lastSmallLoadError;
}

export function getLlmLoadError(): string | null {
  return lastLargeLoadError;
}

// ── Small LLM (0.6B classifier) ───────────────────────────────────────────────

export async function loadSmallLlm(): Promise<boolean> {
  if (llamaCtxSmall) return true;
  // Free RAM: only one context can be loaded at a time
  if (llamaCtxLarge) await unloadLlm();
  lastSmallLoadError = null;
  const t0 = Date.now();
  try {
    const modelPath = getSmallLlmModelPath().replace(/^file:\/\//, '');
    llamaCtxSmall = await initLlama({
      model: modelPath,
      // n_ctx=768 → KV cache ~42 MB for Qwen3-0.6B (28L × 8KV heads × 64 head_dim)
      n_ctx: 768,
      n_threads: 4,
      n_batch: 64,
    });
    void logLlmLoad('qwen3-0.6b', Date.now() - t0);
    return true;
  } catch (err) {
    lastSmallLoadError = err instanceof Error ? err.message : String(err);
    llamaCtxSmall = null;
    return false;
  }
}

export async function unloadSmallLlm(): Promise<void> {
  if (llamaCtxSmall) {
    const ctx = llamaCtxSmall;
    llamaCtxSmall = null;
    try {
      await ctx.release();
    } catch {
      /* non-fatal */
    }
  }
}

// ── Large LLM (1.7B extractor) ────────────────────────────────────────────────

export async function loadLlm(): Promise<boolean> {
  if (llamaCtxLarge) return true;
  // Free RAM: only one context can be loaded at a time
  if (llamaCtxSmall) await unloadSmallLlm();
  lastLargeLoadError = null;
  const t0 = Date.now();
  try {
    const modelPath = getLlmModelPath().replace(/^file:\/\//, '');
    llamaCtxLarge = await initLlama({
      model: modelPath,
      // n_ctx=1024 → KV cache ~115 MB; covers screenshot inputs (~600 tok) + output
      n_ctx: 1024,
      n_threads: 4,
      n_batch: 128,
    });
    void logLlmLoad('qwen3-1.7b', Date.now() - t0);
    return true;
  } catch (err) {
    lastLargeLoadError = err instanceof Error ? err.message : String(err);
    llamaCtxLarge = null;
    return false;
  }
}

export async function unloadLlm(): Promise<void> {
  if (llamaCtxLarge) {
    const ctx = llamaCtxLarge;
    llamaCtxLarge = null;
    try {
      await ctx.release();
    } catch {
      /* non-fatal */
    }
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────

const STOP_TOKENS = ['<|im_end|>', '<|endoftext|>'];
const VALID_PRIORITIES = new Set<string>(['URGENT', 'HIGH', 'MEDIUM', 'LOW']);

function parsePriority(raw: unknown): Priority {
  return typeof raw === 'string' && VALID_PRIORITIES.has(raw) ? (raw as Priority) : 'MEDIUM';
}

function extractJson(raw: string): string {
  const noThink = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const start = noThink.search(/[{[]/);
  if (start === -1) return noThink;
  const opener = noThink[start];
  const closer = opener === '{' ? '}' : ']';
  const end = noThink.lastIndexOf(closer);
  if (end === -1) return noThink;
  return noThink.slice(start, end + 1);
}

function getRawText(result: unknown): string {
  if (typeof result !== 'object' || result === null) return '';
  const r = result as Record<string, unknown>;
  return String(r.content ?? r.text ?? '');
}

// ── Notification classification (small LLM) ───────────────────────────────────

export interface FewShotExample {
  appName: string;
  sender: string | null;
  text: string;
  decision: 'confirmed' | 'rejected';
  title: string | null;
}

export interface ClassifyResult {
  actionable: boolean;
  confidence: number;
  title: string | null;
  priority: Priority;
  durationMs: number;
}

function buildClassificationPrompt(examples: FewShotExample[]): string {
  const base =
    'You are a notification classifier. Decide if a notification requires the user to take action.\n\n' +
    'Output ONLY valid JSON with no explanation:\n' +
    '{"actionable":true,"confidence":0.85,"title":"Task title ≤80 chars","priority":"URGENT|HIGH|MEDIUM|LOW"}\n' +
    'or {"actionable":false,"confidence":0.9,"title":null,"priority":null}\n\n' +
    'Priority: URGENT=emergency/same-day deadline, HIGH=reply needed soon, MEDIUM=action needed, LOW=optional\n' +
    '/no_think';

  if (examples.length === 0) return base;

  const lines = examples.map((ex) => {
    const from = ex.sender ? ` From:${ex.sender}` : '';
    const head = `App:${ex.appName}${from} | "${ex.text.slice(0, 80)}"`;
    if (ex.decision === 'confirmed' && ex.title) {
      return `[TASK] ${head} → {"actionable":true,"title":"${ex.title.slice(0, 60)}"}`;
    }
    return `[SKIP] ${head} → {"actionable":false}`;
  });

  return `${base}\n\nRecent examples from this user:\n${lines.join('\n')}`;
}

/**
 * Classify a notification using the small LLM.
 * Returns null when the small LLM is not loaded or inference fails.
 * Falls back gracefully — callers should use the rule engine when null is returned.
 */
export async function classifyNotification(params: {
  text: string;
  appName: string;
  sender: string | null;
  examples: FewShotExample[];
}): Promise<ClassifyResult | null> {
  if (!llamaCtxSmall || !params.text.trim()) return null;

  const systemPrompt = buildClassificationPrompt(params.examples);
  const userMessage = `App:${params.appName}${params.sender ? ` | From:${params.sender}` : ''}\n${params.text.slice(0, 400)}`;

  const t0 = Date.now();
  try {
    const result = await llamaCtxSmall.completion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      n_predict: 80,
      temperature: 0.1,
      stop: STOP_TOKENS,
    });

    const durationMs = Date.now() - t0;
    const jsonStr = extractJson(getRawText(result));
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    const actionable = Boolean(parsed.actionable);
    const confidence =
      typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : actionable
          ? 0.75
          : 0.2;
    const title =
      actionable && typeof parsed.title === 'string' ? parsed.title.slice(0, 80).trim() : null;
    const priority = actionable ? parsePriority(parsed.priority) : 'LOW';

    // Fire-and-forget metric logging
    const decision: 'CREATE' | 'CONFIRM' | 'DISCARD' = !actionable
      ? 'DISCARD'
      : confidence >= 0.75
        ? 'CREATE'
        : confidence >= 0.35
          ? 'CONFIRM'
          : 'DISCARD';
    void logLlmInference({
      modelId: 'qwen3-0.6b',
      durationMs,
      decision,
      confidence,
      inputLength: params.text.length,
    });

    return { actionable, confidence, title, priority, durationMs };
  } catch {
    return null;
  }
}

// ── Screenshot / transcript extraction (large LLM) ────────────────────────────

const TASK_SYSTEM_PROMPT =
  'You are a task extraction assistant. Given text from a phone screen or message, ' +
  'extract the single most actionable task. Respond with ONLY a valid JSON object — ' +
  'no markdown fences, no explanation. ' +
  'JSON keys: "title" (string ≤120 chars), "priority" (one of URGENT HIGH MEDIUM LOW), ' +
  '"dueDate" (ISO 8601 date string or null). /no_think';

const TRANSCRIPT_SYSTEM_PROMPT =
  'You are a task extraction assistant. Given a meeting transcript or long text, ' +
  'extract ALL actionable tasks. Respond with ONLY a valid JSON array — ' +
  'no markdown fences, no explanation. ' +
  'Each element: {"title": string ≤120 chars, "priority": URGENT|HIGH|MEDIUM|LOW}. ' +
  'Maximum 20 items. /no_think';

export interface LlmTaskResult {
  title: string;
  priority: Priority;
  /** Unix timestamp (ms) or null if no due date detected. */
  dueDate: number | null;
}

export async function extractTaskFromText(text: string): Promise<LlmTaskResult | null> {
  if (!llamaCtxLarge || !text.trim()) return null;
  try {
    const t0 = Date.now();
    const result = await llamaCtxLarge.completion({
      messages: [
        { role: 'system', content: TASK_SYSTEM_PROMPT },
        { role: 'user', content: `Extract the main task from:\n\n${text.slice(0, 2000)}` },
      ],
      n_predict: 200,
      temperature: 0.1,
      stop: STOP_TOKENS,
    });

    void logLlmInference({
      modelId: 'qwen3-1.7b',
      durationMs: Date.now() - t0,
      decision: 'CREATE',
      confidence: 0.92,
      inputLength: text.length,
    });

    const jsonStr = extractJson(getRawText(result));
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    const title = String(parsed.title ?? '')
      .slice(0, 120)
      .trim();
    if (!title) return null;

    let dueDate: number | null = null;
    if (typeof parsed.dueDate === 'string' && parsed.dueDate) {
      const ts = Date.parse(parsed.dueDate);
      if (!isNaN(ts)) dueDate = ts;
    }
    return { title, priority: parsePriority(parsed.priority), dueDate };
  } catch {
    return null;
  }
}

export async function extractTasksFromTranscript(
  text: string
): Promise<Array<{ title: string; priority: Priority }>> {
  if (!llamaCtxLarge || !text.trim()) return [];
  try {
    const result = await llamaCtxLarge.completion({
      messages: [
        { role: 'system', content: TRANSCRIPT_SYSTEM_PROMPT },
        // Cap at 2500 chars — beyond that risks exceeding n_ctx=1024 on the large model
        { role: 'user', content: `Extract all actionable tasks from:\n\n${text.slice(0, 2500)}` },
      ],
      n_predict: 800,
      temperature: 0.1,
      stop: STOP_TOKENS,
    });

    const jsonStr = extractJson(getRawText(result));
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .slice(0, 20)
      .map((item: Record<string, unknown>) => ({
        title: String(item.title ?? '')
          .slice(0, 120)
          .trim(),
        priority: parsePriority(item.priority),
      }))
      .filter((t) => t.title.length > 0);
  } catch {
    return [];
  }
}
