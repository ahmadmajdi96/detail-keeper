// Public: returns the OAuth callback URLs to register in GitHub/Atlassian apps.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = {
    github: `${SUPABASE_URL}/functions/v1/oauth-github-callback`,
    jira: `${SUPABASE_URL}/functions/v1/oauth-jira-callback`,
  };
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
