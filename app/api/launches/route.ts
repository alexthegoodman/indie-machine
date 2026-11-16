// Visitor Launches.
//   GET                       the live launches, newest first
//   POST { url }              launch a product (no account; same-origin only)
//   DELETE ?id=  + Bearer     hide a launch (LAUNCHES_ADMIN_TOKEN)
import { createHash, timingSafeEqual } from "node:crypto";
import { hideLaunch, launch, listLaunches } from "@/lib/launches/store";
import { LaunchError } from "@/lib/launches/url";

function json(body: unknown, status = 200, cache = "no-store"): Response {
  return Response.json(body, { status, headers: { "Cache-Control": cache } });
}

function fail(e: unknown): Response {
  if (e instanceof LaunchError) return json({ error: { code: e.code, message: e.message } }, e.status);
  console.error("[launches api]", e);
  return json({ error: { code: "server", message: "Something broke on our side. Try again in a moment." } }, 500);
}

function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
}

export async function GET(): Promise<Response> {
  try {
    // A few seconds of CDN caching is plenty: a visitor's own launch is shown from the POST reply.
    return json({ launches: await listLaunches() }, 200, "public, s-maxage=10, stale-while-revalidate=30");
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request): Promise<Response> {
  try {
    // Only this site's own form may launch: stops other pages using visitors' browsers to spam.
    const origin = req.headers.get("origin");
    if (origin && URL.parse(origin)?.host !== req.headers.get("host")) throw new LaunchError(403, "origin", "Launch from indie-machine.com.");
    const text = await req.text();
    if (text.length > 4096) throw new LaunchError(413, "too-large", "Request is too large.");
    let b: { url?: unknown; website?: unknown };
    try {
      b = JSON.parse(text);
    } catch {
      throw new LaunchError(400, "bad-json", "Request body is not valid JSON.");
    }
    // Honeypot: a field people never see, which form-filling bots fill in.
    if (typeof b.website === "string" && b.website) throw new LaunchError(400, "blocked", "That launch looks automated.");
    return json({ launch: await launch(b.url, clientIp(req)) }, 201);
  } catch (e) {
    return fail(e);
  }
}

function sameSecret(a: string, b: string): boolean {
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(a), h(b));
}

export async function DELETE(req: Request): Promise<Response> {
  try {
    const token = process.env.LAUNCHES_ADMIN_TOKEN;
    const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!token || !sameSecret(given, token)) throw new LaunchError(401, "auth", "Not allowed.");
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!(await hideLaunch(id))) throw new LaunchError(404, "not-found", "No launch with that id.");
    return json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
