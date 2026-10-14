'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { deleteResource, saveResource, setResourceStatus, type ActionState } from '@/app/actions';
import {
  domainOf,
  formatDate,
  guessKind,
  RESOURCE_KINDS,
  RESOURCE_STATUS,
  sortResources,
  type LearningResource,
  type ResourceKind,
  type ResourceStatus,
} from '@/lib/daily-log';
import { RichText } from './daily-log-parts';
import { Message } from './forms';
import { Icon, type IconName } from './icons';

const KIND_ICON: Record<ResourceKind, IconName> = {
  video: 'video',
  artikel: 'notebook',
  dokumen: 'file',
  kursus: 'book',
  data: 'database',
  lainnya: 'link',
};

export function ResourcesTab({
  resources,
  today,
  readOnly,
  onToast,
}: {
  resources: LearningResource[];
  today: string;
  readOnly: boolean;
  onToast: (state: ActionState) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<'' | ResourceStatus>('');
  const [kind, setKind] = useState<'' | ResourceKind>('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<LearningResource | 'new' | null>(null);
  const [, startTransition] = useTransition();

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortResources(
      resources.filter(
        (r) =>
          (!status || r.status === status) &&
          (!kind || r.kind === kind) &&
          (!q || [r.title, r.note, r.url, ...r.tags].join(' ').toLowerCase().includes(q)),
      ),
    );
  }, [resources, status, kind, query]);

  const done = resources.filter((r) => r.status === 'selesai').length;
  const run = (task: () => Promise<ActionState>) =>
    startTransition(async () => {
      onToast(await task());
      router.refresh();
    });

  return (
    <>
      <section className="card log-toolbar res-toolbar">
        <div className="log-seg" role="group" aria-label="Status">
          {([['', 'Semua'], ...Object.entries(RESOURCE_STATUS)] as [string, string][]).map(([key, label]) => (
            <button key={key} type="button" className={status === key ? 'on' : undefined} aria-pressed={status === key} onClick={() => setStatus(key as '' | ResourceStatus)}>
              {label}
            </button>
          ))}
        </div>
        <select className="res-kind" value={kind} aria-label="Filter jenis" onChange={(e) => setKind(e.target.value as '' | ResourceKind)}>
          <option value="">Semua jenis</option>
          {Object.entries(RESOURCE_KINDS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <label className="search-box log-search">
          <Icon name="search" size={16} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari judul, topik, catatan…" aria-label="Cari bahan" />
        </label>
        {!readOnly && (
          <button type="button" className="small res-add" onClick={() => setEditing('new')}>
            <Icon name="plus" size={15} /> Tambah bahan
          </button>
        )}
        <div className="res-progress">
          <span>
            {done} dari {resources.length} bahan selesai dipelajari
          </span>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={resources.length} aria-valuenow={done}>
            <i style={{ width: `${resources.length ? (done / resources.length) * 100 : 0}%` }} />
          </div>
        </div>
      </section>

      {list.length === 0 ? (
        <div className="card log-empty">
          <strong>Belum ada bahan belajar</strong>
          <span className="muted">
            {readOnly ? 'Anggota ini belum menyimpan bahan yang cocok dengan filter.' : 'Klik "Tambah bahan" untuk menyimpan link atau data yang perlu dipelajari.'}
          </span>
        </div>
      ) : (
        <section className="res-grid">
          {list.map((r) => {
            const late = !!r.due_date && r.status !== 'selesai' && r.due_date < today;
            const domain = domainOf(r.url);
            return (
              <article key={r.id} className={`res-card st-${r.status}`}>
                <div className="res-top">
                  <span className={`res-icon k-${r.kind}`}>
                    <Icon name={KIND_ICON[r.kind]} size={17} />
                  </span>
                  <div className="res-meta">
                    <span className={`res-kind-label k-${r.kind}`}>{RESOURCE_KINDS[r.kind]}</span>
                    {domain && <span className="res-domain">{domain}</span>}
                  </div>
                  {!readOnly && (
                    <div className="log-row-actions">
                      <button type="button" className="icon-button dark" aria-label="Edit bahan" title="Edit" onClick={() => setEditing(r)}>
                        <Icon name="pen" size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-button dark"
                        aria-label="Hapus bahan"
                        title="Hapus"
                        onClick={() => confirm(`Hapus bahan "${r.title}"?`) && run(() => deleteResource(r.id))}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="res-title">
                  {r.url ? (
                    <a href={r.url} target="_blank" rel="noopener noreferrer">
                      {r.title}
                    </a>
                  ) : (
                    r.title
                  )}
                </div>
                {r.note && (
                  <div className="res-note">
                    <RichText text={r.note} />
                  </div>
                )}
                {r.tags.length > 0 && (
                  <div className="res-tags">
                    {r.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                )}
                <div className="res-foot">
                  <select
                    className={`res-status ${r.status}`}
                    value={r.status}
                    aria-label={`Status ${r.title}`}
                    disabled={readOnly}
                    onChange={(e) => run(() => setResourceStatus(r.id, e.target.value))}
                  >
                    <option value="belum">○ Belum</option>
                    <option value="sedang">◐ Sedang dipelajari</option>
                    <option value="selesai">● Selesai</option>
                  </select>
                  <span className={`res-due${late ? ' late' : ''}`}>
                    {r.status === 'selesai' && r.done_date
                      ? `Selesai ${formatDate(r.done_date)}`
                      : r.due_date
                        ? `${late ? 'Lewat target' : 'Target'} ${formatDate(r.due_date)}`
                        : ''}
                  </span>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {editing && (
        <ResourceDialog
          key={editing === 'new' ? 'new' : editing.id}
          resource={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(state) => {
            setEditing(null);
            onToast(state);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function ResourceDialog({
  resource,
  onClose,
  onSaved,
}: {
  resource: LearningResource | null;
  onClose: () => void;
  onSaved: (state: ActionState) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState<ResourceKind>(resource?.kind ?? 'artikel');
  // Jenis ditebak dari link sampai pengguna memilihnya sendiri.
  const [kindTouched, setKindTouched] = useState(!!resource);
  const [error, setError] = useState<ActionState>(undefined);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  }, []);

  const submit = (form: FormData) => {
    const field = (name: string) => String(form.get(name) ?? '');
    startTransition(async () => {
      const state = await saveResource({
        id: resource?.id,
        url: field('url'),
        title: field('title'),
        kind,
        tags: field('tags'),
        due_date: field('due_date'),
        status: field('status'),
        note: field('note'),
      });
      if (state?.error) setError(state);
      else onSaved(state);
    });
  };

  return (
    <dialog ref={dialogRef} className="modal log-modal res-modal" aria-labelledby="res-dialog-title" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(new FormData(e.currentTarget));
        }}
      >
        <div className="modal-head">
          <div>
            <h2 id="res-dialog-title">{resource ? 'Edit bahan belajar' : 'Tambah bahan belajar'}</h2>
            <p className="muted small-text">Simpan link, dokumen, atau data yang perlu dipelajari.</p>
          </div>
          <button type="button" className="icon-button dark" aria-label="Tutup" onClick={onClose}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <fieldset className="log-fieldset bahan">
          <legend>Bahan</legend>
          <label>
            <span>
              Link <span className="muted small-text">Opsional. Jenis terdeteksi otomatis dari link</span>
            </span>
            <input
              type="url"
              name="url"
              defaultValue={resource?.url}
              placeholder="https://youtube.com/… atau https://docs.google.com/…"
              autoFocus
              onChange={(e) => {
                const guess = guessKind(e.target.value);
                if (guess && !kindTouched) setKind(guess);
              }}
            />
          </label>
          <label>
            Judul / apa yang perlu dipelajari
            <input name="title" required defaultValue={resource?.title} placeholder="Contoh: Cara optimasi Core Web Vitals" />
          </label>
          <div className="res-kind-pick" role="radiogroup" aria-label="Jenis">
            <span className="res-kind-pick-label">Jenis</span>
            {Object.entries(RESOURCE_KINDS).map(([key, label]) => (
              <label key={key} className={kind === key ? 'on' : undefined}>
                <input
                  type="radio"
                  name="kind"
                  value={key}
                  checked={kind === key}
                  onChange={() => {
                    setKind(key as ResourceKind);
                    setKindTouched(true);
                  }}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="modal-grid">
            <label>
              <span>
                Topik <span className="muted small-text">pisahkan dengan koma</span>
              </span>
              <input name="tags" defaultValue={resource?.tags.join(', ')} placeholder="SEO, PageSpeed" />
            </label>
            <label>
              <span>
                Target selesai <span className="muted small-text">opsional</span>
              </span>
              <input type="date" name="due_date" defaultValue={resource?.due_date ?? ''} />
            </label>
          </div>
          <label>
            Status
            <select name="status" defaultValue={resource?.status ?? 'belum'}>
              <option value="belum">Belum dipelajari</option>
              <option value="sedang">Sedang dipelajari</option>
              <option value="selesai">Selesai</option>
            </select>
          </label>
          <label>
            <span>
              Catatan / ringkasan <span className="muted small-text">poin penting, data, atau kenapa perlu dipelajari</span>
            </span>
            <textarea name="note" rows={3} defaultValue={resource?.note} placeholder="Contoh: Fokus ke bagian LCP dan cara kompres gambar" />
          </label>
        </fieldset>

        <div className="modal-actions">
          <Message state={error} />
          <button type="button" className="secondary" onClick={onClose}>
            Batal
          </button>
          <button type="submit" disabled={pending}>
            {pending ? 'Menyimpan…' : resource ? 'Simpan perubahan' : 'Simpan bahan'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
