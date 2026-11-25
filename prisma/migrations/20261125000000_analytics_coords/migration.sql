-- City coordinates from Vercel's edge headers, for the /insights map.
ALTER TABLE "analytics_events" ADD COLUMN "lat" DOUBLE PRECISION,
ADD COLUMN "lon" DOUBLE PRECISION;
