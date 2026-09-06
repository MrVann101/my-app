create table public.food_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  meal_type text not null default 'snack' check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name text not null check (char_length(food_name) between 1 and 200),
  weight_g numeric not null check (weight_g > 0 and weight_g <= 100000),
  calories_per_g numeric not null check (calories_per_g >= 0),
  protein_per_g numeric not null default 0 check (protein_per_g >= 0),
  carbs_per_g numeric not null default 0 check (carbs_per_g >= 0),
  fat_per_g numeric not null default 0 check (fat_per_g >= 0),
  fiber_per_g numeric not null default 0 check (fiber_per_g >= 0),
  sodium_per_g numeric not null default 0 check (sodium_per_g >= 0),
  sugar_per_g numeric not null default 0 check (sugar_per_g >= 0),
  calories numeric not null check (calories >= 0),
  protein_g numeric not null default 0 check (protein_g >= 0),
  carbs_g numeric not null default 0 check (carbs_g >= 0),
  fat_g numeric not null default 0 check (fat_g >= 0),
  fiber_g numeric not null default 0 check (fiber_g >= 0),
  sodium_mg numeric not null default 0 check (sodium_mg >= 0),
  sugar_g numeric not null default 0 check (sugar_g >= 0),
  source text not null default 'manual' check (source in ('ai_photo', 'ai_text', 'database', 'manual')),
  data_source text check (data_source in ('usda', 'off', 'gemini', 'groq')),
  ai_confidence text check (ai_confidence in ('low', 'medium', 'high')),
  logged_from_plan_id bigint,
  photo_url text,
  created_at timestamptz not null default now()
);

create index food_logs_user_date_idx on public.food_logs (user_id, log_date desc);

create table public.daily_summaries (
  user_id uuid not null references auth.users(id) on delete cascade,
  summary_date date not null,
  total_calories numeric not null default 0 check (total_calories >= 0),
  total_protein_g numeric not null default 0 check (total_protein_g >= 0),
  total_carbs_g numeric not null default 0 check (total_carbs_g >= 0),
  total_fat_g numeric not null default 0 check (total_fat_g >= 0),
  total_fiber_g numeric not null default 0 check (total_fiber_g >= 0),
  total_sodium_mg numeric not null default 0 check (total_sodium_mg >= 0),
  total_sugar_g numeric not null default 0 check (total_sugar_g >= 0),
  calories_burned numeric not null default 0 check (calories_burned >= 0),
  hit_target boolean not null default false,
  logged_at_least_once boolean not null default false,
  primary key (user_id, summary_date)
);

create table public.weight_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  weight_kg numeric not null check (weight_kg > 0 and weight_kg <= 700),
  created_at timestamptz not null default now()
);

create index weight_logs_user_date_idx on public.weight_logs (user_id, log_date desc);

create table public.exercise_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  activity_name text not null check (char_length(activity_name) between 1 and 200),
  calories_burned numeric not null check (calories_burned >= 0),
  created_at timestamptz not null default now()
);

create index exercise_logs_user_date_idx on public.exercise_logs (user_id, log_date desc);

create table public.streaks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_log_date date
);

alter table public.food_logs enable row level security;
alter table public.daily_summaries enable row level security;
alter table public.weight_logs enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.streaks enable row level security;

create policy "Food logs are owned by the user"
  on public.food_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Daily summaries are owned by the user"
  on public.daily_summaries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Weight logs are owned by the user"
  on public.weight_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Exercise logs are owned by the user"
  on public.exercise_logs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Streaks are owned by the user"
  on public.streaks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
