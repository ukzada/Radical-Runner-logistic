import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN', 'DISPATCHER']);

    if (authUser.role === 'ADMIN') {
      return adminDashboard();
    }
    return dispatcherDashboard(authUser.userId);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/dashboard error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch dashboard data', 500);
  }
}

async function adminDashboard() {
  const [
    totalCompanies,
    totalMCs,
    totalDispatchers,
    activeDispatchers,
    totalDrivers,
  ] = await Promise.all([
    db.company.count({ where: { status: 'ACTIVE' } }),
    db.mC.count({ where: { status: 'ACTIVE' } }),
    db.user.count({ where: { role: 'DISPATCHER' } }),
    db.user.count({ where: { role: 'DISPATCHER', isActive: true } }),
    db.driver.count(),
  ]);

  // Assigned / unassigned drivers
  const allAssignments = await db.driverDispatcher.findMany({ select: { driverId: true } });
  const assignedDriverIds = new Set(allAssignments.map((a) => a.driverId));
  const assignedDrivers = assignedDriverIds.size;
  const unassignedDrivers = totalDrivers - assignedDrivers;

  // Load stats
  const allLoads = await db.load.findMany({
    select: { status: true, loadPrice: true, createdBy: true, createdAt: true, id: true },
  });
  const totalLoads = allLoads.length;
  const totalLoadValue = allLoads.reduce((sum, l) => sum + l.loadPrice, 0);

  const loadsByStatus: Record<string, number> = {};
  for (const load of allLoads) {
    loadsByStatus[load.status] = (loadsByStatus[load.status] || 0) + 1;
  }

  // Recent loads
  const recentLoadIds = allLoads
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10).map((l) => l.id);

  const recentLoadsRaw = await db.load.findMany({
    where: { id: { in: recentLoadIds } },
    include: {
      driver: {
        select: { firstName: true, lastName: true,
          mc: { select: { mcNumber: true, company: { select: { name: true } } } } },
      },
      dispatcher: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const recentLoads = recentLoadsRaw.map((l) => ({
    id: l.id, loadNumber: l.loadNumber, status: l.status,
    pickupCity: l.pickupCity, pickupState: l.pickupState,
    deliveryCity: l.deliveryCity, deliveryState: l.deliveryState,
    origin: l.origin, destination: l.destination,
    loadPrice: l.loadPrice, commodity: l.commodity, createdAt: l.createdAt,
    driverName: l.driver ? `${l.driver.firstName} ${l.driver.lastName}` : null,
    companyName: l.driver?.mc?.company?.name || null,
    dispatcherName: l.dispatcher?.name || null,
  }));

  // Dispatcher performance
  const dispatcherList = await db.user.findMany({
    where: { role: 'DISPATCHER' },
    include: { _count: { select: { driverAssignments: true } } },
  });

  const dispatcherPerformance = dispatcherList.map((d) => {
    const dispatcherLoads = allLoads.filter((l) => l.createdBy === d.id);
    const dispatcherLoadValue = dispatcherLoads.reduce((sum, l) => sum + l.loadPrice, 0);
    const deliveredLoads = dispatcherLoads.filter((l) => l.status === 'DELIVERED');
    return {
      id: d.id, userId: d.id, name: d.name, email: d.email, isActive: d.isActive,
      driverCount: d._count.driverAssignments,
      loadCount: dispatcherLoads.length, totalLoadValue: dispatcherLoadValue, deliveredLoads: deliveredLoads.length,
    };
  });

  return successResponse({
    role: 'ADMIN',
    totalCompanies, totalMCs,
    totalDispatchers, activeDispatchers,
    totalDrivers, assignedDrivers, unassignedDrivers,
    totalLoads, loadsByStatus, totalLoadValue,
    recentLoads, dispatcherPerformance,
  });
}

async function dispatcherDashboard(dispatcherId: string) {
  const assignedDriverCount = await db.driverDispatcher.count({ where: { dispatcherId } });

  // Count active drivers
  const activeDriverCount = await db.driverDispatcher.findMany({
    where: { dispatcherId },
    include: { driver: { select: { status: true } } },
  }).then((assignments) => assignments.filter((a) => a.driver.status === 'ACTIVE').length);

  const allLoads = await db.load.findMany({
    where: { createdBy: dispatcherId },
    select: { status: true, loadPrice: true, createdAt: true, id: true },
  });

  const totalLoads = allLoads.length;
  const totalLoadValue = allLoads.reduce((sum, l) => sum + l.loadPrice, 0);
  const completedLoads = allLoads.filter((l) => l.status === 'DELIVERED').length;

  const loadsByStatus: Record<string, number> = {};
  for (const load of allLoads) {
    loadsByStatus[load.status] = (loadsByStatus[load.status] || 0) + 1;
  }

  const recentLoadIds = allLoads
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10).map((l) => l.id);

  const recentLoadsRaw = await db.load.findMany({
    where: { id: { in: recentLoadIds } },
    include: {
      driver: {
        select: { firstName: true, lastName: true,
          mc: { select: { mcNumber: true, company: { select: { name: true } } } } },
      },
      dispatcher: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const recentLoads = recentLoadsRaw.map((l) => ({
    id: l.id, loadNumber: l.loadNumber, status: l.status,
    pickupCity: l.pickupCity, pickupState: l.pickupState,
    deliveryCity: l.deliveryCity, deliveryState: l.deliveryState,
    origin: l.origin, destination: l.destination,
    loadPrice: l.loadPrice, commodity: l.commodity, createdAt: l.createdAt,
    driverName: l.driver ? `${l.driver.firstName} ${l.driver.lastName}` : null,
    companyName: l.driver?.mc?.company?.name || null,
    dispatcherName: l.dispatcher?.name || null,
  }));

  const recentActivity = await db.auditLog.findMany({
    where: { userId: dispatcherId },
    orderBy: { createdAt: 'desc' }, take: 10,
    include: { user: { select: { name: true } } },
  });

  return successResponse({
    role: 'DISPATCHER',
    assignedDriverCount, activeDriverCount,
    totalLoads, completedLoads, loadsByStatus, totalLoadValue,
    recentLoads, recentActivity,
  });
}
