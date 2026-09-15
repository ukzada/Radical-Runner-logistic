import { db } from '@/lib/db';
import { getAuthUserAsync, successResponse, errorResponse } from '@/lib/auth-helpers';

/**
 * PUT /api/notifications/mark-all-read
 * Marks every unread notification for the authenticated user as read.
 * (Previously the UI's "Mark all as read" button hit a missing route and
 * fell into the [id] catch-all with id="mark-all-read" → 404.)
 */
export async function PUT(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);

    const result = await db.notification.updateMany({
      where: { userId: authUser.userId, isRead: false },
      data: { isRead: true },
    });

    return successResponse({ updated: result.count });
  } catch (error: any) {
    if (error.status) {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('mark-all-read error:', error);
    return errorResponse('MARK_ALL_READ_ERROR', error.message || 'Failed to mark notifications as read', 500);
  }
}
