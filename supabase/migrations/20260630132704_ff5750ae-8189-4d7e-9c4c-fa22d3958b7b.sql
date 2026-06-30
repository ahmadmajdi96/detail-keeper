-- Enable pg_graphql so the GraphQL endpoint exposes the new tables
CREATE EXTENSION IF NOT EXISTS pg_graphql;

-- Friendly comments so pg_graphql generates clean type names for the new tables
COMMENT ON TABLE public.organizations IS E'@graphql({"totalCount": {"enabled": true}})';
COMMENT ON TABLE public.repositories IS E'@graphql({"totalCount": {"enabled": true}})';
COMMENT ON TABLE public.repository_branches IS E'@graphql({"totalCount": {"enabled": true}})';
COMMENT ON TABLE public.pull_requests IS E'@graphql({"totalCount": {"enabled": true}})';
COMMENT ON TABLE public.commits IS E'@graphql({"totalCount": {"enabled": true}})';
COMMENT ON TABLE public.requirement_versions IS E'@graphql({"totalCount": {"enabled": true}})';
COMMENT ON TABLE public.approvals IS E'@graphql({"totalCount": {"enabled": true}})';
COMMENT ON TABLE public.waivers IS E'@graphql({"totalCount": {"enabled": true}})';
COMMENT ON TABLE public.defect_comments IS E'@graphql({"totalCount": {"enabled": true}})';
COMMENT ON TABLE public.defect_links IS E'@graphql({"totalCount": {"enabled": true}})';
COMMENT ON TABLE public.defect_history IS E'@graphql({"totalCount": {"enabled": true}})';
COMMENT ON TABLE public.defect_slas IS E'@graphql({"totalCount": {"enabled": true}})';
COMMENT ON TABLE public.ai_jobs IS E'@graphql({"totalCount": {"enabled": true}})';
COMMENT ON TABLE public.ai_outputs IS E'@graphql({"totalCount": {"enabled": true}})';
COMMENT ON TABLE public.ai_audit_events IS E'@graphql({"totalCount": {"enabled": true}})';
COMMENT ON TABLE public.audit_logs IS E'@graphql({"totalCount": {"enabled": true}})';
COMMENT ON TABLE public.activity_events IS E'@graphql({"totalCount": {"enabled": true}})';
