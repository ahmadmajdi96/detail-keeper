import { supabase } from "@/integrations/supabase/client";

// Beta Supabase OAuth namespace — locally typed wrapper.
type OAuthResult<T = any> = { data: T | null; error: { message: string } | null };

interface OAuthApi {
  getAuthorizationDetails(id: string): Promise<OAuthResult<any>>;
  approveAuthorization(id: string): Promise<OAuthResult<any>>;
  denyAuthorization(id: string): Promise<OAuthResult<any>>;
}

export function supabaseOAuth(): OAuthApi {
  return (supabase.auth as unknown as { oauth: OAuthApi }).oauth;
}

/** Validate a `next` param as a same-origin relative path. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}
