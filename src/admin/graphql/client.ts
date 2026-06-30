import { GraphQLClient } from "graphql-request";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

/**
 * Lightweight typed client over Supabase's pg_graphql endpoint.
 * Forwards the current user's JWT so RLS still applies.
 */
export async function gqlClient(): Promise<GraphQLClient> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? PUBLISHABLE_KEY;
  return new GraphQLClient(`${SUPABASE_URL}/graphql/v1`, {
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

export async function gql<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const client = await gqlClient();
  return client.request<T>(query, variables);
}
