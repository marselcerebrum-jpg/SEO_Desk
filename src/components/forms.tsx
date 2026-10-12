'use client';

import { useActionState, useEffect, useRef } from 'react';
import {
  createKeyword,
  generateKeyword,
  importKonfigurasiCsv,
  setupFirstLeader,
  signIn,
  testWordpress,
  updatePlatform,
  type ActionState,
} from '@/app/actions';
import type { Platform } from '@/lib/pipeline/types';

export function Message({ state }: { state: ActionState }) {
  if (state?.error) return <span className="msg-err" role="alert">{state.error}</span>;
  if (state?.ok) return <span className="msg-ok" role="status">{state.ok}</span>;
  return null;
}

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <form action={action}>
      <label>
        Username / email
        <input name="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required defaultValue={state?.email} />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Masuk…' : 'Masuk'}
      </button>
      <Message state={state} />
    </form>
  );
}

export function SetupForm() {
  const [state, action, pending] = useActionState(setupFirstLeader, undefined);
  return (
    <form action={action}>
      <label>
        Nama
        <input name="name" autoComplete="name" required />
      </label>
      <label>
        Username / email
        <input name="email" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="new-password" minLength={8} required placeholder="Minimal 8 karakter" />
      </label>
      <label>
        Ulangi password
        <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Membuat…' : 'Buat akun Leader'}
      </button>
      <Message state={state} />
    </form>
  );
}

export function KeywordForm({ platforms }: { platforms: Pick<Platform, 'id' | 'name'>[] }) {
  const [state, action, pending] = useActionState(createKeyword, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action}>
      <div className="grid">
        <label>
          Platform
          <select name="platform_id" required>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Keyword
          <input name="keyword" required />
        </label>
        <label>
          Kategori
          <input name="category" required placeholder="sama persis dengan kategori di WP" />
        </label>
        <label>
          Role
          <input name="role" required />
        </label>
        <label>
          Audience
          <input name="audience" required />
        </label>
        <label>
          Volume
          <input name="volume" type="number" min="0" />
        </label>
        <label>
          Jadwal upload
          <input name="schedule_date" type="date" />
        </label>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button type="submit" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Tambah keyword'}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

export function GenerateButton({
  keywordId,
  resume,
  label,
  stay,
}: {
  keywordId: string;
  resume?: boolean;
  label: string;
  stay?: boolean;
}) {
  const [state, action, pending] = useActionState(generateKeyword, undefined);
  return (
    <form action={action} className="row">
      <input type="hidden" name="keyword_id" value={keywordId} />
      {resume && <input type="hidden" name="resume" value="1" />}
      {stay && <input type="hidden" name="stay" value="1" />}
      <button type="submit" className={resume ? 'secondary small' : 'small'} disabled={pending}>
        {pending ? 'Memulai…' : label}
      </button>
      <Message state={state} />
    </form>
  );
}

export function ImportCsvForm() {
  const [state, action, pending] = useActionState(importKonfigurasiCsv, undefined);
  return (
    <form action={action} className="row">
      <input type="file" name="file" accept=".csv,text/csv" aria-label="File CSV konfigurasi" required />
      <button type="submit" className="secondary" disabled={pending}>
        {pending ? 'Mengimpor…' : 'Impor CSV'}
      </button>
      <Message state={state} />
    </form>
  );
}

// Platform tanpa password asli; `passwordMask` hanya penanda "tersimpan · …abcd".
export type PlatformView = Omit<Platform, 'wp_app_password'> & { passwordMask: string };

const PROMPT_PAIRS: [system: keyof Platform, user: keyof Platform, title: string][] = [
  ['system_research', 'prompt_research', 'Perplexity (riset)'],
  ['system_draft', 'prompt_draft', 'ChatGPT Drafting'],
  ['system_html', 'prompt_html', 'ChatGPT HTML'],
  ['system_meta', 'prompt_meta', 'ChatGPT Slug Meta'],
];

export function PlatformForm({ platform }: { platform: PlatformView }) {
  const [state, action, pending] = useActionState(updatePlatform, undefined);
  const [tested, test, testing] = useActionState(testWordpress, undefined);
  const value = (field: keyof PlatformView) => String(platform[field] ?? '');

  return (
    <form action={action}>
      <input type="hidden" name="id" value={platform.id} />

      <fieldset className="fieldset">
        <legend>Platform & WordPress</legend>
        <div className="grid">
          <label>
            PLATFORM
            <input name="name" defaultValue={platform.name} required />
          </label>
          <label>
            Link CTA
            <input name="link_cta" type="url" defaultValue={platform.link_cta} placeholder="https://…" />
          </label>
          <label>
            Username
            <input name="wp_username" defaultValue={platform.wp_username} autoComplete="off" placeholder="user WordPress" />
          </label>
          <label>
            Password
            <input
              name="wp_app_password"
              type="password"
              autoComplete="new-password"
              placeholder={platform.passwordMask || 'Application Password WordPress'}
            />
          </label>
          <label>
            ID CTA
            <input name="id_cta" defaultValue={platform.id_cta} />
          </label>
          <label>
            Domain
            <input name="domain" defaultValue={platform.domain ?? ''} placeholder="contoh.com (tanpa https://)" />
          </label>
          <label>
            Author ID WordPress
            <input name="wp_author_id" type="number" defaultValue={platform.wp_author_id ?? ''} />
          </label>
          <label className="inline" style={{ alignSelf: 'end' }}>
            <input name="active" type="checkbox" defaultChecked={platform.active} />
            Aktif
          </label>
        </div>
        <div className="row" style={{ marginTop: 14 }}>
          <button type="submit" formAction={test} className="secondary small" disabled={testing}>
            {testing ? 'Mengetes…' : 'Tes koneksi WordPress'}
          </button>
          <span className="muted small-text">memakai data yang sudah tersimpan</span>
          <Message state={tested} />
        </div>
      </fieldset>

      <p className="muted small-text">
        Placeholder: <code>__KEYWORD__</code> <code>__CATEGORY__</code> <code>__ROLE__</code> <code>__AUDIENCE__</code>{' '}
        <code>__LINK_CTA__</code> <code>__ID_CTA__</code> <code>__ARTIKEL_KOMPETITOR__</code>. Di prompt drafting juga{' '}
        <code>__RESEARCH__</code>; kalau tidak dipakai, hasil riset otomatis ditempel di akhir prompt.
      </p>

      {PROMPT_PAIRS.map(([system, user, title]) => (
        <fieldset className="fieldset" key={title}>
          <legend>{title}</legend>
          <div className="prompt-pair">
            <label>
              System Content
              <textarea name={system} defaultValue={value(system as keyof PlatformView)} />
            </label>
            <label>
              Prompt User
              <textarea name={user} defaultValue={value(user as keyof PlatformView)} />
            </label>
          </div>
        </fieldset>
      ))}

      <fieldset className="fieldset">
        <legend>Artikel Kompetitor</legend>
        <label>
          <span className="hint">Satu URL per baris</span>
          <textarea name="artikel_kompetitor" defaultValue={platform.artikel_kompetitor} style={{ minHeight: 90 }} />
        </label>
      </fieldset>

      <div className="row sticky-actions">
        <button type="submit" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan konfigurasi'}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}
