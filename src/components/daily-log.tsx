'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { deleteDailyLog, pinAffirmation, saveDailyLog, type ActionState } from '@/app/actions';
import {
  addDays,
  affirmationAt,
  AFFIRMATIONS,
  BULAN,
  formatDate,
  greeting,
  HARI,
  logsToCsv,
  mondayOf,
  parseDate,
  ROTATE_MS,
  weekStats,
  type DailyLog,
  type LogActivity,
} from '@/lib/daily-log';
import { Message } from './forms';
import { Icon } from './icons';

type View = 'diary' | 'table';
type Filter = '' | 'learn' | 'issue';

export function DailyLogView({
  logs,
  today,
  userName,
  readOnly,
  members,
  selectedMember,
}: {
  logs: DailyLog[];
  today: string;
  userName: string;
  readOnly: boolean;
  members: { id: string; name: string }[];
  selectedMember: string;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>('diary');
  const [filter, setFilter] = useState<Filter>('');
  const [query, setQuery] = useState('');
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [selDay, setSelDay] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ log: DailyLog | null; date: string } | null>(null);
  const [toast, setToast] = useState<ActionState>(undefined);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return logs.filter(
      (l) =>
        (!filter || l[filter].trim()) &&
        (!selDay || l.log_date === selDay) &&
        (!q || [l.learn, l.issue, l.affirmation, ...l.activities.map((a) => a.text)].join(' ').toLowerCase().includes(q)),
    );
  }, [logs, filter, selDay, query]);

  const stats = weekStats(logs, weekStart);
  const todayLog = logs.find((l) => l.log_date === today) ?? null;

  const openWrite = () => {
    const date = selDay ?? today;
    setEditing({ log: logs.find((l) => l.log_date === date) ?? null, date });
  };
  const remove = (log: DailyLog) => {
    if (!confirm(`Hapus log ${formatDate(log.log_date)}?`)) return;
    startTransition(async () => {
      setToast(await deleteDailyLog(log.id));
      router.refresh();
    });
  };
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob(['﻿' + logsToCsv(list)], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'log-kerja-harian.csv' });
    a.click();
    URL.revokeObjectURL(url);
  };
  const moveWeek = (days: number) => {
    setWeekStart((w) => addDays(w, days));
    setSelDay(null);
  };

  const viewedName = members.find((m) => m.id === selectedMember)?.name;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Log Kerja Harian</h1>
          <p className="muted">
            {readOnly
              ? `Melihat log ${viewedName ?? 'anggota tim'} (hanya baca).`
              : 'Catat apa yang dikerjakan hari ini, apa yang dipelajari, dan masalah yang ditemui.'}
          </p>
        </div>
        <div className="row">
          {members.length > 1 && (
            <label className="search-box log-member" title="Lihat log anggota tim">
              <Icon name="search" size={16} />
              <select
                aria-label="Lihat log anggota"
                value={selectedMember}
                onChange={(e) => router.push(`/log-harian?anggota=${encodeURIComponent(e.target.value)}`)}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button type="button" className="secondary log-export" onClick={exportCsv} disabled={!list.length}>
            <Icon name="download" size={16} /> Export CSV
          </button>
          {!readOnly && (
            <button type="button" className="create-button" onClick={openWrite}>
              <Icon name="plus" size={18} /> Tulis log {selDay && selDay !== today ? formatDate(selDay) : 'hari ini'}
            </button>
          )}
        </div>
      </div>

      <AffirmationBanner
        userName={userName}
        pinnedText={todayLog?.affirmation ?? ''}
        canPin={!readOnly}
        onPinned={(state) => {
          setToast(state);
          router.refresh();
        }}
      />

      <section className="stat-row log-stats" aria-label="Ringkasan">
        <StatCard tone="navy" icon="calendar" label="Hari terisi" value={`${stats.filledWorkdays}/5`} sub="hari kerja minggu ini" />
        <StatCard tone="yellow" icon="check" label="Pekerjaan" value={stats.activities} sub="aktivitas dicatat minggu ini" />
        <StatCard tone="green" icon="book" label="Catatan belajar" value={stats.learnDays} sub="hari dengan catatan belajar" />
        <StatCard tone="red" icon="alert" label="Masalah" value={stats.issueDays} sub="hari dengan kendala" />
      </section>

      <section className="card log-week">
        <div className="log-week-nav">
          <button type="button" className="icon-button dark" aria-label="Minggu sebelumnya" onClick={() => moveWeek(-7)}>
            <Icon name="chevronLeft" size={16} />
          </button>
          <strong>{weekLabel(weekStart)}</strong>
          <button type="button" className="icon-button dark" aria-label="Minggu berikutnya" onClick={() => moveWeek(7)}>
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
        <div className="log-days">
          {Array.from({ length: 7 }, (_, i) => {
            const date = addDays(weekStart, i);
            const log = logs.find((l) => l.log_date === date);
            const d = parseDate(date);
            const cls = ['log-day', log && 'filled', date === today && 'today', selDay === date && 'selected', i > 4 && 'weekend']
              .filter(Boolean)
              .join(' ');
            return (
              <button
                key={date}
                type="button"
                className={cls}
                aria-pressed={selDay === date}
                onClick={() => setSelDay(selDay === date ? null : date)}
              >
                <i aria-hidden="true" />
                <b>{HARI[d.getDay()]}</b>
                <span>
                  {d.getDate()} {BULAN[d.getMonth()]} · {log ? `${log.activities.length} kerja` : 'kosong'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="card log-toolbar">
        <div className="log-seg" role="group" aria-label="Tampilan">
          {(
            [
              ['diary', 'Diary'],
              ['table', 'Tabel'],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" className={view === key ? 'on' : undefined} aria-pressed={view === key} onClick={() => setView(key)}>
              {label}
            </button>
          ))}
        </div>
        <div className="log-seg" role="group" aria-label="Filter">
          {(
            [
              ['', 'Semua'],
              ['learn', 'Ada catatan belajar'],
              ['issue', 'Ada masalah'],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" className={filter === key ? 'on' : undefined} aria-pressed={filter === key} onClick={() => setFilter(key)}>
              {label}
            </button>
          ))}
        </div>
        <label className="search-box log-search">
          <Icon name="search" size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari pekerjaan, catatan, masalah…" aria-label="Cari log" />
        </label>
        <span className="muted small-text">
          {selDay && (
            <button type="button" className="link-button" onClick={() => setSelDay(null)}>
              Semua tanggal
            </button>
          )}
          Total: <strong>{list.length}</strong> hari
        </span>
      </section>

      {list.length === 0 ? (
        <div className="card log-empty">
          <strong>Belum ada log</strong>
          <span className="muted">
            {readOnly ? 'Anggota ini belum menulis log yang cocok dengan filter.' : 'Klik "Tulis log hari ini" untuk mulai mencatat.'}
          </span>
        </div>
      ) : view === 'diary' ? (
        <div className="log-diary">
          {list.map((l) => (
            <DiaryEntry key={l.id} log={l} actions={!readOnly && <RowActions busy={pending} onEdit={() => setEditing({ log: l, date: l.log_date })} onDelete={() => remove(l)} />} />
          ))}
        </div>
      ) : (
        <div className="table-wrap card flush">
          <table className="log-table">
            <thead>
              <tr className="log-groups">
                <th />
                <th className="g-kerja">Pekerjaan</th>
                <th className="g-catat" colSpan={2}>
                  Catatan hari ini
                </th>
                <th className="g-afirm">Afirmasi</th>
                {!readOnly && <th />}
              </tr>
              <tr>
                <th style={{ width: 130 }}>Hari / Tanggal</th>
                <th>Yang dikerjakan</th>
                <th className="c-belajar">Belajar apa?</th>
                <th className="c-masalah">Masalah</th>
                <th className="c-afirm">Afirmasi hari ini</th>
                {!readOnly && <th style={{ width: 80 }} />}
              </tr>
            </thead>
            <tbody>
              {list.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{HARI[parseDate(l.log_date).getDay()]}</strong>
                    <div className="muted small-text">{formatDate(l.log_date)}</div>
                  </td>
                  <td>
                    <Activities list={l.activities} />
                  </td>
                  <td>{l.learn ? <RichText text={l.learn} /> : <span className="log-none">–</span>}</td>
                  <td>{l.issue ? <RichText text={l.issue} /> : <span className="log-none">Tidak ada kendala</span>}</td>
                  <td className="log-afirm-cell">{l.affirmation ? `“${l.affirmation}”` : <span className="log-none">–</span>}</td>
                  {!readOnly && (
                    <td>
                      <RowActions busy={pending} onEdit={() => setEditing({ log: l, date: l.log_date })} onDelete={() => remove(l)} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <LogDialog
          key={editing.log?.id ?? editing.date}
          log={editing.log}
          date={editing.date}
          onClose={() => setEditing(null)}
          onSaved={(state) => {
            setEditing(null);
            setToast(state);
            router.refresh();
          }}
        />
      )}

      {toast && (
        <div className={`log-toast${toast.error ? ' err' : ''}`} role="status">
          {toast.error ?? toast.ok}
        </div>
      )}
    </>
  );
}

function weekLabel(start: string) {
  const s = parseDate(start);
  const e = parseDate(addDays(start, 6));
  return `${s.getDate()} ${BULAN[s.getMonth()]} – ${e.getDate()} ${BULAN[e.getMonth()]} ${e.getFullYear()}`;
}

function StatCard({ tone, icon, label, value, sub }: { tone: string; icon: 'calendar' | 'check' | 'book' | 'alert'; label: string; value: ReactNode; sub: string }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <span className="stat-icon">
        <Icon name={icon} size={18} />
      </span>
      <span>
        <span className="label">{label}</span>
        <div className="value">{value}</div>
        <span className="sub">{sub}</span>
      </span>
    </div>
  );
}

// Tautan di catatan bisa diklik; baris baru dipertahankan lewat CSS (pre-line).
function RichText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return (
    <span className="log-rich">
      {parts.map((part, i) =>
        i % 2 ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </span>
  );
}

function Activities({ list }: { list: LogActivity[] }) {
  if (!list.length) return <span className="log-none">Belum ada pekerjaan dicatat</span>;
  return (
    <ul className="log-acts">
      {list.map((a, i) => (
        <li key={i}>
          <span className={`log-chk ${a.status}`} aria-label={a.status === 'done' ? 'Selesai' : 'Lanjut besok'}>
            {a.status === 'done' && <Icon name="check" size={11} />}
          </span>
          <span className="log-act-text">
            <RichText text={a.text} />
            {a.status === 'lanjut' && <span className="log-tag">lanjut besok</span>}
          </span>
          {a.time && <span className="log-time">{a.time.replace(':', '.')}</span>}
        </li>
      ))}
    </ul>
  );
}

function RowActions({ busy, onEdit, onDelete }: { busy: boolean; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="log-row-actions">
      <button type="button" className="icon-button dark" aria-label="Edit log" title="Edit" onClick={onEdit}>
        <Icon name="pen" size={15} />
      </button>
      <button type="button" className="icon-button dark" aria-label="Hapus log" title="Hapus" disabled={busy} onClick={onDelete}>
        <Icon name="trash" size={15} />
      </button>
    </div>
  );
}

function DiaryEntry({ log, actions }: { log: DailyLog; actions: ReactNode }) {
  const d = parseDate(log.log_date);
  return (
    <article className="log-entry">
      <div className="log-date">
        <span className="d">{d.getDate()}</span>
        <span className="m">
          {BULAN[d.getMonth()].toUpperCase()} {d.getFullYear()}
        </span>
        <span className="h">{HARI[d.getDay()]}</span>
      </div>
      <div className="log-body">
        <div>
          <h4 className="log-label kerja">Yang dikerjakan</h4>
          <Activities list={log.activities} />
        </div>
        <div className="log-notes">
          <div className="log-note learn">
            <h4 className="log-label">Belajar apa?</h4>
            {log.learn ? <RichText text={log.learn} /> : <span className="log-none">Tidak ada catatan</span>}
          </div>
          <div className="log-note issue">
            <h4 className="log-label">Masalah</h4>
            {log.issue ? <RichText text={log.issue} /> : <span className="log-none">Tidak ada kendala</span>}
          </div>
          {log.affirmation && (
            <div className="log-note afirm">
              <h4 className="log-label">Afirmasi hari ini</h4>
              <i>“{log.affirmation}”</i>
            </div>
          )}
        </div>
        {actions && <div className="log-foot">{actions}</div>}
      </div>
    </article>
  );
}

// ---------- Afirmasi ----------

function AffirmationBanner({
  userName,
  pinnedText,
  canPin,
  onPinned,
}: {
  userName: string;
  pinnedText: string;
  canPin: boolean;
  onPinned: (state: ActionState) => void;
}) {
  // Waktu hanya dibaca di browser: server dan browser bisa beda jam, jadi render awal kosong.
  const [now, setNow] = useState<Date | null>(null);
  const [offset, setOffset] = useState(0);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const current = now ? affirmationAt(now, offset) : null;
  const into = now ? (now.getTime() - new Date(now).setHours(0, 0, 0, 0)) % ROTATE_MS : 0;
  const left = Math.ceil((ROTATE_MS - into) / 1000);
  const pinned = !!current && pinnedText === current.text;

  return (
    <section className="log-affirm" aria-label="Afirmasi positif">
      <span className="qm" aria-hidden="true">
        “
      </span>
      <div>
        <div className="meta">
          <span className="cat">{current?.category ?? 'Afirmasi'}</span>
          {current && (
            <span className="no">
              #{current.index + 1} dari {AFFIRMATIONS.length}
            </span>
          )}
        </div>
        {/* key: animasi muncul setiap kalimat berganti */}
        <p className="txt" key={current?.index ?? -1} aria-live="polite">
          {current?.text ?? 'Memuat afirmasi…'}
        </p>
        {now && (
          <div className="who">
            {greeting(now)}, {userName}. Ucapkan pelan-pelan, lalu mulai harimu.
          </div>
        )}
      </div>
      <div className="side">
        <span className="next">{now ? `Berganti dalam ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : ''}</span>
        <button type="button" className="abtn" onClick={() => setOffset((o) => o + 1 + Math.floor(Math.random() * 50))}>
          <Icon name="shuffle" size={14} /> Afirmasi lain
        </button>
        {canPin && (
          <button
            type="button"
            className="abtn pin"
            disabled={!current || pinned || pending}
            onClick={() => current && startTransition(async () => onPinned(await pinAffirmation(current.text)))}
          >
            <Icon name="pin" size={14} /> {pinned ? 'Tersimpan di log' : 'Simpan ke log hari ini'}
          </button>
        )}
      </div>
      <div className="timer" style={{ transform: `scaleX(${into / ROTATE_MS})` }} />
    </section>
  );
}

// ---------- Dialog tulis / edit ----------

type Row = LogActivity & { key: number };
let rowKey = 0;
const newRow = (a?: LogActivity): Row => ({ time: '', text: '', status: 'done', ...a, key: ++rowKey });

function LogDialog({
  log,
  date,
  onClose,
  onSaved,
}: {
  log: DailyLog | null;
  date: string;
  onClose: () => void;
  onSaved: (state: ActionState) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [rows, setRows] = useState<Row[]>(() => (log?.activities.length ? log.activities.map(newRow) : [newRow()]));
  const [error, setError] = useState<ActionState>(undefined);
  const [pending, startTransition] = useTransition();

  // Tanpa cleanup close(): event close memanggil onClose dan langsung menutup dialog lagi
  // (efek dijalankan dua kali di dev). Dialog yang dilepas dari DOM otomatis tertutup.
  useEffect(() => {
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, []);

  const update = (key: number, patch: Partial<LogActivity>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submit = (form: FormData) => {
    const activities = rows.filter((r) => r.text.trim()).map(({ time, text, status }) => ({ time, text, status }));
    if (!activities.length) {
      setError({ error: 'Isi minimal satu pekerjaan' });
      return;
    }
    startTransition(async () => {
      const state = await saveDailyLog({
        id: log?.id,
        date: String(form.get('date')),
        activities,
        learn: String(form.get('learn') ?? ''),
        issue: String(form.get('issue') ?? ''),
        affirmation: String(form.get('affirmation') ?? ''),
      });
      if (state?.error) setError(state);
      else onSaved(state);
    });
  };

  return (
    <dialog ref={dialogRef} className="modal log-modal" aria-labelledby="log-dialog-title" onClose={onClose}>
      {/* onSubmit, bukan action: action mengosongkan form setelah selesai, isi hilang bila gagal disimpan. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        <div className="modal-head">
          <div>
            <h2 id="log-dialog-title">{log ? `Edit log ${formatDate(log.log_date)}` : 'Tulis log hari ini'}</h2>
            <p className="muted small-text">Satu log untuk satu hari. Tambahkan pekerjaan sebanyak yang dikerjakan.</p>
          </div>
          <button type="button" className="icon-button dark" aria-label="Tutup" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <label className="log-date-input">
          Tanggal
          <input type="date" name="date" required defaultValue={date} />
        </label>

        <fieldset className="log-fieldset kerja">
          <legend>Pekerjaan hari ini</legend>
          {rows.map((r, i) => (
            <div className="log-act-row" key={r.key}>
              <input type="time" value={r.time} aria-label="Jam" onChange={(e) => update(r.key, { time: e.target.value })} />
              <input
                value={r.text}
                placeholder="Apa yang dikerjakan?"
                aria-label="Pekerjaan"
                autoFocus={i === rows.length - 1 && i > 0}
                onChange={(e) => update(r.key, { text: e.target.value })}
              />
              <select value={r.status} aria-label="Status" onChange={(e) => update(r.key, { status: e.target.value as LogActivity['status'] })}>
                <option value="done">Selesai</option>
                <option value="lanjut">Lanjut besok</option>
              </select>
              <button
                type="button"
                className="icon-button dark"
                aria-label="Hapus baris"
                onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((x) => x.key !== r.key) : [newRow()]))}
              >
                <Icon name="x" size={15} />
              </button>
            </div>
          ))}
          <button type="button" className="link-button log-add" onClick={() => setRows((rs) => [...rs, newRow()])}>
            + Tambah pekerjaan
          </button>
        </fieldset>

        <fieldset className="log-fieldset catat">
          <legend>Catatan hari ini</legend>
          <div className="modal-grid">
            <label>
              <span>
                Belajar apa hari ini? <span className="muted small-text">Opsional</span>
              </span>
              <textarea name="learn" rows={3} defaultValue={log?.learn} placeholder="Contoh: Perbandingan Elementor vs Spectra untuk page builder" />
            </label>
            <label>
              <span>
                Ada masalah apa? <span className="muted small-text">Kosongkan jika lancar</span>
              </span>
              <textarea name="issue" rows={3} defaultValue={log?.issue} placeholder="Contoh: Plugin optimasi gambar bentrok dengan cache" />
            </label>
            <label className="span-2">
              <span>
                Afirmasi hari ini <span className="muted small-text">Terisi lewat tombol &quot;Simpan ke log hari ini&quot;, atau tulis sendiri</span>
              </span>
              <input name="affirmation" defaultValue={log?.affirmation} placeholder="Contoh: Aku tenang menghadapi apa pun yang terjadi hari ini." />
            </label>
          </div>
        </fieldset>

        <div className="modal-actions">
          <Message state={error} />
          <button type="button" className="secondary" onClick={onClose}>
            Batal
          </button>
          <button type="submit" disabled={pending}>
            {pending ? 'Menyimpan…' : log ? 'Simpan perubahan' : 'Simpan log'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
