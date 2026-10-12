import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ChatRequest } from '../src/lib/pipeline/providers/openai';
import { executeRun, type PipelineDeps } from '../src/lib/pipeline/run';
import type { Keyword, Platform, RunRow } from '../src/lib/pipeline/types';

const platform: Platform = {
  id: 'JadiASN',
  name: 'JadiASN',
  sort_order: 1,
  is_testing: false,
  active: true,
  link_cta: 'https://jadiasn.example/daftar',
  wp_username: 'editor',
  wp_app_password: 'xxxx',
  system_research: 'Kamu peneliti __CATEGORY__',
  prompt_research: 'Riset __KEYWORD__',
  system_draft: 'Kamu penulis',
  prompt_draft: 'Tulis artikel __KEYWORD__ untuk __AUDIENCE__, CTA ke __LINK_CTA__',
  system_html: 'Kamu formatter',
  prompt_html: 'Ubah ke HTML',
  system_meta: 'Kamu SEO specialist',
  prompt_meta: 'Buat judul untuk __KEYWORD__',
  id_cta: '',
  domain: 'https://jadiasn.example/',
  artikel_kompetitor: '',
  wp_author_id: null,
};

const keyword: Keyword = {
  id: 'kw-1',
  platform_id: 'JadiASN',
  keyword: 'gaji guru asn',
  volume: 10,
  keyword_status: 'Trending',
  category: 'Informasi CPNS',
  role: 'ASN Berpengalaman',
  audience: 'Fresh Graduate',
  schedule_date: null,
  status: 'processing',
  title: null,
  slug: null,
  meta: null,
  wp_post_id: null,
  wp_edit_url: null,
  last_error: null,
  copywriter: null,
  posted_at: null,
  posted_url: null,
  qc: {},
  status_awal: null,
  note_awal: null,
  feedback: null,
  status_akhir: null,
  note_akhir: null,
  created_at: '',
  updated_at: '',
};

const newRun = (patch: Partial<RunRow> = {}): RunRow => ({
  id: 'run-1',
  keyword_id: 'kw-1',
  platform_id: 'JadiASN',
  status: 'running',
  current_step: null,
  steps: [],
  category_id: null,
  research: null,
  draft: null,
  html: null,
  title: null,
  slug: null,
  meta: null,
  content: null,
  wp_post_id: null,
  error: null,
  started_at: new Date().toISOString(),
  finished_at: null,
  ...patch,
});

function fakeDeps(overrides: Partial<PipelineDeps> = {}) {
  const calls = {
    research: [] as [string, string][],
    chat: [] as ChatRequest[],
    posts: [] as unknown[],
    keyword: {} as Partial<Keyword>,
  };
  const deps: PipelineDeps = {
    research: async (system, user) => {
      calls.research.push([system, user]);
      return { text: 'Gaji naik 8%[1].', citations: ['https://bkn.go.id'] };
    },
    chat: async (req) => {
      calls.chat.push(req);
      if (req.jsonSchema) return '{"slug":"gaji-guru-asn","title":"Gaji Guru ASN","meta":"Info gaji."}';
      if (req.user.startsWith('Ubah ke HTML')) return '```html\n<h2>Gaji</h2><p>akhir</p>\n```';
      return 'DRAF ARTIKEL';
    },
    listCategories: async () => [{ id: 12, name: 'Informasi CPNS' }],
    createDraftPost: async (_, post) => {
      calls.posts.push(post);
      return { id: 555, editUrl: 'https://jadiasn.example/wp-admin/post.php?post=555&action=edit' };
    },
    saveRun: async () => {},
    saveKeyword: async (_, patch) => {
      Object.assign(calls.keyword, patch);
    },
    ...overrides,
  };
  return { deps, calls };
}

test('alur sukses: riset sampai ke penulis, post draft dibuat', async () => {
  const { deps, calls } = fakeDeps();
  const run = await executeRun(newRun(), keyword, platform, deps);

  assert.equal(run.status, 'success', run.error ?? '');
  assert.deepEqual(calls.research[0], ['Kamu peneliti Informasi CPNS', 'Riset gaji guru asn']);

  const draftCall = calls.chat.find((c) => c.system === 'Kamu penulis')!;
  assert.match(draftCall.user, /Tulis artikel gaji guru asn untuk Fresh Graduate, CTA ke https:\/\/jadiasn\.example\/daftar/);
  assert.match(draftCall.user, /Gaji naik 8% - source: https:\/\/bkn\.go\.id\./);

  const metaCall = calls.chat.find((c) => c.jsonSchema)!;
  assert.equal(metaCall.system, 'Kamu SEO specialist');

  assert.deepEqual(calls.posts[0], {
    title: 'Gaji Guru ASN',
    slug: 'gaji-guru-asn',
    content: '<h2>Gaji</h2><p>akhir</p>',
    categoryId: 12,
  });
  assert.equal(calls.keyword.status, 'generated');
  assert.equal(calls.keyword.wp_post_id, 555);
  assert.ok(run.steps.every((s) => s.status === 'done'));
});

test('kategori tidak ada: berhenti sebelum memanggil AI', async () => {
  const { deps, calls } = fakeDeps({ listCategories: async () => [{ id: 3, name: 'Lain' }] });
  const run = await executeRun(newRun(), keyword, platform, deps);

  assert.equal(run.status, 'error');
  assert.match(run.error!, /Kategori "Informasi CPNS" tidak ditemukan/);
  assert.equal(calls.research.length, 0);
  assert.equal(calls.chat.length, 0);
  assert.equal(calls.keyword.status, 'error');
});

test('tahap HTML tanpa System maupun Prompt User ditolak di validasi', async () => {
  const { deps } = fakeDeps();
  const run = await executeRun(newRun(), keyword, { ...platform, system_html: '', prompt_html: ' ' }, deps);
  assert.equal(run.status, 'error');
  assert.match(run.error!, /HTML/);
});

test('HTML cukup dengan System Content saja (format sheet lama), __TOPIC__ = kategori', async () => {
  const { deps, calls } = fakeDeps();
  const run = await executeRun(
    newRun(),
    keyword,
    { ...platform, system_html: 'Topik: __TOPIC__. Ubah ke HTML', prompt_html: '' },
    deps,
  );
  assert.equal(run.status, 'success', run.error ?? '');
  const htmlCall = calls.chat.find((c) => c.system?.startsWith('Topik'))!;
  assert.equal(htmlCall.system, 'Topik: Informasi CPNS. Ubah ke HTML');
});

test('lanjutkan run gagal: tahap yang sudah ada tidak diulang', async () => {
  const { deps, calls } = fakeDeps();
  const resumed = newRun({
    category_id: 12,
    research: 'riset lama',
    draft: 'draf lama',
    html: '<p>lama</p>',
    title: 'Judul',
    slug: 'judul',
    meta: 'Meta',
  });
  const run = await executeRun(resumed, keyword, platform, deps);

  assert.equal(run.status, 'success');
  assert.equal(calls.research.length, 0);
  assert.equal(calls.chat.length, 0);
  assert.equal(calls.posts.length, 1);
});

test('HTML gagal: metadata tetap selesai, post tidak dibuat', async () => {
  const { deps, calls } = fakeDeps();
  const chat = deps.chat;
  deps.chat = async (req) => {
    if (req.user.startsWith('Ubah ke HTML')) throw new Error('api.openai.com 500: down');
    return chat(req);
  };
  const run = await executeRun(newRun(), keyword, platform, deps);

  assert.equal(run.status, 'error');
  assert.match(run.error!, /500/);
  assert.equal(run.title, 'Gaji Guru ASN');
  assert.equal(run.steps.find((s) => s.name === 'html')?.status, 'error');
  assert.equal(run.steps.find((s) => s.name === 'metadata')?.status, 'done');
  assert.equal(calls.posts.length, 0);
});
