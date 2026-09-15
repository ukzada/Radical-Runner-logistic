export async function register() {
  // Only run the node-cron scheduler in the Node.js runtime (never edge).
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startReminderScheduler } = await import('./lib/reminder-scheduler');
    startReminderScheduler();
  }
}
