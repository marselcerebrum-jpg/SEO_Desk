'use client';

import { useActionState } from 'react';
import { disconnectSupabase, resetLocal, saveAiSettings, saveSupabaseSettings } from '@/app/actions';
import { Message } from './forms';

// Nilai rahasia tidak pernah dikirim ke browser; hanya penanda "tersimpan · …abcd".
function SecretInput({ name, label, masked }: { name: string; label: string; masked: string }) {
  return (
    <label>
      {label}
      <input name={name} type="password" autoComplete="off" placeholder={masked || 'belum diisi'} />
    </label>
  );
}

export type AiView = { openaiKey: string; openaiModel: string; perplexityKey: string; perplexityModel: string };

export function AiForm({ view }: { view: AiView }) {
  const [state, action, pending] = useActionState(saveAiSettings, undefined);
  return (
    <form action={action}>
      <div className="grid">
        <SecretInput name="openaiApiKey" label="OpenAI API key" masked={view.openaiKey} />
        <label>
          Model OpenAI
          <input name="openaiModel" defaultValue={view.openaiModel} />
        </label>
        <SecretInput name="perplexityApiKey" label="Perplexity API key" masked={view.perplexityKey} />
        <label>
          Model Perplexity
          <input name="perplexityModel" defaultValue={view.perplexityModel} />
        </label>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button type="submit" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan API key'}
        </button>
        <Message state={state} />
      </div>
    </form>
  );
}

export type SupabaseView = { url: string; anon: string; service: string; connected: boolean };

export function SupabaseForm({ view }: { view: SupabaseView }) {
  const [state, action, pending] = useActionState(saveSupabaseSettings, undefined);
  return (
    <form action={action}>
      <div className="grid">
        <label>
          Project URL
          <input name="supabaseUrl" defaultValue={view.url} placeholder="https://xxxx.supabase.co" />
        </label>
        <SecretInput name="supabaseAnonKey" label="Anon / publishable key" masked={view.anon} />
        <SecretInput name="supabaseServiceRoleKey" label="Service role / secret key" masked={view.service} />
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <button type="submit" disabled={pending}>
          {pending ? 'Mengecek koneksi…' : view.connected ? 'Simpan' : 'Tes & hubungkan'}
        </button>
        {view.connected && (
          <button type="submit" className="secondary" formAction={disconnectSupabase}>
            Putuskan (kembali ke mode lokal)
          </button>
        )}
        <Message state={state} />
      </div>
    </form>
  );
}

export function LocalDataForm() {
  const [state, action, pending] = useActionState(resetLocal, undefined);
  return (
    <form action={action} className="row">
      <button type="submit" name="mode" value="empty" className="secondary" disabled={pending}>
        Kosongkan keyword & riwayat
      </button>
      <button type="submit" name="mode" value="demo" className="secondary" disabled={pending}>
        Pulihkan data contoh
      </button>
      <Message state={state} />
    </form>
  );
}
