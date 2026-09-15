import { db } from '@/lib/db';

/**
 * Delivery-date reminder scan.
 *
 * Finds loads whose deliveryDate falls within the next ~26 hours and that
 * are not yet delivered/cancelled, then creates an alarm notification for:
 *   - the dispatcher who created the load (createdBy)
 *   - every active ADMIN user
 *
 * Idempotency is DB-enforced via Notification.dedupeKey (unique):
 *   delivery-reminder:<loadId>:<userId>:<YYYY-MM-DD of deliveryDate>
 * so re-running the scan never duplicates a reminder for the same
 * load + user + delivery day.
 */

const WINDOW_HOURS = 26;

export async function runDeliveryReminderScan(): Promise<{
  scanned: number;
  created: number;
  skipped: number;
}> {
  const now = new Date();
  const horizon = new Date(now.getTime() + WINDOW_HOURS * 60 * 60 * 1000);

  const loads = await db.load.findMany({
    where: {
      deliveryDate: { gte: now, lte: horizon },
      status: { notIn: ['DELIVERED', 'CANCELLED'] },
    },
    orderBy: { deliveryDate: 'asc' },
  });

  const admins = await db.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });
  const adminIds = admins.map((a) => a.id);

  let created = 0;
  let skipped = 0;

  for (const load of loads) {
    if (!load.deliveryDate) continue;
    const day = load.deliveryDate.toISOString().slice(0, 10);

    // Recipients: the load's dispatcher (creator) + all active admins (deduped)
    const recipientIds = new Set<string>(adminIds);
    if (load.createdBy) recipientIds.add(load.createdBy);

    for (const userId of recipientIds) {
      const dedupeKey = `delivery-reminder:${load.id}:${userId}:${day}`;
      const res = await db.notification.createMany({
        data: [
          {
            userId,
            type: 'DELIVERY_DUE',
            title: 'Delivery due within 24 hours',
            message: `Load ${load.loadNumber} is scheduled for delivery on ${day}.\nRoute: ${load.origin || '—'} → ${load.destination || '—'}.\nPrice: $${(load.loadPrice || 0).toFixed(2)}. Follow up with the driver to confirm on-time delivery.`,
            relatedEntityType: 'Load',
            relatedEntityId: load.id,
            dedupeKey,
          },
        ],
        skipDuplicates: true,
      });
      created += res.count;
      if (res.count === 0) skipped++;
    }
  }

  return { scanned: loads.length, created, skipped };
}
