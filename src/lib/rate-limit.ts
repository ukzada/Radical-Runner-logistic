// Simple in-memory rate limiter
// For production, use Redis-backed rate limiting

const attempts = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 10;

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of attempts.entries()) {
    if (val.resetAt < now) attempts.delete(key);
  }
}, 5 * 60 * 1000);

export function rateLimit(key: string, maxAttempts = MAX_ATTEMPTS, windowMs = WINDOW_MS): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = attempts.get(key);

  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= maxAttempts) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Clear the rate-limit window for a key.
 * Called after a successful login so a few failed attempts followed by a
 * correct password never lock the user out for the full 15-minute window.
 */
export function resetRateLimit(key: string): void {
  attempts.delete(key);
}

// Rate limit for password reset requests: 1 per hour per user
const resetAttempts = new Map<string, { lastRequest: number }>();
const RESET_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export function rateLimitResetRequest(userId: string): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  const entry = resetAttempts.get(userId);

  if (!entry || (now - entry.lastRequest) > RESET_COOLDOWN_MS) {
    resetAttempts.set(userId, { lastRequest: now });
    return { allowed: true, retryAfterMs: 0 };
  }

  return { allowed: false, retryAfterMs: RESET_COOLDOWN_MS - (now - entry.lastRequest) };
}
