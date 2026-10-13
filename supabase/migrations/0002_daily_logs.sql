-- Log Kerja Harian: satu log per orang per hari.
-- user_id = id user Supabase Auth (akun dihapus -> log ikut terhapus).
create table if not exists daily_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  log_date     date not null,
  -- [{ "time": "09:00", "text": "...", "status": "done" | "lanjut" }]
  activities   jsonb not null default '[]'::jsonb,
  learn        text not null default '',
  issue        text not null default '',
  affirmation  text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, log_date)
);

alter table daily_logs enable row level security;

drop trigger if exists daily_logs_touch on daily_logs;
create trigger daily_logs_touch before update on daily_logs
  for each row execute function touch_updated_at();
