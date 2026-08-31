import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';
import { hashPassword } from '@/lib/auth';
import { parsePagination, buildPaginationMeta } from '@/lib/utils';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN', 'DISPATCHER']);

    const { searchParams } = new URL(request.url);
    const { page, limit, sortBy, sortOrder } = parsePagination(searchParams);
    const search = (searchParams.get('search') || '').trim();

    // DISPATCHER can only see their own profile
    if (authUser.role === 'DISPATCHER') {
      const dispatcher = await db.user.findUnique({
        where: { id: authUser.userId },
        include: {
          _count: {
            select: {
              driverAssignments: true,
            },
          },
        },
      });

      if (!dispatcher) {
        return errorResponse('NOT_FOUND', 'Dispatcher not found', 404);
      }

      const loadCount = await db.load.count({
        where: { createdBy: dispatcher.id },
      });

      const totalLoadValue = await db.load.aggregate({
        _sum: { loadPrice: true },
        where: { createdBy: dispatcher.id },
      });

      return successResponse({
        dispatchers: [{
          ...dispatcher,
          driverCount: dispatcher._count.driverAssignments,
          loadCount,
          totalLoadValue: totalLoadValue._sum.loadPrice || 0,
        }],
        meta: buildPaginationMeta(1, 1, limit),
      });
    }

    // ADMIN sees all dispatchers
    const where: Prisma.UserWhereInput = {
      role: 'DISPATCHER',
    };

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [dispatchers, total] = await Promise.all([
      db.user.findMany({
        where,
        include: {
          _count: {
            select: {
              driverAssignments: true,
            },
          },
        },
        orderBy: { [sortBy === 'name' ? 'name' : 'createdAt']: sortBy === 'name' ? 'asc' : sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    // Get load stats for each dispatcher
    const dispatcherIds = dispatchers.map((d) => d.id);
    const loadStats = await db.load.groupBy({
      by: ['createdBy'],
      _count: { id: true },
      _sum: { loadPrice: true },
      where: { createdBy: { in: dispatcherIds } },
    });

    const loadStatsMap = Object.fromEntries(
      loadStats
        .filter((s) => s.createdBy !== null)
        .map((s) => [s.createdBy, { loadCount: s._count.id, totalLoadValue: s._sum.loadPrice || 0 }])
    );

    const result = dispatchers.map((d) => ({
      ...d,
      driverCount: d._count.driverAssignments,
      loadCount: loadStatsMap[d.id]?.loadCount || 0,
      totalLoadValue: loadStatsMap[d.id]?.totalLoadValue || 0,
    }));

    return successResponse({
      dispatchers: result,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/dispatchers error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch dispatchers', 500);
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const body = await request.json();
    const { email, name, phone, password } = body;

    if (!email || !password) {
      return errorResponse('VALIDATION_ERROR', 'Email and password are required', 400);
    }

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return errorResponse('CONFLICT', 'A user with this email already exists', 409);
    }

    const passwordHash = await hashPassword(password);

    const dispatcher = await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: name || null,
        phone: phone || null,
        role: 'DISPATCHER',
        isActive: true,
      },
    });

    return successResponse({
      id: dispatcher.id,
      email: dispatcher.email,
      name: dispatcher.name,
      phone: dispatcher.phone,
      role: dispatcher.role,
      isActive: dispatcher.isActive,
      createdAt: dispatcher.createdAt,
    }, 201);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('POST /api/dispatchers error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create dispatcher', 500);
  }
}
