GRANT SELECT ON public.plans TO anon;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active plans" ON public.plans;
CREATE POLICY "Anyone can view active plans" ON public.plans FOR SELECT TO anon, authenticated USING (is_active = true);