// JSON responses, errors and CORS for /api/allegiance. The game runs on its own subdomain, so every
// response carries CORS headers for the allowed origins; auth is a bearer token, never a cookie.

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const DEFAULT_ORIGINS = ["https://allegiance.indie-machine.com"];

function allowedOrigins(): string[] {
  const env = process.env.ALLEGIANCE_ORIGINS;
  return env ? env.split(",").map(s => s.trim()).filter(Boolean) : DEFAULT_ORIGINS;
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin || !allowedOrigins().includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

export function json(req: Request, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { ...corsHeaders(req), "Cache-Control": "no-store" } });
}

export function preflight(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

type Handler = (req: Request) => Promise<unknown>;

/** Wraps a handler: CORS origin check, JSON out, errors as { error: { code, message } }. */
export function route(fn: Handler): (req: Request) => Promise<Response> {
  return async req => {
    try {
      const origin = req.headers.get("origin");
      if (origin && !allowedOrigins().includes(origin)) throw new ApiError(403, "origin", `Origin ${origin} is not allowed.`);
      return json(req, await fn(req));
    } catch (e) {
      if (e instanceof ApiError) return json(req, { error: { code: e.code, message: e.message } }, e.status);
      console.error("[allegiance api]", e);
      return json(req, { error: { code: "server", message: "The Allegiance server hit an error. Try again in a moment." } }, 500);
    }
  };
}

const MAX_BODY = 4 * 1024 * 1024;

export async function body<T>(req: Request): Promise<T> {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new ApiError(413, "too-large", "Request body is too large.");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(400, "bad-json", "Request body is not valid JSON.");
  }
}

// --- Validation ------------------------------------------------------------------------------

export function str(v: unknown, name: string, max: number, min = 1): string {
  if (typeof v !== "string") throw new ApiError(400, "invalid", `${name} must be a string.`);
  const s = v.trim();
  if (s.length < min || s.length > max) throw new ApiError(400, "invalid", `${name} must be ${min}-${max} characters.`);
  return s;
}

export function num(v: unknown, name: string, lo: number, hi: number): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi) throw new ApiError(400, "invalid", `${name} must be a number from ${lo} to ${hi}.`);
  return v;
}

export function oneOf<T extends string>(v: unknown, name: string, options: readonly T[]): T {
  if (typeof v !== "string" || !options.includes(v as T)) throw new ApiError(400, "invalid", `${name} must be one of ${options.join(", ")}.`);
  return v as T;
}

export const REGION_ID = /^[a-z0-9-]{1,80}$/;

export function regionId(v: unknown): string {
  if (typeof v !== "string" || !REGION_ID.test(v)) throw new ApiError(400, "invalid", "Region id is invalid.");
  return v;
}
