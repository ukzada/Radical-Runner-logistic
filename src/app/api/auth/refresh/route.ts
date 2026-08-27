import { verifyRefreshToken, signAccessToken, signRefreshToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/auth-helpers';
import { db } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return errorResponse('VALIDATION_ERROR', 'Refresh token is required', 400);
    }

    const payload = await verifyRefreshToken(refreshToken);

    if (!payload) {
      return errorResponse('INVALID_TOKEN', 'Invalid or expired refresh token', 401);
    }

    // Verify user still exists and is active
    const user = await db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return errorResponse('INVALID_TOKEN', 'User account is no longer active', 401);
    }

    const tokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [newAccessToken, newRefreshToken] = await Promise.all([
      signAccessToken(tokenPayload),
      signRefreshToken(tokenPayload),
    ]);

    return successResponse({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error: any) {
    console.error('Token refresh error:', error);
    return errorResponse('REFRESH_ERROR', 'Token refresh failed', 500);
  }
}
