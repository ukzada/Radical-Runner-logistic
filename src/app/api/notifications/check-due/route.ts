import { getAuthUserAsync, successResponse, errorResponse } from '@/lib/auth-helpers';
import { runDeliveryReminderScan } from '@/lib/delivery-reminders';

/**
 * POST|GET /api/notifications/check-due
 *
 * Manual/external trigger for the delivery-date reminder scan.
 * This path is PUBLIC in middleware but guarded here by either:
 *   1. x-cron-secret header matching CRON_SECRET (custom schedulers:
 *      cron-job.org, GitHub Actions, k8s CronJob), or
 *   2. an "Authorization: Bearer <CRON_SECRET>" header matching CRON_SECRET
 *      (exactly what Vercel Cron sends), or
 *   3. a valid ADMIN bearer token (for on-demand checks from the UI).
 *
 * Safe to call repeatedly — the scan is idempotent (dedupeKey-unique).
 */
async function handle(request: Request) {
  try {
    const secret = process.env.CRON_SECRET || '';
    const cronSecret = request.headers.get('x-cron-secret');

    // Vercel Cron sends "Authorization: Bearer <CRON_SECRET>"
    const authHeader = request.headers.get('Authorization') || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if ((secret && cronSecret === secret) || (secret && bearer === secret)) {
      // External scheduler with the correct secret — proceed
    } else {
      // Otherwise require an ADMIN token
      const authUser = await getAuthUserAsync(request);
      if (authUser.role !== 'ADMIN') {
        return errorResponse('FORBIDDEN', 'Only ADMIN can trigger the reminder scan', 403);
      }
    }

    const result = await runDeliveryReminderScan();
    return successResponse(result);
  } catch (error: any) {
    if (error.status) {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('check-due error:', error);
    return errorResponse('CHECK_DUE_ERROR', error.message || 'Failed to run reminder scan', 500);
  }
}

export async function POST(request: Request) {
  return handle(request);
}

export async function GET(request: Request) {
  return handle(request);
}
