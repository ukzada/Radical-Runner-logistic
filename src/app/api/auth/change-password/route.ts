import { db } from '@/lib/db';
import { getAuthUserAsync, successResponse, errorResponse } from '@/lib/auth-helpers';
import { verifyPassword, hashPassword } from '@/lib/auth';

// POST /api/auth/change-password — User changes their own password
export async function POST(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);

    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return errorResponse('VALIDATION_ERROR', 'Current password, new password, and confirmation are required', 400);
    }

    if (newPassword !== confirmPassword) {
      return errorResponse('VALIDATION_ERROR', 'New password and confirmation do not match', 400);
    }

    if (newPassword.length < 8) {
      return errorResponse('VALIDATION_ERROR', 'Password must be at least 8 characters', 400);
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return errorResponse('VALIDATION_ERROR', 'Password must contain uppercase, lowercase, and a number', 400);
    }

    // Fetch user with password hash
    const user = await db.user.findUnique({
      where: { id: authUser.userId },
      select: { id: true, passwordHash: true, isActive: true },
    });

    if (!user) {
      return errorResponse('USER_NOT_FOUND', 'User not found', 404);
    }

    if (!user.isActive) {
      return errorResponse('ACCOUNT_DISABLED', 'Account has been disabled', 403);
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return errorResponse('INVALID_PASSWORD', 'Current password is incorrect', 401);
    }

    // Hash and save new password
    const newPasswordHash = await hashPassword(newPassword);
    await db.user.update({
      where: { id: authUser.userId },
      data: { passwordHash: newPasswordHash },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: authUser.userId,
        action: 'PASSWORD_CHANGED',
        entityType: 'User',
        entityId: authUser.userId,
        oldValues: null,
        newValues: 'Password changed by user',
      },
    });

    return successResponse({ message: 'Password changed successfully' });
  } catch (error: any) {
    if (error.status) {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('POST /api/auth/change-password error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to change password', 500);
  }
}
