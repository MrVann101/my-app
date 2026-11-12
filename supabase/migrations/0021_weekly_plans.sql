create table public.weekly_plans (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  preferences jsonb not null check (jsonb_typeof(preferences) = 'object'),
  days jsonb not null check (jsonb_typeof(days) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index weekly_plans_owner_updated_idx
  on public.weekly_plans (user_id, updated_at desc);

alter table public.weekly_plans enable row level security;

create policy "Weekly plans are private to their owner"
  on public.weekly_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger weekly_plans_set_updated_at
before update on public.weekly_plans
for each row execute function public.set_updated_at();
