  alter table public.food_logs
    add column is_recipe boolean not null default false;
