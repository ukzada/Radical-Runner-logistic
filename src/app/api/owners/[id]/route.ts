import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';
import { hashPassword } from '@/lib/auth';

/**
 * GET /api/owners/[id] — Admin views one company owner: profile + company + fleet KPIs + trucks.
 * PUT /api/owners/[id] — Admin updates owner info (name, email, phone, company, password, status).
 * DELETE /api/owners/[id] — Admin deactivates the owner (soft delete).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const { id } = await params;

    const owner = await db.user.findUnique({
      where: { id, role: 'COMPANY_OWNER' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        companyId: true,
        company: { select: { id: true, name: true, status: true, city: true, state: true, email: true, phone: true } },
      },
    });

    if (!owner) {
      return errorResponse('NOT_FOUND', 'Company owner not found', 404);
    }

    // Fleet = drivers of the owner's company
    const fleet = owner.companyId
      ? await db.driver.findMany({
          where: { companyId: owner.companyId },
          include: { mc: { select: { mcNumber: true } } },
          orderBy: { firstName: 'asc' },
        })
      : [];

    const fleetIds = fleet.map((d) => d.id);

    const [paidAgg, pendingAgg] = fleetIds.length
      ? await Promise.all([
          db.load.groupBy({
            by: ['driverId'],
            _sum: { loadPrice: true },
            _count: { _all: true },
            where: { driverId: { in: fleetIds }, status: 'DELIVERED' },
          }),
          db.load.groupBy({
            by: ['driverId'],
            _sum: { loadPrice: true },
            _count: { _all: true },
            where: { driverId: { in: fleetIds }, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
          }),
        ])
      : [[], []];

    const perDriver = new Map<string, { paid: number; pending: number; loads: number }>();
    let totalPaid = 0;
    let totalPending = 0;
    let totalLoads = 0;
    for (const row of paidAgg) {
      const entry = perDriver.get(row.driverId!) || { paid: 0, pending: 0, loads: 0 };
      entry.paid = row._sum.loadPrice || 0;
      entry.loads += row._count._all;
      perDriver.set(row.driverId!, entry);
      totalPaid += row._sum.loadPrice || 0;
      totalLoads += row._count._all;
    }
    for (const row of pendingAgg) {
      const entry = perDriver.get(row.driverId!) || { paid: 0, pending: 0, loads: 0 };
      entry.pending = row._sum.loadPrice || 0;
      entry.loads += row._count._all;
      perDriver.set(row.driverId!, entry);
      totalPending += row._sum.loadPrice || 0;
      totalLoads += row._count._all;
    }

    const trucks = fleet.map((d) => {
      const stats = perDriver.get(d.id) || { paid: 0, pending: 0, loads: 0 };
      return {
        id: d.id,
        driverName: `${d.firstName} ${d.lastName}`,
        driverId: d.driverId,
        truckType: d.truckType,
        status: d.status,
        mcNumber: d.mc?.mcNumber || null,
        loads: stats.loads,
        paidEarnings: stats.paid,
        pendingEarnings: stats.pending,
      };
    });

    return successResponse({
      ...owner,
      kpis: {
        truckCount: trucks.length,
        totalLoads,
        paidEarnings: totalPaid,
        pendingEarnings: totalPending,
      },
      trucks,
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/owners/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch company owner', 500);
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

    const owner = await db.user.findUnique({ where: { id, role: 'COMPANY_OWNER' } });
    if (!owner) {
      return errorResponse('NOT_FOUND', 'Company owner not found', 404);
    }

    const body = await request.json();
    const { name, email, phone, companyId, isActive, password } = body;

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (email !== undefined && email.toLowerCase() !== owner.email) {
      const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existing) {
        return errorResponse('DUPLICATE_EMAIL', 'A user with this email already exists', 409);
      }
      updateData.email = email.toLowerCase();
    }

    if (companyId !== undefined && companyId !== owner.companyId) {
      if (!companyId) {
        return errorResponse('VALIDATION_ERROR', 'A company owner must remain linked to a company', 400);
      }
      const company = await db.company.findUnique({ where: { id: companyId } });
      if (!company) {
        return errorResponse('VALIDATION_ERROR', 'Company not found', 400);
      }
      updateData.companyId = companyId;
    }

    if (password) {
      if (password.length < 8) {
        return errorResponse('VALIDATION_ERROR', 'Password must be at least 8 characters', 400);
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
        return errorResponse('VALIDATION_ERROR', 'Password must contain uppercase, lowercase, and a number', 400);
      }
      updateData.passwordHash = await hashPassword(password);
    }

    const oldValues = JSON.stringify({
      name: owner.name, email: owner.email, phone: owner.phone,
      companyId: owner.companyId, isActive: owner.isActive,
    });

    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, email: true, name: true, phone: true,
        role: true, isActive: true, companyId: true, createdAt: true, updatedAt: true,
      },
    });

    await db.auditLog.create({
      data: {
        userId: authUser.userId,
        action: 'COMPANY_OWNER_UPDATED',
        entityType: 'User',
        entityId: id,
        oldValues,
        newValues: JSON.stringify({
          name: updated.name, email: updated.email, phone: updated.phone,
          companyId: updated.companyId, isActive: updated.isActive,
        }),
      },
    });

    return successResponse(updated);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('PUT /api/owners/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update company owner', 500);
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

    const owner = await db.user.findUnique({ where: { id, role: 'COMPANY_OWNER' } });
    if (!owner) {
      return errorResponse('NOT_FOUND', 'Company owner not found', 404);
    }

    const updated = await db.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, email: true, isActive: true },
    });

    await db.auditLog.create({
      data: {
        userId: authUser.userId,
        action: 'COMPANY_OWNER_DEACTIVATED',
        entityType: 'User',
        entityId: id,
        oldValues: JSON.stringify({ isActive: owner.isActive }),
        newValues: JSON.stringify({ isActive: false }),
      },
    });

    return successResponse({ message: `Owner ${owner.email} has been deactivated`, ...updated });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('DELETE /api/owners/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to deactivate company owner', 500);
  }
}
