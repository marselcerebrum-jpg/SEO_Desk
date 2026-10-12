import Link from 'next/link';
import { AutoRefresh } from '@/components/auto-refresh';
import { CreateArticleButton } from '@/components/create-article';
import { GeneratorFilters } from '@/components/generator-filters';
import { GeneratorGrid, type GridOptions } from '@/components/generator-grid';
import { Icon } from '@/components/icons';
import { getDb } from '@/lib/db';
import { STATUS_LABEL } from '@/lib/format';
import { OPTION_KINDS, type Keyword, type KeywordStatus, type OptionKind } from '@/lib/pipeline/types';
import { platformReadiness } from '@/lib/readiness';
import { requireUser } from '@/lib/supabase/server';

const PAGE_SIZE = 50;

type Params = {
  platform?: string;
  tahun?: string;
  bulan?: string;
  tanggal?: string;
  q?: string;
  status?: string;
  urut?: string;
  hal?: string;
};

export default async function GeneratorPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const user = await requireUser();
  const leader = user.role === 'leader';
  const db = getDb();

  const [platforms, allOptions] = await Promise.all([db.listPlatforms({ activeOnly: true }), db.listOptions()]);
  if (platforms.length === 0) return <p className="muted">Belum ada platform aktif. Atur di menu Konfigurasi.</p>;

  const platform = platforms.find((p) => p.id === params.platform) ?? null;
  const statusFilter = params.status && params.status in STATUS_LABEL ? (params.status as KeywordStatus) : null;
  const oldestFirst = params.urut === 'terlama';
  const year = Number(params.tahun) || null;
  const month = Number(params.bulan) || null;
  const search = (params.q ?? '').trim().toLowerCase();

  const activeIds = new Set(platforms.map((p) => p.id));
  const all = (await db.listKeywords({ platformId: platform?.id, limit: 10000 })).filter((k) => activeIds.has(k.platform_id));

  // Filter Tahun/Bulan/Tanggal memakai Jadwal Upload.
  const inPeriod = (k: Keyword) => {
    if (!year && !month && !params.tanggal) return true;
    if (!k.schedule_date) return false;
    const [y, m] = k.schedule_date.split('-').map(Number);
    return (!year || y === year) && (!month || m === month) && (!params.tanggal || k.schedule_date === params.tanggal);
  };
  const matches = (k: Keyword) =>
    !search || k.keyword.toLowerCase().includes(search) || (k.title ?? '').toLowerCase().includes(search);

  // Jumlah per status mengikuti filter lain (bukan filter status itu sendiri).
  const base = all.filter((k) => inPeriod(k) && matches(k));
  const counts = base.reduce<Partial<Record<KeywordStatus, number>>>((acc, k) => {
    acc[k.status] = (acc[k.status] ?? 0) + 1;
    return acc;
  }, {});

  // Urut berdasarkan Jadwal Upload; baris tanpa jadwal memakai tanggal dibuat.
  const dateKey = (k: Keyword) => `${k.schedule_date ?? k.created_at.slice(0, 10)}|${k.created_at}`;
  const filtered = base
    .filter((k) => !statusFilter || k.status === statusFilter)
    .sort((a, b) => (oldestFirst ? dateKey(a).localeCompare(dateKey(b)) : dateKey(b).localeCompare(dateKey(a))));

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(params.hal) || 1));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const optionsByPlatform = Object.fromEntries(
    platforms.map((p) => [
      p.id,
      Object.fromEntries(
        (Object.keys(OPTION_KINDS) as OptionKind[]).map((kind) => [
          kind,
          allOptions
            .filter((o) => o.kind === kind && (o.platform_id === null || o.platform_id === p.id))
            .map(({ value, color }) => ({ value, color })),
        ]),
      ) as GridOptions,
    ]),
  );

  // Pilihan filter tanggal: dari data yang ada.
  const now = new Date();
  const years = [
    ...new Set([now.getFullYear(), ...all.flatMap((k) => (k.schedule_date ? [Number(k.schedule_date.slice(0, 4))] : []))]),
  ].sort();
  const dates = [
    ...new Set(
      all
        .filter((k) => {
          if (!k.schedule_date) return false;
          const [y, m] = k.schedule_date.split('-').map(Number);
          return (!year || y === year) && (!month || m === month);
        })
        .map((k) => k.schedule_date!),
    ),
  ].sort();

  const href = (changes: Partial<Params>) => {
    const next = new URLSearchParams();
    const merged: Params = { ...params, hal: undefined, ...changes };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const query = next.toString();
    return query ? `/generator?${query}` : '/generator';
  };

  const readiness = platform ? platformReadiness(platform) : null;
  const notReady = platforms.filter((p) => !platformReadiness(p).ready).length;
  const from = filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(page * PAGE_SIZE, filtered.length);
  const first = Math.max(1, Math.min(page - 3, pages - 6));
  const pageNumbers = Array.from({ length: Math.min(7, pages) }, (_, i) => first + i);
  const statusTone: Record<KeywordStatus, string> = {
    draft: 'gray',
    ready: 'green',
    processing: 'blue',
    generated: 'green',
    error: 'red',
  };

  return (
    <>
      <AutoRefresh active={all.some((k) => k.status === 'processing')} />
      <div className="page-head gen-head">
        <div>
          <h1>Artikel Generator</h1>
          <p className="muted">Kelola keyword hingga artikel siap dipublikasikan.</p>
        </div>
        <CreateArticleButton
          platforms={platforms.map(({ id, name }) => ({ id, name }))}
          optionsByPlatform={optionsByPlatform}
          defaultPlatform={platform?.id ?? null}
        />
      </div>

      <GeneratorFilters platforms={platforms.map(({ id, name }) => ({ id, name }))} years={years} dates={dates} />

      <div className="card gen-status">
        <div className="row">
          <Link href={href({ status: undefined })} className={`status-chip${!statusFilter ? ' active' : ''}`}>
            Semua <span className="count">{base.length}</span>
          </Link>
          {(Object.keys(STATUS_LABEL) as KeywordStatus[]).map((s) =>
            counts[s] ? (
              <Link
                key={s}
                href={href({ status: s })}
                className={`status-chip tone-${statusTone[s]}${statusFilter === s ? ' active' : ''}`}
              >
                {STATUS_LABEL[s]} <span className="count">{counts[s]}</span>
              </Link>
            ) : null,
          )}
        </div>
        <div className="row small-text">
          {readiness ? (
            readiness.ready ? (
              <span className="badge done">Konfigurasi lengkap</span>
            ) : (
              <ConfigLink leader={leader} href={`/konfigurasi/${platform!.id}`}>
                Kurang: {readiness.missing.join(', ')}
              </ConfigLink>
            )
          ) : notReady > 0 ? (
            <ConfigLink leader={leader} href="/konfigurasi">
              {notReady} platform belum lengkap
            </ConfigLink>
          ) : null}
          {leader && (
            <Link href="/settings?tab=dropdown" className="row-link">
              <Icon name="gear" size={16} /> Atur dropdown
            </Link>
          )}
        </div>
      </div>

      <GeneratorGrid
        key={`${platform?.id ?? 'semua'}-${page}-${oldestFirst}`}
        platformId={platform?.id ?? null}
        platforms={platforms.map(({ id, name }) => ({ id, name }))}
        rows={rows}
        optionsByPlatform={optionsByPlatform}
        dateSort={{ oldestFirst, toggleHref: href({ urut: oldestFirst ? undefined : 'terlama' }) }}
      />

      <div className="pager">
        <span className="muted small-text">
          {filtered.length
            ? `Menampilkan ${from}–${to} dari ${filtered.length} artikel · ${oldestFirst ? 'terlama' : 'terbaru'} dulu`
            : search || year || month || params.tanggal || statusFilter
              ? 'Tidak ada artikel yang cocok dengan filter.'
              : 'Belum ada artikel. Klik Create artikel untuk menambah.'}
        </span>
        {pages > 1 && (
          <nav className="row" aria-label="Halaman">
            {page > 1 ? (
              <Link href={href({ hal: String(page - 1) })} className="btn-outline">
                <Icon name="arrowLeft" size={14} /> Sebelumnya
              </Link>
            ) : (
              <span className="btn-outline disabled">
                <Icon name="arrowLeft" size={14} /> Sebelumnya
              </span>
            )}
            {pageNumbers.map((n) => (
              <Link
                key={n}
                href={href({ hal: String(n) })}
                className={n === page ? 'btn-outline active' : 'btn-outline'}
                aria-current={n === page ? 'page' : undefined}
              >
                {n}
              </Link>
            ))}
            {page < pages ? (
              <Link href={href({ hal: String(page + 1) })} className="btn-outline">
                Selanjutnya <Icon name="arrowRight" size={14} />
              </Link>
            ) : (
              <span className="btn-outline disabled">
                Selanjutnya <Icon name="arrowRight" size={14} />
              </span>
            )}
          </nav>
        )}
      </div>
    </>
  );
}

// Staff tidak punya akses Konfigurasi: tampilkan peringatannya tanpa tautan.
function ConfigLink({ leader, href, children }: { leader: boolean; href: string; children: React.ReactNode }) {
  return leader ? (
    <Link href={href} className="notice-badge">
      {children}
    </Link>
  ) : (
    <span className="notice-badge">{children}</span>
  );
}
