import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { accountFromSessionToken, isRole, SESSION_COOKIE, type Role } from '../local-auth';
import { getSettings, isSupabaseConfigured } from '../settings';

export async function createClient() {
  const cookieStore = await cookies();
  const { supabaseUrl, supabaseAnonKey } = getSettings();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Dipanggil dari Server Component; refresh sesi sudah ditangani proxy.
        }
      },
    },
  });
}

export type AppUser = { id: string; email: string; name: string; role: Role };

// Jabatan Supabase disimpan di app_metadata (hanya bisa diubah lewat service role).
// User lama yang dibuat dari dashboard Supabase tanpa jabatan dianggap Leader.
export const supabaseRole = (appMetadata: Record<string, unknown> | undefined): Role =>
  isRole(appMetadata?.role) ? appMetadata.role : 'leader';

export async function getCurrentUser(): Promise<AppUser | null> {
  // Data selalu dibaca saat request; tanpa ini halaman ikut di-prerender saat build.
  await connection();
  if (!isSupabaseConfigured()) {
    const account = accountFromSessionToken((await cookies()).get(SESSION_COOKIE)?.value);
    return account && { id: account.id, email: account.email, name: account.name, role: account.role };
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  return {
    id: data.user.id,
    email: data.user.email ?? '',
    name: String(data.user.user_metadata?.name ?? ''),
    role: supabaseRole(data.user.app_metadata),
  };
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

// Konfigurasi, akun, dan dropdown hanya untuk Leader; Staff dikembalikan ke Dashboard.
export async function requireLeader(): Promise<AppUser> {
  const user = await requireUser();
  if (user.role !== 'leader') redirect('/');
  return user;
}
