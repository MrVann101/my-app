create table public.ai_global_rate_limits (
  bucket_start timestamptz primary key,
  request_count integer not null default 0 check (request_count >= 0)
);

alter table public.ai_global_rate_limits enable row level security;

create or replace function public.claim_global_ai_rate_limit(p_bucket_start timestamptz, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_count integer;
  safe_limit integer := least(greatest(p_limit, 1), 60);
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  insert into public.ai_global_rate_limits (bucket_start, request_count)
  values (p_bucket_start, 1)
  on conflict (bucket_start) do update
    set request_count = public.ai_global_rate_limits.request_count + 1
    where public.ai_global_rate_limits.request_count < safe_limit
  returning request_count into claimed_count;

  return found;
end;
$$;

revoke all on function public.claim_global_ai_rate_limit(timestamptz, integer) from public;
grant execute on function public.claim_global_ai_rate_limit(timestamptz, integer) to authenticated;
