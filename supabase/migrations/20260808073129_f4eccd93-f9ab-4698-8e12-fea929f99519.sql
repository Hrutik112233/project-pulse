CREATE POLICY "work screenshots readable" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'work-screenshots');
CREATE POLICY "work screenshots upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'work-screenshots');
CREATE POLICY "work screenshots update own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'work-screenshots' AND owner = auth.uid());
CREATE POLICY "work screenshots delete own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'work-screenshots' AND owner = auth.uid());