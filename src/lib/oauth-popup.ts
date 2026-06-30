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
  if (!popup || popup.closed || typeof popup.closed === "undefined") {
    throw new Error(
      "POPUP_BLOCKED:Please allow popups for this site, then click Connect again.",
    );
  }

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
    let settled = false;

    const finish = (result: OAuthResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", handler);
      clearInterval(pollClosed);
      clearTimeout(timeout);
      resolve(result);
    };

    const handler = (event: MessageEvent) => {
      const okOrigin =
        event.origin === window.location.origin ||
        event.origin === expectedOrigin;
      if (!okOrigin) return;
      const data = event.data;
      if (!data || data.type !== "qualixa:oauth") return;
      if (data.provider !== opts.provider) return;
      const msg = data.message ?? "";
      const friendly = /access_denied|user_denied|cancelled/i.test(msg)
        ? "You declined the request."
        : msg;
      finish({ ok: !!data.ok, provider: opts.provider, message: friendly });
    };
    window.addEventListener("message", handler);

    const pollClosed = setInterval(() => {
      if (popup.closed) {
        finish({ ok: false, provider: opts.provider, message: "Window closed before completing sign-in." });
      }
    }, 600);

    const timeout = setTimeout(() => {
      try { popup.close(); } catch { /* ignore */ }
      finish({ ok: false, provider: opts.provider, message: "Timed out waiting for sign-in (5 min). Please try again." });
    }, 5 * 60_000);
  });
}
