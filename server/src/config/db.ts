import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "./env.js";

// Hosted Postgres (Neon, Render, Supabase) needs TLS; local Docker does not.
const needsSsl = /sslmode=require|neon\.tech|render\.com|supabase/.test(env.DATABASE_URL);

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.PG_POOL_MAX,
  ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
});

export const db = drizzle(pool);

/** A transaction handle, so helpers can run inside or outside a transaction. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Executor = Tx | typeof db;

/** Fail fast at boot if the database is unreachable. */
export const connectDB = async () => {
  try {
    const client = await pool.connect();
    client.release();
    console.log("PostgreSQL connected");
  } catch (error) {
    console.error("PostgreSQL connection failed:", (error as Error).message);
    process.exit(1);
  }
};

/** Readiness probe: can we run a query right now? */
export const pingDB = async () => {
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
};
