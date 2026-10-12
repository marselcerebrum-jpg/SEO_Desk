import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoRefresh } from '@/components/auto-refresh';
import { GenerateButton } from '@/components/forms';
import { getDb } from '@/lib/db';
import { RUN_STATUS_LABEL, STATUS_LABEL, dateTime } from '@/lib/format';
import { STEP_LABELS } from '@/lib/pipeline/types';
import { requireUser } from '@/lib/supabase/server';

const seconds = (start: string, end?: string | null) =>
  end ? `${Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 1000))} dtk` : '';

const STEP_STATUS = { running: 'Berjalan', done: 'Selesai', skipped: 'Dilewati', error: 'Gagal' } as const;

export default async function GeneratorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const db = getDb();

  const keyword = await db.getKeyword(id);
  if (!keyword) notFound();
  const [runs, platform] = await Promise.all([db.listRuns(id), db.getPlatform(keyword.platform_id)]);
  const latest = runs[0];

  return (
    <>
      <AutoRefresh active={keyword.status === 'processing'} />
      <p>
        <Link href="/generator">← Artikel Generator</Link>
      </p>
      <div className="page-head">
        <h1>{keyword.keyword}</h1>
        <span className={`badge ${keyword.status}`}>{STATUS_LABEL[keyword.status]}</span>
      </div>

      <div className="card grid">
        <div>
          <div className="muted small-text">Platform</div>
          {user.role === 'leader' ? (
            <Link href={`/konfigurasi/${keyword.platform_id}`}>{platform?.name ?? keyword.platform_id}</Link>
          ) : (
            (platform?.name ?? keyword.platform_id)
          )}
        </div>
        <div>
          <div className="muted small-text">Kategori</div>
          {keyword.category}
        </div>
        <div>
          <div className="muted small-text">Role</div>
          {keyword.role}
        </div>
        <div>
          <div className="muted small-text">Audience</div>
          {keyword.audience}
        </div>
        <div>
          <div className="muted small-text">Volume</div>
          {keyword.volume ?? '—'}
        </div>
      </div>

      <div className="row" style={{ marginBottom: 16 }}>
        {keyword.status === 'ready' && <GenerateButton keywordId={keyword.id} label="Generate" />}
        {keyword.status === 'draft' && (
          <span className="muted small-text">
            Masih Draft. Ubah status ke <strong>Ready</strong> di <Link href="/generator">Generator</Link> untuk bisa
            generate.
          </span>
        )}
        {keyword.status === 'error' && (
          <>
            <GenerateButton keywordId={keyword.id} resume label="Lanjutkan dari tahap gagal" />
            <GenerateButton keywordId={keyword.id} label="Ulang dari awal" />
          </>
        )}
        {keyword.wp_edit_url && (
          <a href={keyword.wp_edit_url} target="_blank" rel="noreferrer">
            Buka draft di WordPress
          </a>
        )}
      </div>

      {latest && (
        <div className="card">
          <div className="page-head" style={{ marginBottom: 8 }}>
            <h2>
              Proses terakhir <span className={`badge ${latest.status}`}>{RUN_STATUS_LABEL[latest.status]}</span>
            </h2>
            <span className="muted">{dateTime(latest.started_at)}</span>
          </div>
          {latest.error && <p className="msg-err">{latest.error}</p>}
          <ul className="list">
            {latest.steps.map((s) => (
              <li key={s.name}>
                <span className="name">{STEP_LABELS[s.name]}</span>
                <span className={`badge ${s.status}`}>{STEP_STATUS[s.status]}</span>
                <span className="muted">{seconds(s.started_at, s.finished_at)}</span>
                {s.note && <span>{s.note}</span>}
                {s.error && <span className="msg-err">{s.error}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {latest?.title && (
        <div className="card">
          <h2>{latest.title}</h2>
          <p className="muted">/{latest.slug}</p>
          <p>{latest.meta}</p>
        </div>
      )}

      {latest?.research && (
        <details className="card">
          <summary>Hasil riset</summary>
          <pre className="output">{latest.research}</pre>
        </details>
      )}
      {latest?.draft && (
        <details className="card">
          <summary>Draf</summary>
          <pre className="output">{latest.draft}</pre>
        </details>
      )}
      {latest?.content && (
        <details className="card">
          <summary>HTML final</summary>
          <pre className="output">{latest.content}</pre>
        </details>
      )}

      {runs.length > 1 && (
        <div className="card">
          <h2>Riwayat proses</h2>
          <table>
            <tbody>
              {runs.slice(1).map((r) => (
                <tr key={r.id}>
                  <td>{dateTime(r.started_at)}</td>
                  <td>
                    <span className={`badge ${r.status}`}>{RUN_STATUS_LABEL[r.status]}</span>
                  </td>
                  <td className="msg-err">{r.error}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
