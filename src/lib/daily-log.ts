// Log Kerja Harian: satu log = satu orang × satu hari.
// File ini dipakai di server dan komponen client, jadi jangan import modul Node di sini.
import { AFFIRMATION_CATEGORIES } from './affirmations';

export type ActivityStatus = 'done' | 'lanjut';
export type LogActivity = { time: string; text: string; status: ActivityStatus };

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

export function cleanActivities(list: LogActivity[]): LogActivity[] {
  return list
    .map((a) => ({
      time: /^\d{2}:\d{2}$/.test(a.time) ? a.time : '',
      text: String(a.text ?? '').trim(),
      status: a.status === 'lanjut' ? ('lanjut' as const) : ('done' as const),
    }))
    .filter((a) => a.text);
}

/** Satu hari satu log: isi baru digabung ke log yang sudah ada di tanggal itu. */
export function mergeInto(existing: DailyLogInput, incoming: DailyLogInput): DailyLogInput {
  const join = (a: string, b: string) => [a, b].filter((x) => x.trim()).join('\n');
  return {
    log_date: existing.log_date,
    activities: [...existing.activities, ...incoming.activities],
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
    // Log yang baru berisi afirmasi belum dihitung sebagai hari terisi.
    filledWorkdays: week.filter((l) => l.activities.length && parseDate(l.log_date).getDay() % 6 !== 0).length,
    activities: week.reduce((sum, l) => sum + l.activities.length, 0),
    learnDays: logs.filter((l) => l.learn.trim()).length,
    issueDays: logs.filter((l) => l.issue.trim()).length,
  };
}

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

export function greeting(now: Date) {
  const h = now.getHours();
  return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
}

// ---------- Export ----------

export function logsToCsv(logs: DailyLog[]) {
  const head = ['Hari', 'Tanggal', 'Yang Dikerjakan', 'Belajar Apa', 'Masalah', 'Afirmasi'];
  const rows = logs.map((l) => [
    HARI[parseDate(l.log_date).getDay()],
    l.log_date,
    l.activities
      .map((a) => `- ${a.time ? `${a.time} ` : ''}${a.text}${a.status === 'lanjut' ? ' (lanjut besok)' : ''}`)
      .join('\n'),
    l.learn,
    l.issue,
    l.affirmation,
  ]);
  return [head, ...rows].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}
