import { toast } from "sonner";

let installed = false;
const recent = new Map<string, number>();
const DEDUPE_MS = 4000;

function shouldEmit(key: string) {
  const now = Date.now();
  const last = recent.get(key) ?? 0;
  if (now - last < DEDUPE_MS) return false;
  recent.set(key, now);
  return true;
}

export function installErrorInstrumentation() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("error", (e) => {
    const msg = e.message || "Unknown error";
    if (!shouldEmit("err:" + msg)) return;
    // eslint-disable-next-line no-console
    console.error("[window.error]", { message: msg, source: e.filename, line: e.lineno, col: e.colno, error: e.error });
    toast.error("Runtime error", { description: msg.slice(0, 200) });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const reason: unknown = e.reason;
    const msg = reason instanceof Error ? reason.message : String(reason);
    if (!shouldEmit("rej:" + msg)) return;
    // eslint-disable-next-line no-console
    console.error("[unhandledrejection]", reason);
    toast.error("Async error", { description: msg.slice(0, 200) });
  });

  // Wrap fetch to surface non-2xx Supabase function errors with context
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
    try {
      const res = await origFetch(input as RequestInfo, init);
      if (!res.ok && /\/functions\/v1\//.test(url)) {
        const fn = url.split("/functions/v1/")[1]?.split("?")[0]?.split("/")[0] ?? "function";
        const reqId = res.headers.get("x-request-id") || res.headers.get("sb-request-id") || "";
        const key = `fn:${fn}:${res.status}`;
        if (shouldEmit(key)) {
          let detail = "";
          try { detail = (await res.clone().text()).slice(0, 200); } catch { /* ignore */ }
          // eslint-disable-next-line no-console
          console.error("[edge-function]", { fn, status: res.status, reqId, detail });
          toast.error(`${fn} failed (${res.status})`, { description: detail || reqId || undefined });
        }
      }
      return res;
    } catch (err) {
      if (/\/functions\/v1\//.test(url) && shouldEmit("netfail:" + url)) {
        // eslint-disable-next-line no-console
        console.error("[edge-function:network]", { url, err });
        toast.error("Network error calling backend", { description: (err as Error).message });
      }
      throw err;
    }
  };
}
