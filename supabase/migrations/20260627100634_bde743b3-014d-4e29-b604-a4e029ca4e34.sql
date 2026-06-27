
CREATE POLICY "ws members read project repos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-repos'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.zip_storage_path = name
      AND public.is_workspace_member(p.workspace_id, auth.uid())
  )
);

CREATE POLICY "ws editors upload project repos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-repos'
  AND (storage.foldername(name))[1] IS NOT NULL
);

CREATE POLICY "ws editors delete project repos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'project-repos'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.zip_storage_path = name
      AND public.workspace_role_of(p.workspace_id, auth.uid()) IN ('owner','admin','editor')
  )
);
