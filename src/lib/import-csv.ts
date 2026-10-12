import type { Platform } from './pipeline/types';

// Parser CSV (RFC 4180): mendukung kolom ber-kutip, "" sebagai kutip, dan baris baru di dalam kolom.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const input = text.replace(/^﻿/, '');

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Urutan kolom sama dengan tab "Patim Testing" di Google Sheets.
const COLUMNS: Record<string, keyof Platform> = {
  'link cta': 'link_cta',
  username: 'wp_username',
  password: 'wp_app_password',
  'system content preplexity': 'system_research',
  'prompt user preplexity': 'prompt_research',
  'system content chatgpt drafting': 'system_draft',
  'prompt user chatgpt drafting': 'prompt_draft',
  'system content chatgpt html': 'system_html',
  'prompt user chatgpt html': 'prompt_html',
  'system content chatgpt slug meta': 'system_meta',
  'prompt user chatgpt slug meta': 'prompt_meta',
  'id cta': 'id_cta',
  domain: 'domain',
  'artikel kompetitor': 'artikel_kompetitor',
};

// Placeholder yang salah ketik di sheet ('_KEYWORD', 'AUDIENCE_') dan sisa `"",` di akhir sel.
export function repairPrompt(text: string): string {
  return text
    .replace(/(^|[^_])_KEYWORD(?!_)/g, '$1__KEYWORD__')
    .replace(/(^|[^_])AUDIENCE_(?!_)/g, '$1__AUDIENCE__')
    .replace(/"+,\s*$/, '')
    .trim();
}

const SHEET_ERRORS = new Set(['#N/A', '#REF!', '#VALUE!', '#NAME?', '#ERROR!']);

export type CsvPlatformRow = { platform: string; patch: Partial<Platform> };

export function platformRowsFromCsv(text: string): CsvPlatformRow[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const names = header.map((h) => h.trim().toLowerCase());
  const platformIndex = names.indexOf('platform');
  if (platformIndex === -1) throw new Error('Kolom PLATFORM tidak ditemukan di CSV');

  const result: CsvPlatformRow[] = [];
  for (const row of rows) {
    // Tabel berakhir di bagian LEGEND di bawahnya; baris kosong dilewati.
    if (row.some((cell) => cell.trim().toUpperCase() === 'LEGEND')) break;
    const platform = row[platformIndex]?.trim();
    if (!platform) continue;

    const patch: Partial<Platform> = {};
    names.forEach((name, i) => {
      const field = COLUMNS[name];
      if (!field) return;
      let value = (row[i] ?? '').trim();
      if (SHEET_ERRORS.has(value)) value = '';
      if (field === 'domain') {
        (patch as Record<string, unknown>).domain = value.replace(/^https?:\/\//, '').replace(/\/+$/, '') || null;
      } else if (field.startsWith('prompt_') || field.startsWith('system_')) {
        (patch as Record<string, unknown>)[field] = repairPrompt(value);
      } else {
        (patch as Record<string, unknown>)[field] = value;
      }
    });
    // Password kosong di CSV = jangan timpa password yang sudah tersimpan.
    if (!patch.wp_app_password) delete patch.wp_app_password;
    result.push({ platform, patch });
  }
  return result;
}
