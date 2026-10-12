import 'server-only';
import { randomUUID } from 'node:crypto';
import type { DropdownOption, Keyword, Platform, RunRow } from '../pipeline/types';
import { createAdminClient } from '../supabase/admin';
import type { Db, KeywordSummary, RunSummary } from './types';

const RUN_SUMMARY_COLUMNS =
  'id, keyword_id, platform_id, status, current_step, error, started_at, finished_at';

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

// Akses ke Supabase lewat service role; hak akses user dicek di requireUser.
export function supabaseDb(): Db {
  const db = createAdminClient();
  return {
    mode: 'supabase',

    async listPlatforms({ activeOnly = false } = {}) {
      let query = db.from('platforms').select('*').order('sort_order');
      if (activeOnly) query = query.eq('active', true);
      return check(await query.returns<Platform[]>()) ?? [];
    },
    async getPlatform(id) {
      return check(await db.from('platforms').select('*').eq('id', id).maybeSingle<Platform>());
    },
    async updatePlatform(id, patch) {
      check(await db.from('platforms').update(patch).eq('id', id));
    },

    async listKeywords({ platformId, status, limit = 300 } = {}) {
      let query = db.from('keywords').select('*').order('created_at', { ascending: false }).limit(limit);
      if (platformId) query = query.eq('platform_id', platformId);
      if (status) query = query.eq('status', status);
      return check(await query.returns<Keyword[]>()) ?? [];
    },
    async keywordSummaries() {
      return (
        check(
          await db
            .from('keywords')
            .select('id, platform_id, keyword, status, updated_at')
            .range(0, 9999)
            .returns<KeywordSummary[]>(),
        ) ?? []
      );
    },
    async getKeyword(id) {
      return check(await db.from('keywords').select('*').eq('id', id).maybeSingle<Keyword>());
    },
    async createKeyword(row) {
      check(await db.from('keywords').insert(row));
    },
    async updateKeyword(id, patch) {
      check(await db.from('keywords').update(patch).eq('id', id));
    },
    async deleteKeyword(id) {
      check(await db.from('keywords').delete().eq('id', id));
    },
    async claimKeyword(id) {
      const rows = check(await db.rpc('claim_keyword', { p_keyword_id: id })) as Keyword[] | null;
      return rows?.[0] ?? null;
    },

    async listRuns(keywordId) {
      return (
        check(
          await db
            .from('pipeline_runs')
            .select('*')
            .eq('keyword_id', keywordId)
            .order('started_at', { ascending: false })
            .returns<RunRow[]>(),
        ) ?? []
      );
    },
    async runSummaries({ since, limit = 1000 } = {}) {
      let query = db
        .from('pipeline_runs')
        .select(RUN_SUMMARY_COLUMNS)
        .order('started_at', { ascending: false })
        .limit(limit);
      if (since) query = query.gte('started_at', since);
      return check(await query.returns<RunSummary[]>()) ?? [];
    },
    async latestFailedRun(keywordId) {
      return check(
        await db
          .from('pipeline_runs')
          .select('*')
          .eq('keyword_id', keywordId)
          .eq('status', 'error')
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle<RunRow>(),
      );
    },
    async failStaleRuns(keywordId) {
      check(
        await db
          .from('pipeline_runs')
          .update({ status: 'error', error: 'Terputus (server restart)', finished_at: new Date().toISOString() })
          .eq('keyword_id', keywordId)
          .eq('status', 'running'),
      );
    },
    async createRun(row) {
      const run = check(await db.from('pipeline_runs').insert(row).select('*').single<RunRow>());
      if (!run) throw new Error('Gagal membuat run');
      return run;
    },
    async updateRun(id, patch) {
      check(await db.from('pipeline_runs').update(patch).eq('id', id));
    },

    async listOptions() {
      return (
        check(
          await db
            .from('dropdown_options')
            .select('id, kind, platform_id, value, color, sort_order')
            .order('sort_order')
            .order('created_at')
            .returns<DropdownOption[]>(),
        ) ?? []
      );
    },
    async addOption(option) {
      const { count } = await db
        .from('dropdown_options')
        .select('id', { count: 'exact', head: true })
        .eq('kind', option.kind);
      check(await db.from('dropdown_options').insert({ ...option, sort_order: (count ?? 0) + 1 }));
    },
    async deleteOption(id) {
      check(await db.from('dropdown_options').delete().eq('id', id));
    },
    async replaceOptions(kind, rows) {
      const keepIds = rows.flatMap((r) => (r.id ? [r.id] : []));
      let remove = db.from('dropdown_options').delete().eq('kind', kind);
      if (keepIds.length) remove = remove.not('id', 'in', `(${keepIds.join(',')})`);
      check(await remove);
      // Semua baris diberi id agar upsert massal punya kolom yang seragam.
      const payload = rows.map((r, i) => ({
        id: r.id ?? randomUUID(),
        kind,
        platform_id: r.platform_id,
        value: r.value,
        color: r.color,
        sort_order: i + 1,
      }));
      if (payload.length) check(await db.from('dropdown_options').upsert(payload));
    },
    async renameKeywordValues(field, from, to, platformId) {
      let query = db.from('keywords').update({ [field]: to }).eq(field, from);
      if (platformId) query = query.eq('platform_id', platformId);
      check(await query);
    },
  };
}
