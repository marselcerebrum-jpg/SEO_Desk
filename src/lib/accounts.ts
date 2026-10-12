import 'server-only';
import { listLocalAccounts, type Role } from './local-auth';
import { displayLogin } from './roles';
import { isSupabaseConfigured } from './settings';
import { createAdminClient } from './supabase/admin';
import { supabaseRole } from './supabase/server';

export type Account = {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  lastSignInAt: string | null;
};

// Akun = user Supabase Auth, atau akun lokal (data/accounts.json) sebelum Supabase terhubung.
export async function listAccounts(): Promise<Account[]> {
  if (!isSupabaseConfigured()) {
    return listLocalAccounts()
      .map(({ id, email, name, role, createdAt, lastSignInAt }) => ({ id, email, name, role, createdAt, lastSignInAt }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const { data, error } = await createAdminClient().auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(error.message);
  return data.users
    .map((u) => ({
      id: u.id,
      email: displayLogin(u.email ?? ''),
      name: String(u.user_metadata?.name ?? ''),
      role: supabaseRole(u.app_metadata),
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
