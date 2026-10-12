import fs from 'node:fs';
import path from 'node:path';

// API key & koneksi database dari menu Konfigurasi disimpan di file server ini (tidak ikut git).
// Env lama tetap dipakai sebagai cadangan bila kolom di file kosong.
export const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

export type Settings = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  openaiApiKey: string;
  openaiModel: string;
  perplexityApiKey: string;
  perplexityModel: string;
};

const EMPTY: Settings = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  supabaseServiceRoleKey: '',
  openaiApiKey: '',
  openaiModel: '',
  perplexityApiKey: '',
  perplexityModel: '',
};

function readFile(): Settings {
  try {
    return { ...EMPTY, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) };
  } catch {
    return { ...EMPTY };
  }
}

const env = (name: string) => process.env[name] ?? '';

export function getSettings(): Settings {
  const file = readFile();
  return {
    supabaseUrl: file.supabaseUrl || env('NEXT_PUBLIC_SUPABASE_URL'),
    supabaseAnonKey: file.supabaseAnonKey || env('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: file.supabaseServiceRoleKey || env('SUPABASE_SERVICE_ROLE_KEY'),
    openaiApiKey: file.openaiApiKey || env('OPENAI_API_KEY'),
    openaiModel: file.openaiModel || env('OPENAI_MODEL') || 'gpt-4.1-mini',
    perplexityApiKey: file.perplexityApiKey || env('PERPLEXITY_API_KEY'),
    perplexityModel: file.perplexityModel || env('PERPLEXITY_MODEL') || 'sonar',
  };
}

export function saveSettings(patch: Partial<Settings>) {
  const next = { ...readFile(), ...patch };
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${SETTINGS_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, SETTINGS_FILE);
}

export function isSupabaseConfigured(settings = getSettings()) {
  return !!(settings.supabaseUrl && settings.supabaseAnonKey && settings.supabaseServiceRoleKey);
}

// Untuk ditampilkan di form tanpa membocorkan isi rahasia.
export function maskSecret(value: string) {
  return value ? `tersimpan · …${value.slice(-4)}` : '';
}
