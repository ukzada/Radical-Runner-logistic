import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN', 'DISPATCHER']);

    const { id } = await params;

    const notification = await db.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return errorResponse('NOT_FOUND', 'Notification not found', 404);
    }

    if (notification.userId !== authUser.userId) {
      return errorResponse('FORBIDDEN', 'You can only update your own notifications', 403);
    }

    const updated = await db.notification.update({
      where: { id },
      data: { isRead: true },
    });

    return successResponse(updated);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('PUT /api/notifications/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update notification', 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN', 'DISPATCHER']);

    const { id } = await params;

    const notification = await db.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return errorResponse('NOT_FOUND', 'Notification not found', 404);
    }

    if (notification.userId !== authUser.userId) {
      return errorResponse('FORBIDDEN', 'You can only delete your own notifications', 403);
    }

    await db.notification.delete({ where: { id } });

    return successResponse({ deleted: true });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('DELETE /api/notifications/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to delete notification', 500);
  }
}
