import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN', 'DISPATCHER']);

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    if (!q) return errorResponse('VALIDATION_ERROR', 'Search query "q" is required', 400);
    if (q.length < 2) return errorResponse('VALIDATION_ERROR', 'Search query must be at least 2 characters', 400);

    const driverWhere =
      authUser.role === 'DISPATCHER'
        ? { dispatcherAssignments: { some: { dispatcherId: authUser.userId } } }
        : {};

    const loadWhere =
      authUser.role === 'DISPATCHER'
        ? { createdBy: authUser.userId }
        : {};

    const [drivers, loads, companies, mcs] = await Promise.all([
      db.driver.findMany({
        where: { ...driverWhere, OR: [
          { firstName: { contains: q } }, { lastName: { contains: q } },
          { driverId: { contains: q } }, { email: { contains: q } }, { phone: { contains: q } },
        ] },
        select: { id: true, firstName: true, lastName: true, driverId: true, status: true },
        take: 10,
      }),
      db.load.findMany({
        where: { ...loadWhere, OR: [
          { loadNumber: { contains: q } }, { pickupCity: { contains: q } },
          { deliveryCity: { contains: q } }, { origin: { contains: q } },
          { destination: { contains: q } }, { commodity: { contains: q } },
        ] },
        select: { id: true, loadNumber: true, status: true, origin: true, destination: true, loadPrice: true },
        take: 10,
      }),
      // Only admin can search companies and MCs
      ...(authUser.role === 'ADMIN' ? [
        db.company.findMany({
          where: { OR: [{ name: { contains: q } }, { email: { contains: q } }] },
          select: { id: true, name: true, city: true, state: true },
          take: 5,
        }),
        db.mC.findMany({
          where: { mcNumber: { contains: q } },
          select: { id: true, mcNumber: true, companyId: true,
            company: { select: { name: true } } },
          take: 5,
        }),
      ] : [{}, {}]),
    ]);

    return successResponse({
      query: q,
      results: {
        drivers: drivers.map((d) => ({ ...d, name: `${d.firstName} ${d.lastName}` })),
        loads,
        companies: authUser.role === 'ADMIN' ? companies : [],
        mcs: authUser.role === 'ADMIN' ? mcs.map((m: any) => ({
          ...m, name: `${m.mcNumber} (${m.company?.name || ''})`,
        })) : [],
      },
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/search error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to perform search', 500);
  }
}
