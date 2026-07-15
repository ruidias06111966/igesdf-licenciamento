
CREATE POLICY "auth read docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id='licencas-docs');
CREATE POLICY "auth upload docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='licencas-docs');
CREATE POLICY "auth update docs" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id='licencas-docs');
CREATE POLICY "auth delete docs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id='licencas-docs');
