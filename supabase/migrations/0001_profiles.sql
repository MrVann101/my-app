create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (char_length(username) between 2 and 30),
  weight_kg numeric check (weight_kg > 0 and weight_kg <= 700),
  height_cm numeric check (height_cm > 0 and height_cm <= 300),
  age integer check (age between 13 and 120),
  sex text check (sex in ('male', 'female')),
  activity_level text not null default 'moderate' check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal text not null default 'lose' check (goal in ('lose', 'maintain', 'gain')),
  timezone text not null default 'UTC',
  bmr numeric,
  tdee numeric,
  target_calories numeric,
  target_protein_g numeric,
  target_carbs_g numeric,
  target_fat_g numeric,
  deletion_requested_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are readable by their owner"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "Profiles are insertable by their owner"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "Profiles are editable by their owner"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
