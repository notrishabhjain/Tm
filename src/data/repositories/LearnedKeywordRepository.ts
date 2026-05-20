import { eq, and, desc } from 'drizzle-orm';
import type { Database } from '../db/client';
import { learnedKeywords } from '../db/schema';

export interface LearnedKeyword {
  id: number;
  ngram: string;
  weight: number;
  language: string;
  occurrenceCount: number;
  status: 'PENDING' | 'ACTIVE' | 'DEMOTED';
  createdAt: number;
  updatedAt: number;
}

function mapRow(row: typeof learnedKeywords.$inferSelect): LearnedKeyword {
  return {
    id: row.id,
    ngram: row.ngram,
    weight: row.weight,
    language: row.language,
    occurrenceCount: row.occurrenceCount,
    status: row.status as LearnedKeyword['status'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const PROMOTION_THRESHOLD = 3;

export class LearnedKeywordRepository {
  constructor(private readonly db: Database) {}

  async recordNgrams(ngrams: string[], language: string): Promise<void> {
    const now = Date.now();
    for (const ngram of ngrams) {
      const existing = await this.db
        .select()
        .from(learnedKeywords)
        .where(and(eq(learnedKeywords.ngram, ngram), eq(learnedKeywords.language, language)))
        .limit(1);

      if (existing[0]) {
        const newCount = existing[0].occurrenceCount + 1;
        const newStatus =
          existing[0].status === 'DEMOTED'
            ? 'DEMOTED'
            : newCount >= PROMOTION_THRESHOLD
              ? 'ACTIVE'
              : 'PENDING';
        await this.db
          .update(learnedKeywords)
          .set({ occurrenceCount: newCount, status: newStatus, updatedAt: now })
          .where(eq(learnedKeywords.id, existing[0].id));
      } else {
        await this.db.insert(learnedKeywords).values({
          ngram,
          language,
          weight: 0.5,
          occurrenceCount: 1,
          status: 'PENDING',
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }

  async getAll(): Promise<LearnedKeyword[]> {
    const rows = await this.db
      .select()
      .from(learnedKeywords)
      .orderBy(desc(learnedKeywords.occurrenceCount));
    return rows.map(mapRow);
  }

  async getActive(): Promise<LearnedKeyword[]> {
    const rows = await this.db
      .select()
      .from(learnedKeywords)
      .where(eq(learnedKeywords.status, 'ACTIVE'))
      .orderBy(desc(learnedKeywords.occurrenceCount));
    return rows.map(mapRow);
  }

  async setStatus(id: number, status: LearnedKeyword['status']): Promise<void> {
    await this.db
      .update(learnedKeywords)
      .set({ status, updatedAt: Date.now() })
      .where(eq(learnedKeywords.id, id));
  }

  async remove(id: number): Promise<void> {
    await this.db.delete(learnedKeywords).where(eq(learnedKeywords.id, id));
  }

  async count(): Promise<number> {
    return this.db.$count(learnedKeywords);
  }
}
