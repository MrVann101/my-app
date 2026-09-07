drop policy if exists "Public meal plans are readable by authenticated users" on public.meal_plans;
create policy "Public meal plans are readable by authenticated users"
  on public.meal_plans for select
  using (
    auth.uid() is not null
    and (
      auth.uid() = user_id
      or (
        visibility = 'public'
        and exists (select 1 from public.profiles where profiles.user_id = meal_plans.user_id and profiles.deletion_requested_at is null)
      )
    )
  );
