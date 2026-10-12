'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { GenerateButton } from './forms';
import { Icon } from './icons';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

/* ---------------- Filter ---------------- */

export function DashboardFilters({
  platforms,
  years,
  value,
}: {
  platforms: { id: string; name: string }[];
  years: number[];
  value: { platform: string; year: number; month: number; date: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(value.year, value.month, 0).getDate();
  const min = `${value.year}-${pad(value.month)}-01`;
  const max = `${value.year}-${pad(value.month)}-${pad(lastDay)}`;

  return (
    <div className="dash-filters card">
      <label>
        Platform
        <select value={value.platform} onChange={(e) => set({ platform: e.target.value })}>
          <option value="">Semua platform</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tahun
        <select value={value.year} onChange={(e) => set({ tahun: e.target.value, tanggal: '' })}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <label>
        Bulan
        <select value={value.month} onChange={(e) => set({ bulan: e.target.value, tanggal: '' })}>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tanggal dibuat
        <span className="row" style={{ flexWrap: 'nowrap' }}>
          <input
            type="date"
            value={value.date}
            min={min}
            max={max}
            onChange={(e) => set({ tanggal: e.target.value })}
            aria-label="Tanggal"
          />
          {value.date && (
            <button type="button" className="link-button" onClick={() => set({ tanggal: '' })}>
              Semua tanggal
            </button>
          )}
        </span>
      </label>
    </div>
  );
}

/* ---------------- Produksi artikel harian (batang bertumpuk per platform) ---------------- */

export type ChartSeries = { id: string; name: string; color: string };
export type ChartDay = {
  key: string;
  day: number;
  label: string;
  total: number;
  /** Jumlah per seri (7 platform berwarna + "Lainnya") untuk tumpukan batang. */
  bySeries: Record<string, number>;
  /** Rincian tooltip: semua platform, urut terbanyak. [nama, jumlah, warna] */
  parts: [string, number, string][];
};

export function DailyBarChart({ days, series, monthShort }: { days: ChartDay[]; series: ChartSeries[]; monthShort: string }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  // Sumbu Y: maksimal ~4 interval angka bulat, plus satu ruang di atas.
  const step = Math.max(1, Math.ceil(max / 4));
  const top = step * (Math.ceil(max / step) + (max % step === 0 ? 1 : 0));
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => top - i * step);

  return (
    <div className="card chart-card">
      <h2>Produksi Artikel Harian</h2>
      <div className="bar-chart" role="group" aria-label={`Produksi artikel harian, ${monthShort}`}>
        <div className="plot">
          {ticks.map((t) => (
            <div key={t} className="gridline" style={{ bottom: `${(t / top) * 100}%` }}>
              <span>{t}</span>
            </div>
          ))}
          <div className="columns">
            {days.map((d, i) => {
              const dayLabel = `${String(d.day).padStart(2, '0')} ${monthShort}`;
              // Tooltip di sisi kanan batang; untuk batang di separuh kanan, pindah ke kiri.
              const side = i >= days.length / 2 ? ' tip-left' : '';
              return (
                <div
                  key={d.key}
                  className={`column${side}`}
                  tabIndex={0}
                  aria-label={`${dayLabel}: ${d.total} artikel${d.parts
                    .filter(([, n]) => n > 0)
                    .map(([name, n]) => `, ${name} ${n}`)
                    .join('')}`}
                >
                  <span className="stack" style={{ height: `${(d.total / top) * 100}%` }}>
                    {series.map((s) =>
                      d.bySeries[s.id] ? (
                        <span key={s.id} className="segment" style={{ flexGrow: d.bySeries[s.id], background: s.color }} />
                      ) : null,
                    )}
                  </span>
                  <span className="bar-tip" role="tooltip">
                    <span className="tip-date">{dayLabel}</span>
                    <span className="tip-row tip-total">
                      <span>Total artikel</span>
                      <b>{d.total}</b>
                    </span>
                    {d.parts.map(([name, n, color]) => (
                      <span key={name} className={`tip-row${n === 0 ? ' is-zero' : ''}`}>
                        <span>
                          <i className="dot" style={{ background: color }} /> {name}
                        </span>
                        <b>{n}</b>
                      </span>
                    ))}
                  </span>
                  <span className="x-label">{dayLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Antrean artikel (belum digenerate) ---------------- */

export type ReadyRow = { id: string; keyword: string; platformId: string; platformName: string; createdAt: string };

const PAGE_SIZE = 10;

export const initials = (name: string) => {
  const caps = name.replace(/[^A-Z]/g, '');
  return (caps.length >= 2 ? caps.slice(0, 2) : name.slice(0, 2)).toUpperCase();
};

export function QueueTable({ rows }: { rows: ReadyRow[] }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.keyword.toLowerCase().includes(q) || r.platformName.toLowerCase().includes(q)) : rows;
  }, [rows, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  return (
    <div className="card">
      <div className="table-head">
        <h2>
          Antrean Artikel <span className="count-pill">{rows.length} keyword</span>
        </h2>
        <label className="search-box">
          <Icon name="search" size={16} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Cari keyword atau platform…"
            aria-label="Cari antrean artikel"
          />
        </label>
      </div>
      <div className="table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>No.</th>
              <th>Keyword</th>
              <th>Platform</th>
              <th>Tanggal dibuat</th>
              <th>Status</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  {rows.length ? 'Tidak ada yang cocok.' : 'Semua keyword sudah digenerate.'}
                </td>
              </tr>
            )}
            {shown.map((r, i) => (
              <tr key={r.id}>
                <td className="muted">{(current - 1) * PAGE_SIZE + i + 1}</td>
                <td>{r.keyword}</td>
                <td>
                  <span className="platform-mark">{initials(r.platformName)}</span> {r.platformName}
                </td>
                <td className="muted">
                  {new Date(r.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
                <td>
                  <span className="badge warn">Ready</span>
                </td>
                <td>
                  <GenerateButton keywordId={r.id} label="Generate" stay />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length > PAGE_SIZE && (
        <div className="pager">
          <span className="muted small-text">
            Menampilkan {(current - 1) * PAGE_SIZE + 1}–{Math.min(current * PAGE_SIZE, filtered.length)} dari {filtered.length} keyword
          </span>
          <div className="row">
            <button type="button" className="secondary small" disabled={current === 1} onClick={() => setPage(current - 1)}>
              <Icon name="arrowLeft" size={14} /> Sebelumnya
            </button>
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                className={p === current ? 'small' : 'secondary small'}
                aria-current={p === current ? 'page' : undefined}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button type="button" className="secondary small" disabled={current === pages} onClick={() => setPage(current + 1)}>
              Selanjutnya <Icon name="arrowRight" size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Ringkasan platform ---------------- */

export type PlatformSummaryRow = {
  id: string;
  name: string;
  total: number;
  waiting: number;
  generated: number;
  error: number;
  ready: boolean;
  missing: string[];
};

export function PlatformSummaryTable({ rows, leader }: { rows: PlatformSummaryRow[]; leader: boolean }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'ready' | 'incomplete'>('all');
  const filtered = rows.filter(
    (r) =>
      r.name.toLowerCase().includes(query.trim().toLowerCase()) &&
      (status === 'all' || (status === 'ready' ? r.ready : !r.ready)),
  );

  return (
    <div className="card">
      <div className="table-head">
        <h2>Ringkasan platform</h2>
        <div className="row">
          <label className="search-box">
            <Icon name="search" size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari platform…" aria-label="Cari platform" />
          </label>
          <label className="search-box">
            <Icon name="filter" size={16} />
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter status konfigurasi">
              <option value="all">Semua status</option>
              <option value="ready">Siap</option>
              <option value="incomplete">Belum lengkap</option>
            </select>
          </label>
        </div>
      </div>
      <div className="table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>Platform</th>
              <th>Keyword</th>
              <th>Menunggu</th>
              <th>Generated</th>
              <th>Error</th>
              <th>Konfigurasi</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  Tidak ada platform yang cocok.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <span className="platform-mark">{initials(r.name)}</span> <strong>{r.name}</strong>
                </td>
                <td>{r.total}</td>
                <td>{r.waiting}</td>
                <td>{r.generated}</td>
                <td>{r.error ? <span className="badge error">{r.error}</span> : 0}</td>
                <td>
                  {r.ready ? (
                    <span className="badge done">Siap</span>
                  ) : leader ? (
                    <Link href={`/konfigurasi/${r.id}`} className="badge warn" title={`Kurang: ${r.missing.join(', ')}`}>
                      Belum lengkap
                    </Link>
                  ) : (
                    <span className="badge warn" title={`Kurang: ${r.missing.join(', ')}`}>
                      Belum lengkap
                    </span>
                  )}
                </td>
                <td>
                  <Link href={`/generator?platform=${encodeURIComponent(r.id)}`} className="btn-outline">
                    Detail
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
