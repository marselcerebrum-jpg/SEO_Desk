'use server';

import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { listAccounts } from '@/lib/accounts';
import { getDb } from '@/lib/db';
import { resetLocalData } from '@/lib/db/local';
import type { KeywordOptionField } from '@/lib/db/types';
import { platformRowsFromCsv } from '@/lib/import-csv';
import {
  createLocalAccount,
  createSessionToken,
  deleteLocalAccount,
  findLocalAccountByEmail,
  hasLocalAccounts,
  isRole,
  ROLES,
  SESSION_COOKIE,
  SESSION_DAYS,
  updateLocalAccount,
  verifyPassword,
  type LocalAccount,
  type Role,
} from '@/lib/local-auth';
import {
  OPTION_COLORS,
  OPTION_KINDS,
  QC_KEYS,
  type Keyword,
  type OptionColor,
  type OptionKind,
  type Platform,
  type QcKey,
} from '@/lib/pipeline/types';
import { testWpConnection } from '@/lib/pipeline/providers/wordpress';
import { startRun } from '@/lib/pipeline/start';
import { getSettings, isSupabaseConfigured, saveSettings } from '@/lib/settings';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient, requireLeader, requireUser } from '@/lib/supabase/server';

// email: dikembalikan ke form login supaya tidak hilang saat form di-reset setelah gagal.
export type ActionState = { error?: string; ok?: string; email?: string } | undefined;

const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim();
const optionalInt = (form: FormData, name: string) => {
  const value = text(form, name);
  return value ? Number.parseInt(value, 10) : null;
};
const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

// ---------- Auth ----------

async function startLocalSession(account: LocalAccount) {
  updateLocalAccount(account.id, { lastSignInAt: new Date().toISOString() });
  const h = await headers();
  const https = h.get('x-forwarded-proto') === 'https' || (h.get('origin') ?? '').startsWith('https://');
  (await cookies()).set(SESSION_COOKIE, createSessionToken(account), {
    httpOnly: true,
    sameSite: 'lax',
    secure: https,
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function signIn(_: ActionState, form: FormData): Promise<ActionState> {
  const email = text(form, 'email').toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!isSupabaseConfigured()) {
    const account = findLocalAccountByEmail(email);
    if (!account || !verifyPassword(password, account.passwordHash)) return { error: 'Username/email atau password salah', email };
    await startLocalSession(account);
    redirect('/');
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: 'Username/email atau password salah', email };
  redirect('/');
}

export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}

type NewAccount = { name: string; email: string; password: string };

function readNewAccount(form: FormData): NewAccount | { error: string } {
  const name = text(form, 'name');
  const email = text(form, 'email').toLowerCase();
  const password = String(form.get('password') ?? '');
  if (!name) return { error: 'Nama wajib diisi' };
  // Mode lokal boleh pakai username (mis. "admin"); Supabase Auth wajib email.
  if (isSupabaseConfigured() ? !email.includes('@') : !/^[^s]{3,}$/.test(email)) {
    return { error: isSupabaseConfigured() ? 'Email tidak valid' : 'Username/email minimal 3 karakter tanpa spasi' };
  }
  if (password.length < 8) return { error: 'Password minimal 8 karakter' };
  if (form.has('confirm') && password !== String(form.get('confirm'))) return { error: 'Konfirmasi password tidak sama' };
  return { name, email, password };
}

// Pertama kali dibuka di mode lokal: belum ada akun, jadi akun Leader pertama dibuat di /setup.
export async function setupFirstLeader(_: ActionState, form: FormData): Promise<ActionState> {
  if (isSupabaseConfigured() || hasLocalAccounts()) redirect('/login');
  const input = readNewAccount(form);
  if ('error' in input) return input;
  const account = createLocalAccount({ ...input, role: 'leader' });
  await startLocalSession(account);
  redirect('/');
}

// ---------- Keyword ----------

export async function createKeyword(_: ActionState, form: FormData): Promise<ActionState> {
  await requireUser();
  const row = {
    platform_id: text(form, 'platform_id'),
    keyword: text(form, 'keyword'),
    category: text(form, 'category'),
    role: text(form, 'role'),
    audience: text(form, 'audience'),
    volume: optionalInt(form, 'volume'),
    schedule_date: text(form, 'schedule_date') || null,
    keyword_status: text(form, 'keyword_status') || null,
  };
  if (!row.platform_id || !row.keyword) return { error: 'Platform dan keyword wajib diisi' };
  try {
    await getDb().createKeyword(row);
  } catch (error) {
    return { error: errorText(error) };
  }
  revalidatePath('/generator');
  return { ok: `Keyword "${row.keyword}" ditambahkan` };
}

// ---------- Grid Artikel Generator (edit per sel) ----------

const TEXT_FIELDS = new Set([
  'keyword',
  'category',
  'role',
  'audience',
  'keyword_status',
  'copywriter',
  'posted_url',
  'status_awal',
  'note_awal',
  'feedback',
  'status_akhir',
  'note_akhir',
]);
const DATE_FIELDS = new Set(['schedule_date', 'posted_at']);

export type CellValue = string | number | boolean | null;

export async function updateKeywordCell(id: string, field: string, value: CellValue): Promise<ActionState> {
  await requireUser();
  const db = getDb();
  let patch: Partial<Keyword>;

  if (field.startsWith('qc.')) {
    const key = field.slice(3) as QcKey;
    if (!QC_KEYS.includes(key)) return { error: `Kolom QC tidak dikenal: ${key}` };
    const keyword = await db.getKeyword(id);
    if (!keyword) return { error: 'Keyword tidak ditemukan' };
    patch = { qc: { ...keyword.qc, [key]: value === true } };
  } else if (TEXT_FIELDS.has(field)) {
    const text = String(value ?? '').trim();
    if (field === 'keyword' && !text) return { error: 'Keyword tidak boleh kosong' };
    patch = { [field]: ['category', 'role', 'audience', 'keyword'].includes(field) ? text : text || null };
  } else if (DATE_FIELDS.has(field)) {
    patch = { [field]: value ? String(value) : null };
  } else if (field === 'volume') {
    const n = Number.parseInt(String(value ?? ''), 10);
    patch = { volume: Number.isFinite(n) ? n : null };
  } else if (field === 'status') {
    // Tim hanya mengatur Draft <-> Ready; Diproses/Done/Error diatur oleh proses generate.
    if (value !== 'draft' && value !== 'ready') return { error: 'Status hanya bisa diubah ke Draft atau Ready' };
    const keyword = await db.getKeyword(id);
    if (!keyword) return { error: 'Keyword tidak ditemukan' };
    if (keyword.status !== 'draft' && keyword.status !== 'ready') {
      return { error: 'Status hanya bisa diubah selama masih Draft/Ready' };
    }
    if (value === 'ready') {
      const missing = (['keyword', 'category', 'role', 'audience'] as const).filter((f) => !keyword[f]?.trim());
      if (missing.length) return { error: `Lengkapi dulu sebelum Ready: ${missing.join(', ')}` };
    }
    patch = { status: value };
  } else {
    return { error: `Kolom tidak bisa diedit: ${field}` };
  }

  try {
    await db.updateKeyword(id, patch);
  } catch (error) {
    return { error: errorText(error) };
  }
  // Status memengaruhi kartu Dashboard ("Menunggu generate").
  if (field === 'status') revalidatePath('/', 'layout');
  return { ok: 'Tersimpan' };
}

export async function addKeywordRow(platformId: string, keyword: string): Promise<ActionState> {
  await requireUser();
  const text = keyword.trim();
  if (!platformId || !text) return { error: 'Keyword wajib diisi' };
  try {
    await getDb().createKeyword({ platform_id: platformId, keyword: text });
  } catch (error) {
    return { error: errorText(error) };
  }
  revalidatePath('/generator');
  return { ok: `Keyword "${text}" ditambahkan` };
}

export async function deleteKeywordRow(id: string): Promise<ActionState> {
  await requireUser();
  const keyword = await getDb().getKeyword(id);
  if (keyword?.status === 'processing') return { error: 'Sedang diproses, tunggu sampai selesai' };
  await getDb().deleteKeyword(id);
  revalidatePath('/generator');
  return { ok: 'Dihapus' };
}

// ---------- Akun (menu Setting) ----------

export async function createAccount(_: ActionState, form: FormData): Promise<ActionState> {
  await requireLeader();
  const input = readNewAccount(form);
  if ('error' in input) return input;
  const role: Role = isRole(form.get('role')) ? (form.get('role') as Role) : 'staff';

  if (!isSupabaseConfigured()) {
    try {
      createLocalAccount({ ...input, role });
    } catch (error) {
      return { error: errorText(error) };
    }
  } else {
    const { error } = await createAdminClient().auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true, // langsung bisa login tanpa verifikasi email
      user_metadata: { name: input.name },
      app_metadata: { role },
    });
    if (error) return { error: error.message };
  }
  revalidatePath('/settings');
  return { ok: `Akun ${input.email} dibuat sebagai ${ROLES[role]}` };
}

// Selalu sisakan minimal satu Leader supaya Konfigurasi dan akun tetap bisa dikelola.
async function isLastLeader(id: string) {
  const leaders = (await listAccounts()).filter((a) => a.role === 'leader');
  return leaders.length === 1 && leaders[0].id === id;
}

export async function setAccountRole(id: string, role: Role): Promise<ActionState> {
  const me = await requireLeader();
  if (!isRole(role)) return { error: 'Jabatan tidak dikenal' };
  if (me.id === id) return { error: 'Jabatan sendiri tidak bisa diubah' };
  if (role === 'staff' && (await isLastLeader(id))) return { error: 'Harus ada minimal satu Leader' };
  if (!isSupabaseConfigured()) {
    updateLocalAccount(id, { role });
  } else {
    const { error } = await createAdminClient().auth.admin.updateUserById(id, { app_metadata: { role } });
    if (error) return { error: error.message };
  }
  revalidatePath('/settings');
  return { ok: `Jabatan diubah ke ${ROLES[role]}` };
}

// Untuk anggota yang lupa password: Leader mengisi password baru lalu memberitahukannya.
export async function resetAccountPassword(id: string, password: string): Promise<ActionState> {
  const me = await requireLeader();
  if (me.id === id) return { error: 'Ganti password sendiri lewat tab Ganti password' };
  if (password.length < 8) return { error: 'Password minimal 8 karakter' };
  if (!isSupabaseConfigured()) {
    updateLocalAccount(id, { password });
  } else {
    const { error } = await createAdminClient().auth.admin.updateUserById(id, { password });
    if (error) return { error: error.message };
  }
  return { ok: 'Password direset' };
}

export async function deleteAccount(id: string): Promise<ActionState> {
  const me = await requireLeader();
  if (me.id === id) return { error: 'Tidak bisa menghapus akun yang sedang dipakai' };
  if (await isLastLeader(id)) return { error: 'Harus ada minimal satu Leader' };
  if (!isSupabaseConfigured()) {
    deleteLocalAccount(id);
  } else {
    const { error } = await createAdminClient().auth.admin.deleteUser(id);
    if (error) return { error: error.message };
  }
  revalidatePath('/settings');
  return { ok: 'Akun dihapus' };
}

// ---------- Dropdown (menu Setting) ----------

const KEYWORD_FIELD: Record<OptionKind, KeywordOptionField> = {
  status_keyword: 'keyword_status',
  category: 'category',
  role: 'role',
  audience: 'audience',
  copywriter: 'copywriter',
  status_awal: 'status_awal',
  feedback: 'feedback',
  status_akhir: 'status_akhir',
};

export type DropdownRowInput = { id?: string; value: string; color: string; platform_id: string | null };

// Simpan seluruh pilihan satu jenis dropdown sekaligus (urutan = urutan baris).
export async function saveDropdownOptions(kind: OptionKind, rows: DropdownRowInput[]): Promise<ActionState> {
  await requireLeader();
  if (!(kind in OPTION_KINDS)) return { error: 'Jenis dropdown tidak dikenal' };

  const clean = rows.map((r) => ({
    id: r.id,
    value: r.value.trim(),
    color: (OPTION_COLORS.includes(r.color as OptionColor) ? r.color : 'netral') as OptionColor,
    platform_id: r.platform_id || null,
  }));
  if (clean.some((r) => !r.value)) return { error: 'Nama pilihan tidak boleh kosong' };
  const seen = new Set<string>();
  for (const r of clean) {
    const key = `${r.platform_id ?? '*'}|${r.value.toLowerCase()}`;
    if (seen.has(key)) return { error: `"${r.value}" muncul dua kali untuk cakupan yang sama` };
    seen.add(key);
  }

  const db = getDb();
  try {
    // Pilihan yang di-rename: ikut ganti nilainya di keyword agar data lama tetap cocok.
    const before = new Map((await db.listOptions()).filter((o) => o.kind === kind).map((o) => [o.id, o]));
    for (const r of clean) {
      const old = r.id ? before.get(r.id) : undefined;
      if (old && old.value !== r.value) {
        await db.renameKeywordValues(KEYWORD_FIELD[kind], old.value, r.value, old.platform_id);
      }
    }
    await db.replaceOptions(kind, clean.map((r) => ({ ...r, kind })));
  } catch (error) {
    return { error: errorText(error) };
  }
  revalidatePath('/', 'layout');
  return { ok: `${OPTION_KINDS[kind]} tersimpan (${clean.length} pilihan)` };
}

// ---------- Ganti password (menu Setting) ----------

export async function changePassword(_: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireUser();
  const current = String(form.get('current') ?? '');
  const password = String(form.get('password') ?? '');
  const confirmation = String(form.get('confirm') ?? '');
  if (password.length < 8) return { error: 'Password minimal 8 karakter' };
  if (password !== confirmation) return { error: 'Konfirmasi password tidak sama' };

  if (!isSupabaseConfigured()) {
    const account = findLocalAccountByEmail(me.email);
    if (!account || !verifyPassword(current, account.passwordHash)) return { error: 'Password lama salah' };
    updateLocalAccount(account.id, { password });
    // Sesi lama batal karena hash berubah; buat sesi baru supaya tetap masuk.
    await startLocalSession({ ...account, passwordHash: findLocalAccountByEmail(me.email)!.passwordHash });
    return { ok: 'Password berhasil diganti' };
  }
  const supabase = await createClient();
  const { error: wrong } = await supabase.auth.signInWithPassword({ email: me.email, password: current });
  if (wrong) return { error: 'Password lama salah' };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { ok: 'Password berhasil diganti' };
}

export async function generateKeyword(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const keywordId = text(form, 'keyword_id');
  try {
    await startRun(keywordId, user.id, { resume: form.get('resume') === '1' });
  } catch (error) {
    return { error: errorText(error) };
  }
  revalidatePath('/generator');
  // Dari grid: tetap di halaman, status baris diperbarui otomatis.
  if (form.get('stay') === '1') return { ok: 'Diproses' };
  redirect(`/generator/${keywordId}`);
}

// ---------- Konfigurasi platform ----------

// Teks panjang disimpan apa adanya (spasi/baris baru di dalam prompt penting).
const LONG_TEXT_FIELDS = [
  'system_research',
  'prompt_research',
  'system_draft',
  'prompt_draft',
  'system_html',
  'prompt_html',
  'system_meta',
  'prompt_meta',
  'artikel_kompetitor',
] as const;

// Kolom rahasia yang dikosongkan berarti "tetap pakai nilai lama".
const secret = (form: FormData, name: string, current: string) => text(form, name) || current;

export async function updatePlatform(_: ActionState, form: FormData): Promise<ActionState> {
  await requireLeader();
  const db = getDb();
  const id = text(form, 'id');
  const current = await db.getPlatform(id);
  if (!current) return { error: 'Platform tidak ditemukan' };
  const name = text(form, 'name');
  if (!name) return { error: 'Nama platform wajib diisi' };

  const patch: Partial<Platform> = {
    name,
    link_cta: text(form, 'link_cta'),
    wp_username: text(form, 'wp_username'),
    wp_app_password: secret(form, 'wp_app_password', current.wp_app_password),
    id_cta: text(form, 'id_cta'),
    domain: text(form, 'domain').replace(/^https?:\/\//, '').replace(/\/+$/, '') || null,
    wp_author_id: optionalInt(form, 'wp_author_id'),
    active: form.get('active') === 'on',
    ...Object.fromEntries(LONG_TEXT_FIELDS.map((f) => [f, String(form.get(f) ?? '')])),
  };
  try {
    await db.updatePlatform(id, patch);
  } catch (error) {
    return { error: errorText(error) };
  }
  revalidatePath('/konfigurasi');
  revalidatePath(`/konfigurasi/${id}`);
  return { ok: 'Tersimpan' };
}

export async function importKonfigurasiCsv(_: ActionState, form: FormData): Promise<ActionState> {
  await requireLeader();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) return { error: 'Pilih file CSV dulu' };
  try {
    const db = getDb();
    const platforms = await db.listPlatforms();
    const rows = platformRowsFromCsv(await file.text());
    const updated: string[] = [];
    const unknown: string[] = [];
    for (const { platform, patch } of rows) {
      const target = platforms.find(
        (p) => p.id.toLowerCase() === platform.toLowerCase() || p.name.toLowerCase() === platform.toLowerCase(),
      );
      if (!target) {
        unknown.push(platform);
        continue;
      }
      await db.updatePlatform(target.id, patch);
      updated.push(target.name);
    }
    revalidatePath('/konfigurasi');
    revalidatePath('/');
    const skipped = unknown.length ? ` Tidak dikenal: ${unknown.join(', ')}.` : '';
    return { ok: `${updated.length} platform diperbarui.${skipped}` };
  } catch (error) {
    return { error: errorText(error) };
  }
}

// ---------- API key & database (menu Konfigurasi) ----------

export async function saveAiSettings(_: ActionState, form: FormData): Promise<ActionState> {
  await requireLeader();
  const current = getSettings();
  saveSettings({
    openaiApiKey: secret(form, 'openaiApiKey', current.openaiApiKey),
    openaiModel: text(form, 'openaiModel'),
    perplexityApiKey: secret(form, 'perplexityApiKey', current.perplexityApiKey),
    perplexityModel: text(form, 'perplexityModel'),
  });
  revalidatePath('/konfigurasi');
  return { ok: 'API key tersimpan' };
}

export async function saveSupabaseSettings(_: ActionState, form: FormData): Promise<ActionState> {
  await requireLeader();
  const current = getSettings();
  const candidate = {
    ...current,
    supabaseUrl: text(form, 'supabaseUrl').replace(/\/+$/, ''),
    supabaseAnonKey: secret(form, 'supabaseAnonKey', current.supabaseAnonKey),
    supabaseServiceRoleKey: secret(form, 'supabaseServiceRoleKey', current.supabaseServiceRoleKey),
  };
  if (!isSupabaseConfigured(candidate)) return { error: 'URL, anon key, dan service role key wajib diisi' };

  // Cek dulu supaya tidak terkunci: tabel harus ada dan minimal satu user bisa login.
  try {
    const admin = createAdminClient(candidate);
    const { error: tableError } = await admin.from('platforms').select('id').limit(1);
    if (tableError) {
      return { error: `Tabel belum siap (${tableError.message}). Jalankan supabase/migrations/0001_init.sql dan seed.sql dulu.` };
    }
    const { data: users, error: userError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (userError) return { error: `Service role key ditolak: ${userError.message}` };
    if (!users.users.length) {
      return {
        error: 'Belum ada user. Buat dulu di Supabase → Authentication → Add user (otomatis jadi Leader), supaya bisa login.',
      };
    }
  } catch (error) {
    return { error: `Tidak bisa terhubung: ${errorText(error)}` };
  }

  saveSettings({
    supabaseUrl: candidate.supabaseUrl,
    supabaseAnonKey: candidate.supabaseAnonKey,
    supabaseServiceRoleKey: candidate.supabaseServiceRoleKey,
  });
  redirect('/login');
}

export async function disconnectSupabase() {
  await requireLeader();
  saveSettings({ supabaseUrl: '', supabaseAnonKey: '', supabaseServiceRoleKey: '' });
  redirect('/konfigurasi');
}

// Mengetes data yang tersimpan (simpan dulu sebelum tes).
export async function testWordpress(_: ActionState, form: FormData): Promise<ActionState> {
  await requireLeader();
  const platform = await getDb().getPlatform(text(form, 'id'));
  if (!platform) return { error: 'Platform tidak ditemukan' };
  try {
    const name = await testWpConnection(platform);
    return { ok: `Terhubung sebagai ${name}` };
  } catch (error) {
    return { error: errorText(error) };
  }
}

export async function resetLocal(_: ActionState, form: FormData): Promise<ActionState> {
  await requireLeader();
  if (isSupabaseConfigured()) return { error: 'Hanya untuk mode lokal' };
  const withDemo = form.get('mode') === 'demo';
  resetLocalData(withDemo);
  revalidatePath('/', 'layout');
  return { ok: withDemo ? 'Data contoh dipulihkan' : 'Keyword dan riwayat run lokal dikosongkan' };
}
