import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Simple JWT implementation using Web Crypto API
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be set in .env');
}
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat: number;
  exp: number;
}

// Base64URL encoding/decoding
function base64UrlEncode(data: string): string {
  return Buffer.from(data).toString('base64url');
}

function base64UrlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString();
}

// Simple HMAC-SHA256 JWT implementation
async function createHmacSha256(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return Buffer.from(sig).toString('base64url');
}

async function verifyHmacSha256(secret: string, data: string, signature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const sig = Buffer.from(signature, 'base64url');
  return crypto.subtle.verify('HMAC', key, sig, encoder.encode(data));
}

export async function signToken(payload: Omit<JwtPayload, 'iat' | 'exp'>, secret: string, expiry: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expSeconds = parseExpiryToSeconds(expiry);
  
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp: now + expSeconds,
  };

  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncode(JSON.stringify(fullPayload));
  const signature = await createHmacSha256(secret, `${header}.${body}`);

  return `${header}.${body}.${signature}`;
}

export async function verifyToken(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const valid = await verifyHmacSha256(secret, `${header}.${body}`, signature);
    if (!valid) return null;

    const payload: JwtPayload = JSON.parse(base64UrlDecode(body));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp < now) return null;

    return payload;
  } catch {
    return null;
  }
}

function parseExpiryToSeconds(expiry: string): number {
  const match = expiry.match(/^(\d+)(s|m|h|d)$/);
  if (!match) return 3600; // default 1h
  const value = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: return 3600;
  }
}

export async function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  if (!JWT_SECRET) throw new Error('JWT_SECRET not configured');
  return signToken(payload, JWT_SECRET, ACCESS_TOKEN_EXPIRY);
}

export async function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): Promise<string> {
  if (!JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET not configured');
  return signToken(payload, JWT_REFRESH_SECRET, REFRESH_TOKEN_EXPIRY);
}

export async function verifyAccessToken(token: string): Promise<JwtPayload | null> {
  if (!JWT_SECRET) return null;
  return verifyToken(token, JWT_SECRET);
}

export async function verifyRefreshToken(token: string): Promise<JwtPayload | null> {
  if (!JWT_REFRESH_SECRET) return null;
  return verifyToken(token, JWT_REFRESH_SECRET);
}
