import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';

/**
 * GET /api/owner/trucks
 * Company-owner fleet overview: every driver (truck) in the owner's company
 * with live occupancy status, last known location, and paid/pending earnings.
 */
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['COMPANY_OWNER']);

    const owner = await db.user.findUnique({
      where: { id: authUser.userId },
      select: { companyId: true },
    });

    if (!owner?.companyId) {
      return errorResponse('NO_COMPANY', 'Your account is not linked to a company', 400);
    }

    const drivers = await db.driver.findMany({
      where: { companyId: owner.companyId },
      include: { mc: { select: { mcNumber: true } } },
      orderBy: { firstName: 'asc' },
    });

    const trucks = await Promise.all(
      drivers.map(async (d) => {
        const loads = await db.load.findMany({
          where: { driverId: d.id },
          orderBy: { loadDate: 'desc' },
        });

        const paid = loads
          .filter((l) => l.status === 'DELIVERED')
          .reduce((sum, l) => sum + (l.loadPrice || 0), 0);
        const pending = loads
          .filter((l) => l.status !== 'DELIVERED' && l.status !== 'CANCELLED')
          .reduce((sum, l) => sum + (l.loadPrice || 0), 0);

        const activeLoad =
          loads.find((l) => l.status !== 'DELIVERED' && l.status !== 'CANCELLED') || null;
        const lastDelivered = loads.find((l) => l.status === 'DELIVERED');

        const truckStatus: 'EMPTY' | 'BOOKED' | 'OFF_DUTY' =
          d.status === 'OFF_DUTY' || d.status === 'INACTIVE'
            ? 'OFF_DUTY'
            : activeLoad
              ? 'BOOKED'
              : 'EMPTY';

        return {
          id: d.id,
          driverId: d.driverId,
          driverName: `${d.firstName} ${d.lastName}`,
          phone: d.phone,
          truckType: d.truckType,
          driverStatus: d.status,
          cdlExpiration: d.cdlExpiration,
          mcNumber: d.mc?.mcNumber || null,
          truckStatus,
          activeLoad: activeLoad
            ? {
                id: activeLoad.id,
                loadNumber: activeLoad.loadNumber,
                status: activeLoad.status,
                loadPrice: activeLoad.loadPrice,
                pickupCity: activeLoad.pickupCity,
                pickupState: activeLoad.pickupState,
                deliveryCity: activeLoad.deliveryCity,
                deliveryState: activeLoad.deliveryState,
              }
            : null,
          lastLocation: lastDelivered?.destination
            ? { location: lastDelivered.destination, updatedAt: lastDelivered.deliveryDate || lastDelivered.updatedAt }
            : null,
          earnings: {
            paid,
            pending,
            totalLoads: loads.length,
            paidLoads: loads.filter((l) => l.status === 'DELIVERED').length,
            pendingLoads: loads.filter((l) => !['DELIVERED', 'CANCELLED'].includes(l.status)).length,
          },
        };
      })
    );

    const kpis = {
      totalTrucks: trucks.length,
      booked: trucks.filter((t) => t.truckStatus === 'BOOKED').length,
      empty: trucks.filter((t) => t.truckStatus === 'EMPTY').length,
      offDuty: trucks.filter((t) => t.truckStatus === 'OFF_DUTY').length,
      totalPaidEarnings: trucks.reduce((sum, t) => sum + t.earnings.paid, 0),
      totalPendingEarnings: trucks.reduce((sum, t) => sum + t.earnings.pending, 0),
      totalLoads: trucks.reduce((sum, t) => sum + t.earnings.totalLoads, 0),
    };

    return successResponse({ kpis, trucks });
  } catch (error: any) {
    if (error.status) {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('Owner fleet error:', error);
    return errorResponse('OWNER_FLEET_ERROR', error.message || 'Failed to load fleet', 500);
  }
}
