import type { DailyLog, DailyLogInput, LearningResource, ResourceInput } from '../daily-log';
import type { DropdownOption, Keyword, OptionKind, Platform, RunRow } from '../pipeline/types';

/** Kolom keyword yang isinya berasal dari dropdown. */
export type KeywordOptionField =
  | 'keyword_status'
  | 'category'
  | 'role'
  | 'audience'
  | 'copywriter'
  | 'status_awal'
  | 'feedback'
  | 'status_akhir';

export type NewKeyword = Pick<Keyword, 'platform_id' | 'keyword'> &
  Partial<Pick<Keyword, 'category' | 'role' | 'audience' | 'volume' | 'schedule_date' | 'keyword_status'>>;

export type KeywordSummary = Pick<Keyword, 'id' | 'platform_id' | 'keyword' | 'status' | 'updated_at'>;

export type RunSummary = Pick<
  RunRow,
  'id' | 'keyword_id' | 'platform_id' | 'status' | 'current_step' | 'error' | 'started_at' | 'finished_at'
>;

export type NewRun = Partial<RunRow> & { keyword_id: string; platform_id: string; started_by: string };

export type NewOption = Pick<DropdownOption, 'kind' | 'platform_id' | 'value' | 'color'>;

export interface Db {
  mode: 'local' | 'supabase';
  listPlatforms(opts?: { activeOnly?: boolean }): Promise<Platform[]>;
  getPlatform(id: string): Promise<Platform | null>;
  updatePlatform(id: string, patch: Partial<Platform>): Promise<void>;

  listKeywords(opts?: { platformId?: string; status?: string; limit?: number }): Promise<Keyword[]>;
  keywordSummaries(): Promise<KeywordSummary[]>;
  getKeyword(id: string): Promise<Keyword | null>;
  createKeyword(row: NewKeyword): Promise<void>;
  updateKeyword(id: string, patch: Partial<Keyword>): Promise<void>;
  deleteKeyword(id: string): Promise<void>;
  /** Kunci atomik: null bila keyword sedang diproses / sudah generated. */
  claimKeyword(id: string): Promise<Keyword | null>;

  listRuns(keywordId: string): Promise<RunRow[]>;
  runSummaries(opts?: { since?: string; limit?: number }): Promise<RunSummary[]>;
  latestFailedRun(keywordId: string): Promise<RunRow | null>;
  failStaleRuns(keywordId: string): Promise<void>;
  createRun(row: NewRun): Promise<RunRow>;
  updateRun(id: string, patch: Partial<RunRow>): Promise<void>;

  listOptions(): Promise<DropdownOption[]>;
  addOption(option: NewOption): Promise<void>;
  deleteOption(id: string): Promise<void>;
  /** Ganti seluruh pilihan satu jenis dropdown (urutan = urutan array). Baris tanpa id = baru. */
  replaceOptions(kind: OptionKind, rows: (NewOption & { id?: string })[]): Promise<void>;
  /** Ikut ganti nilai di keyword saat pilihan dropdown di-rename. platformId null = semua platform. */
  renameKeywordValues(field: KeywordOptionField, from: string, to: string, platformId: string | null): Promise<void>;

  /** Log Harian satu orang, terbaru dulu. */
  listDailyLogs(userId: string): Promise<DailyLog[]>;
  getDailyLog(id: string): Promise<DailyLog | null>;
  getDailyLogByDate(userId: string, date: string): Promise<DailyLog | null>;
  /** Tanpa id = log baru. Satu orang hanya punya satu log per tanggal. */
  saveDailyLog(userId: string, input: DailyLogInput, id?: string): Promise<void>;
  deleteDailyLog(id: string): Promise<void>;

  /** Bahan belajar satu orang (tab Bahan Belajar di Log Harian). */
  listResources(userId: string): Promise<LearningResource[]>;
  getResource(id: string): Promise<LearningResource | null>;
  saveResource(userId: string, input: ResourceInput, id?: string): Promise<void>;
  deleteResource(id: string): Promise<void>;
}
