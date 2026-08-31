import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN', 'DISPATCHER']);

    const { id } = await params;

    // DISPATCHER can only see their own profile
    if (authUser.role === 'DISPATCHER' && authUser.userId !== id) {
      return errorResponse('FORBIDDEN', 'You can only view your own profile', 403);
    }

    const dispatcher = await db.user.findUnique({
      where: { id, role: 'DISPATCHER' },
      include: {
        driverAssignments: {
          include: {
            driver: {
              include: {
                mc: { select: { id: true, mcNumber: true, company: { select: { id: true, name: true } } } },
              },
            },
          },
        },
        _count: { select: { driverAssignments: true } },
      },
    });

    if (!dispatcher) {
      return errorResponse('NOT_FOUND', 'Dispatcher not found', 404);
    }

    const assignedDrivers = dispatcher.driverAssignments.map((da) => ({
      ...da.driver,
      mcId: da.driver.mc?.id || null,
      mcNumber: da.driver.mc?.mcNumber || null,
      companyId: da.driver.mc?.company?.id || null,
      companyName: da.driver.mc?.company?.name || null,
      mc: undefined,
    }));

    // Get load stats and recent loads
    const [loadCount, totalLoadValue, recentLoads] = await Promise.all([
      db.load.count({ where: { createdBy: dispatcher.id } }),
      db.load.aggregate({
        _sum: { loadPrice: true },
        where: { createdBy: dispatcher.id },
      }),
      db.load.findMany({
        where: { createdBy: dispatcher.id },
        include: {
          driver: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    return successResponse({
      ...dispatcher,
      passwordHash: undefined,
      driverCount: dispatcher._count.driverAssignments,
      assignedDrivers,
      loadCount,
      totalLoadValue: totalLoadValue._sum.loadPrice || 0,
      recentLoads: recentLoads.map((l) => ({
        ...l,
        driverName: l.driver ? `${l.driver.firstName} ${l.driver.lastName}` : null,
      })),
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/dispatchers/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch dispatcher', 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN', 'DISPATCHER']);

    const { id } = await params;

    if (authUser.role === 'DISPATCHER' && authUser.userId !== id) {
      return errorResponse('FORBIDDEN', 'You can only update your own profile', 403);
    }

    const dispatcher = await db.user.findUnique({ where: { id, role: 'DISPATCHER' } });
    if (!dispatcher) {
      return errorResponse('NOT_FOUND', 'Dispatcher not found', 404);
    }

    const body = await request.json();
    const { name, email, phone, isActive } = body;

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (isActive !== undefined && authUser.role === 'ADMIN') updateData.isActive = isActive;

    if (email !== undefined && email !== dispatcher.email) {
      const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existing) {
        return errorResponse('CONFLICT', 'A user with this email already exists', 409);
      }
      updateData.email = email.toLowerCase();
    }

    const updated = await db.user.update({ where: { id }, data: updateData });

    return successResponse({
      id: updated.id, email: updated.email, name: updated.name, phone: updated.phone,
      role: updated.role, isActive: updated.isActive, createdAt: updated.createdAt, updatedAt: updated.updatedAt,
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('PUT /api/dispatchers/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update dispatcher', 500);
  }
}
