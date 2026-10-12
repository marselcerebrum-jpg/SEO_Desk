'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { createKeyword } from '@/app/actions';
import { Message } from './forms';
import type { GridOptions } from './generator-grid';
import { Icon } from './icons';

export function CreateArticleButton({
  platforms,
  optionsByPlatform,
  defaultPlatform,
}: {
  platforms: { id: string; name: string }[];
  optionsByPlatform: Record<string, GridOptions>;
  defaultPlatform: string | null;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [platform, setPlatform] = useState(defaultPlatform ?? '');
  const [state, action, pending] = useActionState(createKeyword, undefined);

  // Berhasil: tutup dialog, kosongkan form, muat ulang tabel.
  useEffect(() => {
    if (!state?.ok) return;
    formRef.current?.reset();
    dialogRef.current?.close();
    router.refresh();
  }, [state, router]);

  const options = optionsByPlatform[platform];
  const select = (name: string, label: string, list: { value: string }[] | undefined, required = false) => (
    // key ikut platform: pilihan direset saat platform diganti.
    <label key={`${name}-${platform}`}>
      {label}
      <select name={name} required={required} defaultValue="" disabled={!platform}>
        <option value="">{platform ? `Pilih ${label.toLowerCase()}` : 'Pilih platform dulu'}</option>
        {(list ?? []).map((o) => (
          <option key={o.value} value={o.value}>
            {o.value}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <button
        type="button"
        className="create-button"
        onClick={() => {
          setPlatform(defaultPlatform ?? '');
          dialogRef.current?.showModal();
        }}
      >
        <Icon name="plus" size={18} /> Create artikel
      </button>

      <dialog ref={dialogRef} className="modal" aria-labelledby="create-article-title">
        <form ref={formRef} action={action}>
          <div className="modal-head">
            <h2 id="create-article-title">Create Artikel</h2>
            <button type="button" className="icon-button dark" aria-label="Tutup" onClick={() => dialogRef.current?.close()}>
              <Icon name="x" size={18} />
            </button>
          </div>

          <div className="modal-grid">
            <label>
              Tanggal (jadwal upload)
              <input name="schedule_date" type="date" />
            </label>
            <label>
              Platform
              <select name="platform_id" required value={platform} onChange={(e) => setPlatform(e.target.value)}>
                <option value="">Pilih platform</option>
                {platforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="span-2">
              Keyword
              <input name="keyword" required placeholder="mis. gaji guru asn" autoFocus />
            </label>
            <label>
              Volume
              <input name="volume" type="number" min="0" inputMode="numeric" />
            </label>
            {select('keyword_status', 'Status Keyword', options?.status_keyword)}
            {select('category', 'Category', options?.category, true)}
            {select('role', 'Role', options?.role, true)}
            {select('audience', 'Audience', options?.audience, true)}
          </div>

          <p className="muted small-text">
            Artikel baru berstatus <strong>Draft</strong>. Ubah ke <strong>Ready</strong> di tabel untuk bisa digenerate. Isi
            dropdown diatur di menu Setting.
          </p>
          <div className="modal-actions">
            <Message state={state?.error ? state : undefined} />
            <button type="button" className="secondary" onClick={() => dialogRef.current?.close()}>
              Batal
            </button>
            <button type="submit" disabled={pending}>
              {pending ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
