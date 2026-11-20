import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

// drizzle-kit runs outside the app, so it reads the env file itself.
dotenv.config({ path: [".env", "../.env"], quiet: true });

export default defineConfig({
  schema: "./src/db/schema/*.schema.ts", // one table (or tightly coupled pair) per file
  out: "./drizzle", // GENERATED — never hand-edit
  dialect: "postgresql",
  verbose: true,
  strict: true,
  // DDL goes over the direct connection when there is one (Neon's pooler is transaction mode).
  dbCredentials: { url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "" },
});
