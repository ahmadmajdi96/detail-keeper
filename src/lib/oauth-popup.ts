import { supabase } from "@/integrations/supabase/client";

export type OAuthProvider = "github" | "jira";

export interface OAuthResult {
  ok: boolean;
  provider: OAuthProvider;
  message?: string;
}

/**
 * Opens a popup that completes a 3rd-party OAuth flow.
 * Resolves once the callback edge function postMessages back.
 */
export async function connectOAuthPopup(opts: {
  provider: OAuthProvider;
  workspace_id: string;
  project_id?: string | null;
}): Promise<OAuthResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error("You must be logged in.");

  // Open the popup synchronously to avoid popup-blockers; we'll redirect it after start returns.
  const popup = window.open(
    "about:blank",
    `oauth_${opts.provider}`,
    "popup=yes,width=560,height=720,left=200,top=120",
  );
  if (!popup) throw new Error("Popup blocked. Please allow popups for this site.");

  try {
    const { data, error } = await supabase.functions.invoke("oauth-start", {
      body: {
        provider: opts.provider,
        workspace_id: opts.workspace_id,
        project_id: opts.project_id ?? null,
        origin: window.location.origin,
      },
    });
    if (error || !data?.authorizeUrl) {
      popup.close();
      throw new Error(error?.message ?? "Failed to start OAuth");
    }
    popup.location.href = data.authorizeUrl;
  } catch (e) {
    popup.close();
    throw e;
  }

  return new Promise<OAuthResult>((resolve) => {
    const expectedOrigin = new URL(import.meta.env.VITE_SUPABASE_URL).origin;
    const handler = (event: MessageEvent) => {
      // Callback runs on the supabase functions origin and posts to window.opener
      // with our app origin as the target — so we receive event.origin === app origin
      // only when running same-origin. Edge function posts with target = state.origin
      // so event.origin will equal the supabase functions origin. Accept either.
      const ok =
        event.origin === window.location.origin ||
        event.origin === expectedOrigin;
      if (!ok) return;
      const data = event.data;
      if (!data || data.type !== "qualixa:oauth") return;
      if (data.provider !== opts.provider) return;
      window.removeEventListener("message", handler);
      clearInterval(pollClosed);
      resolve({ ok: !!data.ok, provider: opts.provider, message: data.message });
    };
    window.addEventListener("message", handler);

    const pollClosed = setInterval(() => {
      if (popup.closed) {
        window.removeEventListener("message", handler);
        clearInterval(pollClosed);
        resolve({ ok: false, provider: opts.provider, message: "Popup closed before completion" });
      }
    }, 600);
  });
}
