
CREATE POLICY "evidence_read_authenticated" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'defect-evidence');
CREATE POLICY "evidence_insert_authenticated" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'defect-evidence' AND owner = auth.uid());
CREATE POLICY "evidence_delete_owner" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'defect-evidence' AND owner = auth.uid());
