// One-off purge of stale partial responses (the server also runs it every 6 hours).
//   npm run cleanup -w server            PARTIAL_TTL_DAYS=7 npm run cleanup -w server
import { pool } from "../../config/db.js";
import { env } from "../../config/env.js";
import { purgeStalePartials } from "./Response.service.js";

const n = await purgeStalePartials();
console.log(`removed ${n} partial response(s) older than ${env.PARTIAL_TTL_DAYS} days`);
await pool.end();
