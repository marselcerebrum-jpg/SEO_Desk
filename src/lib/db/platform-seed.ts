import type { Platform } from '../pipeline/types';

// Sama dengan supabase/seed.sql (urutan Switch di n8n). authorId dari node WordPress n8n.
const SEED: [id: string, authorId: number | null][] = [
  ['JadiASN', null],
  ['Cerebrum', 30],
  ['JadiBUMN', 33],
  ['JadiPCPM', 27],
  ['JadiPOLISI', 26],
  ['JadiPRAJURIT', 18],
  ['JadiOJK', 22],
  ['JadiPPG', 21],
  ['JadiPPPK', 34],
  ['ToeflAcademy', 16],
  ['JadiBEASISWA', 24],
  ['JadiNAKES', 33],
  ['PsikotesKerja', 18],
  ['JadiSEKDIN', 1],
  ['MANAKOR', 27],
  ['JagoTPA', 14],
  ['Testing', 3],
];

export function seedPlatforms(): Platform[] {
  return SEED.map(([id, authorId], i) => ({
    id,
    name: id,
    sort_order: i + 1,
    is_testing: id === 'Testing',
    active: true,
    link_cta: '',
    wp_username: '',
    wp_app_password: '',
    system_research: '',
    prompt_research: '',
    system_draft: '',
    prompt_draft: '',
    system_html: '',
    prompt_html: '',
    system_meta: '',
    prompt_meta: '',
    id_cta: '',
    domain: null,
    artikel_kompetitor: '',
    wp_author_id: authorId,
  }));
}
