import { verifyAccessToken } from '@/lib/auth';

export interface AuthUser {
  userId: string;
  email: string;
  role: string;
}

export async function getAuthUserAsync(request: Request): Promise<AuthUser> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    const error = new Error('Missing or invalid Authorization header');
    (error as any).status = 401;
    (error as any).code = 'UNAUTHORIZED';
    throw error;
  }

  const token = authHeader.substring(7);
  const payload = await verifyAccessToken(token);

  if (!payload) {
    const error = new Error('Invalid or expired token');
    (error as any).status = 401;
    (error as any).code = 'UNAUTHORIZED';
    throw error;
  }

  return {
    userId: payload.sub,
    email: payload.email,
    role: payload.role,
  };
}

export function requireRole(authUser: AuthUser, allowedRoles: string[]): void {
  if (!allowedRoles.includes(authUser.role)) {
    const error = new Error('Insufficient permissions');
    (error as any).status = 403;
    (error as any).code = 'FORBIDDEN';
    throw error;
  }
}

export function successResponse<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function errorResponse(code: string, message: string, status: number) {
  return Response.json(
    { success: false, error: { code, message } },
    { status }
  );
}
