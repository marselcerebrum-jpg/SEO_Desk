'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { saveDropdownOptions, type ActionState } from '@/app/actions';
import { OPTION_COLORS, OPTION_KINDS, type DropdownOption, type OptionKind } from '@/lib/pipeline/types';
import { Message } from './forms';
import { Icon } from './icons';

type Row = { key: string; id?: string; value: string; color: string; platform_id: string | null };

const DESCRIPTIONS: Record<OptionKind, string> = {
  status_keyword: 'Label tren keyword di kolom Status Keyword (mis. Trending, Evergreen).',
  category: 'Kategori artikel. Harus sama persis dengan nama kategori di WordPress platform tersebut.',
  role: 'Sudut pandang penulis yang dipakai di prompt (__ROLE__).',
  audience: 'Target pembaca yang dipakai di prompt (__AUDIENCE__).',
  copywriter: 'Nama copywriter (PIC) yang mengunggah artikel.',
  status_awal: 'Status QC awal dari tim SEO.',
  feedback: 'Feedback copywriter setelah QC awal.',
  status_akhir: 'Status QC final. Artikel keluar dari daftar "Ready for QC" setelah diisi.',
};

let counter = 0;
const newKey = () => `new-${++counter}`;
const toRows = (options: DropdownOption[], kind: OptionKind): Row[] =>
  options
    .filter((o) => o.kind === kind)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((o) => ({ key: o.id, id: o.id, value: o.value, color: o.color, platform_id: o.platform_id }));

export function DropdownEditor({
  options,
  platforms,
}: {
  options: DropdownOption[];
  platforms: { id: string; name: string }[];
}) {
  const router = useRouter();
  const kinds = Object.keys(OPTION_KINDS) as OptionKind[];
  const [kind, setKind] = useState<OptionKind>('category');
  // Perubahan yang belum disimpan, per jenis dropdown.
  const [drafts, setDrafts] = useState<Partial<Record<OptionKind, Row[]>>>({});
  const [result, setResult] = useState<ActionState>(undefined);
  const [pending, startTransition] = useTransition();

  const saved = toRows(options, kind);
  const rows = drafts[kind] ?? saved;
  const dirty = drafts[kind] !== undefined;
  const update = (next: Row[]) => {
    setDrafts((d) => ({ ...d, [kind]: next }));
    setResult(undefined);
  };
  const patch = (i: number, changes: Partial<Row>) => update(rows.map((r, j) => (j === i ? { ...r, ...changes } : r)));
  const move = (i: number, dir: -1 | 1) => {
    const next = [...rows];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    update(next);
  };

  function selectKind(next: OptionKind) {
    if (next === kind) return;
    setKind(next);
    setResult(undefined);
  }

  function discard() {
    setDrafts((d) => {
      const { [kind]: _, ...rest } = d;
      return rest;
    });
    setResult(undefined);
  }

  function save() {
    startTransition(async () => {
      const res = await saveDropdownOptions(
        kind,
        rows.map(({ id, value, color, platform_id }) => ({ id, value, color, platform_id })),
      );
      setResult(res);
      if (res?.ok) {
        discard();
        setResult(res);
        router.refresh();
      }
    });
  }

  return (
    <div className="dd-layout">
      <nav className="dd-kinds" aria-label="Jenis dropdown">
        {kinds.map((k) => {
          const count = (drafts[k] ?? toRows(options, k)).length;
          return (
            <button key={k} type="button" className={k === kind ? 'active' : undefined} aria-current={k === kind} onClick={() => selectKind(k)}>
              <span>
                {OPTION_KINDS[k]}
                {drafts[k] && <span className="dd-dot" title="Ada perubahan belum disimpan" />}
              </span>
              <span className="dd-count">{count}</span>
            </button>
          );
        })}
      </nav>

      <section className="dd-panel">
        <header className="dd-panel-head">
          <h2>{OPTION_KINDS[kind]}</h2>
          <p className="muted small-text">{DESCRIPTIONS[kind]}</p>
        </header>

        <div className="dd-body">
          <div className="dd-row dd-row-head">
            <span>Urutan</span>
            <span>Nama pilihan</span>
            <span>Berlaku untuk</span>
            <span>Warna</span>
            <span />
          </div>
          {rows.length === 0 && <p className="muted small-text dd-empty">Belum ada pilihan. Klik &quot;Tambah pilihan&quot;.</p>}
          {rows.map((r, i) => (
            <div key={r.key} className="dd-row">
              <span className="dd-order">
                <button type="button" className="dd-icon" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Naikkan ${r.value}`}>
                  <Icon name="arrowUp" size={14} />
                </button>
                <button type="button" className="dd-icon" disabled={i === rows.length - 1} onClick={() => move(i, 1)} aria-label={`Turunkan ${r.value}`}>
                  <Icon name="arrowDown" size={14} />
                </button>
              </span>
              <input value={r.value} onChange={(e) => patch(i, { value: e.target.value })} placeholder="Nama pilihan" aria-label="Nama pilihan" />
              <select value={r.platform_id ?? ''} onChange={(e) => patch(i, { platform_id: e.target.value || null })} aria-label="Berlaku untuk">
                <option value="">Semua platform</option>
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <span className="dd-color">
                <select value={r.color} onChange={(e) => patch(i, { color: e.target.value })} aria-label="Warna">
                  {OPTION_COLORS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <span className="chip-static" data-color={r.color}>
                  {r.value || 'Contoh'}
                </span>
              </span>
              <button type="button" className="dd-icon danger" onClick={() => update(rows.filter((_, j) => j !== i))} aria-label={`Hapus ${r.value}`}>
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="dd-add"
            onClick={() => update([...rows, { key: newKey(), value: '', color: 'netral', platform_id: null }])}
          >
            <Icon name="plus" size={16} /> Tambah pilihan
          </button>
        </div>

        <footer className="dd-foot">
          <span className="muted small-text">
            {rows.length} pilihan{dirty ? ' · ada perubahan belum disimpan' : ''}
          </span>
          <span className="row">
            <Message state={result} />
            {dirty && (
              <button type="button" className="secondary" disabled={pending} onClick={discard}>
                Batalkan
              </button>
            )}
            <button type="button" disabled={!dirty || pending} onClick={save}>
              {pending ? 'Menyimpan…' : 'Simpan perubahan'}
            </button>
          </span>
        </footer>
      </section>
    </div>
  );
}
