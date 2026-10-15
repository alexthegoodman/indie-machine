import { defineConfig } from "prisma/config";

// The CLI does not read .env by itself; Next.js does for the app. Vercel sets DATABASE_URL directly.
try { process.loadEnvFile(".env"); } catch { /* no .env: the environment provides it */ }

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL },
});
