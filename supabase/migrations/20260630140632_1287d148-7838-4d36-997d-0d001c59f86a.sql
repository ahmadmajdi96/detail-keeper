ALTER TABLE public.integration_connections
  ADD CONSTRAINT integration_connections_workspace_slug_unique
  UNIQUE (workspace_id, slug);