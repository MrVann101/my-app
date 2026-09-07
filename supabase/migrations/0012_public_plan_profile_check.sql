create or replace function public.is_profile_available_for_public_plan(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where user_id = p_user_id and deletion_requested_at is null
  );
$$;

revoke all on function public.is_profile_available_for_public_plan(uuid) from public;
grant execute on function public.is_profile_available_for_public_plan(uuid) to authenticated;

drop policy if exists "Public meal plans are readable by authenticated users" on public.meal_plans;
create policy "Public meal plans are readable by authenticated users"
  on public.meal_plans for select
  using (
    auth.uid() is not null
    and (
      auth.uid() = user_id
      or (visibility = 'public' and public.is_profile_available_for_public_plan(user_id))
    )
  );
