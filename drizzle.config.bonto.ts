import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Used on Bonto: `npx drizzle-kit push --config=drizzle.config.bonto.ts`
// Reads DATABASE_URL from the Bonto dashboard environment variables
// (e.g. a free Neon / Supabase PostgreSQL connection string).
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL is missing. Add it in Bonto Dashboard → App → Environment Variables."
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  dbCredentials: { url },
});
