import Link from 'next/link';
import { ImportCsvForm } from '@/components/forms';
import { AiForm, LocalDataForm, SupabaseForm } from '@/components/settings-forms';
import { getSettings, isSupabaseConfigured, maskSecret } from '@/lib/settings';
import { getDb } from '@/lib/db';
import type { Platform } from '@/lib/pipeline/types';
import { platformReadiness } from '@/lib/readiness';
import { requireLeader } from '@/lib/supabase/server';

const PROMPT_COLUMNS: [keyof Platform, string][] = [
  ['system_research', 'System Content Preplexity'],
  ['prompt_research', 'Prompt User Preplexity'],
  ['system_draft', 'System Content ChatGPT Drafting'],
  ['prompt_draft', 'Prompt User ChatGPT Drafting'],
  ['system_html', 'System Content ChatGPT HTML'],
  ['prompt_html', 'Prompt User ChatGPT HTML'],
  ['system_meta', 'System Content ChatGPT Slug Meta'],
  ['prompt_meta', 'Prompt User ChatGPT Slug Meta'],
];

function Filled({ value }: { value: string }) {
  const text = value.trim();
  if (!text) return <span className="muted">—</span>;
  return (
    <span title={text.slice(0, 300)} className="badge done">
      {text.length.toLocaleString('id-ID')} karakter
    </span>
  );
}

export default async function KonfigurasiPage() {
  await requireLeader();
  const platforms = await getDb().listPlatforms();
  const settings = getSettings();
  const connected = isSupabaseConfigured(settings);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Konfigurasi</h1>
          <p className="muted">API key AI, koneksi database, dan konfigurasi tiap platform.</p>
        </div>
      </div>

      <div className="config-grid">
        <section className="card" id="api-key">
          <h2>API key AI</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Satu API key untuk semua platform. Disimpan di server dan tidak pernah ditampilkan ulang.
          </p>
          <AiForm
            view={{
              openaiKey: maskSecret(settings.openaiApiKey),
              openaiModel: settings.openaiModel,
              perplexityKey: maskSecret(settings.perplexityApiKey),
              perplexityModel: settings.perplexityModel,
            }}
          />
        </section>

        <section className="card" id="database">
          <div className="table-head">
            <h2>Database (Supabase)</h2>
            <span className={`badge ${connected ? 'done' : 'warn'}`}>{connected ? 'Terhubung' : 'Mode lokal'}</span>
          </div>
          <p className="muted" style={{ marginTop: 0 }}>
            Sebelum menghubungkan: jalankan <code>supabase/migrations/0001_init.sql</code> lalu{' '}
            <code>supabase/seed.sql</code> di SQL Editor, matikan signup, dan buat minimal satu user di Authentication.
            Setelah terhubung, app meminta login dan akun tim bisa dibuat di menu Setting.
          </p>
          <SupabaseForm
            view={{
              url: settings.supabaseUrl,
              anon: maskSecret(settings.supabaseAnonKey),
              service: maskSecret(settings.supabaseServiceRoleKey),
              connected,
            }}
          />
          {!connected && (
            <details style={{ marginTop: 14 }}>
              <summary>Data lokal</summary>
              <p className="muted small-text">Konfigurasi platform tidak ikut terhapus.</p>
              <LocalDataForm />
            </details>
          )}
        </section>
      </div>

      <div className="page-head" style={{ marginTop: 8 }}>
        <div>
          <h2>Konfigurasi platform</h2>
          <p className="muted">Klik nama platform untuk mengubah prompt, domain, dan akun WordPress.</p>
        </div>
        <span className="muted">
          {platforms.filter((p) => platformReadiness(p).ready).length}/{platforms.length} siap generate
        </span>
      </div>

      <details className="card">
        <summary>Impor dari CSV (ekspor tab &quot;Patim Testing&quot;)</summary>
        <p className="muted small-text">
          Baris dicocokkan lewat kolom PLATFORM. Password kosong di CSV tidak menimpa password yang tersimpan.
          Placeholder salah ketik (<code>_KEYWORD</code>, <code>AUDIENCE_</code>) diperbaiki otomatis.
        </p>
        <ImportCsvForm />
      </details>

      <div className="card flush table-wrap">
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>PLATFORM</th>
              <th>Link CTA</th>
              <th>Username</th>
              <th>Password</th>
              {PROMPT_COLUMNS.map(([, title]) => (
                <th key={title}>{title}</th>
              ))}
              <th>ID CTA</th>
              <th>Domain</th>
              <th>Artikel Kompetitor</th>
            </tr>
          </thead>
          <tbody>
            {platforms.map((p, i) => {
              const competitors = p.artikel_kompetitor.split('\n').filter((l) => l.trim()).length;
              return (
                <tr key={p.id}>
                  <td className="num">{i + 1}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Link href={`/konfigurasi/${p.id}`}>
                      <strong>{p.name}</strong>
                    </Link>
                    {!p.active && <div className="muted small-text">nonaktif</div>}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {p.link_cta || <span className="muted">—</span>}
                  </td>
                  <td>{p.wp_username || <span className="muted">—</span>}</td>
                  <td>{p.wp_app_password ? '••••••' : <span className="muted">—</span>}</td>
                  {PROMPT_COLUMNS.map(([field]) => (
                    <td key={field}>
                      <Filled value={String(p[field] ?? '')} />
                    </td>
                  ))}
                  <td>{p.id_cta || <span className="muted">—</span>}</td>
                  <td>{p.domain ?? <span className="badge warn">belum diisi</span>}</td>
                  <td>{competitors ? `${competitors} URL` : <span className="muted">—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
