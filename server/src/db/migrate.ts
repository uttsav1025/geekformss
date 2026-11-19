import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { migrate as drizzleMigrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "../config/db.js";

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../drizzle");

// Postgres auto-named these foreign keys under the pre-Drizzle SQL migrations.
// Renaming them makes a legacy database identical to one built from 0000.
const LEGACY_FK_RENAMES: [table: string, from: string, to: string][] = [
  ["responses", "responses_survey_id_fkey", "responses_survey_id_surveys_id_fk"],
  ["responses", "responses_version_id_fkey", "responses_version_id_survey_versions_id_fk"],
  ["survey_versions", "survey_versions_survey_id_fkey", "survey_versions_survey_id_surveys_id_fk"],
  ["surveys", "surveys_owner_id_fkey", "surveys_owner_id_users_id_fk"],
  ["surveys", "surveys_current_version_fk", "surveys_current_version_id_survey_versions_id_fk"],
];

/**
 * Databases created by the old hand-written SQL runner already contain the
 * 0000_init schema. Record 0000 as applied (exactly as Drizzle would) instead
 * of re-running it, so existing data survives the switch. No-op otherwise.
 */
async function baselineLegacyDatabase() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ legacy: boolean; tracked: boolean }>(
      `SELECT to_regclass('public.schema_migrations') IS NOT NULL AS legacy,
              to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS tracked`,
    );
    if (!rows[0].legacy || rows[0].tracked) return;

    const journal = JSON.parse(fs.readFileSync(path.join(migrationsFolder, "meta/_journal.json"), "utf8")) as {
      entries: { tag: string; when: number }[];
    };
    const first = journal.entries[0];
    if (!first) throw new Error("migration journal is empty");
    const sql = fs.readFileSync(path.join(migrationsFolder, `${first.tag}.sql`), "utf8");
    const hash = crypto.createHash("sha256").update(sql).digest("hex"); // same hash Drizzle computes

    await client.query("BEGIN");
    for (const [table, from, to] of LEGACY_FK_RENAMES) {
      await client.query(
        `DO $$ BEGIN
           IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${from}') THEN
             ALTER TABLE "${table}" RENAME CONSTRAINT "${from}" TO "${to}";
           END IF;
         END $$;`,
      );
    }
    await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await client.query(
      `CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
    );
    await client.query(`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`, [hash, first.when]);
    await client.query("COMMIT");
    console.log(`baseline: legacy database adopted, ${first.tag} marked as applied`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/** Apply pending migrations. Serialised across instances with an advisory lock. */
export async function migrate() {
  const lock = await pool.connect();
  try {
    await lock.query("SELECT pg_advisory_lock(727274)");
    await baselineLegacyDatabase();
    await drizzleMigrate(db, { migrationsFolder });
  } finally {
    await lock.query("SELECT pg_advisory_unlock(727274)").catch(() => {});
    lock.release();
  }
}

// `npm run db:migrate`
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  migrate()
    .then(() => {
      console.log("migrations up to date");
      return pool.end();
    })
    .catch((error) => {
      console.error("migration failed:", error);
      process.exit(1);
    });
}
