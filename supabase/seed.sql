-- 16 platform + Testing (urutan sama dengan Switch di n8n). authorId dari node WordPress n8n.
-- Kolom lain diisi di menu Konfigurasi.
insert into platforms (id, name, sort_order, wp_author_id, is_testing) values
  ('JadiASN',       'JadiASN',        1,  null, false),
  ('Cerebrum',      'Cerebrum',       2,  30,   false),
  ('JadiBUMN',      'JadiBUMN',       3,  33,   false),
  ('JadiPCPM',      'JadiPCPM',       4,  27,   false),
  ('JadiPOLISI',    'JadiPOLISI',     5,  26,   false),
  ('JadiPRAJURIT',  'JadiPRAJURIT',   6,  18,   false),
  ('JadiOJK',       'JadiOJK',        7,  22,   false),
  ('JadiPPG',       'JadiPPG',        8,  21,   false),
  ('JadiPPPK',      'JadiPPPK',       9,  34,   false),
  ('ToeflAcademy',  'ToeflAcademy',   10, 16,   false),
  ('JadiBEASISWA',  'JadiBEASISWA',   11, 24,   false),
  ('JadiNAKES',     'JadiNAKES',      12, 33,   false),
  ('PsikotesKerja', 'PsikotesKerja',  13, 18,   false),
  ('JadiSEKDIN',    'JadiSEKDIN',     14, 1,    false),
  ('MANAKOR',       'MANAKOR',        15, 27,   false),
  ('JagoTPA',       'JagoTPA',        16, 14,   false),
  ('Testing',       'Testing',        17, 3,    true)
on conflict (id) do nothing;

-- Dropdown awal (sesuai sheet lama); tambah/ubah di menu Setting.
insert into dropdown_options (kind, platform_id, value, color, sort_order) values
  ('status_keyword', null, 'Trending',  'coklat', 1),
  ('status_keyword', null, 'Evergreen', 'hijau',  2),
  ('category', 'JadiASN', 'Informasi CPNS', 'hijau', 1),
  ('role', 'JadiASN', 'ASN Berpengalaman (Sharing Dunia Kerja & Realita PNS)', 'netral', 1),
  ('audience', 'JadiASN', 'Fresh Graduate yang Baru Memulai Persiapan CPNS', 'netral', 1),
  ('copywriter', null, 'Jian', 'pink', 1),
  ('status_awal', null, 'Done', 'kuning', 1),
  ('status_akhir', null, 'Done', 'kuning', 1);
