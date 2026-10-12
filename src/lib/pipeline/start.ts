import 'server-only';
import { after } from 'next/server';
import { getDb } from '../db';
import { openaiChat } from './providers/openai';
import { perplexityResearch } from './providers/perplexity';
import { createDraftPost, listCategories } from './providers/wordpress';
import { executeRun } from './run';
import type { RunRow } from './types';

// Kolom hasil yang boleh dipakai ulang saat "lanjutkan run gagal".
const REUSABLE = ['category_id', 'research', 'draft', 'html', 'title', 'slug', 'meta', 'wp_post_id'] as const;

export async function startRun(keywordId: string, userId: string, { resume = false } = {}) {
  const db = getDb();

  const keyword = await db.claimKeyword(keywordId);
  if (!keyword) throw new Error('Hanya keyword berstatus Ready yang bisa digenerate (atau sedang diproses / sudah Done)');

  try {
    // Run lama yang macet (server restart) ditutup dulu.
    await db.failStaleRuns(keywordId);

    const platform = await db.getPlatform(keyword.platform_id);
    if (!platform) throw new Error(`Platform ${keyword.platform_id} tidak ditemukan`);

    let carried: Partial<RunRow> = {};
    if (resume) {
      const previous = await db.latestFailedRun(keywordId);
      if (previous) carried = Object.fromEntries(REUSABLE.map((k) => [k, previous[k] ?? null]));
    }

    const run = await db.createRun({
      ...carried,
      keyword_id: keywordId,
      platform_id: keyword.platform_id,
      started_by: userId,
    });

    after(() =>
      executeRun(run, keyword, platform, {
        research: perplexityResearch,
        chat: openaiChat,
        listCategories,
        createDraftPost,
        saveRun: (id, patch) => db.updateRun(id, patch),
        saveKeyword: (id, patch) => db.updateKeyword(id, patch),
      }),
    );

    return run.id;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.updateKeyword(keywordId, { status: 'error', last_error: message });
    throw error;
  }
}
