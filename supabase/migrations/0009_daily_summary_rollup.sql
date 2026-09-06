create or replace function public.rollup_daily_summary(p_user_id uuid, p_summary_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target numeric;
  intake numeric;
  burned numeric;
  protein numeric;
  carbs numeric;
  fat numeric;
  fiber numeric;
  sodium numeric;
  sugar numeric;
  logged boolean;
begin
  select target_calories into target
  from public.profiles
  where user_id = p_user_id;

  select
    coalesce(sum(calories), 0),
    coalesce(sum(protein_g), 0),
    coalesce(sum(carbs_g), 0),
    coalesce(sum(fat_g), 0),
    coalesce(sum(fiber_g), 0),
    coalesce(sum(sodium_mg), 0),
    coalesce(sum(sugar_g), 0),
    count(*) > 0
  into intake, protein, carbs, fat, fiber, sodium, sugar, logged
  from public.food_logs
  where user_id = p_user_id and log_date = p_summary_date;

  select coalesce(sum(calories_burned), 0) into burned
  from public.exercise_logs
  where user_id = p_user_id and log_date = p_summary_date;

  insert into public.daily_summaries (user_id, summary_date, total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, total_sodium_mg, total_sugar_g, calories_burned, hit_target, logged_at_least_once)
  values (p_user_id, p_summary_date, intake, protein, carbs, fat, fiber, sodium, sugar, burned, target is not null and abs((intake - burned) - target) <= target * 0.10, logged)
  on conflict (user_id, summary_date) do update set
    total_calories = excluded.total_calories,
    total_protein_g = excluded.total_protein_g,
    total_carbs_g = excluded.total_carbs_g,
    total_fat_g = excluded.total_fat_g,
    total_fiber_g = excluded.total_fiber_g,
    total_sodium_mg = excluded.total_sodium_mg,
    total_sugar_g = excluded.total_sugar_g,
    calories_burned = excluded.calories_burned,
    hit_target = excluded.hit_target,
    logged_at_least_once = excluded.logged_at_least_once;
end;
$$;

revoke all on function public.rollup_daily_summary(uuid, date) from public;
grant execute on function public.rollup_daily_summary(uuid, date) to service_role;
