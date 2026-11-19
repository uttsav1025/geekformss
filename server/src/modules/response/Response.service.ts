import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "../../config/db.js";
import { env } from "../../config/env.js";
import { responses } from "../../db/schema/response.schema.js";

/**
 * Delete partial responses nobody has touched for PARTIAL_TTL_DAYS. A
 * respondent who returns after that starts fresh: their resume token no longer
 * matches a row. Returns the number of rows removed. Idempotent, so running it
 * on several instances at once is harmless.
 */
export const purgeStalePartials = async (days = env.PARTIAL_TTL_DAYS) => {
  const removed = await db
    .delete(responses)
    .where(and(eq(responses.status, "partial"), lt(responses.updatedAt, sql`now() - make_interval(days => ${days})`)))
    .returning({ id: responses.id });
  return removed.length;
};

const SIX_HOURS = 6 * 60 * 60 * 1000;

/** Run once now, then every 6 hours. Failures are logged, never fatal. */
export const scheduleCleanup = (every = SIX_HOURS) => {
  const run = () =>
    purgeStalePartials()
      .then((n) => {
        if (n) console.log(`cleanup: removed ${n} partial response(s) older than ${env.PARTIAL_TTL_DAYS} days`);
      })
      .catch((error) => console.error("cleanup failed:", (error as Error).message));
  void run();
  const timer = setInterval(run, every);
  timer.unref(); // never keeps the process alive on shutdown
  return () => clearInterval(timer);
};
