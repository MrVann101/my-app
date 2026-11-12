alter table public.meal_plans
  add column if not exists recipe jsonb,
  add column if not exists cook_time_minutes integer check (cook_time_minutes between 1 and 240),
  add column if not exists nutrition jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.meal_plans'::regclass
      and conname = 'meal_plans_nutrition_object'
  ) then
    alter table public.meal_plans
      add constraint meal_plans_nutrition_object
      check (nutrition is null or jsonb_typeof(nutrition) = 'object');
  end if;
end
$$;

notify pgrst, 'reload schema';
