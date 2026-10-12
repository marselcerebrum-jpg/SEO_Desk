import type { KeywordStatus } from './pipeline/types';

export const STATUS_LABEL: Record<KeywordStatus, string> = {
  draft: 'Draft',
  ready: 'Ready',
  processing: 'Diproses',
  generated: 'Done',
  error: 'Error',
};

export const RUN_STATUS_LABEL = { running: 'Berjalan', success: 'Sukses', error: 'Gagal' } as const;

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export function relative(iso: string) {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} mnt lalu`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.round(hours / 24)} hari lalu`;
}
