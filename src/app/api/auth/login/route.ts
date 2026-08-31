import { db } from '@/lib/db';
import { verifyPassword, signAccessToken, signRefreshToken } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/auth-helpers';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return errorResponse('VALIDATION_ERROR', 'Email and password are required', 400);
    }

    // Rate limit by email (IP-based would need middleware)
    const rl = rateLimit(`login:${email.toLowerCase()}`);
    if (!rl.allowed) {
      const retryMin = Math.ceil(rl.retryAfterMs / 60000);
      return errorResponse('RATE_LIMITED', `Too many login attempts. Try again in ${retryMin} minutes.`, 429);
    }

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return errorResponse('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    if (!user.isActive) {
      return errorResponse('ACCOUNT_DISABLED', 'Account has been disabled', 403);
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return errorResponse('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const tokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(tokenPayload),
      signRefreshToken(tokenPayload),
    ]);

    // Clear rate limit on successful login
    const attempts = (global as any).__loginAttempts;
    if (attempts) attempts.delete(`login:${email.toLowerCase()}`);

    return successResponse({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return errorResponse('LOGIN_ERROR', error.message || 'Login failed', 500);
  }
}
