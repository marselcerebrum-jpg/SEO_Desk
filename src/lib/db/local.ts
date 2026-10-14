import 'server-only';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  DropdownOption,
  Keyword,
  OptionColor,
  OptionKind,
  Platform,
  RunRow,
  StepLog,
  StepName,
} from '../pipeline/types';
import { normalizeLog, type DailyLog, type LearningResource } from '../daily-log';
import { DATA_DIR } from '../settings';
import { seedPlatforms } from './platform-seed';
import type { Db } from './types';

// Mode lokal: dipakai selama Supabase belum dihubungkan di menu Konfigurasi.
// Semua operasi file sinkron, jadi tidak ada tulis-baca yang saling menimpa di satu proses Node.
const DB_FILE = path.join(DATA_DIR, 'local-db.json');
const VERSION = 5;

type LocalData = {
  version: number;
  platforms: Platform[];
  keywords: Keyword[];
  runs: RunRow[];
  options: DropdownOption[];
  logs: DailyLog[];
  resources: LearningResource[];
};

const KEYWORD_DEFAULTS = {
  copywriter: null,
  posted_at: null,
  posted_url: null,
  qc: {},
  status_awal: null,
  note_awal: null,
  feedback: null,
  status_akhir: null,
  note_akhir: null,
} satisfies Partial<Keyword>;

// Sama dengan supabase/seed.sql.
function seedOptions(): DropdownOption[] {
  const rows: [OptionKind, string | null, string, OptionColor][] = [
    ['status_keyword', null, 'Trending', 'coklat'],
    ['status_keyword', null, 'Evergreen', 'hijau'],
    ['category', 'JadiASN', 'Informasi CPNS', 'hijau'],
    ['role', 'JadiASN', 'ASN Berpengalaman (Sharing Dunia Kerja & Realita PNS)', 'netral'],
    ['audience', 'JadiASN', 'Fresh Graduate yang Baru Memulai Persiapan CPNS', 'netral'],
    ['copywriter', null, 'Jian', 'pink'],
    ['status_awal', null, 'Done', 'kuning'],
    ['status_akhir', null, 'Done', 'kuning'],
  ];
  return rows.map(([kind, platform_id, value, color], i) => ({
    id: randomUUID(),
    kind,
    platform_id,
    value,
    color,
    sort_order: i + 1,
  }));
}

function load(): LocalData {
  let data: LocalData | null = null;
  try {
    data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as LocalData;
  } catch {
    // belum ada file
  }
  if (data?.version === VERSION) return data;
  if (data?.version === 4) {
    // v4 -> v5: Bahan Belajar.
    data = { ...data, version: VERSION, resources: [] };
  } else if (data?.version === 3) {
    // v3 -> v4: Log Harian.
    data = { ...data, version: VERSION, logs: [], resources: [] };
  } else if (data?.version === 2) {
    // v2 -> v3: kolom copywriter/QC + dropdown. Konfigurasi platform tetap.
    data = {
      ...data,
      version: VERSION,
      keywords: data.keywords.map((k) => ({ ...KEYWORD_DEFAULTS, ...k })),
      options: seedOptions(),
      logs: [],
      resources: [],
    };
  } else {
    // File belum ada atau format sangat lama: mulai dari data contoh.
    data = demoData();
  }
  persist(data);
  return data;
}

function persist(data: LocalData) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

function mutate<T>(fn: (data: LocalData) => T): T {
  const data = load();
  const result = fn(data);
  persist(data);
  return result;
}

const now = () => new Date().toISOString();
const byNewest = <T extends { created_at?: string; started_at?: string }>(a: T, b: T) =>
  (b.created_at ?? b.started_at ?? '').localeCompare(a.created_at ?? a.started_at ?? '');

// Keyword & run diganti; konfigurasi platform (prompt, domain) dan Log Harian tetap.
export function resetLocalData(withDemo: boolean) {
  const { platforms, options, logs, resources } = load();
  const fresh = withDemo ? demoData() : { version: VERSION, platforms, keywords: [], runs: [], options, logs, resources };
  persist({ ...fresh, platforms, options, logs, resources });
}

export function localDb(): Db {
  return {
    mode: 'local',

    async listPlatforms({ activeOnly = false } = {}) {
      return load()
        .platforms.filter((p) => !activeOnly || p.active)
        .sort((a, b) => a.sort_order - b.sort_order);
    },
    async getPlatform(id) {
      return load().platforms.find((p) => p.id === id) ?? null;
    },
    async updatePlatform(id, patch) {
      mutate((d) => {
        const platform = d.platforms.find((p) => p.id === id);
        if (platform) Object.assign(platform, patch);
      });
    },

    async listKeywords({ platformId, status, limit = 300 } = {}) {
      return load()
        .keywords.filter((k) => (!platformId || k.platform_id === platformId) && (!status || k.status === status))
        .sort(byNewest)
        .slice(0, limit);
    },
    async keywordSummaries() {
      return load().keywords.map(({ id, platform_id, keyword, status, updated_at }) => ({
        id,
        platform_id,
        keyword,
        status,
        updated_at,
      }));
    },
    async getKeyword(id) {
      return load().keywords.find((k) => k.id === id) ?? null;
    },
    async createKeyword(row) {
      mutate((d) => {
        d.keywords.push({
          category: '',
          role: '',
          audience: '',
          volume: null,
          schedule_date: null,
          keyword_status: null,
          ...KEYWORD_DEFAULTS,
          ...row,
          id: randomUUID(),
          status: 'draft',
          title: null,
          slug: null,
          meta: null,
          wp_post_id: null,
          wp_edit_url: null,
          last_error: null,
          created_at: now(),
          updated_at: now(),
        });
      });
    },
    async updateKeyword(id, patch) {
      mutate((d) => {
        const keyword = d.keywords.find((k) => k.id === id);
        if (keyword) Object.assign(keyword, patch, { updated_at: now() });
      });
    },
    async deleteKeyword(id) {
      mutate((d) => {
        d.keywords = d.keywords.filter((k) => k.id !== id);
        d.runs = d.runs.filter((r) => r.keyword_id !== id);
      });
    },
    async claimKeyword(id) {
      return mutate((d) => {
        const keyword = d.keywords.find((k) => k.id === id);
        if (!keyword) return null;
        const stale = keyword.status === 'processing' && Date.now() - Date.parse(keyword.updated_at) > 20 * 60_000;
        // Hanya Ready (atau Error untuk dilanjutkan) yang boleh digenerate.
        if (!['ready', 'error'].includes(keyword.status) && !stale) return null;
        Object.assign(keyword, { status: 'processing', last_error: null, updated_at: now() });
        return { ...keyword };
      });
    },

    async listRuns(keywordId) {
      return load()
        .runs.filter((r) => r.keyword_id === keywordId)
        .sort(byNewest);
    },
    async runSummaries({ since, limit = 1000 } = {}) {
      return load()
        .runs.filter((r) => !since || r.started_at >= since)
        .sort(byNewest)
        .slice(0, limit);
    },
    async latestFailedRun(keywordId) {
      return (
        load()
          .runs.filter((r) => r.keyword_id === keywordId && r.status === 'error')
          .sort(byNewest)[0] ?? null
      );
    },
    async failStaleRuns(keywordId) {
      mutate((d) => {
        for (const run of d.runs) {
          if (run.keyword_id === keywordId && run.status === 'running') {
            Object.assign(run, { status: 'error', error: 'Terputus (server restart)', finished_at: now() });
          }
        }
      });
    },
    async createRun(row) {
      return mutate((d) => {
        const run: RunRow = {
          id: randomUUID(),
          status: 'running',
          current_step: null,
          steps: [],
          category_id: null,
          research: null,
          draft: null,
          html: null,
          title: null,
          slug: null,
          meta: null,
          content: null,
          wp_post_id: null,
          error: null,
          started_at: now(),
          finished_at: null,
          ...row,
        };
        d.runs.push(run);
        return run;
      });
    },
    async updateRun(id, patch) {
      mutate((d) => {
        const run = d.runs.find((r) => r.id === id);
        if (run) Object.assign(run, patch);
      });
    },

    async listOptions() {
      return [...load().options].sort((a, b) => a.sort_order - b.sort_order);
    },
    async addOption(option) {
      mutate((d) => {
        const order = d.options.filter((o) => o.kind === option.kind).length + 1;
        d.options.push({ ...option, id: randomUUID(), sort_order: order });
      });
    },
    async deleteOption(id) {
      mutate((d) => {
        d.options = d.options.filter((o) => o.id !== id);
      });
    },
    async replaceOptions(kind, rows) {
      mutate((d) => {
        const kept = d.options.filter((o) => o.kind !== kind);
        const next = rows.map((r, i) => ({ ...r, id: r.id ?? randomUUID(), kind, sort_order: i + 1 }));
        d.options = [...kept, ...next];
      });
    },
    async renameKeywordValues(field, from, to, platformId) {
      mutate((d) => {
        for (const k of d.keywords) {
          if (k[field] === from && (!platformId || k.platform_id === platformId)) {
            Object.assign(k, { [field]: to, updated_at: now() });
          }
        }
      });
    },

    async listDailyLogs(userId) {
      return load()
        .logs.filter((l) => l.user_id === userId)
        .map(normalizeLog)
        .sort((a, b) => b.log_date.localeCompare(a.log_date));
    },
    async getDailyLog(id) {
      const log = load().logs.find((l) => l.id === id);
      return log ? normalizeLog(log) : null;
    },
    async getDailyLogByDate(userId, date) {
      const log = load().logs.find((l) => l.user_id === userId && l.log_date === date);
      return log ? normalizeLog(log) : null;
    },
    async saveDailyLog(userId, input, id) {
      mutate((d) => {
        const log = id && d.logs.find((l) => l.id === id);
        if (log) {
          Object.assign(log, input, { updated_at: now() });
        } else {
          d.logs.push({ ...input, id: randomUUID(), user_id: userId, created_at: now(), updated_at: now() });
        }
      });
    },
    async deleteDailyLog(id) {
      mutate((d) => {
        d.logs = d.logs.filter((l) => l.id !== id);
      });
    },

    async listResources(userId) {
      return load().resources.filter((r) => r.user_id === userId);
    },
    async getResource(id) {
      return load().resources.find((r) => r.id === id) ?? null;
    },
    async saveResource(userId, input, id) {
      mutate((d) => {
        const resource = id && d.resources.find((r) => r.id === id);
        if (resource) {
          Object.assign(resource, input, { updated_at: now() });
        } else {
          d.resources.push({ ...input, id: randomUUID(), user_id: userId, created_at: now(), updated_at: now() });
        }
      });
    },
    async deleteResource(id) {
      mutate((d) => {
        d.resources = d.resources.filter((r) => r.id !== id);
      });
    },
  };
}

// ---------- Data contoh untuk melihat tampilan ----------

const ORDER: StepName[] = [
  'validasi',
  'konfigurasi',
  'kategori',
  'riset',
  'tulis',
  'metadata',
  'html',
  'gabung',
  'draft_wp',
];
const DURATION: Record<StepName, number> = {
  validasi: 0.1,
  konfigurasi: 0.1,
  kategori: 1.2,
  riset: 14,
  tulis: 38,
  metadata: 3,
  html: 41,
  gabung: 0.1,
  draft_wp: 2.4,
};

function demoSteps(start: Date, failAt?: { step: StepName; error: string }): StepLog[] {
  const steps: StepLog[] = [];
  let t = start.getTime();
  for (const name of ORDER) {
    const finished = t + DURATION[name] * 1000;
    if (failAt?.step === name) {
      steps.push({ name, status: 'error', started_at: new Date(t).toISOString(), finished_at: new Date(finished).toISOString(), error: failAt.error });
      break;
    }
    steps.push({ name, status: 'done', started_at: new Date(t).toISOString(), finished_at: new Date(finished).toISOString() });
    t = finished;
  }
  return steps;
}

type DemoKeyword = {
  platform: string;
  keyword: string;
  category: string;
  role: string;
  audience: string;
  volume: number | null;
  status: Keyword['status'];
  daysAgo: number;
  title?: string;
  fail?: { step: StepName; error: string };
};

const DEMO: DemoKeyword[] = [
  { platform: 'JadiASN', keyword: 'gaji guru asn', category: 'Informasi CPNS', role: 'ASN Berpengalaman (Sharing Dunia Kerja & Realita PNS)', audience: 'Fresh Graduate yang Baru Memulai Persiapan CPNS', volume: 10, status: 'generated', daysAgo: 1, title: 'Gaji Guru ASN 2026: Rincian Gaji Pokok, Tunjangan, dan Realitanya' },
  { platform: 'JadiASN', keyword: 'formasi cpns 2026', category: 'Informasi CPNS', role: 'Mentor CPNS', audience: 'Pejuang CPNS Pemula', volume: 880, status: 'ready', daysAgo: 0 },
  { platform: 'JadiASN', keyword: 'passing grade skd cpns', category: 'Tips CPNS', role: 'Mentor CPNS', audience: 'Pejuang CPNS Pemula', volume: 1300, status: 'generated', daysAgo: 3, title: 'Passing Grade SKD CPNS: Nilai Minimal TWK, TIU, dan TKP' },
  { platform: 'JadiPPPK', keyword: 'jadwal seleksi pppk 2026', category: 'Informasi PPPK', role: 'Guru Honorer Senior', audience: 'Guru Honorer', volume: 720, status: 'generated', daysAgo: 2, title: 'Jadwal Seleksi PPPK 2026 dan Tahapan yang Perlu Disiapkan' },
  { platform: 'JadiPPPK', keyword: 'syarat pppk guru', category: 'Informasi PPPK', role: 'Guru Honorer Senior', audience: 'Guru Honorer', volume: 390, status: 'draft', daysAgo: 0 },
  { platform: 'JadiBUMN', keyword: 'rekrutmen bersama bumn 2026', category: 'Info Rekrutmen', role: 'HR BUMN', audience: 'Fresh Graduate', volume: 2400, status: 'generated', daysAgo: 4, title: 'Rekrutmen Bersama BUMN 2026: Syarat, Jadwal, dan Cara Daftar' },
  { platform: 'JadiPOLISI', keyword: 'syarat tinggi badan polri', category: 'Info Polri', role: 'Anggota Polri', audience: 'Calon Bintara', volume: 1600, status: 'error', daysAgo: 1, fail: { step: 'kategori', error: 'Kategori "Info Polri" tidak ditemukan di jadipolisi.example' } },
  { platform: 'ToeflAcademy', keyword: 'contoh soal toefl structure', category: 'TOEFL Tips', role: 'Pengajar TOEFL', audience: 'Mahasiswa', volume: 900, status: 'draft', daysAgo: 0 },
  { platform: 'JadiPPG', keyword: 'ppg daljab 2026', category: 'Informasi PPG', role: 'Guru Penggerak', audience: 'Guru Dalam Jabatan', volume: 1100, status: 'generated', daysAgo: 6, title: 'PPG Daljab 2026: Syarat, Alur Seleksi, dan Tips Lolos' },
  { platform: 'Cerebrum', keyword: 'tips lolos skd', category: 'Tips CPNS', role: 'Mentor CPNS', audience: 'Pejuang CPNS Pemula', volume: 500, status: 'ready', daysAgo: 0 },
  { platform: 'JadiBEASISWA', keyword: 'beasiswa lpdp 2026', category: 'Info Beasiswa', role: 'Awardee LPDP', audience: 'Mahasiswa Tingkat Akhir', volume: 2900, status: 'error', daysAgo: 2, fail: { step: 'html', error: 'api.openai.com 429: Rate limit reached' } },
  { platform: 'Testing', keyword: 'artikel uji coba', category: 'Uncategorized', role: 'Penulis', audience: 'Umum', volume: null, status: 'generated', daysAgo: 5, title: 'Artikel Uji Coba Pipeline' },
];

const slugify = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);

function demoData(): LocalData {
  const platforms = seedPlatforms();
  const keywords: Keyword[] = [];
  const runs: RunRow[] = [];

  DEMO.forEach((d, i) => {
    const created = new Date(Date.now() - (d.daysAgo * 24 + 2) * 3600_000 - i * 60_000);
    const id = randomUUID();
    const generated = d.status === 'generated';
    keywords.push({
      id,
      platform_id: d.platform,
      keyword: d.keyword,
      volume: d.volume,
      keyword_status: d.volume && d.volume > 1000 ? 'Trending' : null,
      category: d.category,
      role: d.role,
      audience: d.audience,
      schedule_date: null,
      status: d.status,
      title: d.title ?? null,
      slug: d.title ? slugify(d.keyword) : null,
      meta: d.title ? `Contoh meta description untuk "${d.keyword}".` : null,
      wp_post_id: generated ? 1000 + i : null,
      wp_edit_url: null,
      last_error: d.fail?.error ?? null,
      ...KEYWORD_DEFAULTS,
      copywriter: generated ? 'Jian' : null,
      status_awal: generated && d.daysAgo > 3 ? 'Done' : null,
      qc: generated && d.daysAgo > 3 ? { keyword_min5: true, judul_artikel: true, informasi_valid: true, sub_point: true } : {},
      created_at: created.toISOString(),
      updated_at: created.toISOString(),
    });

    if (!generated && d.status !== 'error') return;
    const start = new Date(created.getTime() + 30 * 60_000);
    const steps = demoSteps(start, d.fail);
    const reachedAi = !d.fail || ORDER.indexOf(d.fail.step) > ORDER.indexOf('riset');
    runs.push({
      id: randomUUID(),
      keyword_id: id,
      platform_id: d.platform,
      status: generated ? 'success' : 'error',
      current_step: null,
      steps,
      category_id: d.fail?.step === 'kategori' ? null : 12,
      research: reachedAi ? `(Data contoh) Ringkasan riset untuk "${d.keyword}" - source: https://contoh.go.id` : null,
      draft: reachedAi ? `(Data contoh) Draf artikel tentang ${d.keyword}.` : null,
      html: generated ? `<h2>${d.title}</h2><p>(Data contoh)</p>` : null,
      title: d.title ?? null,
      slug: d.title ? slugify(d.keyword) : null,
      meta: d.title ? `Contoh meta description untuk "${d.keyword}".` : null,
      content: generated ? `<h2>${d.title}</h2>\n<p>(Data contoh) Isi artikel.</p>` : null,
      wp_post_id: generated ? 1000 + i : null,
      error: d.fail?.error ?? null,
      started_at: start.toISOString(),
      finished_at: steps.at(-1)?.finished_at ?? null,
    });
  });

  return { version: VERSION, platforms, keywords, runs, options: seedOptions(), logs: [], resources: [] };
}
