alter table public.profiles
  add column is_admin boolean not null default false;

create table public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  username_snapshot text not null check (char_length(trim(username_snapshot)) between 1 and 60),
  overall_rating smallint not null check (overall_rating between 1 and 5),
  focus_area text not null check (
    focus_area in (
      'meal_logging',
      'ai_photo_scan',
      'weekly_planner',
      'meal_plans',
      'targets_progress',
      'ui_speed',
      'other'
    )
  ),
  logging_ease text not null check (logging_ease in ('very_easy', 'okay', 'needs_work')),
  most_wanted text check (most_wanted is null or char_length(most_wanted) <= 120),
  message text not null check (char_length(trim(message)) between 5 and 1500),
  status text not null default 'new' check (
    status in ('new', 'reviewing', 'planned', 'shipped', 'archived')
  ),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index app_feedback_user_created_idx on public.app_feedback (user_id, created_at desc);
create index app_feedback_status_created_idx on public.app_feedback (status, created_at desc);

alter table public.app_feedback enable row level security;

create policy "App feedback is readable by its author"
  on public.app_feedback
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "App feedback is insertable by its author"
  on public.app_feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);
