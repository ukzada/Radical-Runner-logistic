import { db } from '@/lib/db';
import { getAuthUserAsync, successResponse, errorResponse } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);

    const user = await db.user.findUnique({
      where: { id: authUser.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        companyId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return errorResponse('USER_NOT_FOUND', 'User not found', 404);
    }

    if (!user.isActive) {
      return errorResponse('ACCOUNT_DISABLED', 'Account has been disabled', 403);
    }

    return successResponse(user);
  } catch (error: any) {
    if (error.status) {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('Auth me error:', error);
    return errorResponse('AUTH_ERROR', error.message || 'Authentication failed', 500);
  }
}
