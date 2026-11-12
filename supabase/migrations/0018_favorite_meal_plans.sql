alter table public.meal_plans
  add column is_favorite boolean not null default false,
  add column favorited_at timestamptz;
