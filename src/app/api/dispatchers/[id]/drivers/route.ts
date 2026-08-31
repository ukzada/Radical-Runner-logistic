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
    const { searchParams } = new URL(request.url);
    const available = searchParams.get('available');

    // DISPATCHER can only see their own drivers
    if (authUser.role === 'DISPATCHER' && authUser.userId !== id) {
      return errorResponse('FORBIDDEN', 'You can only view your own drivers', 403);
    }

    const dispatcher = await db.user.findUnique({
      where: { id, role: 'DISPATCHER' },
    });

    if (!dispatcher) {
      return errorResponse('NOT_FOUND', 'Dispatcher not found', 404);
    }

    if (available === 'true') {
      // Get drivers NOT assigned to this dispatcher
      const assignedDriverIds = await db.driverDispatcher
        .findMany({ where: { dispatcherId: id }, select: { driverId: true } })
        .then((a) => a.map((d) => d.driverId));

      const availableDrivers = await db.driver.findMany({
        where: {
          id: { notIn: assignedDriverIds },
          status: 'ACTIVE',
        },
        include: {
          mc: { select: { id: true, mcNumber: true, company: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      });

      return successResponse({
        drivers: availableDrivers.map((d) => ({
          ...d,
          mcId: d.mc?.id || null,
          mcNumber: d.mc?.mcNumber || null,
          companyId: d.mc?.company?.id || null,
          companyName: d.mc?.company?.name || null,
          mc: undefined,
        })),
      });
    }

    const assignments = await db.driverDispatcher.findMany({
      where: { dispatcherId: id },
      include: {
        driver: true,
      },
      orderBy: { assignedAt: 'desc' },
    });

    return successResponse({
      drivers: assignments.map((a) => ({
        ...a.driver,
        assignedAt: a.assignedAt,
      })),
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/dispatchers/[id]/drivers error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch dispatcher drivers', 500);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const { id } = await params;

    const dispatcher = await db.user.findUnique({
      where: { id, role: 'DISPATCHER' },
    });

    if (!dispatcher) {
      return errorResponse('NOT_FOUND', 'Dispatcher not found', 404);
    }

    const body = await request.json();
    const { driverIds } = body;

    if (!Array.isArray(driverIds) || driverIds.length === 0) {
      return errorResponse('VALIDATION_ERROR', 'driverIds array is required', 400);
    }

    // Verify drivers exist
    const drivers = await db.driver.findMany({
      where: { id: { in: driverIds } },
    });

    if (drivers.length !== driverIds.length) {
      return errorResponse('NOT_FOUND', 'One or more drivers not found', 404);
    }

    // Assign drivers (skip already assigned)
    const assignments = [];
    for (const driverId of driverIds) {
      const existing = await db.driverDispatcher.findUnique({
        where: { driverId_dispatcherId: { driverId, dispatcherId: id } },
      });
      if (!existing) {
        const assignment = await db.driverDispatcher.create({
          data: { driverId, dispatcherId: id },
        });
        assignments.push(assignment);
      }
    }

    return successResponse({
      assigned: assignments.length,
      alreadyAssigned: driverIds.length - assignments.length,
    }, 201);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('POST /api/dispatchers/[id]/drivers error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to assign drivers', 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const driverId = searchParams.get('driverId');

    if (!driverId) {
      return errorResponse('VALIDATION_ERROR', 'driverId query parameter is required', 400);
    }

    const existing = await db.driverDispatcher.findUnique({
      where: { driverId_dispatcherId: { driverId, dispatcherId: id } },
    });

    if (!existing) {
      return errorResponse('NOT_FOUND', 'Driver assignment not found', 404);
    }

    await db.driverDispatcher.delete({
      where: { driverId_dispatcherId: { driverId, dispatcherId: id } },
    });

    return successResponse({ unassigned: true });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('DELETE /api/dispatchers/[id]/drivers error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to unassign driver', 500);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const { id } = await params;
    const body = await request.json();
    const { driverId, newDispatcherId } = body;

    if (!driverId || !newDispatcherId) {
      return errorResponse('VALIDATION_ERROR', 'driverId and newDispatcherId are required', 400);
    }

    // Verify current assignment exists
    const existing = await db.driverDispatcher.findUnique({
      where: { driverId_dispatcherId: { driverId, dispatcherId: id } },
    });

    if (!existing) {
      return errorResponse('NOT_FOUND', 'Driver assignment not found', 404);
    }

    // Verify new dispatcher exists
    const newDispatcher = await db.user.findUnique({
      where: { id: newDispatcherId, role: 'DISPATCHER' },
    });

    if (!newDispatcher) {
      return errorResponse('NOT_FOUND', 'New dispatcher not found', 404);
    }

    // Check if already assigned to new dispatcher
    const alreadyAssigned = await db.driverDispatcher.findUnique({
      where: { driverId_dispatcherId: { driverId, dispatcherId: newDispatcherId } },
    });

    if (alreadyAssigned) {
      return errorResponse('CONFLICT', 'Driver is already assigned to this dispatcher', 409);
    }

    // Reassign: delete old, create new
    await db.$transaction([
      db.driverDispatcher.delete({ where: { driverId_dispatcherId: { driverId, dispatcherId: id } } }),
      db.driverDispatcher.create({ data: { driverId, dispatcherId: newDispatcherId } }),
    ]);

    return successResponse({ reassigned: true });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('PUT /api/dispatchers/[id]/drivers error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to reassign driver', 500);
  }
}
