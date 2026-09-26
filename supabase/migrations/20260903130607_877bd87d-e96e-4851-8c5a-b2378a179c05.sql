create policy "authenticated read user media" on storage.objects for select to authenticated using (bucket_id = 'user-media');
create policy "owner uploads user media" on storage.objects for insert to authenticated with check (bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner updates user media" on storage.objects for update to authenticated using (bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner deletes user media" on storage.objects for delete to authenticated using (bucket_id = 'user-media' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "owner or admin reads docs" on storage.objects for select to authenticated using (bucket_id = 'verification-docs' and ((storage.foldername(name))[1] = auth.uid()::text or public.has_role(auth.uid(), 'admin')));
create policy "owner uploads docs" on storage.objects for insert to authenticated with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner deletes docs" on storage.objects for delete to authenticated using (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);