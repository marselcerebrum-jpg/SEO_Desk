export type Platform = {
  id: string;
  name: string;
  sort_order: number;
  is_testing: boolean;
  active: boolean;
  link_cta: string;
  wp_username: string;
  wp_app_password: string;
  system_research: string;
  prompt_research: string;
  system_draft: string;
  prompt_draft: string;
  system_html: string;
  prompt_html: string;
  system_meta: string;
  prompt_meta: string;
  id_cta: string;
  domain: string | null;
  artikel_kompetitor: string;
  wp_author_id: number | null;
};

export type KeywordStatus = 'draft' | 'ready' | 'processing' | 'generated' | 'error';

export type Keyword = {
  id: string;
  platform_id: string;
  keyword: string;
  volume: number | null;
  keyword_status: string | null;
  category: string;
  role: string;
  audience: string;
  schedule_date: string | null;
  status: KeywordStatus;
  title: string | null;
  slug: string | null;
  meta: string | null;
  wp_post_id: number | null;
  wp_edit_url: string | null;
  last_error: string | null;
  copywriter: string | null;
  posted_at: string | null;
  posted_url: string | null;
  qc: Partial<Record<QcKey, boolean>>;
  status_awal: string | null;
  note_awal: string | null;
  feedback: string | null;
  status_akhir: string | null;
  note_akhir: string | null;
  created_at: string;
  updated_at: string;
};

// Checklist QC, urutan sama dengan kolom sheet lama.
export const QC_GROUPS = [
  {
    title: 'QC Artikel',
    items: [
      ['keyword_min5', 'Keyword (min 5)'],
      ['judul_artikel', 'Judul Artikel'],
      ['informasi_valid', 'Informasi Valid'],
      ['sub_point', 'Sub Point'],
      ['cta', 'CTA'],
      ['referensi', 'Referensi'],
      ['yoast_seo', 'Yoast SEO'],
      ['tags', 'Tags'],
    ],
  },
  {
    title: 'Atribut Artikel',
    items: [
      ['cover', 'Cover'],
      ['sub_gambar', 'Sub Gambar'],
      ['baca_juga', 'Baca Juga'],
    ],
  },
] as const;

export type QcKey = (typeof QC_GROUPS)[number]['items'][number][0] | 'index_check';

export const QC_KEYS: QcKey[] = [...QC_GROUPS.flatMap((g) => g.items.map(([key]) => key)), 'index_check'];

export const OPTION_KINDS = {
  status_keyword: 'Status Keyword',
  category: 'Category',
  role: 'Role',
  audience: 'Audience',
  copywriter: 'Copywriter',
  status_awal: 'Status Awal',
  feedback: 'Feedback',
  status_akhir: 'Status Akhir',
} as const;

export type OptionKind = keyof typeof OPTION_KINDS;

export const OPTION_COLORS = ['netral', 'merah', 'salmon', 'pink', 'coklat', 'hijau', 'kuning', 'biru'] as const;
export type OptionColor = (typeof OPTION_COLORS)[number];

export type DropdownOption = {
  id: string;
  kind: OptionKind;
  platform_id: string | null;
  value: string;
  color: OptionColor;
  sort_order: number;
};

export const STEP_LABELS = {
  validasi: 'Validasi',
  konfigurasi: 'Konfigurasi',
  kategori: 'Kategori WP',
  riset: 'Riset (Perplexity)',
  tulis: 'Tulis draf',
  metadata: 'Judul, slug, meta',
  html: 'Format HTML',
  gabung: 'Rapikan HTML',
  draft_wp: 'Draft WordPress',
} as const;

export type StepName = keyof typeof STEP_LABELS;

export type StepLog = {
  name: StepName;
  status: 'running' | 'done' | 'skipped' | 'error';
  started_at: string;
  finished_at?: string;
  note?: string;
  error?: string;
};

export type RunRow = {
  id: string;
  keyword_id: string;
  platform_id: string;
  status: 'running' | 'success' | 'error';
  current_step: StepName | null;
  steps: StepLog[];
  category_id: number | null;
  research: string | null;
  draft: string | null;
  html: string | null;
  title: string | null;
  slug: string | null;
  meta: string | null;
  content: string | null;
  wp_post_id: number | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};
