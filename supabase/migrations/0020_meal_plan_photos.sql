insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meal-plan-photos',
  'meal-plan-photos',
  true,
  3145728,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Meal plan photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'meal-plan-photos');

create policy "Users can upload their own meal plan photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'meal-plan-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete their own meal plan photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'meal-plan-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
