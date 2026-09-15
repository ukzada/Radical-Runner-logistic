import cron from 'node-cron';
import { runDeliveryReminderScan } from './delivery-reminders';

/**
 * Background scheduler for delivery-date reminders.
 * - Runs one scan shortly after startup (so a fresh deploy catches up)
 * - Then runs at 07:00 and 19:00 (UTC by default, override with CRON_TZ)
 *
 * node-cron only works in the Node.js runtime — this module is imported
 * dynamically from src/instrumentation.ts under a NEXT_RUNTIME === 'nodejs'
 * guard so it never ends up in the edge bundle.
 */
export function startReminderScheduler(): void {
  const tz = process.env.CRON_TZ || 'UTC';
  console.log(`[delivery-reminders] scheduler started (07:00 & 19:00 ${tz})`);

  const run = async (trigger: string) => {
    try {
      const result = await runDeliveryReminderScan();
      console.log(
        `[delivery-reminders:${trigger}] scanned=${result.scanned} created=${result.created} alreadySent=${result.skipped}`
      );
    } catch (error) {
      console.error(`[delivery-reminders:${trigger}] scan failed:`, error);
    }
  };

  // Startup catch-up after a short grace period
  setTimeout(() => {
    void run('startup');
  }, 3000);

  // Twice-daily schedule
  cron.schedule('0 7,19 * * *', () => {
    void run('cron');
  });
}
