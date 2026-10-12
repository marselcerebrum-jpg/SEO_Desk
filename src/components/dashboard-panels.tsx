'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Keyword } from '@/lib/pipeline/types';
import { QueueTable, initials } from './dashboard-widgets';
import { GenerateButton } from './forms';
import { GeneratorGrid, type GridOptions } from './generator-grid';
import { Icon, type IconName } from './icons';

const PANEL_KEYS = ['total', 'menunggu', 'proses', 'generated', 'qc', 'error'] as const;
type PanelKey = (typeof PANEL_KEYS)[number];

const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');
const date = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

// Ready for QC: sudah generated tetapi Status Akhir (QC final) belum diisi.
export const needsQc = (k: Keyword) => k.status === 'generated' && !k.status_akhir;

export function DashboardPanels({
  keywords,
  platforms,
  optionsByPlatform,
  runningStep,
  initialView,
}: {
  keywords: Keyword[];
  platforms: { id: string; name: string }[];
  optionsByPlatform: Record<string, GridOptions>;
  /** keywordId -> nama tahap yang sedang berjalan */
  runningStep: Record<string, string>;
  /** dari ?view= di URL, agar panel bisa dibuka lewat link */
  initialView?: string;
}) {
  // null = tampilan default (tanpa panel). Klik kartu membuka panel, klik lagi menutup.
  const [view, setViewState] = useState<PanelKey | null>(
    PANEL_KEYS.includes(initialView as PanelKey) ? (initialView as PanelKey) : null,
  );

  // Panel yang terbuka disimpan di URL (?view=) agar bisa dibagikan dan bertahan saat refresh.
  function setView(next: PanelKey | null) {
    setViewState(next);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set('view', next);
    else url.searchParams.delete('view');
    window.history.replaceState(null, '', url);
  }

  useEffect(() => {
    if (!view) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setView(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [view]);
  const platformName = useMemo(() => new Map(platforms.map((p) => [p.id, p.name])), [platforms]);
  const nameOf = (id: string) => platformName.get(id) ?? id;

  const groups = useMemo(() => {
    const by = (pred: (k: Keyword) => boolean) => keywords.filter(pred);
    return {
      // Menunggu generate = sudah Ready tetapi belum digenerate (Draft belum dihitung).
      menunggu: by((k) => k.status === 'ready'),
      proses: by((k) => k.status === 'processing'),
      generated: by((k) => k.status === 'generated'),
      qc: by(needsQc),
      error: by((k) => k.status === 'error'),
    };
  }, [keywords]);
  const uniqueCount = useMemo(() => new Set(keywords.map((k) => normalize(k.keyword))).size, [keywords]);

  const cards: { key: PanelKey; label: string; value: number; sub: string; icon: IconName; tone: string }[] = [
    { key: 'total', label: 'Total keyword', value: uniqueCount, sub: `unik dari ${keywords.length} keyword`, icon: 'search', tone: 'navy' },
    { key: 'menunggu', label: 'Menunggu generate', value: groups.menunggu.length, sub: 'ready, belum digenerate', icon: 'clock', tone: 'yellow' },
    { key: 'proses', label: 'Sedang diproses', value: groups.proses.length, sub: 'sedang digenerate', icon: 'refresh', tone: 'navy' },
    { key: 'generated', label: 'Generated', value: groups.generated.length, sub: 'berhasil digenerate', icon: 'check', tone: 'green' },
    { key: 'qc', label: 'Ready for QC', value: groups.qc.length, sub: 'menunggu QC', icon: 'layers', tone: 'orange' },
    { key: 'error', label: 'Error', value: groups.error.length, sub: 'gagal digenerate', icon: 'x', tone: 'red' },
  ];

  return (
    <>
      <div className="stat-row" aria-label="Ringkasan artikel">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-expanded={view === c.key}
            aria-controls="dash-panel"
            title={view === c.key ? 'Klik lagi untuk menutup' : 'Lihat rincian'}
            className={`stat-card tone-${c.tone}${view === c.key ? ' selected' : ''}`}
            onClick={() => setView(view === c.key ? null : c.key)}
          >
            <span className="stat-icon">
              <Icon name={c.icon} size={20} />
            </span>
            <span>
              <span className="label">{c.label}</span>
              <span className="value">{c.value}</span>
              <span className="sub">{c.sub}</span>
            </span>
          </button>
        ))}
      </div>

      {view && (
      <section id="dash-panel" className="dash-panel">
        <div className="panel-close">
          <button type="button" className="secondary small" onClick={() => setView(null)}>
            <Icon name="x" size={14} /> Tutup rincian
          </button>
        </div>
        {view === 'total' && <KeywordBreakdown keywords={keywords} nameOf={nameOf} />}

        {view === 'menunggu' && (
          <QueueTable
            rows={groups.menunggu
              .slice()
              .sort((a, b) => a.created_at.localeCompare(b.created_at))
              .map((k) => ({ id: k.id, keyword: k.keyword, platformId: k.platform_id, platformName: nameOf(k.platform_id), createdAt: k.created_at }))}
          />
        )}

        {view === 'proses' && (
          <SimpleTable
            title="Sedang diproses"
            empty="Tidak ada artikel yang sedang digenerate."
            headers={['Keyword', 'Platform', 'Tahap', '']}
            rows={groups.proses.map((k) => [
              k.keyword,
              <PlatformCell key="p" name={nameOf(k.platform_id)} />,
              <span key="s" className="badge running">
                {runningStep[k.id] ?? 'Memulai'}
              </span>,
              <Link key="d" href={`/generator/${k.id}`} className="btn-outline">
                Lihat progres
              </Link>,
            ])}
          />
        )}

        {view === 'generated' && (
          <SimpleTable
            title="Artikel generated"
            empty="Belum ada artikel yang berhasil digenerate."
            headers={['Keyword', 'Platform', 'Judul', 'Status QC', 'WordPress']}
            rows={groups.generated.map((k) => [
              k.keyword,
              <PlatformCell key="p" name={nameOf(k.platform_id)} />,
              <span key="t" className="clamp" title={k.title ?? ''}>
                {k.title ?? '—'}
              </span>,
              needsQc(k) ? (
                <span key="q" className="badge warn">
                  Menunggu QC
                </span>
              ) : (
                <span key="q" className="badge done">
                  {k.status_akhir}
                </span>
              ),
              k.wp_edit_url ? (
                <a key="w" href={k.wp_edit_url} target="_blank" rel="noreferrer">
                  Edit di WP
                </a>
              ) : (
                <span key="w" className="muted">
                  —
                </span>
              ),
            ])}
          />
        )}

        {view === 'qc' && (
          <div className="card">
            <div className="table-head">
              <h2>
                Ready for QC <span className="count-pill">{groups.qc.length} artikel</span>
              </h2>
              <span className="muted small-text">
                Centang checklist dan isi Status Akhir. Artikel keluar dari daftar ini setelah Status Akhir diisi.
              </span>
            </div>
            {groups.qc.length === 0 ? (
              <p className="muted">Tidak ada artikel yang menunggu QC.</p>
            ) : (
              <GeneratorGrid
                mode="qc"
                platformId={null}
                platforms={platforms}
                rows={groups.qc}
                optionsByPlatform={optionsByPlatform}
              />
            )}
          </div>
        )}

        {view === 'error' && (
          <SimpleTable
            title="Gagal generate"
            empty="Tidak ada artikel yang gagal."
            headers={['Keyword', 'Platform', 'Penyebab', 'Aksi']}
            rows={groups.error.map((k) => [
              k.keyword,
              <PlatformCell key="p" name={nameOf(k.platform_id)} />,
              <span key="e" className="msg-err small-text">
                {k.last_error ?? 'Tidak diketahui'}
              </span>,
              <GenerateButton key="g" keywordId={k.id} label="Lanjutkan" resume stay />,
            ])}
          />
        )}
      </section>
      )}
    </>
  );
}

function PlatformCell({ name }: { name: string }) {
  return (
    <span className="nowrap">
      <span className="platform-mark">{initials(name)}</span> {name}
    </span>
  );
}

function SimpleTable({
  title,
  empty,
  headers,
  rows,
}: {
  title: string;
  empty: string;
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="card">
      <div className="table-head">
        <h2>
          {title} <span className="count-pill">{rows.length} artikel</span>
        </h2>
      </div>
      <div className="table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>No.</th>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={headers.length + 1} className="muted">
                  {empty}
                </td>
              </tr>
            )}
            {rows.map((cells, i) => (
              <tr key={i}>
                <td className="muted">{i + 1}</td>
                {cells.map((cell, j) => (
                  <td key={j}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KeywordBreakdown({ keywords, nameOf }: { keywords: Keyword[]; nameOf: (id: string) => string }) {
  const { perPlatform, duplicates, unique } = useMemo(() => {
    const byText = new Map<string, Keyword[]>();
    for (const k of keywords) {
      const key = normalize(k.keyword);
      byText.set(key, [...(byText.get(key) ?? []), k]);
    }
    const platformIds = [...new Set(keywords.map((k) => k.platform_id))];
    return {
      unique: byText.size,
      duplicates: [...byText.values()].filter((list) => list.length > 1),
      perPlatform: platformIds
        .map((id) => {
          const own = keywords.filter((k) => k.platform_id === id);
          return { id, total: own.length, unique: new Set(own.map((k) => normalize(k.keyword))).size };
        })
        .sort((a, b) => b.total - a.total),
    };
  }, [keywords]);

  return (
    <div className="card">
      <div className="table-head">
        <h2>Rincian keyword</h2>
      </div>
      <div className="breakdown-totals">
        <div>
          <span className="muted small-text">Keyword unik</span>
          <strong>{unique}</strong>
        </div>
        <div>
          <span className="muted small-text">Total keyword</span>
          <strong>{keywords.length}</strong>
        </div>
        <div>
          <span className="muted small-text">Dobel</span>
          <strong>{keywords.length - unique}</strong>
        </div>
      </div>

      <div className="breakdown-grid">
        <div className="table-wrap">
          <table className="dash-table">
            <thead>
              <tr>
                <th>Platform</th>
                <th>Unik</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {perPlatform.map((p) => (
                <tr key={p.id}>
                  <td>
                    <PlatformCell name={nameOf(p.id)} />
                  </td>
                  <td>{p.unique}</td>
                  <td>{p.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <h3>Keyword dobel</h3>
          {duplicates.length === 0 ? (
            <p className="muted small-text">Tidak ada keyword yang dobel.</p>
          ) : (
            <ul className="list">
              {duplicates.map((list) => (
                <li key={list[0].id}>
                  <span style={{ flex: 1 }}>{list[0].keyword}</span>
                  <span className="muted small-text">
                    {list.length}× · {[...new Set(list.map((k) => nameOf(k.platform_id)))].join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
