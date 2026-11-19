import { env } from "./config/env.js";
import { connectDB, pool } from "./config/db.js";
import { migrate } from "./db/migrate.js";
import { scheduleCleanup } from "./modules/response/Response.service.js";
import { createApp } from "./app.js";

// Fail fast on dependencies, then listen on all interfaces (containers).
await connectDB();
await migrate();
const stopCleanup = scheduleCleanup();

const server = createApp().listen(env.PORT, "0.0.0.0", () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});

// Graceful shutdown: stop accepting, let in-flight requests finish, close the pool.
let shuttingDown = false;
const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);
  stopCleanup();
  const force = setTimeout(() => process.exit(1), 10_000);
  force.unref();
  server.close(() => {
    void pool.end().finally(() => process.exit(0));
  });
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
