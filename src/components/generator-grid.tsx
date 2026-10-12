'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { deleteKeywordRow, updateKeywordCell, type CellValue } from '@/app/actions';
import { STATUS_LABEL } from '@/lib/format';
import {
  QC_GROUPS,
  type DropdownOption,
  type Keyword,
  type OptionKind,
  type QcKey,
} from '@/lib/pipeline/types';
import { GenerateButton } from './forms';
import { Icon, type IconName } from './icons';

export type GridOptions = Record<OptionKind, Pick<DropdownOption, 'value' | 'color'>[]>;

type Field = keyof Keyword | `qc.${QcKey}`;

const NO_OPTIONS = Object.fromEntries(
  ['status_keyword', 'category', 'role', 'audience', 'copywriter', 'status_awal', 'feedback', 'status_akhir'].map((k) => [k, []]),
) as unknown as GridOptions;

export function GeneratorGrid({
  platformId,
  platforms,
  rows: initialRows,
  optionsByPlatform,
  mode = 'full',
  dateSort,
}: {
  /** null = tampilan semua platform (ada kolom Platform). */
  platformId: string | null;
  platforms: { id: string; name: string }[];
  rows: Keyword[];
  optionsByPlatform: Record<string, GridOptions>;
  /** 'qc' = hanya kolom yang dibutuhkan tim QC (dipakai di Dashboard). */
  mode?: 'full' | 'qc';
  /** Panah urut di header Jadwal Upload: urutan saat ini + link untuk membaliknya. */
  dateSort?: { oldestFirst: boolean; toggleHref: string };
}) {
  const full = mode === 'full';
  const showPlatform = platformId === null;
  const platformName = new Map(platforms.map((p) => [p.id, p.name]));
  // Isi dropdown mengikuti platform baris (opsi global + opsi khusus platform itu).
  const opts = (row: Keyword) => optionsByPlatform[row.platform_id] ?? NO_OPTIONS;
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Data server terbaru (mis. status generate) menggantikan salinan lokal.
  useEffect(() => setRows(initialRows), [initialRows]);

  // Tabel setinggi sisa layar, supaya scrollbar samping selalu terlihat walau 50 baris.
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const fit = () => {
      const top = wrap.getBoundingClientRect().top + window.scrollY;
      wrap.style.maxHeight = `${Math.max(320, window.innerHeight - Math.min(top, 260) - 70)}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const scrollBy = (dx: number) => wrapRef.current?.scrollBy({ left: dx, behavior: 'smooth' });
  const jumpTo = (section: string) => {
    const wrap = wrapRef.current;
    const th = wrap?.querySelector<HTMLElement>(`[data-section='${section}']`);
    if (!wrap || !th) return;
    // Posisi kolom relatif ke area scroll, dikurangi lebar kolom Keyword yang menempel di kiri.
    const sticky = wrap.querySelector<HTMLElement>('thead .sticky-col');
    const stickyRight = sticky ? sticky.getBoundingClientRect().right : wrap.getBoundingClientRect().left;
    const delta = th.getBoundingClientRect().left - stickyRight - 4;
    wrap.scrollTo({ left: Math.max(0, wrap.scrollLeft + delta), behavior: 'smooth' });
  };
  const sections: [string, string, IconName][] = full
    ? [
        ['input', 'Input', 'file'],
        ['ai', 'AI Output', 'sparkles'],
        ['copy', 'Copywriter', 'pen'],
        ['qc', 'QC Artikel', 'shield'],
        ['final', 'QC Final', 'checkCircle'],
      ]
    : [
        ['ai', 'Artikel', 'file'],
        ['copy', 'Copywriter', 'pen'],
        ['qc', 'QC Artikel', 'shield'],
        ['final', 'QC Final', 'checkCircle'],
      ];

  // Tandai bagian yang sedang terlihat di sebelah kanan kolom Keyword.
  const [activeSection, setActiveSection] = useState(sections[0][0]);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const onScroll = () => {
      const sticky = wrap.querySelector<HTMLElement>('thead .sticky-col');
      const edge = (sticky ? sticky.getBoundingClientRect().right : wrap.getBoundingClientRect().left) + 40;
      let current = sections[0][0];
      for (const [key] of sections) {
        const th = wrap.querySelector<HTMLElement>(`[data-section='${key}']`);
        if (th && th.getBoundingClientRect().left <= edge) current = key;
      }
      setActiveSection(current);
    };
    onScroll();
    wrap.addEventListener('scroll', onScroll, { passive: true });
    return () => wrap.removeEventListener('scroll', onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [full]);

  function save(row: Keyword, field: Field, value: CellValue) {
    const previous = rows;
    setRows((current) =>
      current.map((r) => {
        if (r.id !== row.id) return r;
        if (field.startsWith('qc.')) return { ...r, qc: { ...r.qc, [field.slice(3)]: value === true } };
        return { ...r, [field]: value };
      }),
    );
    setSaving(row.id);
    startTransition(async () => {
      const result = await updateKeywordCell(row.id, field, value);
      setSaving(null);
      if (result?.error) {
        setRows(previous);
        setMessage({ type: 'err', text: result.error });
      }
    });
  }

  function remove(row: Keyword) {
    if (!confirm(`Hapus keyword "${row.keyword}"? Riwayat prosesnya ikut terhapus.`)) return;
    startTransition(async () => {
      const result = await deleteKeywordRow(row.id);
      if (result?.error) setMessage({ type: 'err', text: result.error });
      else {
        setRows((current) => current.filter((r) => r.id !== row.id));
        router.refresh();
      }
    });
  }

  return (
    <>
      {message && (
        <div className={`grid-toast ${message.type}`} role={message.type === 'err' ? 'alert' : 'status'}>
          {message.text}
          <button type="button" className="link-button" onClick={() => setMessage(null)} aria-label="Tutup pesan">
            ×
          </button>
        </div>
      )}
      <div className="sheet-nav" role="toolbar" aria-label="Geser tabel (atau Shift + scroll mouse)">
        <button type="button" className="nav-arrow" onClick={() => scrollBy(-600)} aria-label="Geser ke kiri">
          <Icon name="chevronLeft" size={18} />
        </button>
        <div className="sec-buttons">
          {sections.map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              className={`sec-btn${activeSection === key ? ' active' : ''}`}
              aria-pressed={activeSection === key}
              onClick={() => jumpTo(key)}
            >
              <Icon name={icon} size={16} /> {label}
            </button>
          ))}
        </div>
        <button type="button" className="nav-arrow" onClick={() => scrollBy(600)} aria-label="Geser ke kanan">
          <Icon name="chevronRight" size={18} />
        </button>
      </div>
      <div className="sheet-wrap" ref={wrapRef}>
        <table className="sheet">
          <thead>
            <tr className="group-row">
              {full ? (
                <>
                  <th className="g-date">Tanggal</th>
                  <th colSpan={showPlatform ? 7 : 6} className="g-seo" data-section="input">
                    TIM SEO · Input
                  </th>
                  <th colSpan={4} className="g-ai" data-section="ai">
                    AI · Output
                  </th>
                </>
              ) : (
                <th colSpan={showPlatform ? 4 : 3} className="g-ai" data-section="ai">
                  Artikel
                </th>
              )}
              <th colSpan={3} className="g-copy" data-section="copy">
                Copywriter
              </th>
              {QC_GROUPS.map((g, i) => (
                <th key={g.title} colSpan={g.items.length} className="g-qc" data-section={i === 0 ? 'qc' : undefined}>
                  TIM SEO · {g.title}
                </th>
              ))}
              <th colSpan={3} className="g-final" data-section="final">
                QC Final
              </th>
              <th className="g-copy">Copywriter</th>
              <th colSpan={2} className="g-final">
                QC Final
              </th>
              <th className="g-ai">AI</th>
            </tr>
            <tr>
              {full && (
                <th>
                  {dateSort ? (
                    <Link
                      href={dateSort.toggleHref}
                      className="sort-link"
                      title={dateSort.oldestFirst ? 'Urutan: terlama dulu. Klik untuk terbaru dulu' : 'Urutan: terbaru dulu. Klik untuk terlama dulu'}
                    >
                      Jadwal Upload <Icon name={dateSort.oldestFirst ? 'arrowUp' : 'arrowDown'} size={14} />
                    </Link>
                  ) : (
                    'Jadwal Upload'
                  )}
                </th>
              )}
              {showPlatform && <th>Platform</th>}
              <th className="sticky-col">Keyword</th>
              {full && (
                <>
                  <th>Volume</th>
                  <th>Status Keyword</th>
                  <th>Category</th>
                  <th>Role</th>
                  <th>Audience</th>
                  <th>Status</th>
                  <th>Meta</th>
                </>
              )}
              <th>Judul</th>
              <th>Link Artikel</th>
              <th>Copywriter</th>
              <th>Tanggal Posting</th>
              <th>Link Artikel Posting</th>
              {QC_GROUPS.flatMap((g) =>
                g.items.map(([key, label]) => (
                  <th key={key} className="check-col">
                    {label}
                  </th>
                )),
              )}
              <th className="check-col">Index Check (Site:URL)</th>
              <th>Status Awal</th>
              <th>Keterangan</th>
              <th>Feedback</th>
              <th>Status Akhir</th>
              <th>Keterangan</th>
              <th>Execution</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={saving === row.id ? 'is-saving' : undefined}>
                {full && (
                  <td>
                    <DateCell value={row.schedule_date} onSave={(v) => save(row, 'schedule_date', v)} label="Jadwal upload" />
                  </td>
                )}
                {showPlatform && (
                  <td className="nowrap">
                    <span className="chip-static" data-color="biru">
                      {platformName.get(row.platform_id) ?? row.platform_id}
                    </span>
                  </td>
                )}
                <td className="sticky-col">
                  {full ? (
                    <TextCell value={row.keyword} onSave={(v) => save(row, 'keyword', v)} label="Keyword" wide />
                  ) : (
                    <strong className="cell-text">{row.keyword}</strong>
                  )}
                </td>
                {full && (
                <>
                <td>
                  <TextCell
                    value={row.volume === null ? '' : String(row.volume)}
                    onSave={(v) => save(row, 'volume', v)}
                    label="Volume"
                    numeric
                  />
                </td>
                <td>
                  <SelectCell value={row.keyword_status} options={opts(row).status_keyword} onSave={(v) => save(row, 'keyword_status', v)} label="Status keyword" />
                </td>
                <td>
                  <SelectCell value={row.category} options={opts(row).category} onSave={(v) => save(row, 'category', v)} label="Category" />
                </td>
                <td>
                  <SelectCell value={row.role} options={opts(row).role} onSave={(v) => save(row, 'role', v)} label="Role" />
                </td>
                <td>
                  <SelectCell value={row.audience} options={opts(row).audience} onSave={(v) => save(row, 'audience', v)} label="Audience" />
                </td>
                <td className="status-cell">
                  {/* Draft/Ready diatur tim; Diproses/Done/Error diatur proses generate. */}
                  {row.status === 'draft' || row.status === 'ready' ? (
                    <select
                      className="chip-select"
                      data-color={row.status === 'ready' ? 'hijau' : 'netral'}
                      value={row.status}
                      aria-label={`Status ${row.keyword}`}
                      onChange={(e) => save(row, 'status', e.target.value)}
                    >
                      <option value="draft">Draft</option>
                      <option value="ready">Ready</option>
                    </select>
                  ) : (
                    <span className={`badge ${row.status}`}>{STATUS_LABEL[row.status]}</span>
                  )}
                  {row.status === 'ready' && <GenerateButton keywordId={row.id} label="Generate" stay />}
                  {row.status === 'error' && (
                    <>
                      <GenerateButton keywordId={row.id} label="Lanjutkan" resume stay />
                      <span className="msg-err small-text clamp" title={row.last_error ?? ''}>
                        {row.last_error}
                      </span>
                    </>
                  )}
                </td>
                <td className="clamp-cell" title={row.meta ?? ''}>
                  {row.meta ?? <span className="muted">—</span>}
                </td>
                </>
                )}
                <td className="clamp-cell" title={row.title ?? ''}>
                  {row.title ?? <span className="muted">—</span>}
                </td>
                <td>
                  {row.wp_edit_url ? (
                    <a href={row.wp_edit_url} target="_blank" rel="noreferrer">
                      Edit di WP
                    </a>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td>
                  <SelectCell value={row.copywriter} options={opts(row).copywriter} onSave={(v) => save(row, 'copywriter', v)} label="Copywriter" />
                </td>
                <td>
                  <DateCell value={row.posted_at} onSave={(v) => save(row, 'posted_at', v)} label="Tanggal posting" />
                </td>
                <td>
                  <TextCell value={row.posted_url ?? ''} onSave={(v) => save(row, 'posted_url', v)} label="Link artikel posting" />
                </td>
                {QC_GROUPS.flatMap((g) =>
                  g.items.map(([key, label]) => (
                    <td key={key} className="check-col">
                      <CheckCell checked={!!row.qc[key]} onSave={(v) => save(row, `qc.${key}`, v)} label={label} />
                    </td>
                  )),
                )}
                <td className="check-col">
                  <CheckCell checked={!!row.qc.index_check} onSave={(v) => save(row, 'qc.index_check', v)} label="Index check" />
                </td>
                <td>
                  <SelectCell value={row.status_awal} options={opts(row).status_awal} onSave={(v) => save(row, 'status_awal', v)} label="Status awal" />
                </td>
                <td>
                  <TextCell value={row.note_awal ?? ''} onSave={(v) => save(row, 'note_awal', v)} label="Keterangan status awal" />
                </td>
                <td>
                  <SelectCell value={row.feedback} options={opts(row).feedback} onSave={(v) => save(row, 'feedback', v)} label="Feedback" />
                </td>
                <td>
                  <SelectCell value={row.status_akhir} options={opts(row).status_akhir} onSave={(v) => save(row, 'status_akhir', v)} label="Status akhir" />
                </td>
                <td>
                  <TextCell value={row.note_akhir ?? ''} onSave={(v) => save(row, 'note_akhir', v)} label="Keterangan status akhir" />
                </td>
                <td className="nowrap">
                  <Link href={`/generator/${row.id}`}>Detail</Link>
                  {full && (
                    <button type="button" className="link-button danger" onClick={() => remove(row)} aria-label={`Hapus ${row.keyword}`}>
                      Hapus
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TextCell({
  value,
  onSave,
  label,
  numeric,
  wide,
}: {
  value: string;
  onSave: (v: string) => void;
  label: string;
  numeric?: boolean;
  wide?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (draft.trim() !== value.trim()) onSave(draft);
  };
  return (
    <input
      className={`cell-input${wide ? ' wide' : ''}${numeric ? ' numeric' : ''}`}
      value={draft}
      inputMode={numeric ? 'numeric' : undefined}
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        if (e.key === 'Escape') setDraft(value);
      }}
    />
  );
}

function DateCell({ value, onSave, label }: { value: string | null; onSave: (v: string | null) => void; label: string }) {
  return (
    <input
      type="date"
      className="cell-input date"
      value={value ?? ''}
      aria-label={label}
      onChange={(e) => onSave(e.target.value || null)}
    />
  );
}

function SelectCell({
  value,
  options,
  onSave,
  label,
}: {
  value: string | null;
  options: Pick<DropdownOption, 'value' | 'color'>[];
  onSave: (v: string | null) => void;
  label: string;
}) {
  const current = value ?? '';
  const known = options.find((o) => o.value === current);
  return (
    <select
      className="chip-select"
      data-color={current ? (known?.color ?? 'netral') : 'kosong'}
      value={current}
      aria-label={label}
      onChange={(e) => onSave(e.target.value || null)}
    >
      <option value="">—</option>
      {/* Nilai lama yang sudah tidak ada di daftar tetap ditampilkan. */}
      {current && !known && <option value={current}>{current}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.value}
        </option>
      ))}
    </select>
  );
}

function CheckCell({ checked, onSave, label }: { checked: boolean; onSave: (v: boolean) => void; label: string }) {
  return <input type="checkbox" className="cell-check" checked={checked} aria-label={label} onChange={(e) => onSave(e.target.checked)} />;
}
