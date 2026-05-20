import { runRuleEngine, type Keyword } from '../../../src/domain/extraction/ruleEngine';

const VOCAB: Keyword[] = [
  { phrase: 'send', category: 'IMPERATIVE', language: 'EN', weight: 1.0 },
  { phrase: 'call', category: 'IMPERATIVE', language: 'EN', weight: 1.0 },
  { phrase: 'urgent', category: 'URGENCY', language: 'EN', weight: 1.5 },
  { phrase: 'by tomorrow', category: 'DEADLINE', language: 'EN', weight: 1.0 },
  { phrase: 'lol', category: 'ANTI_PATTERN', language: 'EN', weight: 1.0 },
  { phrase: 'bhej', category: 'IMPERATIVE', language: 'HI-EN', weight: 1.0 },
  { phrase: 'kal tak', category: 'DEADLINE', language: 'HI-EN', weight: 1.0 },
];

describe('runRuleEngine — keyword matching', () => {
  it('matches imperative keyword', () => {
    const result = runRuleEngine('please send the file', 4, VOCAB);
    expect(result.hasImperative).toBe(true);
    expect(result.matches.some((m) => m.phrase === 'send')).toBe(true);
  });

  it('matches urgency keyword', () => {
    const result = runRuleEngine('this is urgent please respond', 5, VOCAB);
    expect(result.hasUrgency).toBe(true);
  });

  it('matches deadline', () => {
    const result = runRuleEngine('finish the report by tomorrow', 5, VOCAB);
    expect(result.hasDeadline).toBe(true);
  });

  it('detects anti-pattern', () => {
    const result = runRuleEngine('lol that was funny', 4, VOCAB);
    expect(result.hasAntiPattern).toBe(true);
  });

  it('penalizes anti-pattern without imperative', () => {
    const result = runRuleEngine('lol', 1, VOCAB);
    // anti-pattern(-0.25) + short(<3 words, -0.1) = -0.35 → clamped to 0
    expect(result.score).toBe(0);
  });

  it('gives high score for imperative + deadline + pronoun', () => {
    const result = runRuleEngine('can you send the report by tomorrow please', 8, VOCAB);
    expect(result.score).toBeGreaterThan(0.6);
  });

  it('handles Hinglish keywords', () => {
    const result = runRuleEngine('kal tak report bhej dena', 5, VOCAB);
    expect(result.hasImperative).toBe(true);
    expect(result.hasDeadline).toBe(true);
  });

  it('penalizes very short text', () => {
    const result = runRuleEngine('ok', 1, VOCAB);
    expect(result.score).toBeLessThan(0.3);
  });

  it('returns score between 0 and 1', () => {
    const texts = [
      'send report urgent by tomorrow please you',
      'lol ok haha',
      'kal tak bhej dena urgent please review this document carefully',
    ];
    for (const text of texts) {
      const result = runRuleEngine(text, text.split(' ').length, VOCAB);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(1);
    }
  });
});

describe('runRuleEngine — directed request detection', () => {
  it('detects "can you" pattern and boosts score', () => {
    const result = runRuleEngine('can you send this file', 5, VOCAB);
    expect(result.isDirectedRequest).toBe(true);
    // imperative(0.4) + directed(0.2) + pronoun(0.15) + length(0.1) = 0.85
    expect(result.score).toBeGreaterThan(0.7);
  });

  it('detects "could you" pattern', () => {
    const result = runRuleEngine('could you please confirm', 4, VOCAB);
    expect(result.isDirectedRequest).toBe(true);
  });

  it('detects "please <verb>" pattern', () => {
    const result = runRuleEngine('please call me back', 4, VOCAB);
    expect(result.isDirectedRequest).toBe(true);
  });

  it('does not flag general statements as directed requests', () => {
    const result = runRuleEngine('the report was sent yesterday', 5, VOCAB);
    expect(result.isDirectedRequest).toBe(false);
  });
});

describe('runRuleEngine — implicit request detection', () => {
  it('detects "let me know" as implicit request', () => {
    const result = runRuleEngine('let me know when you are free', 7, VOCAB);
    expect(result.hasImplicitRequest).toBe(true);
    // implicit(!hasImperative: +0.25) + pronoun(+0.15) + length(+0.1) = 0.50 → CONFIRM range
    expect(result.score).toBeGreaterThanOrEqual(0.4);
  });

  it('detects "waiting for your response" as implicit request', () => {
    const result = runRuleEngine('waiting for your response on the proposal', 7, VOCAB);
    expect(result.hasImplicitRequest).toBe(true);
  });

  it('detects "pending your approval" as implicit request', () => {
    const result = runRuleEngine('pending your approval', 3, VOCAB);
    expect(result.hasImplicitRequest).toBe(true);
  });

  it('implicit request does not apply bonus when imperative already present', () => {
    const withImperative = runRuleEngine('send me the file and let me know', 8, VOCAB);
    const withoutImperative = runRuleEngine('let me know when done', 5, VOCAB);
    // imperative path skips the +0.25 implicit bonus
    expect(withImperative.hasImperative).toBe(true);
    expect(withoutImperative.hasImperative).toBe(false);
    expect(withoutImperative.hasImplicitRequest).toBe(true);
  });
});

describe('runRuleEngine — past-tense narrative penalty', () => {
  it('penalizes "I sent" narrative', () => {
    const narrative = runRuleEngine('i sent you the document', 5, VOCAB);
    expect(narrative.hasPastTenseNarrative).toBe(true);
    // no imperative, past-tense penalty applies
    expect(narrative.score).toBeLessThan(0.4);
  });

  it('penalizes "I have already submitted" narrative', () => {
    const result = runRuleEngine('i have already submitted the form', 6, VOCAB);
    expect(result.hasPastTenseNarrative).toBe(true);
  });

  it('does not penalize when imperative is also present', () => {
    // "I called but please send the docs" — past narrative but there IS an imperative
    const result = runRuleEngine('i called already please send the docs', 7, VOCAB);
    expect(result.hasPastTenseNarrative).toBe(true);
    expect(result.hasImperative).toBe(true);
    // penalty skipped since hasImperative → score still high
    expect(result.score).toBeGreaterThan(0.4);
  });

  it('does not penalize future intent', () => {
    const result = runRuleEngine('i will send you the file tomorrow', 7, VOCAB);
    expect(result.hasPastTenseNarrative).toBe(false);
  });
});

describe('runRuleEngine — negation penalty', () => {
  it('penalizes "no need to call"', () => {
    const result = runRuleEngine('no need to call back', 5, VOCAB);
    expect(result.hasNegation).toBe(true);
    // call(+0.40) + negation(-0.30) = 0.10 → DISCARD
    expect(result.score).toBeLessThan(0.4);
  });

  it('penalizes "never mind"', () => {
    const result = runRuleEngine('never mind about sending it', 5, VOCAB);
    expect(result.hasNegation).toBe(true);
  });

  it('penalizes "no need to" even with urgency keyword', () => {
    const result = runRuleEngine('urgent but no need to send anything now', 8, VOCAB);
    expect(result.hasNegation).toBe(true);
    // urgency(+0.35) + imperative(+0.4) - negation(-0.30) = 0.45... still CONFIRM
    // but with negation it should be lower than without
    const withoutNegation = runRuleEngine('urgent please send right away', 5, VOCAB);
    expect(result.score).toBeLessThan(withoutNegation.score);
  });
});

describe('runRuleEngine — social pleasantry penalty', () => {
  it('penalizes good morning without action', () => {
    const result = runRuleEngine('good morning hope you have a great day', 8, VOCAB);
    expect(result.score).toBeLessThan(0.3);
  });

  it('does not penalize social phrase when action keyword also present', () => {
    const result = runRuleEngine('good morning please send the report by tomorrow', 8, VOCAB);
    // has imperative + deadline → hasSocialOnly=false (action present)
    expect(result.score).toBeGreaterThan(0.4);
  });
});
