// Log Kerja Harian: satu log = satu orang × satu hari.
// File ini dipakai di server dan komponen client, jadi jangan import modul Node di sini.
import { AFFIRMATION_CATEGORIES } from './affirmations';

export type ActivityStatus = 'done' | 'lanjut' | 'diskusi';
export type LogActivity = { start: string; end: string; text: string; status: ActivityStatus };

export const ACTIVITY_STATUS: Record<ActivityStatus, string> = {
  done: 'Selesai',
  lanjut: 'Lanjut besok',
  diskusi: 'Perlu diskusi',
};

export type DailyLog = {
  id: string;
  user_id: string;
  log_date: string; // YYYY-MM-DD
  activities: LogActivity[];
  learn: string;
  issue: string;
  affirmation: string;
  created_at: string;
  updated_at: string;
};

export type DailyLogInput = Pick<DailyLog, 'log_date' | 'activities' | 'learn' | 'issue' | 'affirmation'>;

export const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
export const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
export const BULAN_PANJANG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

// Tanggal disimpan sebagai teks YYYY-MM-DD; Date hanya dipakai untuk hitung hari, di jam 00:00 lokal.
export const isoDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const parseDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const isIsoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && isoDate(parseDate(s)) === s;
export const formatDate = (s: string) => {
  const d = parseDate(s);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};
/** "Rabu, 7 Oktober 2026" */
export const formatDateLong = (s: string) => {
  const d = parseDate(s);
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN_PANJANG[d.getMonth()]} ${d.getFullYear()}`;
};

/** Tanggal hari ini di zona waktu tim (server VPS memakai UTC). */
export const todayInJakarta = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);

export function addDays(s: string, days: number) {
  const d = parseDate(s);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** Senin dari minggu tanggal tersebut. */
export const mondayOf = (s: string) => addDays(s, -((parseDate(s).getDay() + 6) % 7));

// ---------- Jam & durasi ----------

const isTime = (t: unknown): t is string => typeof t === 'string' && /^\d{2}:\d{2}$/.test(t);
export const minutesOf = (t: string) => (isTime(t) ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);
export const timeFromMinutes = (m: number) =>
  `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Durasi menit; 0 bila jam tidak lengkap atau selesai tidak setelah mulai. */
export function durationOf(a: Pick<LogActivity, 'start' | 'end'>) {
  const s = minutesOf(a.start);
  const e = minutesOf(a.end);
  return s != null && e != null && e > s ? e - s : 0;
}
export const totalMinutes = (list: LogActivity[]) => list.reduce((sum, a) => sum + durationOf(a), 0);
/** "1j 45m" */
export function durationShort(m: number) {
  const h = Math.floor(m / 60);
  const n = m % 60;
  return [h && `${h}j`, n && `${n}m`].filter(Boolean).join(' ') || '0m';
}
/** "1 jam 45 menit" */
export function durationLong(m: number) {
  const h = Math.floor(m / 60);
  const n = m % 60;
  return [h && `${h} jam`, n && `${n} menit`].filter(Boolean).join(' ');
}
const dot = (t: string) => t.replace(':', '.');
/** "09.00–10.45" / "mulai 09.00" / "" */
export function timeRange(a: Pick<LogActivity, 'start' | 'end'>) {
  if (a.start && a.end) return `${dot(a.start)}–${dot(a.end)}`;
  if (a.start) return `mulai ${dot(a.start)}`;
  return '';
}

/**
 * Rapikan daftar pekerjaan dari form atau database: buang baris kosong, jam tidak valid jadi kosong,
 * urut berdasar jam mulai (tanpa jam di akhir). Data lama memakai satu kolom `time` → dibaca sebagai jam mulai.
 */
export function cleanActivities(list: unknown): LogActivity[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((raw) => {
      const a = (raw ?? {}) as Record<string, unknown>;
      const start = isTime(a.start) ? a.start : isTime(a.time) ? a.time : '';
      const status: ActivityStatus = a.status === 'lanjut' || a.status === 'diskusi' ? a.status : 'done';
      return { start, end: isTime(a.end) ? a.end : '', text: String(a.text ?? '').trim(), status };
    })
    .filter((a) => a.text)
    .sort((a, b) => (a.start || '99').localeCompare(b.start || '99'));
}

/** Baris yang jam selesainya tidak setelah jam mulai (indeks), atau -1. */
export const invalidTimeRow = (list: Pick<LogActivity, 'start' | 'end'>[]) =>
  list.findIndex((a) => {
    const s = minutesOf(a.start);
    const e = minutesOf(a.end);
    return s != null && e != null && e <= s;
  });

export function normalizeLog<T extends { activities: unknown; log_date: string }>(log: T): T & { activities: LogActivity[] } {
  return { ...log, log_date: String(log.log_date).slice(0, 10), activities: cleanActivities(log.activities) };
}

/** Satu hari satu log: isi baru digabung ke log yang sudah ada di tanggal itu. */
export function mergeInto(existing: DailyLogInput, incoming: DailyLogInput): DailyLogInput {
  const join = (a: string, b: string) => [a, b].filter((x) => x.trim()).join('\n');
  return {
    log_date: existing.log_date,
    activities: cleanActivities([...existing.activities, ...incoming.activities]),
    learn: join(existing.learn, incoming.learn),
    issue: join(existing.issue, incoming.issue),
    affirmation: incoming.affirmation || existing.affirmation,
  };
}

export type WeekStats = { filledWorkdays: number; activities: number; learnDays: number; issueDays: number };

/** Angka kartu atas: hari kerja terisi & pekerjaan untuk minggu terpilih, belajar & masalah untuk semua log. */
export function weekStats(logs: DailyLog[], weekStart: string): WeekStats {
  const weekEnd = addDays(weekStart, 6);
  const week = logs.filter((l) => l.log_date >= weekStart && l.log_date <= weekEnd);
  return {
    // Log yang baru berisi afirmasi / bahan belajar belum dihitung sebagai hari terisi.
    filledWorkdays: week.filter((l) => l.activities.length && parseDate(l.log_date).getDay() % 6 !== 0).length,
    activities: week.reduce((sum, l) => sum + l.activities.length, 0),
    learnDays: logs.filter((l) => l.learn.trim()).length,
    issueDays: logs.filter((l) => l.issue.trim()).length,
  };
}

// ---------- Rangkuman harian ----------
// Teks rapi untuk disalin ke logbook lain (PKL / MagangHub). Dibuat dengan aturan, tanpa AI,
// jadi hasilnya konsisten dan tetap bisa diedit sebelum disalin.

export type SummaryFormat = 'paragraf' | 'poin';
export type DaySummary = { kegiatan: string; pembelajaran: string; kendala: string; activityCount: number; minutes: number };

// "Membuat PPT" → "membuat PPT"; singkatan seperti "QC" dibiarkan.
const lowerFirst = (t: string) => {
  t = t.trim();
  return /^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t;
};
const upperFirst = (t: string) => (t.trim() ? t.trim()[0].toUpperCase() + t.trim().slice(1) : '');
const endDot = (t: string) => (/[.!?]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`);
const lines = (t: string) =>
  t
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
/** "a", "a dan b", "a, b, dan c" */
export function joinId(items: string[]) {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')}${items.length > 2 ? ',' : ''} dan ${items[items.length - 1]}`;
}

export const LEARN_DONE_PREFIX = 'Selesai mempelajari: ';
function learnPhrase(line: string) {
  const m = line.match(/^Selesai mempelajari:\s*(.+?)(\s+—\s+https?:\/\/\S+)?$/);
  if (m) return `menyelesaikan materi “${m[1].trim()}”`;
  return lowerFirst(line.replace(/[.]+$/, ''));
}

export function buildSummary(log: Pick<DailyLog, 'log_date' | 'activities' | 'learn' | 'issue'>, format: SummaryFormat, withTime: boolean): DaySummary {
  const acts = log.activities;
  const done = acts.filter((a) => a.status === 'done');
  const lanjut = acts.filter((a) => a.status === 'lanjut');
  const diskusi = acts.filter((a) => a.status === 'diskusi');
  const minutes = totalMinutes(acts);
  const learn = lines(log.learn).map(learnPhrase);
  const issue = lines(log.issue).map((x) => x.replace(/[.]+$/, ''));
  const label = (a: LogActivity) => {
    const range = withTime ? timeRange(a) : '';
    return lowerFirst(a.text) + (range ? ` (${range})` : '');
  };
  const texts = (list: LogActivity[]) => joinId(list.map((a) => lowerFirst(a.text)));

  if (format === 'paragraf') {
    let kegiatan = acts.length
      ? `Pada hari ${formatDateLong(log.log_date)}, saya melaksanakan ${acts.length} kegiatan, yaitu ${joinId(acts.map(label))}.`
      : `Pada hari ${formatDateLong(log.log_date)}, belum ada kegiatan yang dicatat.`;
    if (acts.length && done.length === acts.length) kegiatan += ' Seluruh kegiatan telah diselesaikan dengan baik.';
    else if (done.length) kegiatan += ` Kegiatan yang telah selesai yaitu ${texts(done)}.`;
    if (lanjut.length) kegiatan += ` Kegiatan ${texts(lanjut)} masih dalam proses dan akan dilanjutkan pada hari berikutnya.`;
    if (diskusi.length) kegiatan += ` Selain itu, kegiatan ${texts(diskusi)} memerlukan diskusi lebih lanjut dengan pembimbing.`;
    if (withTime && minutes) kegiatan += ` Total waktu kegiatan yang tercatat sekitar ${durationLong(minutes)}.`;
    return {
      kegiatan,
      pembelajaran: learn.length
        ? `Pembelajaran yang saya peroleh hari ini adalah ${joinId(learn)}.`
        : 'Hari ini saya memperdalam pemahaman melalui kegiatan yang dikerjakan.',
      kendala: issue.length
        ? `Kendala yang saya hadapi adalah ${issue.map(lowerFirst).join('; ')}.`
        : 'Tidak terdapat kendala yang berarti dalam pelaksanaan kegiatan hari ini.',
      activityCount: acts.length,
      minutes,
    };
  }

  const statusText: Record<ActivityStatus, string> = { done: 'Selesai', lanjut: 'Dilanjutkan besok', diskusi: 'Perlu diskusi' };
  let kegiatan = acts.length
    ? acts
        .map((a, i) => {
          const range = withTime ? timeRange(a) : '';
          return `${i + 1}. ${upperFirst(a.text)}${range ? ` (${range})` : ''} – ${statusText[a.status]}`;
        })
        .join('\n')
    : '- Belum ada kegiatan';
  if (withTime && minutes) kegiatan += `\nTotal waktu: ${durationLong(minutes)}`;
  return {
    kegiatan,
    pembelajaran: learn.length
      ? learn.map((x) => `- ${endDot(upperFirst(x))}`).join('\n')
      : '- Memperdalam pemahaman melalui kegiatan yang dikerjakan.',
    kendala: issue.length ? issue.map((x) => `- ${endDot(upperFirst(x))}`).join('\n') : '- Tidak ada kendala.',
    activityCount: acts.length,
    minutes,
  };
}

/** Tanggal yang punya isi (bukan hanya afirmasi), urut lama → baru. */
export const loggedDates = (logs: DailyLog[]) =>
  logs
    .filter((l) => l.activities.length || l.learn.trim() || l.issue.trim())
    .map((l) => l.log_date)
    .sort();

// ---------- Bahan belajar ----------

export const RESOURCE_KINDS = {
  video: 'Video',
  artikel: 'Artikel',
  dokumen: 'Dokumen',
  kursus: 'Kursus',
  data: 'Data',
  lainnya: 'Lainnya',
} as const;
export type ResourceKind = keyof typeof RESOURCE_KINDS;
export const RESOURCE_STATUS = { belum: 'Belum', sedang: 'Sedang dipelajari', selesai: 'Selesai' } as const;
export type ResourceStatus = keyof typeof RESOURCE_STATUS;

export type LearningResource = {
  id: string;
  user_id: string;
  title: string;
  url: string;
  kind: ResourceKind;
  tags: string[];
  status: ResourceStatus;
  due_date: string | null;
  note: string;
  done_date: string | null;
  created_at: string;
  updated_at: string;
};

export type ResourceInput = Pick<LearningResource, 'title' | 'url' | 'kind' | 'tags' | 'status' | 'due_date' | 'note' | 'done_date'>;

export const isResourceKind = (v: unknown): v is ResourceKind => typeof v === 'string' && v in RESOURCE_KINDS;
export const isResourceStatus = (v: unknown): v is ResourceStatus => typeof v === 'string' && v in RESOURCE_STATUS;

export function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/** Tebak jenis bahan dari link; null bila bukan link. */
export function guessKind(url: string): ResourceKind | null {
  const d = domainOf(url);
  if (!d) return null;
  if (/youtube|youtu\.be|vimeo|tiktok/.test(d)) return 'video';
  if (/docs\.google|drive\.google|notion|\.pdf$/i.test(d + url)) return /spreadsheets/.test(url) ? 'data' : 'dokumen';
  if (/udemy|coursera|dicoding|skillshop|academy|course/.test(d)) return 'kursus';
  if (/sheets|airtable|looker|datastudio/.test(d + url)) return 'data';
  return 'artikel';
}

export const parseTags = (text: string) =>
  [...new Set(text.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 20);

/** Sedang dipelajari dulu, lalu belum, lalu selesai; di dalamnya target terdekat dulu. */
export function sortResources<T extends Pick<LearningResource, 'status' | 'due_date'>>(list: T[]) {
  const order: Record<ResourceStatus, number> = { sedang: 0, belum: 1, selesai: 2 };
  return [...list].sort((a, b) => order[a.status] - order[b.status] || (a.due_date || '9').localeCompare(b.due_date || '9'));
}

/** Baris yang ditambahkan ke "Belajar apa?" log hari ini saat bahan ditandai selesai. */
export const learnDoneLine = (r: Pick<LearningResource, 'title' | 'url'>) =>
  `${LEARN_DONE_PREFIX}${r.title}${r.url ? ` — ${r.url}` : ''}`;

// ---------- Afirmasi ----------

export type Affirmation = { index: number; category: string; text: string };

export const AFFIRMATIONS: { category: string; text: string }[] = Object.entries(AFFIRMATION_CATEGORIES).flatMap(
  ([category, list]) => list.map((text) => ({ category, text })),
);

export const ROTATE_MS = 2 * 60 * 1000;

// PRNG mulberry32: urutan acak yang sama untuk seed yang sama.
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const orderCache = new Map<string, number[]>();

/** Urutan afirmasi diacak ulang tiap hari (seed = tanggal), sama untuk semua orang. */
export function dailyOrder(day: string): number[] {
  const cached = orderCache.get(day);
  if (cached) return cached;
  const rnd = seeded(Number(day.replace(/-/g, '')));
  const order = AFFIRMATIONS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  orderCache.clear();
  orderCache.set(day, order);
  return order;
}

/** Afirmasi yang tampil pada waktu tertentu: berganti tiap 2 menit; offset = tombol "Afirmasi lain". */
export function affirmationAt(now: Date, offset = 0): Affirmation {
  const order = dailyOrder(isoDate(now));
  const slot = Math.floor((now.getHours() * 60 + now.getMinutes()) / 2);
  const index = order[(slot + offset) % order.length];
  return { index, ...AFFIRMATIONS[index] };
}

// ---------- Export ----------

export function logsToCsv(logs: DailyLog[]) {
  const head = ['Hari', 'Tanggal', 'Yang Dikerjakan', 'Belajar Apa', 'Masalah', 'Afirmasi'];
  const note: Record<ActivityStatus, string> = { done: '', lanjut: ' (lanjut besok)', diskusi: ' (perlu diskusi)' };
  const rows = logs.map((l) => [
    HARI[parseDate(l.log_date).getDay()],
    l.log_date,
    l.activities
      .map((a) => `- ${a.start || a.end ? `${a.start || '?'}-${a.end || '?'} ` : ''}${a.text}${note[a.status]}`)
      .join('\n'),
    l.learn,
    l.issue,
    l.affirmation,
  ]);
  return [head, ...rows].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}
