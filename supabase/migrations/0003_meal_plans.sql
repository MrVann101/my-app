create table public.meal_plans (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  goal text check (goal in ('lose', 'maintain', 'gain')),
  diet_type text,
  total_calories numeric not null default 0 check (total_calories >= 0),
  forked_from bigint references public.meal_plans(id) on delete set null,
  save_count integer not null default 0 check (save_count >= 0),
  created_at timestamptz not null default now()
);

create index meal_plans_public_filters_idx
  on public.meal_plans (visibility, goal, total_calories)
  where visibility = 'public';

create table public.meal_plan_items (
  id bigint generated always as identity primary key,
  plan_id bigint not null references public.meal_plans(id) on delete cascade,
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
  sugar_g numeric not null default 0 check (sugar_g >= 0)
);

alter table public.food_logs
  add constraint food_logs_plan_fk
  foreign key (logged_from_plan_id)
  references public.meal_plans(id)
  on delete set null;

alter table public.meal_plans enable row level security;
alter table public.meal_plan_items enable row level security;

create policy "Public meal plans are readable by authenticated users"
  on public.meal_plans for select
  using (auth.uid() is not null and (visibility = 'public' or auth.uid() = user_id));

create policy "Meal plans are writable by their owner"
  on public.meal_plans for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Public meal-plan items are readable by authenticated users"
  on public.meal_plan_items for select
  using (
    auth.uid() is not null
    and exists (
      select 1
      from public.meal_plans
      where meal_plans.id = meal_plan_items.plan_id
        and (meal_plans.visibility = 'public' or meal_plans.user_id = auth.uid())
    )
  );

create policy "Meal-plan items are writable by their plan owner"
  on public.meal_plan_items for all
  using (
    exists (
      select 1
      from public.meal_plans
      where meal_plans.id = meal_plan_items.plan_id
        and meal_plans.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.meal_plans
      where meal_plans.id = meal_plan_items.plan_id
        and meal_plans.user_id = auth.uid()
    )
  );
