import { createApp } from "./app.js";
import { config } from "./config.js";
import { closeDatabase } from "./database/client.js";
import { logger } from "./logger.js";

const app = createApp();
const server = app.listen(config.port, () => {
  logger.info({ port: config.port }, "Bazaar API listening");
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
