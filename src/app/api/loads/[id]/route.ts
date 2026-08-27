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

    const load = await db.load.findUnique({
      where: { id },
      include: {
        driver: {
          include: {
            mc: { select: { id: true, mcNumber: true, company: { select: { id: true, name: true } } } },
          },
        },
        dispatcher: { select: { id: true, name: true, email: true } },
      },
    });

    if (!load) {
      return errorResponse('NOT_FOUND', 'Load not found', 404);
    }

    if (authUser.role === 'DISPATCHER' && load.createdBy !== authUser.userId) {
      return errorResponse('FORBIDDEN', 'You can only view your own loads', 403);
    }

    return successResponse({
      ...load,
      driverName: load.driver ? `${load.driver.firstName} ${load.driver.lastName}` : null,
      dispatcherName: load.dispatcher?.name || null,
      mcNumber: load.driver?.mc?.mcNumber || null,
      mcId: load.driver?.mc?.id || null,
      companyId: load.driver?.mc?.company?.id || null,
      companyName: load.driver?.mc?.company?.name || null,
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/loads/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch load', 500);
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

    const load = await db.load.findUnique({ where: { id } });
    if (!load) {
      return errorResponse('NOT_FOUND', 'Load not found', 404);
    }

    if (authUser.role === 'DISPATCHER' && load.createdBy !== authUser.userId) {
      return errorResponse('FORBIDDEN', 'You can only update your own loads', 403);
    }

    const body = await request.json();
    const { driverId, status, loadDate, pickupDate, deliveryDate,
      pickupCity, pickupState, deliveryCity, deliveryState,
      loadPrice, commodity, notes } = body;

    const updateData: Record<string, any> = {};
    if (driverId !== undefined) updateData.driverId = driverId || null;
    if (status !== undefined) updateData.status = status;
    if (loadDate !== undefined) updateData.loadDate = loadDate ? new Date(loadDate) : null;
    if (pickupDate !== undefined) updateData.pickupDate = pickupDate ? new Date(pickupDate) : null;
    if (deliveryDate !== undefined) updateData.deliveryDate = deliveryDate ? new Date(deliveryDate) : null;
    if (pickupCity !== undefined) updateData.pickupCity = pickupCity || null;
    if (pickupState !== undefined) updateData.pickupState = pickupState || null;
    if (deliveryCity !== undefined) updateData.deliveryCity = deliveryCity || null;
    if (deliveryState !== undefined) updateData.deliveryState = deliveryState || null;
    if (loadPrice !== undefined) updateData.loadPrice = loadPrice || 0;
    if (commodity !== undefined) updateData.commodity = commodity || null;
    if (notes !== undefined) updateData.notes = notes || null;

    if (pickupCity !== undefined || pickupState !== undefined) {
      const pc = pickupCity ?? load.pickupCity ?? '';
      const ps = pickupState ?? load.pickupState ?? '';
      updateData.origin = pc ? `${pc}, ${ps}`.trim() : null;
    }
    if (deliveryCity !== undefined || deliveryState !== undefined) {
      const dc = deliveryCity ?? load.deliveryCity ?? '';
      const ds = deliveryState ?? load.deliveryState ?? '';
      updateData.destination = dc ? `${dc}, ${ds}`.trim() : null;
    }

    const updated = await db.load.update({
      where: { id },
      data: updateData,
      include: {
        driver: {
          select: { id: true, firstName: true, lastName: true,
            mc: { select: { id: true, mcNumber: true, company: { select: { id: true, name: true } } } } },
        },
        dispatcher: { select: { id: true, name: true, email: true } },
      },
    });

    return successResponse({
      ...updated,
      driverName: updated.driver ? `${updated.driver.firstName} ${updated.driver.lastName}` : null,
      dispatcherName: updated.dispatcher?.name || null,
      mcNumber: updated.driver?.mc?.mcNumber || null,
      companyName: updated.driver?.mc?.company?.name || null,
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('PUT /api/loads/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update load', 500);
  }
}
