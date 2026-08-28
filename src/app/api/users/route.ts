import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';
import { hashPassword } from '@/lib/auth';
import { parsePagination, buildPaginationMeta } from '@/lib/utils';

// GET /api/users — Admin lists all users with search & filters
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const { searchParams } = new URL(request.url);
    const { page, limit, sortBy, sortOrder } = parsePagination(searchParams);
    const search = searchParams.get('search') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role) where.role = role;
    if (status === 'active') where.isActive = true;
    else if (status === 'inactive') where.isActive = false;

    const orderBy: any = { [sortBy]: sortOrder };
    if (sortBy === 'name' && !where.OR) {
      // Already fine
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder;
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return successResponse({
      users,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/users error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch users', 500);
  }
}

// POST /api/users — Admin creates a new user (Admin or Dispatcher)
export async function POST(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const body = await request.json();
    const { name, email, password, role, isActive } = body;

    if (!email || !password) {
      return errorResponse('VALIDATION_ERROR', 'Email and password are required', 400);
    }

    if (!['ADMIN', 'DISPATCHER'].includes(role)) {
      return errorResponse('VALIDATION_ERROR', 'Role must be ADMIN or DISPATCHER', 400);
    }

    if (password.length < 8) {
      return errorResponse('VALIDATION_ERROR', 'Password must be at least 8 characters', 400);
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return errorResponse('VALIDATION_ERROR', 'Password must contain uppercase, lowercase, and a number', 400);
    }

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return errorResponse('DUPLICATE_EMAIL', 'A user with this email already exists', 409);
    }

    const passwordHash = await hashPassword(password);

    const user = await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: name || null,
        role,
        isActive: isActive !== false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: authUser.userId,
        action: 'USER_CREATED',
        entityType: 'User',
        entityId: user.id,
        newValues: JSON.stringify({ email: user.email, role: user.role, isActive: user.isActive }),
      },
    });

    return successResponse(user, 201);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('POST /api/users error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create user', 500);
  }
}