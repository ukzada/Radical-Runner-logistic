import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const body = await request.json();
    const { dispatcherId, driverIds } = body;

    if (!dispatcherId) {
      return errorResponse('VALIDATION_ERROR', 'dispatcherId is required', 400);
    }

    if (!Array.isArray(driverIds) || driverIds.length === 0) {
      return errorResponse('VALIDATION_ERROR', 'driverIds array is required', 400);
    }

    // Verify dispatcher exists and is a DISPATCHER
    const dispatcher = await db.user.findUnique({
      where: { id: dispatcherId, role: 'DISPATCHER' },
    });

    if (!dispatcher) {
      return errorResponse('NOT_FOUND', 'Dispatcher not found', 404);
    }

    // Verify drivers exist
    const drivers = await db.driver.findMany({
      where: { id: { in: driverIds } },
    });

    if (drivers.length !== driverIds.length) {
      return errorResponse('NOT_FOUND', 'One or more drivers not found', 404);
    }

    // Reassign: delete existing assignments and create new ones
    await db.driverDispatcher.deleteMany({
      where: {
        driverId: { in: driverIds },
      },
    });

    await db.driverDispatcher.createMany({
      data: driverIds.map((driverId: string) => ({
        driverId,
        dispatcherId,
      })),
    });

    return successResponse({
      reassigned: driverIds.length,
      dispatcherId,
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('POST /api/drivers/assign error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to assign drivers', 500);
  }
}
