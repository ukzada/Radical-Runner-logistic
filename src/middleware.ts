import { NextRequest, NextResponse } from 'next/server';

/**
 * Edge middleware — protects /api/* routes with JWT (HS256) validation
 * using Web Crypto (edge-compatible; no Node Buffer).
 *
 * Public paths are allowed through (they authenticate by other means or
 * enforce their own secrets):
 *   - /api/auth/login      (credentials)
 *   - /api/auth/refresh    (refresh token in body)
 *   - /api/notifications/check-due (guarded by x-cron-secret inside the route)
 *
 * Everything else requires: Authorization: Bearer <valid access token>.
 */

const PUBLIC_PATHS = [
  '/api/auth/login',
  '/api/auth/refresh',
  '/api/notifications/check-due',
];

function base64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifyAccessToken(token: string, secret: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [headerB64, payloadB64, sigB64] = parts;

  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlToBytes(headerB64)));
    if (header.alg !== 'HS256') return false;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64)));
    if (!payload.exp || payload.exp * 1000 < Date.now()) return false;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sig = base64UrlToBytes(sigB64);
    // Cast Uint8Array to BufferSource for TS lib.dom compatibility
    return await crypto.subtle.verify('HMAC', key, sig as unknown as BufferSource, data);
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p)) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' } },
      { status: 401 }
    );
  }

  const secret = process.env.JWT_SECRET || '';
  const valid = secret ? await verifyAccessToken(token, secret) : false;

  if (!valid) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
