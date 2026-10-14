import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addDays,
  affirmationAt,
  AFFIRMATIONS,
  buildSummary,
  cleanActivities,
  dailyOrder,
  durationLong,
  durationShort,
  guessKind,
  invalidTimeRow,
  isIsoDate,
  joinId,
  learnDoneLine,
  logsToCsv,
  mergeInto,
  mondayOf,
  parseTags,
  sortResources,
  todayInJakarta,
  totalMinutes,
  weekStats,
  type DailyLog,
  type LogActivity,
} from '../src/lib/daily-log';

const act = (text: string, patch: Partial<LogActivity> = {}): LogActivity => ({ start: '', end: '', text, status: 'done', ...patch });

const log = (date: string, patch: Partial<DailyLog> = {}): DailyLog => ({
  id: date,
  user_id: 'u1',
  log_date: date,
  activities: [act('kerja')],
  learn: '',
  issue: '',
  affirmation: '',
  created_at: '',
  updated_at: '',
  ...patch,
});

test('tanggal: Senin minggu itu, tambah hari lintas bulan, validasi', () => {
  assert.equal(mondayOf('2026-10-08'), '2026-10-05'); // Kamis
  assert.equal(mondayOf('2026-10-11'), '2026-10-05'); // Minggu ikut minggu yang sama
  assert.equal(addDays('2026-09-28', 6), '2026-10-04');
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('2026-10-13'), true);
});

test('hari ini memakai zona Jakarta, bukan UTC server', () => {
  assert.equal(todayInJakarta(new Date('2026-10-12T18:30:00Z')), '2026-10-13');
  assert.equal(todayInJakarta(new Date('2026-10-12T16:00:00Z')), '2026-10-12');
});

test('pekerjaan: baris kosong dibuang, jam tidak valid dikosongkan, urut jam mulai, data lama `time` terbaca', () => {
  assert.deepEqual(
    cleanActivities([
      { start: '13:00', end: '16:30', text: '  bandingkan plugin ', status: 'lanjut' },
      { start: 'x', end: '', text: 'cek plugin', status: 'apa' },
      { time: '09:00', text: 'log lama', status: 'done' },
      { start: '10:00', end: '11:00', text: '   ', status: 'diskusi' },
      { start: '10:00', end: '12:00', text: 'rapat SEO', status: 'diskusi' },
    ]),
    [
      act('log lama', { start: '09:00' }),
      act('rapat SEO', { start: '10:00', end: '12:00', status: 'diskusi' }),
      act('bandingkan plugin', { start: '13:00', end: '16:30', status: 'lanjut' }),
      act('cek plugin'),
    ],
  );
  assert.deepEqual(cleanActivities(null), []);
});

test('durasi: jam selesai harus setelah jam mulai', () => {
  const list = [act('a', { start: '09:00', end: '10:45' }), act('b', { start: '11:00', end: '15:30' }), act('c', { start: '16:00' })];
  assert.equal(totalMinutes(list), 375);
  assert.equal(durationShort(105), '1j 45m');
  assert.equal(durationShort(60), '1j');
  assert.equal(durationLong(375), '6 jam 15 menit');
  assert.equal(invalidTimeRow(list), -1);
  assert.equal(invalidTimeRow([...list, act('d', { start: '17:00', end: '17:00' })]), 3);
});

test('satu hari satu log: isi baru digabung, afirmasi lama tetap bila yang baru kosong', () => {
  const merged = mergeInto(
    log('2026-10-07', { activities: [act('uji plugin', { start: '10:00' })], learn: 'JSON-LD', affirmation: 'Aku tenang.' }),
    { log_date: '2026-10-07', activities: [act('cek cache', { start: '08:00' })], learn: 'Rich Results Test', issue: 'hasil beda', affirmation: '' },
  );
  assert.deepEqual(merged.activities.map((a) => a.text), ['cek cache', 'uji plugin']);
  assert.equal(merged.learn, 'JSON-LD\nRich Results Test');
  assert.equal(merged.issue, 'hasil beda');
  assert.equal(merged.affirmation, 'Aku tenang.');
});

test('ringkasan minggu: Sabtu/Minggu & log tanpa pekerjaan tidak dihitung hari terisi', () => {
  const logs = [
    log('2026-10-05', { learn: 'a' }),
    log('2026-10-06', { activities: [act('x'), act('y')] }),
    log('2026-10-07', { activities: [], affirmation: 'hanya afirmasi' }),
    log('2026-10-10'), // Sabtu
    log('2026-09-30', { issue: 'b' }), // minggu lalu
  ];
  assert.deepEqual(weekStats(logs, '2026-10-05'), { filledWorkdays: 2, activities: 4, learnDays: 1, issueDays: 1 });
});

test('rangkuman paragraf: status, jam, total waktu, dan materi selesai', () => {
  const s = buildSummary(
    log('2026-10-07', {
      activities: [
        act('Uji beberapa plugin', { start: '10:00', end: '12:00' }),
        act('Bandingkan hasil kompresi', { start: '13:00', end: '16:30', status: 'lanjut' }),
        act('Input password ke spreadsheet', { status: 'diskusi' }),
      ],
      learn: `Struktur JSON-LD FAQPage.\n${learnDoneLine({ title: 'Core Web Vitals', url: 'https://web.dev/vitals' })}`,
      issue: 'Hasil tiap plugin berbeda.',
    }),
    'paragraf',
    true,
  );
  assert.equal(
    s.kegiatan,
    'Pada hari Rabu, 7 Oktober 2026, saya melaksanakan 3 kegiatan, yaitu uji beberapa plugin (10.00–12.00), ' +
      'bandingkan hasil kompresi (13.00–16.30), dan input password ke spreadsheet. ' +
      'Kegiatan yang telah selesai yaitu uji beberapa plugin. ' +
      'Kegiatan bandingkan hasil kompresi masih dalam proses dan akan dilanjutkan pada hari berikutnya. ' +
      'Selain itu, kegiatan input password ke spreadsheet memerlukan diskusi lebih lanjut dengan pembimbing. ' +
      'Total waktu kegiatan yang tercatat sekitar 5 jam 30 menit.',
  );
  assert.equal(s.pembelajaran, 'Pembelajaran yang saya peroleh hari ini adalah struktur JSON-LD FAQPage dan menyelesaikan materi “Core Web Vitals”.');
  assert.equal(s.kendala, 'Kendala yang saya hadapi adalah hasil tiap plugin berbeda.');
  assert.equal(s.minutes, 330);
});

test('rangkuman poin-poin tanpa jam; teks kosong diberi kalimat bawaan', () => {
  const s = buildSummary(log('2026-10-07', { activities: [act('QC artikel', { start: '09:00', end: '10:00' })] }), 'poin', false);
  assert.equal(s.kegiatan, '1. QC artikel – Selesai');
  assert.equal(s.pembelajaran, '- Memperdalam pemahaman melalui kegiatan yang dikerjakan.');
  assert.equal(s.kendala, '- Tidak ada kendala.');
  assert.equal(joinId(['a', 'b']), 'a dan b');
  assert.equal(joinId(['a', 'b', 'c']), 'a, b, dan c');
});

test('bahan belajar: tebak jenis dari link, topik unik, urutan sedang → belum → selesai', () => {
  assert.equal(guessKind('https://www.youtube.com/watch?v=x'), 'video');
  assert.equal(guessKind('https://docs.google.com/spreadsheets/d/1'), 'data');
  assert.equal(guessKind('https://docs.google.com/document/d/1'), 'dokumen');
  assert.equal(guessKind('https://www.dicoding.com/academies/1'), 'kursus');
  assert.equal(guessKind('https://web.dev/articles/vitals'), 'artikel');
  assert.equal(guessKind('bukan link'), null);
  assert.deepEqual(parseTags(' SEO, PageSpeed ,, SEO'), ['SEO', 'PageSpeed']);
  const sorted = sortResources([
    { id: 'a', status: 'selesai' as const, due_date: null },
    { id: 'b', status: 'belum' as const, due_date: '2026-10-20' },
    { id: 'c', status: 'sedang' as const, due_date: null },
    { id: 'd', status: 'belum' as const, due_date: '2026-10-12' },
  ]);
  assert.deepEqual(sorted.map((r) => r.id), ['c', 'd', 'b', 'a']);
});

test('afirmasi: 1000 kalimat, urutan harian tetap & beda tiap hari, ganti tiap 2 menit', () => {
  assert.equal(AFFIRMATIONS.length, 1000);
  const day = dailyOrder('2026-10-13');
  assert.equal(new Set(day).size, 1000);
  assert.deepEqual(dailyOrder('2026-10-13'), day);
  assert.notDeepEqual(dailyOrder('2026-10-14').slice(0, 20), day.slice(0, 20));
  const at = (h: number, m: number) => affirmationAt(new Date(2026, 9, 13, h, m)).index;
  assert.equal(at(9, 0), at(9, 1));
  assert.notEqual(at(9, 0), at(9, 2));
});

test('CSV: jam mulai-selesai, kutip ganda di-escape, status ditandai', () => {
  const csv = logsToCsv([
    log('2026-10-07', {
      activities: [act('cek "cache"', { start: '14:00', end: '15:00', status: 'lanjut' }), act('rapat', { status: 'diskusi' })],
    }),
  ]);
  assert.match(csv, /^"Hari","Tanggal"/);
  assert.match(csv, /\n"Rabu","2026-10-07","- 14:00-15:00 cek ""cache"" \(lanjut besok\)\n- rapat \(perlu diskusi\)"/);
});
