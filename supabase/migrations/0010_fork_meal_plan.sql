create or replace function public.fork_public_meal_plan(p_source_id bigint, p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  source_plan public.meal_plans%rowtype;
  copied_id bigint;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'not authorized'; end if;
  select * into source_plan from public.meal_plans where id = p_source_id and visibility = 'public';
  if not found then raise exception 'public plan not found'; end if;
  insert into public.meal_plans (user_id, name, visibility, goal, diet_type, total_calories, forked_from)
  values (p_user_id, source_plan.name, 'private', source_plan.goal, source_plan.diet_type, source_plan.total_calories, source_plan.id)
  returning id into copied_id;
  insert into public.meal_plan_items (plan_id, meal_type, food_name, weight_g, calories_per_g, protein_per_g, carbs_per_g, fat_per_g, fiber_per_g, sodium_per_g, sugar_per_g, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, sugar_g)
  select copied_id, meal_type, food_name, weight_g, calories_per_g, protein_per_g, carbs_per_g, fat_per_g, fiber_per_g, sodium_per_g, sugar_per_g, calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, sugar_g
  from public.meal_plan_items where plan_id = source_plan.id;
  update public.meal_plans set save_count = save_count + 1 where id = source_plan.id;
  return copied_id;
end;
$$;

revoke all on function public.fork_public_meal_plan(bigint, uuid) from public;
grant execute on function public.fork_public_meal_plan(bigint, uuid) to authenticated;
