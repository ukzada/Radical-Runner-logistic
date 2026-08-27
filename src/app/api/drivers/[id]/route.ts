import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';
import { parsePagination, buildPaginationMeta } from '@/lib/utils';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN', 'DISPATCHER']);

    const { id } = await params;

    // DISPATCHER can only see their assigned drivers
    if (authUser.role === 'DISPATCHER') {
      const assignment = await db.driverDispatcher.findUnique({
        where: { driverId_dispatcherId: { driverId: id, dispatcherId: authUser.userId } },
      });
      if (!assignment) {
        return errorResponse('FORBIDDEN', 'You can only view your assigned drivers', 403);
      }
    }

    const driver = await db.driver.findUnique({
      where: { id },
      include: {
        mc: {
          select: {
            id: true,
            mcNumber: true,
            company: { select: { id: true, name: true } },
          },
        },
        dispatcherAssignments: {
          include: { dispatcher: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!driver) {
      return errorResponse('NOT_FOUND', 'Driver not found', 404);
    }

    // Get load history
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const loadLimit = parseInt(searchParams.get('loadLimit') || '10');

    const [loads, totalLoads, loadStats] = await Promise.all([
      db.load.findMany({
        where: { driverId: id },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * loadLimit,
        take: loadLimit,
      }),
      db.load.count({ where: { driverId: id } }),
      db.load.aggregate({
        _sum: { loadPrice: true },
        where: { driverId: id, status: 'DELIVERED' },
      }),
    ]);

    const dispatchers = driver.dispatcherAssignments.map((da) => da.dispatcher);
    const primaryDispatcher = dispatchers[0] || null;

    return successResponse({
      id: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      phone: driver.phone,
      email: driver.email,
      driverId: driver.driverId,
      cdlNumber: driver.cdlNumber,
      cdlState: driver.cdlState,
      cdlExpiration: driver.cdlExpiration,
      status: driver.status,
      notes: driver.notes,
      createdAt: driver.createdAt,
      updatedAt: driver.updatedAt,
      mcId: driver.mc?.id || null,
      mcNumber: driver.mc?.mcNumber || null,
      companyId: driver.mc?.company?.id || null,
      companyName: driver.mc?.company?.name || null,
      dispatchers,
      dispatcherName: primaryDispatcher?.name || null,
      dispatcherId: primaryDispatcher?.id || null,
      loadHistory: loads,
      loadHistoryMeta: buildPaginationMeta(totalLoads, page, loadLimit),
      stats: {
        totalLoads: totalLoads,
        totalValue: loadStats._sum.loadPrice || 0,
      },
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/drivers/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch driver', 500);
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

    // DISPATCHER can only update their assigned drivers
    if (authUser.role === 'DISPATCHER') {
      const assignment = await db.driverDispatcher.findUnique({
        where: { driverId_dispatcherId: { driverId: id, dispatcherId: authUser.userId } },
      });
      if (!assignment) {
        return errorResponse('FORBIDDEN', 'You can only update your assigned drivers', 403);
      }
    }

    const driver = await db.driver.findUnique({ where: { id } });
    if (!driver) {
      return errorResponse('NOT_FOUND', 'Driver not found', 404);
    }

    const body = await request.json();
    const { firstName, lastName, phone, email, driverId, cdlNumber, cdlState, cdlExpiration, status, notes, mcId } = body;

    const updateData: Record<string, any> = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone || null;
    if (email !== undefined) updateData.email = email || null;
    if (driverId !== undefined) updateData.driverId = driverId || null;
    if (cdlNumber !== undefined) updateData.cdlNumber = cdlNumber || null;
    if (cdlState !== undefined) updateData.cdlState = cdlState || null;
    if (cdlExpiration !== undefined) updateData.cdlExpiration = cdlExpiration ? new Date(cdlExpiration) : null;
    if (status !== undefined && authUser.role === 'ADMIN') updateData.status = status;
    if (notes !== undefined) updateData.notes = notes || null;
    if (mcId !== undefined && authUser.role === 'ADMIN') updateData.mcId = mcId || null;

    const updated = await db.driver.update({ where: { id }, data: updateData });

    return successResponse(updated);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('PUT /api/drivers/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update driver', 500);
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

    const driver = await db.driver.findUnique({ where: { id } });
    if (!driver) {
      return errorResponse('NOT_FOUND', 'Driver not found', 404);
    }

    if (driver.status === 'INACTIVE') {
      return errorResponse('BAD_REQUEST', 'Driver is already deactivated', 400);
    }

    const updated = await db.driver.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    return successResponse(updated);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('DELETE /api/drivers/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to deactivate driver', 500);
  }
}
