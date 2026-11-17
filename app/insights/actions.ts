"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, AUTH_MAX_AGE, dashboardPassword, passwordMatches, sessionToken } from "@/lib/analytics/auth";

/** Per server instance: failed attempts in the last window, so guessing the password is slow. */
const failures: number[] = [];
const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 20;

export async function signIn(formData: FormData) {
  const now = Date.now();
  while (failures.length && now - failures[0] > WINDOW_MS) failures.shift();
  if (failures.length >= MAX_FAILURES) redirect("/insights?error=locked");

  const given = String(formData.get("password") ?? "");
  const pw = dashboardPassword();
  if (!pw || !passwordMatches(given)) {
    failures.push(now);
    await new Promise((r) => setTimeout(r, 800));
    redirect("/insights?error=1");
  }
  (await cookies()).set(AUTH_COOKIE, sessionToken(pw), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/insights",
    maxAge: AUTH_MAX_AGE,
  });
  redirect("/insights");
}

export async function signOut() {
  (await cookies()).delete({ name: AUTH_COOKIE, path: "/insights" });
  redirect("/insights");
}
