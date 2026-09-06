create or replace function public.claim_ai_text_slot(p_user_id uuid, p_usage_date date)
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

  insert into public.daily_ai_usage (user_id, usage_date, text_count)
  values (p_user_id, p_usage_date, 1)
  on conflict (user_id, usage_date) do update
    set text_count = public.daily_ai_usage.text_count + 1
    where public.daily_ai_usage.text_count < 20
  returning text_count into claimed_count;

  return found;
end;
$$;

revoke all on function public.claim_ai_text_slot(uuid, date) from public;
grant execute on function public.claim_ai_text_slot(uuid, date) to authenticated;
