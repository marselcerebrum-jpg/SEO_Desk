'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from './icons';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export function GeneratorFilters({
  platforms,
  years,
  dates,
}: {
  platforms: { id: string; name: string }[];
  years: number[];
  /** Tanggal upload (YYYY-MM-DD) yang ada pada data sesuai filter tahun/bulan. */
  dates: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');

  // Setiap perubahan filter kembali ke halaman 1.
  function set(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    next.delete('hal');
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  // Pencarian berjalan otomatis setelah berhenti mengetik.
  useEffect(() => {
    if (query === (params.get('q') ?? '')) return;
    const timer = setTimeout(() => set({ q: query.trim() }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const value = (k: string) => params.get(k) ?? '';

  return (
    <div className="card gen-filters">
      <label>
        Platform
        <select value={value('platform')} onChange={(e) => set({ platform: e.target.value })}>
          <option value="">Semua platform</option>
          {platforms.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tahun
        <select value={value('tahun')} onChange={(e) => set({ tahun: e.target.value, tanggal: '' })}>
          <option value="">Semua tahun</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </label>
      <label>
        Bulan
        <select value={value('bulan')} onChange={(e) => set({ bulan: e.target.value, tanggal: '' })}>
          <option value="">Semua bulan</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tanggal upload
        <select value={value('tanggal')} onChange={(e) => set({ tanggal: e.target.value })}>
          <option value="">Semua tanggal</option>
          {dates.map((d) => (
            <option key={d} value={d}>
              {new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
            </option>
          ))}
        </select>
      </label>
      <span className="divider" aria-hidden="true" />
      <label className="search-box gen-search">
        <Icon name="search" size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && set({ q: query.trim() })}
          placeholder="Cari keyword atau judul…"
          aria-label="Cari keyword atau judul"
        />
      </label>
    </div>
  );
}
