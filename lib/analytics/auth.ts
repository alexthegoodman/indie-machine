// /insights is behind one shared password, ANALYTICS_PASSWORD. Signing in stores an HMAC of the
// password in an httpOnly cookie, so changing the password signs everyone out.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const AUTH_COOKIE = "im_insights";
export const AUTH_MAX_AGE = 30 * 24 * 3600;

function sameSecret(a: string, b: string): boolean {
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(a), h(b));
}

export function dashboardPassword(): string | undefined {
  return process.env.ANALYTICS_PASSWORD || undefined;
}

export function sessionToken(password: string): string {
  return createHmac("sha256", password).update("indie-machine-insights-v1").digest("base64url");
}

export function passwordMatches(given: string): boolean {
  const pw = dashboardPassword();
  return !!pw && sameSecret(given, pw);
}

export async function isSignedIn(): Promise<boolean> {
  const pw = dashboardPassword();
  if (!pw) return false;
  const value = (await cookies()).get(AUTH_COOKIE)?.value;
  return !!value && sameSecret(value, sessionToken(pw));
}
