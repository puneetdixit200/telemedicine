// Azure Application Insights — must load BEFORE any other modules
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  try {
    const appInsights = require('applicationinsights');
    appInsights
      .setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true, true)
      .start();
    // eslint-disable-next-line no-console
    console.log('[AppInsights] Telemetry collection started.');
  } catch (_err) {
    // applicationinsights not installed — skip silently
  }
}

require('dotenv').config();

const { createApp } = require('./apps/backend/server/create-app');
const { createServer } = require('./apps/backend/server/create-server');
const { prisma } = require('./apps/backend/models/db');
const { logger } = require('./apps/backend/services/logger.service');

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const { server } = createServer();

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on http://localhost:${port}`);
    logger.info('server.started', { port, nodeEnv: process.env.NODE_ENV });
  });

  // ── Optional: Auto-dispatch reminders every 5 minutes ──
  if (process.env.ENABLE_REMINDER_CRON === 'true') {
    const configuredInterval = Number(process.env.REMINDER_CRON_INTERVAL_MS || 5 * 60 * 1000);
    const reminderIntervalMs =
      Number.isFinite(configuredInterval) && configuredInterval >= 60 * 1000 ? configuredInterval : 5 * 60 * 1000;

    const timer = setInterval(async () => {
      try {
        const { dispatchDueReminderJobs } = require('./apps/backend/services/reminder.service');
        const batchLimit = Number(process.env.REMINDER_CRON_BATCH_LIMIT || 30);
        const result = await dispatchDueReminderJobs({ limit: batchLimit });
        logger.info('reminder.cron.tick', result);
      } catch (err) {
        logger.warn('reminder.cron.error', { error: err.message });
      }
    }, reminderIntervalMs);
    timer.unref();

    logger.info('reminder.cron.enabled', { intervalMs: reminderIntervalMs });
  }

  // ── Graceful shutdown ──
  const shutdown = async (signal) => {
    logger.info('server.shutdown', { signal });
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    // Force exit after 10s if close hangs
    setTimeout(() => process.exit(1), 10000);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

module.exports = { createApp, createServer };
