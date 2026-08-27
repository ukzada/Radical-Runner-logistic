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

    const company = await db.company.findUnique({
      where: { id },
    });

    if (!company) {
      return errorResponse('NOT_FOUND', 'Company not found', 404);
    }

    // Get MCs with driver counts
    const mcs = await db.mC.findMany({
      where: { companyId: id },
      include: {
        _count: { select: { drivers: true } },
      },
      orderBy: { mcNumber: 'asc' },
    });

    // Get all drivers under this company's MCs
    const mcIds = mcs.map((m) => m.id);
    const drivers = await db.driver.findMany({
      where: { mcId: { in: mcIds } },
      include: {
        mc: { select: { mcNumber: true, id: true } },
        dispatcherAssignments: {
          include: { dispatcher: { select: { id: true, name: true, email: true } } },
        },
        _count: { select: { loads: true } },
      },
      orderBy: { firstName: 'asc' },
    });

    // Get load stats for all drivers in this company
    const driverIds = drivers.map((d) => d.id);
    const loadAgg = await db.load.aggregate({
      _sum: { loadPrice: true },
      where: { driverId: { in: driverIds } },
    });
    const totalLoadCount = await db.load.count({ where: { driverId: { in: driverIds } } });

    return successResponse({
      ...company,
      mcs: mcs.map((m) => ({
        ...m,
        driverCount: m._count.drivers,
        _count: undefined,
      })),
      drivers: drivers.map((d) => ({
        ...d,
        mcNumber: d.mc?.mcNumber || null,
        mcId: d.mc?.id || null,
        dispatchers: d.dispatcherAssignments.map((da) => da.dispatcher),
        loadCount: d._count.loads,
        dispatcherAssignments: undefined,
        _count: undefined,
        mc: undefined,
      })),
      totalLoadValue: loadAgg._sum.loadPrice || 0,
      totalLoads: totalLoadCount,
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/companies/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch company', 500);
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

    const company = await db.company.findUnique({ where: { id } });
    if (!company) {
      return errorResponse('NOT_FOUND', 'Company not found', 404);
    }

    const body = await request.json();
    const { name, email, phone, address, city, state, zipCode, status, notes } = body;

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (address !== undefined) updateData.address = address || null;
    if (city !== undefined) updateData.city = city || null;
    if (state !== undefined) updateData.state = state || null;
    if (zipCode !== undefined) updateData.zipCode = zipCode || null;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes || null;

    const updated = await db.company.update({ where: { id }, data: updateData });

    return successResponse(updated);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('PUT /api/companies/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update company', 500);
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

    const company = await db.company.findUnique({ where: { id } });
    if (!company) {
      return errorResponse('NOT_FOUND', 'Company not found', 404);
    }

    const updated = await db.company.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    return successResponse(updated);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('DELETE /api/companies/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to deactivate company', 500);
  }
}
