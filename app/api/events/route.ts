// First-party event logging.
//   POST  a batch from lib/analytics/client.ts (same-origin only). Answers 204.
import { ingest, IngestError } from "@/lib/analytics/ingest";
import { MAX_BODY_BYTES } from "@/lib/analytics/events";

function fail(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request): Promise<Response> {
  try {
    // Only this site's pages may report: stops other origins from filling the table.
    const origin = req.headers.get("origin");
    if (origin && URL.parse(origin)?.host !== req.headers.get("host")) return fail(403, "Wrong origin.");
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return fail(413, "Request is too large.");
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return fail(400, "Request body is not valid JSON.");
    }
    await ingest(body, req.headers);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof IngestError) return fail(e.status, e.message);
    console.error("[events api]", e);
    return fail(500, "Could not store events.");
  }
}
