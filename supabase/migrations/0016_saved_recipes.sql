alter table public.meal_plans
  add column recipe jsonb,
  add column cook_time_minutes integer check (cook_time_minutes between 1 and 240),
  add column nutrition jsonb;

alter table public.meal_plans
  add constraint meal_plans_nutrition_object
  check (nutrition is null or jsonb_typeof(nutrition) = 'object');
