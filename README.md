# SEO Desk

Web app pengganti n8n "Artikel Generator" + Google Sheets + webhook Apps Script.

Menu:
1. **Dashboard** — ringkasan keyword, proses berjalan, artikel per hari, kesiapan platform.
2. **Generator** — buat artikel, set status Ready, lalu **Generate**:
   validasi → kategori WP → riset (Perplexity) → tulis draf (OpenAI) → judul/slug/meta ‖ HTML → draft WordPress.
3. **Konfigurasi** — API key AI, database (Supabase), dan per platform: Link CTA, Username/Password WordPress,
   8 prompt, ID CTA, Domain, Artikel Kompetitor (pengganti master config di Sheets).
4. **Setting** — akun tim, dropdown Generator, ganti password.

Jabatan: **Leader** membuka semua menu dan membuat akun; **Staff** hanya Dashboard, Generator, dan ganti password.
Tidak ada pendaftaran mandiri — akun dibuat Leader di Setting → Akun.

Stack: Next.js 16 (server Node), Supabase (Postgres + Auth) atau mode lokal.

## Menjalankan

`npm install` lalu `npm run dev` → http://127.0.0.1:3000.

Tanpa konfigurasi apa pun app berjalan di **mode lokal**: data di `data/local-db.json` (berisi data contoh),
akun di `data/accounts.json` (password di-hash scrypt), API key di `data/settings.json` (semua tidak ikut git).
Saat pertama dibuka, app meminta membuat akun **Leader** pertama di `/setup`.

## Pindah ke Supabase (untuk tim)

1. Buat project Supabase. Di SQL Editor jalankan `supabase/migrations/0001_init.sql`, lalu `supabase/seed.sql`.
2. Authentication → matikan "Allow new users to sign up", lalu buat satu user lewat **Add user**
   (user tanpa jabatan dianggap Leader). Akun lain dibuat dari app di Setting → Akun.
   Akun mode lokal tidak ikut pindah ke Supabase.
3. Menu **Konfigurasi → Database**: isi URL, anon key, service role key → **Tes & hubungkan**.
   App mengecek tabel dan user dulu, lalu meminta login.
4. Menu **Konfigurasi**: isi tiap platform.

Kalau terkunci (mis. lupa password), hapus kolom supabase di `data/settings.json` untuk kembali ke mode lokal.
Lupa password di mode lokal: Leader lain bisa reset di Setting → Akun; kalau semua Leader lupa, hapus
`data/accounts.json` lalu buat Leader baru di `/setup`.

## Perintah

- `npm test` — tes pipeline (tanpa memanggil API sungguhan)
- `npm run typecheck`
- `npm run build && npm start` — produksi; jalankan di server yang selalu hidup (VPS),
  karena pipeline berjalan 1–3 menit di latar belakang setelah tombol ditekan.

## Beda dengan n8n

- Hasil riset Perplexity benar-benar dipakai penulis (`__RESEARCH__` atau ditempel otomatis).
- Status `processing`/`error` jelas; satu keyword tidak bisa jalan dobel.
- Proses gagal bisa **dilanjutkan** tanpa mengulang tahap yang sudah selesai.
- Kategori yang tidak ada di WP menghentikan proses sebelum memanggil AI.
