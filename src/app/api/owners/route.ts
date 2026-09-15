import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';
import { hashPassword } from '@/lib/auth';
import { parsePagination, buildPaginationMeta } from '@/lib/utils';
import { Prisma } from '@prisma/client';

/**
 * GET /api/owners — Admin lists all company owners with company + fleet stats.
 * POST /api/owners — Admin creates a new company owner (linked to a company).
 */

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const { searchParams } = new URL(request.url);
    const { page, limit, sortBy, sortOrder } = parsePagination(searchParams);
    const search = (searchParams.get('search') || '').trim();
    const status = searchParams.get('status') || '';

    const where: Prisma.UserWhereInput = { role: 'COMPANY_OWNER' };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { company: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (status === 'active') where.isActive = true;
    else if (status === 'inactive') where.isActive = false;

    const [owners, total] = await Promise.all([
      db.user.findMany({
        where,
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
          company: { select: { id: true, name: true, status: true, city: true, state: true } },
        },
        orderBy: { [sortBy === 'name' ? 'name' : 'createdAt']: sortBy === 'name' ? 'asc' : sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    // Fleet + earnings stats per owner's company (batched: 3 queries total)
    const companyIds = owners.map((o) => o.companyId).filter((c): c is string => !!c);
    const drivers = companyIds.length
      ? await db.driver.findMany({
          where: { companyId: { in: companyIds } },
          select: { id: true, companyId: true },
        })
      : [];
    const companyDriverIds = new Map<string, string[]>();
    const driverToCompany = new Map<string, string>();
    for (const d of drivers) {
      driverToCompany.set(d.id, d.companyId);
      const list = companyDriverIds.get(d.companyId) || [];
      list.push(d.id);
      companyDriverIds.set(d.companyId, list);
    }
    const allDriverIds = drivers.map((d) => d.id);

    const [paidAgg, pendingAgg] = allDriverIds.length
      ? await Promise.all([
          db.load.groupBy({
            by: ['driverId'],
            _sum: { loadPrice: true },
            _count: { _all: true },
            where: { driverId: { in: allDriverIds }, status: 'DELIVERED' },
          }),
          db.load.groupBy({
            by: ['driverId'],
            _sum: { loadPrice: true },
            _count: { _all: true },
            where: { driverId: { in: allDriverIds }, status: { notIn: ['DELIVERED', 'CANCELLED'] } },
          }),
        ])
      : [[], []];

    const companyStats: Record<string, { truckCount: number; totalLoads: number; paidEarnings: number; pendingEarnings: number }> = {};
    for (const companyId of companyIds) {
      companyStats[companyId] = {
        truckCount: companyDriverIds.get(companyId)?.length || 0,
        totalLoads: 0,
        paidEarnings: 0,
        pendingEarnings: 0,
      };
    }
    for (const row of paidAgg) {
      const companyId = row.driverId ? driverToCompany.get(row.driverId) : undefined;
      if (!companyId || !companyStats[companyId]) continue;
      companyStats[companyId].paidEarnings += row._sum.loadPrice || 0;
      companyStats[companyId].totalLoads += row._count._all;
    }
    for (const row of pendingAgg) {
      const companyId = row.driverId ? driverToCompany.get(row.driverId) : undefined;
      if (!companyId || !companyStats[companyId]) continue;
      companyStats[companyId].pendingEarnings += row._sum.loadPrice || 0;
      companyStats[companyId].totalLoads += row._count._all;
    }

    const result = owners.map((o) => ({
      ...o,
      companyName: o.company?.name || null,
      truckCount: o.companyId ? companyStats[o.companyId]?.truckCount || 0 : 0,
      totalLoads: o.companyId ? companyStats[o.companyId]?.totalLoads || 0 : 0,
      paidEarnings: o.companyId ? companyStats[o.companyId]?.paidEarnings || 0 : 0,
      pendingEarnings: o.companyId ? companyStats[o.companyId]?.pendingEarnings || 0 : 0,
    }));

    return successResponse({ owners: result, meta: buildPaginationMeta(total, page, limit) });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/owners error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch company owners', 500);
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const body = await request.json();
    const { name, email, password, phone, companyId, isActive } = body;

    if (!email || !password) {
      return errorResponse('VALIDATION_ERROR', 'Email and password are required', 400);
    }
    if (!companyId) {
      return errorResponse('VALIDATION_ERROR', 'A company must be selected for the owner', 400);
    }

    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return errorResponse('VALIDATION_ERROR', 'Company not found', 400);
    }

    if (password.length < 8) {
      return errorResponse('VALIDATION_ERROR', 'Password must be at least 8 characters', 400);
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return errorResponse('VALIDATION_ERROR', 'Password must contain uppercase, lowercase, and a number', 400);
    }

    const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return errorResponse('DUPLICATE_EMAIL', 'A user with this email already exists', 409);
    }

    const passwordHash = await hashPassword(password);

    const owner = await db.user.create({
      data: {
        email: email.toLowerCase(),
        passwordHash,
        name: name || null,
        phone: phone || null,
        role: 'COMPANY_OWNER',
        companyId,
        isActive: isActive !== false,
      },
      select: {
        id: true, email: true, name: true, phone: true,
        role: true, isActive: true, companyId: true, createdAt: true,
      },
    });

    await db.auditLog.create({
      data: {
        userId: authUser.userId,
        action: 'COMPANY_OWNER_CREATED',
        entityType: 'User',
        entityId: owner.id,
        newValues: JSON.stringify({ email: owner.email, companyId, isActive: owner.isActive }),
      },
    });

    return successResponse(owner, 201);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('POST /api/owners error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create company owner', 500);
  }
}
