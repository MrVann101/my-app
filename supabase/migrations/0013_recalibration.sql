create table public.recalibration_states (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state text not null check (state in ('accepted', 'dismissed')),
  recommended_calories numeric not null check (recommended_calories >= 0),
  updated_at timestamptz not null default now()
);

alter table public.recalibration_states enable row level security;

create policy "Recalibration state is private to its owner"
  on public.recalibration_states for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
