import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';
import { hashPassword } from '@/lib/auth';

// PUT /api/admin/reset-requests/[id] — Admin approves/rejects and optionally resets password
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const { id } = await params;
    const body = await request.json();
    const { action, newPassword, notes } = body;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return errorResponse('VALIDATION_ERROR', 'Action must be APPROVE or REJECT', 400);
    }

    const resetRequest = await db.passwordResetRequest.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!resetRequest) {
      return errorResponse('NOT_FOUND', 'Reset request not found', 404);
    }

    if (resetRequest.status !== 'PENDING') {
      return errorResponse('INVALID_STATE', `Request is already ${resetRequest.status.toLowerCase()}`, 400);
    }

    if (action === 'REJECT') {
      const updated = await db.passwordResetRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewedBy: authUser.userId,
          notes: notes || 'Rejected by admin',
        },
      });

      // Notify the requester
      await db.notification.create({
        data: {
          userId: resetRequest.userId,
          type: 'PASSWORD_RESET_REJECTED',
          title: 'Password Reset Request Rejected',
          message: `Your password reset request has been rejected. ${notes ? 'Reason: ' + notes : ''}`,
          relatedEntityType: 'PasswordResetRequest',
          relatedEntityId: id,
        },
      });

      return successResponse(updated);
    }

    // APPROVE — must provide a new password
    if (!newPassword || newPassword.length < 8) {
      return errorResponse('VALIDATION_ERROR', 'New password must be at least 8 characters', 400);
    }

    // Password strength check
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return errorResponse('VALIDATION_ERROR', 'Password must contain uppercase, lowercase, and a number', 400);
    }

    const passwordHash = await hashPassword(newPassword);

    const updated = await db.passwordResetRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: authUser.userId,
        notes: notes || 'Approved by admin',
      },
    });

    // Reset the user's password
    await db.user.update({
      where: { id: resetRequest.userId },
      data: { passwordHash },
    });

    // Notify the requester with the new password
    await db.notification.create({
      data: {
        userId: resetRequest.userId,
        type: 'PASSWORD_RESET_APPROVED',
        title: 'Password Reset Approved',
        message: `Your password has been reset by admin. Your new password is: ${newPassword}. Please change it after logging in.`,
        relatedEntityType: 'PasswordResetRequest',
        relatedEntityId: id,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: authUser.userId,
        action: 'PASSWORD_RESET_APPROVED',
        entityType: 'User',
        entityId: resetRequest.userId,
        oldValues: null,
        newValues: 'Password reset approved and new password set',
      },
    });

    return successResponse({
      id: updated.id,
      status: updated.status,
      message: `Password reset approved for ${resetRequest.user.email}`,
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('PUT /api/admin/reset-requests/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to process reset request', 500);
  }
}
