create or replace function public.claim_ai_photo_slot(p_user_id uuid, p_usage_date date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_count integer;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
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
set search_path = public
as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'not authorized';
  end if;

  update public.daily_ai_usage
  set photo_count = greatest(photo_count - 1, 0)
  where user_id = p_user_id and usage_date = p_usage_date;
end;
$$;

revoke all on function public.claim_ai_photo_slot(uuid, date) from public;
grant execute on function public.claim_ai_photo_slot(uuid, date) to authenticated;
revoke all on function public.release_ai_photo_slot(uuid, date) from public;
grant execute on function public.release_ai_photo_slot(uuid, date) to authenticated;
