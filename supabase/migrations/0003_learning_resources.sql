-- Bahan Belajar (tab di menu Log Harian): link / dokumen / data yang perlu dipelajari tiap orang.
create table if not exists learning_resources (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  url         text not null default '',
  kind        text not null default 'artikel'
                check (kind in ('video', 'artikel', 'dokumen', 'kursus', 'data', 'lainnya')),
  tags        jsonb not null default '[]'::jsonb,
  status      text not null default 'belum' check (status in ('belum', 'sedang', 'selesai')),
  due_date    date,
  note        text not null default '',
  done_date   date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists learning_resources_user_idx on learning_resources (user_id);

alter table learning_resources enable row level security;

drop trigger if exists learning_resources_touch on learning_resources;
create trigger learning_resources_touch before update on learning_resources
  for each row execute function touch_updated_at();
