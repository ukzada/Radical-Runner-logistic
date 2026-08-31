import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const { id } = await params;

    const mc = await db.mC.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, city: true, state: true } },
        _count: { select: { drivers: true } },
      },
    });

    if (!mc) {
      return errorResponse('NOT_FOUND', 'MC not found', 404);
    }

    const drivers = await db.driver.findMany({
      where: { mcId: id },
      include: {
        dispatcherAssignments: {
          include: { dispatcher: { select: { id: true, name: true, email: true } } },
        },
        _count: { select: { loads: true } },
      },
      orderBy: { firstName: 'asc' },
    });

    return successResponse({
      ...mc,
      driverCount: mc._count.drivers,
      drivers: drivers.map((d) => ({
        ...d,
        dispatchers: d.dispatcherAssignments.map((da) => da.dispatcher),
        loadCount: d._count.loads,
        dispatcherAssignments: undefined,
        _count: undefined,
      })),
      _count: undefined,
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/mcs/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch MC', 500);
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

    const mc = await db.mC.findUnique({ where: { id } });
    if (!mc) {
      return errorResponse('NOT_FOUND', 'MC not found', 404);
    }

    const body = await request.json();
    const { mcNumber, status, notes } = body;

    const updateData: Record<string, any> = {};
    if (mcNumber !== undefined) updateData.mcNumber = mcNumber;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes || null;

    const updated = await db.mC.update({ where: { id }, data: updateData });

    return successResponse(updated);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('PUT /api/mcs/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update MC', 500);
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

    const mc = await db.mC.findUnique({ where: { id } });
    if (!mc) {
      return errorResponse('NOT_FOUND', 'MC not found', 404);
    }

    // Check if MC has drivers
    const driverCount = await db.driver.count({ where: { mcId: id } });
    if (driverCount > 0) {
      return errorResponse('BAD_REQUEST', `Cannot deactivate MC with ${driverCount} driver(s). Reassign drivers first.`, 400);
    }

    const updated = await db.mC.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    return successResponse(updated);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('DELETE /api/mcs/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to deactivate MC', 500);
  }
}
