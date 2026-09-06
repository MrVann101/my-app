create table public.custom_foods (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  food_name text not null check (char_length(food_name) between 1 and 200),
  label_source text not null default 'manual_label' check (label_source in ('manual_label', 'imported_label')),
  default_weight_g numeric not null check (default_weight_g > 0 and default_weight_g <= 100000),
  calories_per_g numeric not null check (calories_per_g >= 0),
  protein_per_g numeric not null default 0 check (protein_per_g >= 0),
  carbs_per_g numeric not null default 0 check (carbs_per_g >= 0),
  fat_per_g numeric not null default 0 check (fat_per_g >= 0),
  fiber_per_g numeric not null default 0 check (fiber_per_g >= 0),
  sodium_per_g numeric not null default 0 check (sodium_per_g >= 0),
  sugar_per_g numeric not null default 0 check (sugar_per_g >= 0),
  label_calories numeric not null check (label_calories >= 0),
  label_weight_g numeric not null check (label_weight_g > 0),
  created_at timestamptz not null default now()
);

create index custom_foods_user_name_idx on public.custom_foods (user_id, food_name);

create table public.daily_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  photo_count integer not null default 0 check (photo_count >= 0),
  text_count integer not null default 0 check (text_count >= 0),
  primary key (user_id, usage_date)
);

create table public.favorite_foods (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  food_name text not null check (char_length(food_name) between 1 and 200),
  default_weight_g numeric not null check (default_weight_g > 0),
  calories_per_g numeric not null check (calories_per_g >= 0),
  protein_per_g numeric not null default 0 check (protein_per_g >= 0),
  carbs_per_g numeric not null default 0 check (carbs_per_g >= 0),
  fat_per_g numeric not null default 0 check (fat_per_g >= 0),
  fiber_per_g numeric not null default 0 check (fiber_per_g >= 0),
  sodium_per_g numeric not null default 0 check (sodium_per_g >= 0),
  sugar_per_g numeric not null default 0 check (sugar_per_g >= 0),
  use_count integer not null default 1 check (use_count > 0),
  created_at timestamptz not null default now()
);

create table public.badges (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null check (char_length(badge_key) between 1 and 100),
  earned_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

alter table public.custom_foods enable row level security;
alter table public.daily_ai_usage enable row level security;
alter table public.favorite_foods enable row level security;
alter table public.badges enable row level security;

create policy "Custom foods are private to their owner"
  on public.custom_foods for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "AI usage is private to the user"
  on public.daily_ai_usage for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Favorite foods are private to their owner"
  on public.favorite_foods for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Badges are private to their owner"
  on public.badges for select
  using (auth.uid() = user_id);
