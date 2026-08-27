import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';
import { parsePagination, buildPaginationMeta } from '@/lib/utils';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN', 'DISPATCHER']);

    const { searchParams } = new URL(request.url);
    const { page, limit, sortBy, sortOrder } = parsePagination(searchParams);

    const where: Prisma.NotificationWhereInput = {
      userId: authUser.userId,
    };

    const allowedSortFields = ['createdAt', 'isRead', 'type'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const defaultOrder = safeSortBy === 'createdAt' ? 'desc' : sortOrder;
    const orderBy: Prisma.NotificationOrderByWithRelationInput = {
      [safeSortBy]: defaultOrder,
    };

    const [notifications, total, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.notification.count({ where }),
      db.notification.count({
        where: { userId: authUser.userId, isRead: false },
      }),
    ]);

    return successResponse({
      notifications,
      unreadCount,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/notifications error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch notifications', 500);
  }
}

export async function PUT(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN', 'DISPATCHER']);

    const body = await request.json();
    const { notificationId, isRead } = body;

    if (!notificationId) {
      return errorResponse('VALIDATION_ERROR', 'notificationId is required', 400);
    }

    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      return errorResponse('NOT_FOUND', 'Notification not found', 404);
    }

    if (notification.userId !== authUser.userId) {
      return errorResponse('FORBIDDEN', 'You can only update your own notifications', 403);
    }

    const updated = await db.notification.update({
      where: { id: notificationId },
      data: { isRead: isRead === true },
    });

    return successResponse(updated);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('PUT /api/notifications error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update notification', 500);
  }
}
