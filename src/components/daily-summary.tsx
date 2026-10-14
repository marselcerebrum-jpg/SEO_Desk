'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BULAN,
  buildSummary,
  durationLong,
  formatDateLong,
  HARI,
  loggedDates,
  parseDate,
  type DailyLog,
  type SummaryFormat,
} from '@/lib/daily-log';
import { Icon } from './icons';

/** Rangkuman satu hari, siap disalin ke logbook lain (PKL / MagangHub). */
export function SummaryDialog({
  logs,
  date,
  canWrite,
  onClose,
  onWrite,
  onCopied,
}: {
  logs: DailyLog[];
  date: string;
  canWrite: boolean;
  onClose: () => void;
  onWrite: (date: string) => void;
  onCopied: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [day, setDay] = useState(date);
  const [format, setFormat] = useState<SummaryFormat>('paragraf');
  const [withTime, setWithTime] = useState(true);

  // Lihat catatan di LogDialog: tanpa cleanup close().
  useEffect(() => {
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, []);

  const dates = useMemo(() => loggedDates(logs), [logs]);
  const log = logs.find((l) => l.log_date === day);
  const prev = dates.filter((d) => d < day).at(-1);
  const next = dates.find((d) => d > day);

  return (
    <dialog ref={dialogRef} className="modal log-modal" aria-labelledby="summary-title" onClose={onClose}>
      <div className="modal-body">
        <div className="modal-head">
          <div>
            <h2 id="summary-title">Rangkuman harian</h2>
            <p className="muted small-text">Siap disalin ke dashboard lain (logbook PKL / MagangHub).</p>
          </div>
          <button type="button" className="icon-button dark" aria-label="Tutup" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="sum-top">
          <div className="sum-date">
            <button type="button" className="icon-button dark" aria-label="Log sebelumnya" title="Log sebelumnya" disabled={!prev} onClick={() => prev && setDay(prev)}>
              <Icon name="chevronLeft" size={16} />
            </button>
            <input type="date" value={day} aria-label="Tanggal rangkuman" onChange={(e) => e.target.value && setDay(e.target.value)} />
            <button type="button" className="icon-button dark" aria-label="Log berikutnya" title="Log berikutnya" disabled={!next} onClick={() => next && setDay(next)}>
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
          <div className="log-seg" role="group" aria-label="Format">
            {(
              [
                ['paragraf', 'Paragraf'],
                ['poin', 'Poin-poin'],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" className={format === key ? 'on' : undefined} aria-pressed={format === key} onClick={() => setFormat(key)}>
                {label}
              </button>
            ))}
          </div>
          <div className="log-seg" role="group" aria-label="Jam">
            {(
              [
                [true, 'Pakai jam'],
                [false, 'Tanpa jam'],
              ] as const
            ).map(([key, label]) => (
              <button key={label} type="button" className={withTime === key ? 'on' : undefined} aria-pressed={withTime === key} onClick={() => setWithTime(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {dates.length > 0 && (
          <div className="sum-chips" aria-label="Tanggal yang punya log">
            {dates
              .slice(-7)
              .reverse()
              .map((d) => {
                const x = parseDate(d);
                return (
                  <button key={d} type="button" className={d === day ? 'on' : undefined} aria-pressed={d === day} onClick={() => setDay(d)}>
                    {HARI[x.getDay()].slice(0, 3)}, {x.getDate()} {BULAN[x.getMonth()]}
                  </button>
                );
              })}
          </div>
        )}

        {log?.activities.length ? (
          // key: teks dibuat ulang saat tanggal / format / jam diganti; suntingan sebelumnya dibuang.
          <SummaryBlocks key={`${day}-${format}-${withTime}`} log={log} format={format} withTime={withTime} onCopied={onCopied} />
        ) : (
          <div className="sum-empty">
            <span>Belum ada log pekerjaan pada {formatDateLong(day)}.</span>
            {canWrite && (
              <button type="button" className="small" onClick={() => onWrite(day)}>
                Tulis log tanggal ini
              </button>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}

const BLOCKS = [
  ['kegiatan', 'Kegiatan / aktivitas', 'kerja'],
  ['pembelajaran', 'Pembelajaran', 'learn'],
  ['kendala', 'Kendala', 'issue'],
] as const;
type BlockKey = (typeof BLOCKS)[number][0];

function SummaryBlocks({
  log,
  format,
  withTime,
  onCopied,
}: {
  log: DailyLog;
  format: SummaryFormat;
  withTime: boolean;
  onCopied: () => void;
}) {
  const [texts, setTexts] = useState(() => {
    const s = buildSummary(log, format, withTime);
    return { kegiatan: s.kegiatan, pembelajaran: s.pembelajaran, kendala: s.kendala, info: s };
  });
  const [copied, setCopied] = useState<BlockKey | 'all' | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async (text: string, which: BlockKey | 'all') => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API butuh HTTPS / izin; cadangan lama untuk browser yang menolak.
      const ta = Object.assign(document.createElement('textarea'), { value: text });
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(which);
    if (which === 'all') onCopied();
  };

  const all = [`Kegiatan:\n${texts.kegiatan.trim()}`, `Pembelajaran:\n${texts.pembelajaran.trim()}`, `Kendala:\n${texts.kendala.trim()}`].join('\n\n');

  return (
    <>
      <div className="sum-info">
        <span>
          <strong>{formatDateLong(log.log_date)}</strong> · {texts.info.activityCount} kegiatan
          {texts.info.minutes ? ` · ${durationLong(texts.info.minutes)}` : ''}
        </span>
        <button type="button" className="small" onClick={() => copy(all, 'all')}>
          <Icon name="copy" size={14} /> {copied === 'all' ? 'Tersalin' : 'Salin semua'}
        </button>
      </div>
      {BLOCKS.map(([key, label, tone]) => (
        <div key={key} className={`sum-block ${tone}`}>
          <div className="sum-block-head">
            <b>{label}</b>
            <span className="muted small-text">{texts[key].length} karakter</span>
            <button type="button" className={`sum-copy${copied === key ? ' ok' : ''}`} onClick={() => copy(texts[key], key)}>
              {copied === key ? 'Tersalin ✓' : 'Salin'}
            </button>
          </div>
          <textarea value={texts[key]} aria-label={`Rangkuman ${label.toLowerCase()}`} onChange={(e) => setTexts((t) => ({ ...t, [key]: e.target.value }))} />
        </div>
      ))}
      <p className="muted small-text">
        Teks bisa diedit langsung sebelum disalin. Rangkuman disusun otomatis dari poin-poin log, jadi cek lagi agar sesuai format
        dashboard tujuan.
      </p>
    </>
  );
}
