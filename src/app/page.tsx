import Link from 'next/link';
import { AutoRefresh } from '@/components/auto-refresh';
import {
  DailyBarChart,
  DashboardFilters,
  PlatformSummaryTable,
  type ChartDay,
  type ChartSeries,
} from '@/components/dashboard-widgets';
import { DashboardPanels } from '@/components/dashboard-panels';
import type { GridOptions } from '@/components/generator-grid';
import { Icon } from '@/components/icons';
import { getDb } from '@/lib/db';
import { RUN_STATUS_LABEL, relative } from '@/lib/format';
import { OPTION_KINDS, STEP_LABELS, type OptionKind } from '@/lib/pipeline/types';
import { platformReadiness } from '@/lib/readiness';
import { requireUser } from '@/lib/supabase/server';


const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const SERIES_COLORS = ['#0f6aa6', '#f77f00', '#d62828', '#e0a92c', '#4fa3d9', '#9c4f0a', '#ef8080'];
const OTHER = { id: '__other', name: 'Lainnya', color: '#a8a291' };

const pad = (n: number) => String(n).padStart(2, '0');
const localDayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string; tahun?: string; bulan?: string; tanggal?: string; view?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser();
  const db = getDb();
  const now = new Date();

  const year = Number(params.tahun) || now.getFullYear();
  const month = Math.min(12, Math.max(1, Number(params.bulan) || now.getMonth() + 1));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.tanggal ?? '') ? params.tanggal! : '';
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const lastDay = isCurrentMonth ? now.getDate() : new Date(year, month, 0).getDate();

  const [platforms, keywords, monthRuns, recentRuns, options] = await Promise.all([
    db.listPlatforms(),
    db.listKeywords({ limit: 10000 }),
    db.runSummaries({ since: monthStart.toISOString(), limit: 10000 }),
    db.runSummaries({ limit: 50 }),
    db.listOptions(),
  ]);

  const platform = platforms.find((p) => p.id === params.platform) ?? null;
  const inScope = <T extends { platform_id: string }>(x: T) => !platform || x.platform_id === platform.id;
  const platformName = new Map(platforms.map((p) => [p.id, p.name]));
  const keywordName = new Map(keywords.map((k) => [k.id, k.keyword]));

  const scopedKeywords = keywords.filter(inScope);
  const count = (status: string) => scopedKeywords.filter((k) => k.status === status).length;

  // Artikel sukses dalam bulan terpilih (dan tanggal, bila dipilih).
  const successRuns = monthRuns.filter(
    (r) => r.status === 'success' && r.finished_at && inScope(r) && new Date(r.finished_at) < monthEnd,
  );

  // Warna turunan palet brand (lolos validator dataviz). 7 platform dengan keyword terbanyak
  // dapat warna tetap; sisanya "Lainnya". Tooltip tetap merinci semua platform.
  const keywordCount = new Map<string, number>();
  for (const k of keywords) keywordCount.set(k.platform_id, (keywordCount.get(k.platform_id) ?? 0) + 1);
  const ranked = [...platforms].sort(
    (a, b) => (keywordCount.get(b.id) ?? 0) - (keywordCount.get(a.id) ?? 0) || a.sort_order - b.sort_order,
  );
  const colorOf = new Map(ranked.slice(0, SERIES_COLORS.length).map((p, i) => [p.id, SERIES_COLORS[i]]));
  const series: ChartSeries[] = [
    ...ranked.filter((p) => colorOf.has(p.id)).map((p) => ({ id: p.id, name: p.name, color: colorOf.get(p.id)! })),
    OTHER,
  ];
  const seriesOf = (id: string) => (colorOf.has(id) ? id : OTHER.id);
  const tooltipPlatforms = platforms.filter((p) => p.active && (!platform || p.id === platform.id));

  const days: ChartDay[] = Array.from({ length: lastDay }, (_, i) => {
    const d = new Date(year, month - 1, i + 1);
    return { key: localDayKey(d), day: i + 1, label: String(i + 1), total: 0, bySeries: {}, parts: [] };
  });
  const dayIndex = new Map(days.map((d, i) => [d.key, i]));
  const perDay = new Map<string, Map<string, number>>();
  for (const r of successRuns) {
    const key = localDayKey(new Date(r.finished_at!));
    const day = days[dayIndex.get(key) ?? -1];
    if (!day) continue;
    day.total++;
    const sid = seriesOf(r.platform_id);
    day.bySeries[sid] = (day.bySeries[sid] ?? 0) + 1;
    const counts = perDay.get(key) ?? new Map<string, number>();
    counts.set(r.platform_id, (counts.get(r.platform_id) ?? 0) + 1);
    perDay.set(key, counts);
  }
  for (const day of days) {
    const counts = perDay.get(day.key);
    day.parts = tooltipPlatforms
      .map((p): [string, number, string] => [p.name, counts?.get(p.id) ?? 0, colorOf.get(p.id) ?? OTHER.color])
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }  const years = [...new Set([now.getFullYear(), year, ...keywords.map((k) => new Date(k.created_at).getFullYear())])].sort();

  const summaryRows = platforms
    .filter((p) => !platform || p.id === platform.id)
    .map((p) => {
      const own = keywords.filter((k) => k.platform_id === p.id);
      const readiness = platformReadiness(p);
      return {
        id: p.id,
        name: p.name,
        total: own.length,
        waiting: own.filter((k) => k.status === 'ready').length,
        generated: own.filter((k) => k.status === 'generated').length,
        error: own.filter((k) => k.status === 'error').length,
        ready: readiness.ready,
        missing: readiness.missing,
      };
    });
  const activity = recentRuns.filter(inScope).slice(0, 5);

  // Panel kartu: keyword sesuai filter platform (dan tanggal dibuat, bila dipilih).
  const panelKeywords = scopedKeywords.filter((k) => !date || localDayKey(new Date(k.created_at)) === date);
  const runningStep = Object.fromEntries(
    recentRuns
      .filter((r) => r.status === 'running' && r.current_step)
      .map((r) => [r.keyword_id, STEP_LABELS[r.current_step!]]),
  );
  const optionsByPlatform = Object.fromEntries(
    platforms.map((p) => [
      p.id,
      Object.fromEntries(
        (Object.keys(OPTION_KINDS) as OptionKind[]).map((kind) => [
          kind,
          options
            .filter((o) => o.kind === kind && (o.platform_id === null || o.platform_id === p.id))
            .map(({ value, color }) => ({ value, color })),
        ]),
      ) as GridOptions,
    ]),
  );

  return (
    <>
      <AutoRefresh active={count('processing') > 0} />
      <div className="page-head">
        <h1>Dashboard</h1>
        <Link href="/generator" className="btn">
          Buka Generator
        </Link>
      </div>

      <DashboardFilters
        platforms={platforms.map(({ id, name }) => ({ id, name }))}
        years={years}
        value={{ platform: platform?.id ?? '', year, month, date }}
      />

      <DashboardPanels
        keywords={panelKeywords}
        platforms={platforms.map(({ id, name }) => ({ id, name }))}
        optionsByPlatform={optionsByPlatform}
        runningStep={runningStep}
        initialView={params.view}
      />

      <div className="dash-main">
        <DailyBarChart days={days} series={series} monthShort={SHORT_MONTHS[month - 1]} />

        <div className="card">
          <div className="table-head">
            <h2>Aktivitas terakhir</h2>
            <Link href="/generator" className="row small-text">
              Lihat semua <Icon name="arrowRight" size={14} />
            </Link>
          </div>
          {activity.length === 0 && <p className="muted">Belum ada aktivitas.</p>}
          <ul className="list activity">
            {activity.map((r) => (
              <li key={r.id}>
                <span className={`badge ${r.status}`}>{RUN_STATUS_LABEL[r.status]}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/generator/${r.keyword_id}`} className="activity-title">
                    {keywordName.get(r.keyword_id) ?? '—'}
                  </Link>
                  <div className="muted small-text">
                    {platformName.get(r.platform_id) ?? r.platform_id} · {relative(r.started_at)}
                  </div>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <PlatformSummaryTable rows={summaryRows} leader={user.role === 'leader'} />
    </>
  );
}
