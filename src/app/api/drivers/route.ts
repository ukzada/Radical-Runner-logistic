import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';
import { parsePagination, buildPaginationMeta } from '@/lib/utils';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN', 'DISPATCHER']);

    const { searchParams } = new URL(request.url);
    const { page, limit, sortBy, sortOrder } = parsePagination(searchParams);
    const search = (searchParams.get('search') || '').trim();
    const status = searchParams.get('status') || '';
    const mcId = searchParams.get('mcId') || '';
    const companyId = searchParams.get('companyId') || '';
    const assigned = searchParams.get('assigned') || '';

    const where: Prisma.DriverWhereInput = {};

    // DISPATCHER sees only their assigned drivers
    if (authUser.role === 'DISPATCHER') {
      const assignedDriverIds = await db.driverDispatcher
        .findMany({ where: { dispatcherId: authUser.userId }, select: { driverId: true } })
        .then((a) => a.map((d) => d.driverId));
      where.id = { in: assignedDriverIds };
    }

    // Filter by MC
    if (mcId) {
      where.mcId = mcId;
    }

    // Filter by company (through MCs)
    if (companyId) {
      const companyMcIds = await db.mC.findMany({
        where: { companyId },
        select: { id: true },
      }).then((mcs) => mcs.map((m) => m.id));
      where.mcId = { in: companyMcIds };
    }

    // Filter by assignment status
    if (assigned === 'yes') {
      where.dispatcherAssignments = { some: {} };
    } else if (assigned === 'no') {
      where.dispatcherAssignments = { none: {} };
    }

    if (search) {
      where.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { driverId: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [drivers, total] = await Promise.all([
      db.driver.findMany({
        where,
        include: {
          mc: { select: { id: true, mcNumber: true, company: { select: { id: true, name: true } } } },
          dispatcherAssignments: {
            include: { dispatcher: { select: { id: true, name: true, email: true } } },
          },
          _count: { select: { loads: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.driver.count({ where }),
    ]);

    const result = drivers.map((d) => ({
      ...d,
      mcNumber: d.mc?.mcNumber || null,
      mcId: d.mc?.id || null,
      companyName: d.mc?.company?.name || null,
      companyId: d.mc?.company?.id || null,
      dispatchers: d.dispatcherAssignments.map((da) => da.dispatcher),
      loadCount: d._count.loads,
      dispatcherAssignments: undefined,
      _count: undefined,
      mc: undefined,
    }));

    return successResponse({
      drivers: result,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/drivers error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch drivers', 500);
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const body = await request.json();
    const { firstName, lastName, phone, email, driverId, cdlNumber, cdlState, cdlExpiration, status, notes, mcId, companyId, truckType } = body;

    if (!firstName || !lastName) {
      return errorResponse('VALIDATION_ERROR', 'First name and last name are required', 400);
    }

    // Validate mcId if provided
    if (mcId) {
      const mcExists = await db.mC.findUnique({ where: { id: mcId } });
      if (!mcExists) {
        return errorResponse('VALIDATION_ERROR', 'MC not found', 400);
      }
    }

    // Validate companyId if provided
    if (companyId) {
      const companyExists = await db.company.findUnique({ where: { id: companyId } });
      if (!companyExists) {
        return errorResponse('VALIDATION_ERROR', 'Company not found', 400);
      }
    }

    const driver = await db.driver.create({
      data: {
        firstName,
        lastName,
        phone: phone || null,
        email: email || null,
        driverId: driverId || null,
        cdlNumber: cdlNumber || null,
        cdlState: cdlState || null,
        cdlExpiration: cdlExpiration ? new Date(cdlExpiration) : null,
        status: status || 'ACTIVE',
        notes: notes || null,
        mcId: mcId || null,
        companyId: companyId || null,
        truckType: truckType || null,
      },
    });

    return successResponse(driver, 201);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('POST /api/drivers error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create driver', 500);
  }
}
