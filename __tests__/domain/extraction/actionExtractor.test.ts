import { extractTaskText } from '../../../src/domain/extraction/actionExtractor';

describe('extractTaskText', () => {
  it('returns first meaningful sentence (≤120 chars)', () => {
    const result = extractTaskText('Please send the report. Thanks.');
    expect(result).toBe('Please send the report');
  });

  it('truncates a long first sentence to 120 chars', () => {
    const long = 'a'.repeat(130);
    const result = extractTaskText(long);
    expect(result).toBe(`${'a'.repeat(117)}...`);
  });

  it('falls back to raw text when no sentence part is long enough', () => {
    // All parts are short (≤10 chars) so firstMeaningful is undefined
    const result = extractTaskText('ok.yes.no');
    expect(result).toBe('ok.yes.no');
  });

  it('truncates raw fallback text when it exceeds 120 chars', () => {
    // Single run-on with no sentence-ending punctuation, > 120 chars but first part ≤ 10
    const short = 'ok';
    const long = 'b'.repeat(130);
    const result = extractTaskText(`${short}.${long}`);
    // first part 'ok' (2 chars) ≤ 10, second part 'bbbb...' (130 chars) > 10 → truncated
    expect(result).toBe(`${'b'.repeat(117)}...`);
  });
});
