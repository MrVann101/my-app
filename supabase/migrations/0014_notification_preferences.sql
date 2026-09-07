create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default false,
  frequency text not null default 'off' check (frequency in ('off', 'daily', 'weekly')),
  reminder_time time not null default '19:00:00',
  timezone text not null default 'UTC',
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "Notification preferences are private to their owner"
  on public.notification_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
