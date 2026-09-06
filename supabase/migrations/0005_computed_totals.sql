create or replace function public.compute_food_log_totals()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.calories = round(new.calories_per_g * new.weight_g, 6);
  new.protein_g = round(new.protein_per_g * new.weight_g, 6);
  new.carbs_g = round(new.carbs_per_g * new.weight_g, 6);
  new.fat_g = round(new.fat_per_g * new.weight_g, 6);
  new.fiber_g = round(new.fiber_per_g * new.weight_g, 6);
  new.sodium_mg = round(new.sodium_per_g * new.weight_g, 6);
  new.sugar_g = round(new.sugar_per_g * new.weight_g, 6);
  return new;
end;
$$;

create trigger food_logs_compute_totals
before insert or update of weight_g, calories_per_g, protein_per_g, carbs_per_g, fat_per_g, fiber_per_g, sodium_per_g, sugar_per_g
on public.food_logs
for each row execute function public.compute_food_log_totals();

create or replace function public.compute_meal_plan_item_totals()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.calories = round(new.calories_per_g * new.weight_g, 6);
  new.protein_g = round(new.protein_per_g * new.weight_g, 6);
  new.carbs_g = round(new.carbs_per_g * new.weight_g, 6);
  new.fat_g = round(new.fat_per_g * new.weight_g, 6);
  new.fiber_g = round(new.fiber_per_g * new.weight_g, 6);
  new.sodium_mg = round(new.sodium_per_g * new.weight_g, 6);
  new.sugar_g = round(new.sugar_per_g * new.weight_g, 6);
  return new;
end;
$$;

create trigger meal_plan_items_compute_totals
before insert or update of weight_g, calories_per_g, protein_per_g, carbs_per_g, fat_per_g, fiber_per_g, sodium_per_g, sugar_per_g
on public.meal_plan_items
for each row execute function public.compute_meal_plan_item_totals();

create or replace function public.refresh_meal_plan_total()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.meal_plans
  set total_calories = coalesce((
    select sum(calories)
    from public.meal_plan_items
    where plan_id = case when tg_op = 'DELETE' then old.plan_id else new.plan_id end
  ), 0)
  where id = case when tg_op = 'DELETE' then old.plan_id else new.plan_id end;

  if tg_op = 'UPDATE' and old.plan_id is distinct from new.plan_id then
    update public.meal_plans
    set total_calories = coalesce((
      select sum(calories)
      from public.meal_plan_items
      where plan_id = old.plan_id
    ), 0)
    where id = old.plan_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger meal_plan_items_refresh_total
after insert or update or delete on public.meal_plan_items
for each row execute function public.refresh_meal_plan_total();
