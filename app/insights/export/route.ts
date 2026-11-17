// CSV of the raw events in an /insights slice (same params as the dashboard). Signed-in only.
import { isSignedIn } from "@/lib/analytics/auth";
import { parseQuery } from "@/lib/analytics/query";
import { exportRows } from "@/lib/analytics/reports";

const COLUMNS = [
  "id", "at", "name", "path", "visitorId", "sessionId", "source", "utmSource", "utmMedium", "utmCampaign",
  "entryPath", "country", "city", "device", "browser", "os", "screenW", "lang", "props",
] as const;

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  // Quote everything that needs it, and defuse spreadsheet formulas in visitor-supplied text.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) || safe !== s ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET(req: Request): Promise<Response> {
  if (!(await isSignedIn())) return new Response("Not signed in.", { status: 401 });
  const params: Record<string, string[]> = {};
  for (const [k, v] of new URL(req.url).searchParams) (params[k] ??= []).push(v);
  const q = parseQuery(params);
  const rows = await exportRows(q);
  const lines = [COLUMNS.join(",")];
  for (const r of rows) lines.push(COLUMNS.map((c) => cell((r as Record<string, unknown>)[c])).join(","));
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="indie-machine-events-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
