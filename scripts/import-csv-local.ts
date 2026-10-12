// Impor CSV konfigurasi ke database mode lokal (data/local-db.json) dari terminal.
// Pemakaian: npx tsx scripts/import-csv-local.ts "<path ke file.csv>"
// (Untuk mode Supabase pakai tombol "Impor CSV" di menu Konfigurasi.)
import fs from 'node:fs';
import path from 'node:path';
import { platformRowsFromCsv } from '../src/lib/import-csv';
import type { Platform } from '../src/lib/pipeline/types';

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('Pemakaian: npx tsx scripts/import-csv-local.ts <file.csv>');
  process.exit(1);
}

const dbFile = path.join(process.cwd(), 'data', 'local-db.json');
const db = JSON.parse(fs.readFileSync(dbFile, 'utf8')) as { platforms: Platform[] };

for (const { platform, patch } of platformRowsFromCsv(fs.readFileSync(csvPath, 'utf8'))) {
  const target = db.platforms.find(
    (p) => p.id.toLowerCase() === platform.toLowerCase() || p.name.toLowerCase() === platform.toLowerCase(),
  );
  if (!target) {
    console.log(`- lewati (tidak dikenal): ${platform}`);
    continue;
  }
  Object.assign(target, patch);
  const filled = (['system_research', 'prompt_research', 'system_draft', 'prompt_draft', 'system_html', 'prompt_html', 'system_meta', 'prompt_meta'] as const)
    .map((f) => (target[f].trim() ? '✓' : '·'))
    .join('');
  console.log(`✓ ${target.id.padEnd(14)} domain=${target.domain ?? '-'} user=${target.wp_username || '-'} prompt=${filled}`);
}

fs.writeFileSync(`${dbFile}.tmp`, JSON.stringify(db, null, 2));
fs.renameSync(`${dbFile}.tmp`, dbFile);
