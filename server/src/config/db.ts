import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "./env.js";

// Hosted Postgres (Neon, Render, Supabase) needs TLS; local Docker does not.
// Neon serves publicly trusted certificates, so verify them there.
const sslFor = (url: string) => {
  if (/neon\.tech/.test(url)) return { rejectUnauthorized: true };
  if (/sslmode=require|render\.com|supabase/.test(url)) return { rejectUnauthorized: false };
  return undefined;
};

/** A pg pool for one connection string, with the right TLS settings. */
export const createPool = (connectionString: string, max = env.PG_POOL_MAX) =>
  new pg.Pool({ connectionString, max, ssl: sslFor(connectionString) });

export const pool = createPool(env.DATABASE_URL);

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
