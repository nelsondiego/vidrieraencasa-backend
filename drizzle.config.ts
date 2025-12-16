import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: {
    // Local D1 database file for Studio and local development
    url: ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/dd00d5e9dfe671136915128963ef34c36844d34e167b599f50f7c66148228506.sqlite",
  },
});
