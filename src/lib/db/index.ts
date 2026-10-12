import 'server-only';
import { isSupabaseConfigured } from '../settings';
import { localDb } from './local';
import { supabaseDb } from './supabase';
import type { Db } from './types';

export function getDb(): Db {
  return isSupabaseConfigured() ? supabaseDb() : localDb();
}
