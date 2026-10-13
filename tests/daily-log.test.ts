import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  addDays,
  affirmationAt,
  AFFIRMATIONS,
  cleanActivities,
  dailyOrder,
  isIsoDate,
  logsToCsv,
  mergeInto,
  mondayOf,
  todayInJakarta,
  weekStats,
  type DailyLog,
} from '../src/lib/daily-log';

const log = (date: string, patch: Partial<DailyLog> = {}): DailyLog => ({
  id: date,
  user_id: 'u1',
  log_date: date,
  activities: [{ time: '', text: 'kerja', status: 'done' }],
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
  assert.equal(mondayOf('2026-10-05'), '2026-10-05');
  assert.equal(addDays('2026-09-28', 6), '2026-10-04');
  assert.equal(isIsoDate('2026-02-30'), false);
  assert.equal(isIsoDate('2026-10-13'), true);
});

test('hari ini memakai zona Jakarta, bukan UTC server', () => {
  assert.equal(todayInJakarta(new Date('2026-10-12T18:30:00Z')), '2026-10-13');
  assert.equal(todayInJakarta(new Date('2026-10-12T16:00:00Z')), '2026-10-12');
});

test('pekerjaan: baris kosong dibuang, jam/status tidak valid dirapikan', () => {
  assert.deepEqual(
    cleanActivities([
      { time: '09:00', text: '  optimasi gambar ', status: 'lanjut' },
      { time: 'x', text: 'cek plugin', status: 'apa' as never },
      { time: '10:00', text: '   ', status: 'done' },
    ]),
    [
      { time: '09:00', text: 'optimasi gambar', status: 'lanjut' },
      { time: '', text: 'cek plugin', status: 'done' },
    ],
  );
});

test('satu hari satu log: isi baru digabung, afirmasi lama tetap bila yang baru kosong', () => {
  const merged = mergeInto(
    log('2026-10-07', { learn: 'JSON-LD', affirmation: 'Aku tenang.' }),
    { log_date: '2026-10-07', activities: [{ time: '14:00', text: 'bandingkan plugin', status: 'lanjut' }], learn: 'Rich Results Test', issue: 'hasil beda', affirmation: '' },
  );
  assert.equal(merged.activities.length, 2);
  assert.equal(merged.learn, 'JSON-LD\nRich Results Test');
  assert.equal(merged.issue, 'hasil beda');
  assert.equal(merged.affirmation, 'Aku tenang.');
});

test('ringkasan minggu: Sabtu/Minggu tidak dihitung sebagai hari kerja', () => {
  const logs = [
    log('2026-10-05', { learn: 'a' }),
    log('2026-10-06', { activities: [{ time: '', text: 'x', status: 'done' }, { time: '', text: 'y', status: 'done' }] }),
    log('2026-10-10'), // Sabtu
    log('2026-09-30', { issue: 'b' }), // minggu lalu
  ];
  assert.deepEqual(weekStats(logs, '2026-10-05'), { filledWorkdays: 2, activities: 4, learnDays: 1, issueDays: 1 });
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
  assert.notEqual(affirmationAt(new Date(2026, 9, 13, 9, 0), 1).index, at(9, 0));
});

test('CSV: kutip ganda di-escape, status lanjut ditandai', () => {
  const csv = logsToCsv([log('2026-10-07', { activities: [{ time: '14:00', text: 'cek "cache"', status: 'lanjut' }] })]);
  assert.match(csv, /^"Hari","Tanggal"/);
  assert.match(csv, /\n"Rabu","2026-10-07","- 14:00 cek ""cache"" \(lanjut besok\)"/);
});
