import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';
import { parsePagination, buildPaginationMeta, generateLoadNumber } from '@/lib/utils';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN', 'DISPATCHER']);

    const { searchParams } = new URL(request.url);
    const { page, limit, sortBy, sortOrder } = parsePagination(searchParams);
    const status = searchParams.get('status') || '';
    const driverId = searchParams.get('driverId') || '';
    const dispatcherId = searchParams.get('dispatcherId') || '';
    const companyId = searchParams.get('companyId') || '';
    const dateFrom = searchParams.get('dateFrom') || '';
    const dateTo = searchParams.get('dateTo') || '';
    const search = (searchParams.get('search') || '').trim();

    const where: Prisma.LoadWhereInput = {};

    if (authUser.role === 'DISPATCHER') {
      where.createdBy = authUser.userId;
    }

    if (status) where.status = status;
    if (driverId) where.driverId = driverId;
    if (dispatcherId && authUser.role === 'ADMIN') where.createdBy = dispatcherId;

    // Filter by company (through driver -> MC -> company)
    if (companyId) {
      const companyMcIds = await db.mC.findMany({
        where: { companyId },
        select: { id: true },
      }).then((mcs) => mcs.map((m) => m.id));
      const companyDriverIds = await db.driver.findMany({
        where: { mcId: { in: companyMcIds } },
        select: { id: true },
      }).then((d) => d.map((dr) => dr.id));
      where.driverId = { in: companyDriverIds };
    }

    if (dateFrom || dateTo) {
      where.loadDate = {} as any;
      if (dateFrom) (where.loadDate as any).gte = new Date(dateFrom);
      if (dateTo) (where.loadDate as any).lte = new Date(dateTo);
    }

    if (search) {
      where.OR = [
        { loadNumber: { contains: search } },
        { pickupCity: { contains: search } }, { pickupState: { contains: search } },
        { deliveryCity: { contains: search } }, { deliveryState: { contains: search } },
        { origin: { contains: search } }, { destination: { contains: search } },
        { commodity: { contains: search } },
      ];
    }

    const [loads, total] = await Promise.all([
      db.load.findMany({
        where,
        include: {
          driver: {
            select: { id: true, firstName: true, lastName: true, driverId: true, status: true,
              mc: { select: { id: true, mcNumber: true, company: { select: { id: true, name: true } } } } },
          },
          dispatcher: { select: { id: true, name: true, email: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.load.count({ where }),
    ]);

    const result = loads.map((l) => ({
      ...l,
      driverName: l.driver ? `${l.driver.firstName} ${l.driver.lastName}` : null,
      dispatcherName: l.dispatcher?.name || null,
      mcNumber: l.driver?.mc?.mcNumber || null,
      companyId: l.driver?.mc?.company?.id || null,
      companyName: l.driver?.mc?.company?.name || null,
    }));

    return successResponse({ loads: result, meta: buildPaginationMeta(total, page, limit) });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/loads error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch loads', 500);
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN', 'DISPATCHER']);

    const body = await request.json();
    const { driverId, status, loadDate, pickupDate, deliveryDate,
      pickupCity, pickupState, deliveryCity, deliveryState,
      loadPrice, commodity, notes } = body;

    const origin = pickupCity ? `${pickupCity}, ${pickupState || ''}`.trim() : undefined;
    const destination = deliveryCity ? `${deliveryCity}, ${deliveryState || ''}`.trim() : undefined;

    const load = await db.load.create({
      data: {
        loadNumber: generateLoadNumber(),
        driverId: driverId || null,
        createdBy: authUser.userId,
        status: status || 'AVAILABLE',
        loadDate: loadDate ? new Date(loadDate) : null,
        pickupDate: pickupDate ? new Date(pickupDate) : null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        pickupCity: pickupCity || null,
        pickupState: pickupState || null,
        deliveryCity: deliveryCity || null,
        deliveryState: deliveryState || null,
        origin: origin || null,
        destination: destination || null,
        loadPrice: loadPrice || 0,
        commodity: commodity || null,
        notes: notes || null,
      },
      include: {
        driver: {
          select: { id: true, firstName: true, lastName: true,
            mc: { select: { id: true, mcNumber: true, company: { select: { id: true, name: true } } } } },
        },
        dispatcher: { select: { id: true, name: true, email: true } },
      },
    });

    return successResponse({
      ...load,
      driverName: load.driver ? `${load.driver.firstName} ${load.driver.lastName}` : null,
      dispatcherName: load.dispatcher?.name || null,
      mcNumber: load.driver?.mc?.mcNumber || null,
      companyName: load.driver?.mc?.company?.name || null,
    }, 201);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('POST /api/loads error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create load', 500);
  }
}
