alter table public.weekly_plans
  add column daily_calorie_target integer not null default 2000 check (daily_calorie_target between 800 and 6000),
  add column meals_per_day integer not null default 3 check (meals_per_day between 2 and 6),
  add column preferred_foods text[] not null default '{}',
  add column food_restrictions text[] not null default '{}',
  add column is_active boolean not null default false,
  add column avg_daily_calories numeric not null default 0 check (avg_daily_calories >= 0),
  add column avg_daily_protein_g numeric not null default 0 check (avg_daily_protein_g >= 0),
  add column avg_daily_carbs_g numeric not null default 0 check (avg_daily_carbs_g >= 0),
  add column avg_daily_fat_g numeric not null default 0 check (avg_daily_fat_g >= 0);

create unique index weekly_plans_one_active_per_user_idx
  on public.weekly_plans (user_id)
  where is_active = true;

create table public.weekly_plan_meals (
  id bigint generated always as identity primary key,
  weekly_plan_id bigint not null references public.weekly_plans(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  day_name text not null check (day_name in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  slot_index smallint not null check (slot_index between 0 and 5),
  meal_slot text not null check (meal_slot in ('Breakfast', 'Lunch', 'Dinner', 'Snack 1', 'Snack 2', 'Snack 3')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 240),
  servings numeric not null default 1 check (servings >= 0.25 and servings <= 12),
  calories_per_serving numeric not null default 0 check (calories_per_serving >= 0 and calories_per_serving <= 5000),
  protein_g_per_serving numeric not null default 0 check (protein_g_per_serving >= 0 and protein_g_per_serving <= 500),
  carbs_g_per_serving numeric not null default 0 check (carbs_g_per_serving >= 0 and carbs_g_per_serving <= 1000),
  fat_g_per_serving numeric not null default 0 check (fat_g_per_serving >= 0 and fat_g_per_serving <= 500),
  total_calories numeric not null default 0 check (total_calories >= 0),
  total_protein_g numeric not null default 0 check (total_protein_g >= 0),
  total_carbs_g numeric not null default 0 check (total_carbs_g >= 0),
  total_fat_g numeric not null default 0 check (total_fat_g >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (weekly_plan_id, day_of_week, slot_index)
);

create index weekly_plan_meals_plan_schedule_idx
  on public.weekly_plan_meals (weekly_plan_id, day_of_week, slot_index);

alter table public.weekly_plan_meals enable row level security;

create policy "Weekly plan meals are private to their plan owner"
  on public.weekly_plan_meals for all
  using (
    exists (
      select 1
      from public.weekly_plans
      where weekly_plans.id = weekly_plan_meals.weekly_plan_id
        and weekly_plans.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.weekly_plans
      where weekly_plans.id = weekly_plan_meals.weekly_plan_id
        and weekly_plans.user_id = auth.uid()
    )
  );

create or replace function public.compute_weekly_plan_meal_totals()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.day_name = (array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])[new.day_of_week];
  new.total_calories = round(new.calories_per_serving * new.servings, 2);
  new.total_protein_g = round(new.protein_g_per_serving * new.servings, 2);
  new.total_carbs_g = round(new.carbs_g_per_serving * new.servings, 2);
  new.total_fat_g = round(new.fat_g_per_serving * new.servings, 2);
  return new;
end;
$$;

create trigger weekly_plan_meals_compute_totals
before insert or update on public.weekly_plan_meals
for each row execute function public.compute_weekly_plan_meal_totals();

create or replace function public.refresh_weekly_plan_averages()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_plan_id bigint;
  next_cal numeric;
  next_protein numeric;
  next_carbs numeric;
  next_fat numeric;
begin
  target_plan_id := case when tg_op = 'DELETE' then old.weekly_plan_id else new.weekly_plan_id end;

  select
    coalesce(round(sum(total_calories) / 7.0, 2), 0),
    coalesce(round(sum(total_protein_g) / 7.0, 2), 0),
    coalesce(round(sum(total_carbs_g) / 7.0, 2), 0),
    coalesce(round(sum(total_fat_g) / 7.0, 2), 0)
  into next_cal, next_protein, next_carbs, next_fat
  from public.weekly_plan_meals
  where weekly_plan_id = target_plan_id;

  update public.weekly_plans
  set
    avg_daily_calories = next_cal,
    avg_daily_protein_g = next_protein,
    avg_daily_carbs_g = next_carbs,
    avg_daily_fat_g = next_fat
  where id = target_plan_id;

  if tg_op = 'UPDATE' and old.weekly_plan_id is distinct from new.weekly_plan_id then
    select
      coalesce(round(sum(total_calories) / 7.0, 2), 0),
      coalesce(round(sum(total_protein_g) / 7.0, 2), 0),
      coalesce(round(sum(total_carbs_g) / 7.0, 2), 0),
      coalesce(round(sum(total_fat_g) / 7.0, 2), 0)
    into next_cal, next_protein, next_carbs, next_fat
    from public.weekly_plan_meals
    where weekly_plan_id = old.weekly_plan_id;

    update public.weekly_plans
    set
      avg_daily_calories = next_cal,
      avg_daily_protein_g = next_protein,
      avg_daily_carbs_g = next_carbs,
      avg_daily_fat_g = next_fat
    where id = old.weekly_plan_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger weekly_plan_meals_refresh_averages
after insert or update or delete on public.weekly_plan_meals
for each row execute function public.refresh_weekly_plan_averages();

create trigger weekly_plan_meals_set_updated_at
before update on public.weekly_plan_meals
for each row execute function public.set_updated_at();

update public.weekly_plans
set
  daily_calorie_target = least(6000, greatest(800, coalesce(nullif(preferences->>'dailyCalorieTarget', '')::integer, 2000))),
  meals_per_day = least(6, greatest(2, coalesce(nullif(preferences->>'mealsPerDay', '')::integer, 3))),
  preferred_foods = case
    when jsonb_typeof(preferences->'preferredFoods') = 'array'
      then array(select jsonb_array_elements_text(preferences->'preferredFoods'))
    else '{}'::text[]
  end,
  food_restrictions = case
    when jsonb_typeof(preferences->'foodRestrictions') = 'array'
      then array(select jsonb_array_elements_text(preferences->'foodRestrictions'))
    else '{}'::text[]
  end;

insert into public.weekly_plan_meals (
  weekly_plan_id,
  day_of_week,
  day_name,
  slot_index,
  meal_slot,
  title,
  description,
  servings,
  calories_per_serving,
  protein_g_per_serving,
  carbs_g_per_serving,
  fat_g_per_serving
)
select
  wp.id,
  day_ord::smallint as day_of_week,
  coalesce(nullif(day_elem->>'day', ''), (array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])[day_ord]) as day_name,
  (meal_ord - 1)::smallint as slot_index,
  case
    when jsonb_array_length(coalesce(day_elem->'meals', '[]'::jsonb)) = 2 and meal_ord = 2 then 'Dinner'
    when meal_ord = 1 then 'Breakfast'
    when meal_ord = 2 then 'Lunch'
    when meal_ord = 3 then 'Dinner'
    when meal_ord = 4 then 'Snack 1'
    when meal_ord = 5 then 'Snack 2'
    else 'Snack 3'
  end as meal_slot,
  left(coalesce(nullif(btrim(meal_elem->>'title'), ''), 'Planned meal'), 120) as title,
  left(coalesce(meal_elem->>'description', ''), 240) as description,
  least(12, greatest(0.25, coalesce((meal_elem->>'servings')::numeric, 1))) as servings,
  least(5000, greatest(0, coalesce((meal_elem->'nutrition'->>'calories')::numeric, 0))) as calories_per_serving,
  least(500, greatest(0, coalesce((meal_elem->'nutrition'->>'proteinG')::numeric, 0))) as protein_g_per_serving,
  least(1000, greatest(0, coalesce((meal_elem->'nutrition'->>'carbsG')::numeric, 0))) as carbs_g_per_serving,
  least(500, greatest(0, coalesce((meal_elem->'nutrition'->>'fatG')::numeric, 0))) as fat_g_per_serving
from public.weekly_plans wp
cross join lateral jsonb_array_elements(wp.days) with ordinality as d(day_elem, day_ord)
cross join lateral jsonb_array_elements(coalesce(day_elem->'meals', '[]'::jsonb)) with ordinality as m(meal_elem, meal_ord)
where jsonb_typeof(wp.days) = 'array'
  and day_ord between 1 and 7
  and meal_ord between 1 and 6
on conflict (weekly_plan_id, day_of_week, slot_index) do nothing;

with latest_plans as (
  select distinct on (user_id) id
  from public.weekly_plans wp
  where not exists (
    select 1
    from public.weekly_plans active_wp
    where active_wp.user_id = wp.user_id
      and active_wp.is_active = true
  )
  order by user_id, updated_at desc, id desc
)
update public.weekly_plans
set is_active = true
where id in (select id from latest_plans);
