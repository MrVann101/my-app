create policy "Badges can be earned by their owner"
  on public.badges for insert
  with check (auth.uid() = user_id);