import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { getSettings } from '../settings';

// Service role: melewati RLS. Hanya untuk kode server.
export function createAdminClient(settings = getSettings()) {
  if (!settings.supabaseUrl || !settings.supabaseServiceRoleKey) throw new Error('Supabase belum diisi di menu Konfigurasi');
  return createClient(settings.supabaseUrl, settings.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
