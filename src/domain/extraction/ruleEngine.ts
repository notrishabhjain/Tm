import type { Language } from '../types';

export type KeywordCategory =
  | 'IMPERATIVE'
  | 'URGENCY'
  | 'DEADLINE'
  | 'REQUEST'
  | 'ANTI_PATTERN'
  | 'DOMAIN';

export interface Keyword {
  phrase: string;
  category: KeywordCategory;
  language: Language | 'en';
  weight: number;
}

export interface KeywordMatch {
  phrase: string;
  category: KeywordCategory;
  weight: number;
}

export interface RuleEngineResult {
  score: number;
  matches: KeywordMatch[];
  hasImperative: boolean;
  hasUrgency: boolean;
  hasDeadline: boolean;
  hasAntiPattern: boolean;
  urgencyWeight: number;
  isDirectedRequest: boolean;
  hasImplicitRequest: boolean;
  hasPastTenseNarrative: boolean;
  hasNegation: boolean;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Sender is explicitly asking the reader to perform an action.
function detectDirectedRequest(text: string): boolean {
  // "can you / could you / will you / would you" + anything
  if (/\b(can you|could you|will you|would you|are you able to)\b/i.test(text)) return true;
  // "please <action-verb>" or "kindly <action-verb>"
  if (
    /\b(please|kindly)\s+(send|call|check|confirm|review|submit|share|update|provide|forward|schedule|book|arrange|complete|finish|sign|approve|prepare|create|make|get|bring|take|handle|fix|resolve|address|look|follow|reach|write|reply|respond|clarify|discuss|attend|join|inform|notify|connect|coordinate|help|assist|fill|return|collect|pay|transfer|upload|download|install|configure|setup|deploy|test|verify|validate|audit)\b/i.test(
      text
    )
  )
    return true;
  // Explicit "I need/want/would like you to …"
  if (/\b(i need you to|i want you to|i'?d like you to|i am asking you to)\b/i.test(text))
    return true;
  // Hinglish equivalents
  if (/\b(tum zara|aap zara|tumse request|aapse request)\b/i.test(text)) return true;
  return false;
}

// Message implies the reader must respond or take action, even without an explicit verb.
function detectImplicitRequest(text: string): boolean {
  if (
    /\b(let me know|waiting for your|pending your|awaiting your|following up|need your|requires your|needs your)\b/i.test(
      text
    )
  )
    return true;
  if (
    /\byour\s+(response|reply|approval|input|feedback|decision|confirmation|sign.?off|action|review)\b/i.test(
      text
    )
  )
    return true;
  return false;
}

// Sender is narrating a completed past action — not asking the reader to do anything.
function detectPastTenseNarrative(text: string): boolean {
  // "I / we [have] <past-tense-verb>"
  if (
    /\b(i|we)\b[^.!?]{0,25}\b(have\s+)?(sent|called|submitted|completed|finished|delivered|paid|told|informed|updated|shared|uploaded|posted|done|confirmed|approved|resolved|fixed|cancelled|scheduled|arranged|booked|handled|attached|forwarded)\b/i.test(
      text
    )
  )
    return true;
  // "already <past-tense-verb>"
  if (
    /\balready\s+(sent|done|completed|submitted|called|paid|shared|uploaded|delivered|confirmed|approved|resolved|fixed|handled|forwarded|attached)\b/i.test(
      text
    )
  )
    return true;
  return false;
}

// The required action is explicitly negated.
function detectNegation(text: string): boolean {
  if (
    /\b(no need to|don't worry|you don't need to|you do not need to|never mind|nevermind|disregard|not required|no longer needed|no longer necessary|ignore this|ignore that|false alarm|cancel that|forget it)\b/i.test(
      text
    )
  )
    return true;
  // Hinglish
  if (/\b(koi zaroorat nahi|mat karo|rehne do|chinta mat|bhool jao)\b/i.test(text)) return true;
  return false;
}

// Pure social pleasantry with no action content.
function detectSocialOnly(text: string, hasAction: boolean): boolean {
  if (hasAction) return false;
  return /\b(good (morning|afternoon|evening|night)|happy (birthday|anniversary|diwali|eid|holi|new year)|how are you|hope you.{0,10}well|miss you|thinking of you|take care|stay safe|god bless|well done|great work|good work|well played)\b/i.test(
    text
  );
}

export function runRuleEngine(
  normalized: string,
  wordCount: number,
  vocabulary: Keyword[]
): RuleEngineResult {
  const matches: KeywordMatch[] = [];
  let hasImperative = false;
  let hasUrgency = false;
  let hasDeadline = false;
  let hasAntiPattern = false;
  let urgencyWeight = 0;

  for (const entry of vocabulary) {
    const isLatinPhrase = /[a-zA-Z]/.test(entry.phrase);
    const pattern = isLatinPhrase
      ? new RegExp(`\\b${escapeRegex(entry.phrase)}\\b`, 'i')
      : new RegExp(escapeRegex(entry.phrase));

    if (pattern.test(normalized)) {
      matches.push({ phrase: entry.phrase, category: entry.category, weight: entry.weight });
      if (entry.category === 'IMPERATIVE') hasImperative = true;
      if (entry.category === 'URGENCY') {
        hasUrgency = true;
        urgencyWeight = Math.max(urgencyWeight, entry.weight);
      }
      if (entry.category === 'DEADLINE') hasDeadline = true;
      if (entry.category === 'ANTI_PATTERN') hasAntiPattern = true;
    }
  }

  const hasTwoPronoun = /\b(you|your|tumhara|tumhe|aap)\b/i.test(normalized);
  const hasAnyAction = hasImperative || hasUrgency || hasDeadline;

  const isDirectedRequest = detectDirectedRequest(normalized);
  const hasImplicitRequest = detectImplicitRequest(normalized);
  const hasPastTenseNarrative = detectPastTenseNarrative(normalized);
  const hasNegation = detectNegation(normalized);
  const hasSocialOnly = detectSocialOnly(normalized, hasAnyAction);

  let score = 0;

  // ── Positive keyword signals ──────────────────────────────────────────────
  if (hasImperative) score += 0.4;
  if (hasUrgency) score += 0.35;
  if (hasDeadline) score += 0.15;
  if (hasTwoPronoun) score += 0.15;
  if (wordCount >= 5 && wordCount <= 40) score += 0.1;

  // ── Sentence-structure bonuses ────────────────────────────────────────────
  // Explicit directed request ("can you send…", "please confirm…")
  if (isDirectedRequest) score += 0.2;
  // Implicit request without an action verb ("let me know", "awaiting your approval")
  if (hasImplicitRequest && !hasImperative) score += 0.25;

  // ── Penalties ─────────────────────────────────────────────────────────────
  if (hasAntiPattern && !hasImperative) score -= 0.25;
  if (wordCount < 3) score -= 0.1;
  // Sender narrating past action — not asking reader to act
  if (hasPastTenseNarrative && !hasImperative) score -= 0.15;
  // Action is explicitly negated ("no need to call", "never mind")
  if (hasNegation) score -= 0.3;
  // Pure social pleasantry with no action content
  if (hasSocialOnly) score -= 0.15;

  score = Math.max(0, Math.min(1, score));

  return {
    score,
    matches,
    hasImperative,
    hasUrgency,
    hasDeadline,
    hasAntiPattern,
    urgencyWeight,
    isDirectedRequest,
    hasImplicitRequest,
    hasPastTenseNarrative,
    hasNegation,
  };
}
