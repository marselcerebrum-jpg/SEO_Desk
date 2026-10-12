-- Marsel SEO Office v2 — skema awal.
-- Pengganti: master config sheet -> platforms (menu Konfigurasi),
-- tab per platform -> keywords, eksekusi n8n -> pipeline_runs.

create extension if not exists pgcrypto;

create type keyword_status as enum ('draft', 'ready', 'processing', 'generated', 'error');
create type run_status as enum ('running', 'success', 'error');

create table platforms (
  id                   text primary key,
  name                 text not null,
  sort_order           integer not null default 0,
  is_testing           boolean not null default false,
  active               boolean not null default true,
  link_cta             text not null default '',
  wp_username          text not null default '',
  wp_app_password      text not null default '',   -- Application Password WordPress
  -- Prompt mendukung placeholder __KEYWORD__ __AUDIENCE__ __ROLE__ __CATEGORY__
  -- __LINK_CTA__ __ID_CTA__ __ARTIKEL_KOMPETITOR__, dan __RESEARCH__ di prompt drafting.
  system_research      text not null default '',
  prompt_research      text not null default '',
  system_draft         text not null default '',
  prompt_draft         text not null default '',
  system_html          text not null default '',
  prompt_html          text not null default '',
  system_meta          text not null default '',
  prompt_meta          text not null default '',
  id_cta               text not null default '',
  domain               text,                       -- tanpa https://, mis. "jadiasn.id"
  artikel_kompetitor   text not null default '',
  wp_author_id         integer,
  updated_at           timestamptz not null default now()
);

create table keywords (
  id                    uuid primary key default gen_random_uuid(),
  platform_id           text not null references platforms(id),
  keyword               text not null,
  volume                integer,
  keyword_status        text,
  category              text not null default '',
  role                  text not null default '',
  audience              text not null default '',
  schedule_date         date,
  status                keyword_status not null default 'draft',
  title                 text,
  slug                  text,
  meta                  text,
  wp_post_id            integer,
  wp_edit_url           text,
  last_error            text,
  -- Kolom tim copywriter & QC (sama dengan sheet lama)
  copywriter            text,
  posted_at             date,
  posted_url            text,
  qc                    jsonb not null default '{}'::jsonb,  -- checklist QC: { keyword_min5: true, ... }
  status_awal           text,
  note_awal             text,
  feedback              text,
  status_akhir          text,
  note_akhir            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index keywords_platform_status_idx on keywords (platform_id, status);

-- Isi dropdown Artikel Generator, dikelola di menu Setting.
-- platform_id null = berlaku untuk semua platform.
create table dropdown_options (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in
                ('status_keyword', 'category', 'role', 'audience', 'copywriter', 'status_awal', 'feedback', 'status_akhir')),
  platform_id text references platforms(id) on delete cascade,
  value       text not null,
  color       text not null default 'netral',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index dropdown_options_kind_idx on dropdown_options (kind, platform_id);

create table pipeline_runs (
  id           uuid primary key default gen_random_uuid(),
  keyword_id   uuid not null references keywords(id) on delete cascade,
  platform_id  text not null references platforms(id),
  status       run_status not null default 'running',
  current_step text,
  steps        jsonb not null default '[]'::jsonb,
  category_id  integer,
  research     text,
  draft        text,
  html         text,
  title        text,
  slug         text,
  meta         text,
  content      text,                          -- HTML final yang dikirim ke WP
  wp_post_id   integer,
  error        text,
  started_by   uuid references auth.users(id),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz
);

create index pipeline_runs_keyword_idx on pipeline_runs (keyword_id, started_at desc);

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger keywords_touch before update on keywords
  for each row execute function touch_updated_at();
create trigger platforms_touch before update on platforms
  for each row execute function touch_updated_at();

-- Kunci atomik: hanya satu run per keyword. Hanya keyword berstatus Ready (atau Error
-- untuk dilanjutkan) yang boleh digenerate. Status 'processing' yang macet
-- lebih dari 20 menit (server restart di tengah jalan) boleh diambil ulang.
create or replace function claim_keyword(p_keyword_id uuid)
returns setof keywords
language sql as $$
  update keywords
     set status = 'processing', last_error = null
   where id = p_keyword_id
     and (status in ('ready', 'error')
          or (status = 'processing' and updated_at < now() - interval '20 minutes'))
  returning *;
$$;

-- App mengakses data hanya dari server dengan service role, jadi tidak ada
-- policy untuk anon/authenticated: tabel (termasuk password WP) tertutup dari luar.
alter table platforms enable row level security;
alter table keywords enable row level security;
alter table pipeline_runs enable row level security;
alter table dropdown_options enable row level security;

revoke execute on function claim_keyword(uuid) from public, anon, authenticated;
