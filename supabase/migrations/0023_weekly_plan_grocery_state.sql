alter table public.weekly_plans
  add column grocery_state jsonb not null default '{"checked":[],"custom":[]}'::jsonb
    check (
      jsonb_typeof(grocery_state) = 'object'
      and jsonb_typeof(grocery_state->'checked') = 'array'
      and jsonb_typeof(grocery_state->'custom') = 'array'
    );
