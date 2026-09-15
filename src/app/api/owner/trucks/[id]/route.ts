import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';

/**
 * GET /api/owner/trucks/[id]
 * Company-owner view of one truck (driver) in their company:
 * driver identity + earnings + full load history (last 100).
 * Enforces that the driver belongs to the owner's company.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const driver = await db.driver.findFirst({
      where: { id, companyId: owner.companyId },
      include: { mc: { select: { mcNumber: true } } },
    });

    if (!driver) {
      return errorResponse('NOT_FOUND', 'Truck not found in your fleet', 404);
    }

    const loads = await db.load.findMany({
      where: { driverId: driver.id },
      orderBy: { loadDate: 'desc' },
      take: 100,
      include: {
        dispatcher: { select: { name: true, email: true, feePercentage: true } },
      },
    });

    const paid = loads
      .filter((l) => l.status === 'DELIVERED')
      .reduce((sum, l) => sum + (l.loadPrice || 0), 0);
    const pending = loads
      .filter((l) => l.status !== 'DELIVERED' && l.status !== 'CANCELLED')
      .reduce((sum, l) => sum + (l.loadPrice || 0), 0);

    const activeLoad = loads.find((l) => l.status !== 'DELIVERED' && l.status !== 'CANCELLED') || null;

    const lastDelivered = loads.find((l) => l.status === 'DELIVERED');

    // Dispatcher fees: percentage of load price per dispatching user; none on cancelled loads
    const loadFee = (l: (typeof loads)[number]) =>
      l.status === 'CANCELLED' || !l.dispatcher
        ? 0
        : ((l.loadPrice || 0) * (l.dispatcher.feePercentage || 0)) / 100;
    const dispatcherFees = loads.reduce((sum, l) => sum + loadFee(l), 0);

    return successResponse({
      truck: {
        id: driver.id,
        driverId: driver.driverId,
        driverName: `${driver.firstName} ${driver.lastName}`,
        phone: driver.phone,
        email: driver.email,
        truckType: driver.truckType,
        driverStatus: driver.status,
        cdlNumber: driver.cdlNumber,
        cdlState: driver.cdlState,
        cdlExpiration: driver.cdlExpiration,
        mcNumber: driver.mc?.mcNumber || null,
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
      },
      earnings: {
        paid,
        pending,
        totalLoads: loads.length,
        deliveredLoads: loads.filter((l) => l.status === 'DELIVERED').length,
        activeLoads: loads.filter((l) => !['DELIVERED', 'CANCELLED'].includes(l.status)).length,
        dispatcherFees,
        netTotal: paid + pending - dispatcherFees,
      },
      loadHistory: loads.map((l) => ({
        id: l.id,
        loadNumber: l.loadNumber,
        status: l.status,
        origin: l.origin,
        destination: l.destination,
        loadPrice: l.loadPrice,
        commodity: l.commodity,
        loadDate: l.loadDate,
        pickupDate: l.pickupDate,
        deliveryDate: l.deliveryDate,
        dispatcherName: l.dispatcher?.name || l.dispatcher?.email || null,
        dispatcherFeePercent: l.dispatcher ? l.dispatcher.feePercentage || 0 : null,
        dispatcherFee: loadFee(l),
      })),
    });
  } catch (error: any) {
    if (error.status) {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('Owner truck detail error:', error);
    return errorResponse('OWNER_TRUCK_DETAIL_ERROR', error.message || 'Failed to load truck', 500);
  }
}
