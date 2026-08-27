import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';
import { rateLimitResetRequest } from '@/lib/rate-limit';

// POST /api/auth/reset-request — Dispatcher requests a password reset
export async function POST(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['DISPATCHER']);

    // Rate limit: 1 request per hour
    const rl = rateLimitResetRequest(authUser.userId);
    if (!rl.allowed) {
      const retryMin = Math.ceil(rl.retryAfterMs / 60000);
      return errorResponse('RATE_LIMITED', `You can request a reset once per hour. Try again in ${retryMin} minutes.`, 429);
    }

    const body = await request.json();
    const reason = body.reason || '';

    // Check for existing PENDING request
    const existingPending = await db.passwordResetRequest.findFirst({
      where: { userId: authUser.userId, status: 'PENDING' },
    });
    if (existingPending) {
      return errorResponse('PENDING_EXISTS', 'You already have a pending reset request. Please wait for admin review.', 409);
    }

    // Create the reset request
    const resetRequest = await db.passwordResetRequest.create({
      data: {
        userId: authUser.userId,
        status: 'PENDING',
        reason: reason.substring(0, 500),
      },
      include: {
        user: { select: { id: true, email: true, name: true, role: true } },
      },
    });

    // Notify all admins
    const admins = await db.user.findMany({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true },
    });

    await db.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: 'PASSWORD_RESET_REQUEST',
        title: 'Password Reset Request',
        message: `${resetRequest.user.name || resetRequest.user.email} has requested a password reset. Reason: ${reason || 'Not provided'}`,
        relatedEntityType: 'PasswordResetRequest',
        relatedEntityId: resetRequest.id,
      })),
    });

    return successResponse({
      id: resetRequest.id,
      status: resetRequest.status,
      message: 'Password reset request submitted. An admin will review it shortly.',
    }, 201);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('POST /api/auth/reset-request error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to submit reset request', 500);
  }
}
