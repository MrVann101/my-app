-- Consolidated pre-deployment security hardening migration.
-- Addresses CRIT-01, HIGH-01, HIGH-02, HIGH-03, MED-04, MED-05, MED-06, MED-08, MED-11, LOW-02, and LOW-04.

-- 1. CRIT-01 & MED-05 & MED-08: Protect sensitive profile columns and enforce case-insensitive username uniqueness.
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

revoke insert (is_admin), update (is_admin) on public.profiles from anon, authenticated;

create unique index if not exists profiles_username_lower_uidx
  on public.profiles (lower(username));

create or replace function public.guard_profile_sensitive_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_role text := coalesce(auth.role(), current_setting('role', true), '');
begin
  if caller_role <> 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      if new.is_admin is distinct from false then
        raise exception 'not authorized to set is_admin';
      end if;
      if new.deletion_requested_at is not null then
        raise exception 'not authorized to set deletion_requested_at on insert';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.is_admin is distinct from old.is_admin then
        raise exception 'not authorized to modify is_admin';
      end if;
      if old.deletion_requested_at is not null
         and new.deletion_requested_at is null
         and now() > old.deletion_requested_at + interval '14 days' then
        raise exception 'deletion grace period has expired';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_sensitive_columns on public.profiles;
create trigger profiles_guard_sensitive_columns
before insert or update on public.profiles
for each row execute function public.guard_profile_sensitive_columns();

-- 2. HIGH-01 & HIGH-02 & LOW-02: Lock down AI usage table and SECURITY DEFINER RPCs to service_role with empty search_path.
drop policy if exists "AI usage is private to the user" on public.daily_ai_usage;
drop policy if exists "AI usage is readable by the user" on public.daily_ai_usage;
create policy "AI usage is readable by the user"
  on public.daily_ai_usage for select to authenticated
  using (auth.uid() = user_id);

create or replace function public.claim_ai_photo_slot(p_user_id uuid, p_usage_date date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'not authorized';
  end if;

  insert into public.daily_ai_usage (user_id, usage_date, photo_count)
  values (p_user_id, p_usage_date, 1)
  on conflict (user_id, usage_date) do update
    set photo_count = public.daily_ai_usage.photo_count + 1
    where public.daily_ai_usage.photo_count < 2
  returning photo_count into claimed_count;

  return found;
end;
$$;

create or replace function public.release_ai_photo_slot(p_user_id uuid, p_usage_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'not authorized';
  end if;

  update public.daily_ai_usage
  set photo_count = greatest(photo_count - 1, 0)
  where user_id = p_user_id and usage_date = p_usage_date;
end;
$$;

create or replace function public.claim_ai_text_slot(p_user_id uuid, p_usage_date date)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'not authorized';
  end if;

  insert into public.daily_ai_usage (user_id, usage_date, text_count)
  values (p_user_id, p_usage_date, 1)
  on conflict (user_id, usage_date) do update
    set text_count = public.daily_ai_usage.text_count + 1
    where public.daily_ai_usage.text_count < 20
  returning text_count into claimed_count;

  return found;
end;
$$;

create or replace function public.claim_global_ai_rate_limit(p_bucket_start timestamptz, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed_count integer;
  safe_limit integer := least(greatest(coalesce(p_limit, 60), 1), 60);
  server_bucket timestamptz := date_trunc('minute', now());
begin
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'not authorized';
  end if;

  delete from public.ai_global_rate_limits
  where bucket_start < server_bucket - interval '1 hour';

  insert into public.ai_global_rate_limits (bucket_start, request_count)
  values (server_bucket, 1)
  on conflict (bucket_start) do update
    set request_count = public.ai_global_rate_limits.request_count + 1
    where public.ai_global_rate_limits.request_count < safe_limit
  returning request_count into claimed_count;

  return found;
end;
$$;

create or replace function public.rollup_daily_summary(p_user_id uuid, p_summary_date date)
returns void
language plpgsql
security definer
set search_path = ''
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
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'not authorized';
  end if;

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

revoke all on function public.claim_ai_photo_slot(uuid, date) from public, anon, authenticated;
grant execute on function public.claim_ai_photo_slot(uuid, date) to service_role;

revoke all on function public.release_ai_photo_slot(uuid, date) from public, anon, authenticated;
grant execute on function public.release_ai_photo_slot(uuid, date) to service_role;

revoke all on function public.claim_ai_text_slot(uuid, date) from public, anon, authenticated;
grant execute on function public.claim_ai_text_slot(uuid, date) to service_role;

revoke all on function public.claim_global_ai_rate_limit(timestamptz, integer) from public, anon, authenticated;
grant execute on function public.claim_global_ai_rate_limit(timestamptz, integer) to service_role;

revoke all on function public.rollup_daily_summary(uuid, date) from public, anon, authenticated;
grant execute on function public.rollup_daily_summary(uuid, date) to service_role;

-- 3. Distributed serverless-safe rate-limit table & RPC (HIGH-01, HIGH-04, MED-04, MED-06, MED-09).
create table if not exists public.app_rate_limits (
  rate_key text not null,
  window_start timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  expires_at timestamptz not null,
  primary key (rate_key, window_start)
);

alter table public.app_rate_limits enable row level security;

create index if not exists app_rate_limits_expires_idx
  on public.app_rate_limits (expires_at);

create or replace function public.claim_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_limit integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_window integer := least(greatest(coalesce(p_window_seconds, 60), 1), 86400);
  safe_limit integer := least(greatest(coalesce(p_limit, 1), 1), 10000);
  bucket_epoch bigint;
  v_window_start timestamptz;
  v_expires_at timestamptz;
  v_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'not authorized';
  end if;

  if p_key is null or char_length(trim(p_key)) = 0 or char_length(p_key) > 200 then
    raise exception 'invalid rate limit key';
  end if;

  bucket_epoch := floor(extract(epoch from now()) / safe_window)::bigint * safe_window;
  v_window_start := to_timestamp(bucket_epoch);
  v_expires_at := v_window_start + make_interval(secs => safe_window);

  delete from public.app_rate_limits
  where expires_at < now() - interval '5 minutes';

  insert into public.app_rate_limits (rate_key, window_start, request_count, expires_at)
  values (p_key, v_window_start, 1, v_expires_at)
  on conflict (rate_key, window_start) do update
    set request_count = public.app_rate_limits.request_count + 1
    where public.app_rate_limits.request_count < safe_limit
  returning request_count into v_count;

  return found;
end;
$$;

revoke all on function public.claim_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.claim_rate_limit(text, integer, integer) to service_role;

-- 4. HIGH-02 & MED-08: Harden public plan profile check and fork_public_meal_plan deletion visibility.
create or replace function public.is_profile_available_for_public_plan(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    (auth.uid() is not null or coalesce(auth.role(), '') = 'service_role')
    and exists (
      select 1 from public.profiles
      where user_id = p_user_id and deletion_requested_at is null
    );
$$;

revoke all on function public.is_profile_available_for_public_plan(uuid) from public, anon;
grant execute on function public.is_profile_available_for_public_plan(uuid) to authenticated, service_role;

create or replace function public.fork_public_meal_plan(p_source_id bigint, p_user_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_plan public.meal_plans%rowtype;
  copied_id bigint;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'not authorized';
  end if;

  select * into source_plan
  from public.meal_plans
  where id = p_source_id
    and visibility = 'public'
    and public.is_profile_available_for_public_plan(user_id);

  if not found then
    raise exception 'public plan not found';
  end if;

  insert into public.meal_plans (user_id, name, visibility, goal, diet_type, total_calories, forked_from, recipe, cook_time_minutes, nutrition)
  values (
    p_user_id,
    source_plan.name,
    'private',
    source_plan.goal,
    source_plan.diet_type,
    source_plan.total_calories,
    source_plan.id,
    source_plan.recipe,
    source_plan.cook_time_minutes,
    source_plan.nutrition
  )
  returning id into copied_id;

  insert into public.meal_plan_items (
    plan_id, meal_type, food_name, weight_g,
    calories_per_g, protein_per_g, carbs_per_g, fat_per_g, fiber_per_g, sodium_per_g, sugar_per_g,
    calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, sugar_g
  )
  select
    copied_id, meal_type, food_name, weight_g,
    calories_per_g, protein_per_g, carbs_per_g, fat_per_g, fiber_per_g, sodium_per_g, sugar_per_g,
    calories, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, sugar_g
  from public.meal_plan_items
  where plan_id = source_plan.id;

  update public.meal_plans
  set save_count = save_count + 1
  where id = source_plan.id;

  return copied_id;
end;
$$;

revoke all on function public.fork_public_meal_plan(bigint, uuid) from public, anon;
grant execute on function public.fork_public_meal_plan(bigint, uuid) to authenticated, service_role;

-- 5. HIGH-03 & LOW-04: Prevent backdating food_logs.created_at, fix computed-total triggers, and protect save_count.
create or replace function public.lock_food_log_created_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_role text := coalesce(auth.role(), current_setting('role', true), '');
begin
  if caller_role <> 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    new.created_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists food_logs_lock_created_at on public.food_logs;
create trigger food_logs_lock_created_at
before insert on public.food_logs
for each row execute function public.lock_food_log_created_at();

drop trigger if exists food_logs_compute_totals on public.food_logs;
create trigger food_logs_compute_totals
before insert or update on public.food_logs
for each row execute function public.compute_food_log_totals();

drop trigger if exists meal_plan_items_compute_totals on public.meal_plan_items;
create trigger meal_plan_items_compute_totals
before insert or update on public.meal_plan_items
for each row execute function public.compute_meal_plan_item_totals();

create or replace function public.guard_meal_plan_save_count()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_role text := coalesce(auth.role(), current_setting('role', true), '');
begin
  if caller_role <> 'service_role' and current_user not in ('postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.save_count = 0;
    elsif tg_op = 'UPDATE' then
      new.save_count = old.save_count;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists meal_plans_guard_save_count on public.meal_plans;
create trigger meal_plans_guard_save_count
before insert or update on public.meal_plans
for each row execute function public.guard_meal_plan_save_count();

-- 6. MED-11: Prevent direct badge forgery via PostgREST (awarded server-side via service_role only).
drop policy if exists "Badges can be earned by their owner" on public.badges;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'badges_badge_key_allowed_check'
      and conrelid = 'public.badges'::regclass
  ) then
    alter table public.badges
      add constraint badges_badge_key_allowed_check
      check (badge_key in ('first_log', 'ten_logs', 'seven_day_streak')) not valid;
  end if;
end;
$$;

-- 7. MED-06: Harden app_feedback (allow null user_id for guests; block direct authenticated PostgREST inserts).
alter table public.app_feedback
  alter column user_id drop not null;

drop policy if exists "App feedback is insertable by its author" on public.app_feedback;

-- 8. HIGH-03 & MED-04: Declare private food-photos bucket + narrow meal-plan-photos listing policy.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'food-photos',
  'food-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read their own food photos" on storage.objects;
create policy "Users can read their own food photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'food-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload their own food photos" on storage.objects;
create policy "Users can upload their own food photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'food-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own food photos" on storage.objects;
create policy "Users can delete their own food photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'food-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Meal plan photos are publicly readable" on storage.objects;
drop policy if exists "Meal plan photos metadata is readable by owner" on storage.objects;
create policy "Meal plan photos metadata is readable by owner"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'meal-plan-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
