// Shared CORS helpers for Supabase Edge Functions (Deno).
// Used by every function that the browser PWA calls directly.

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/** JSON response helper that always attaches CORS + JSON headers. */
export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

/**
 * Handle a CORS preflight request.
 * Returns a 204 Response for OPTIONS, or null for any other method
 * (so the caller can continue its normal handling).
 */
export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 204, headers: corsHeaders });
  }
  return null;
}
