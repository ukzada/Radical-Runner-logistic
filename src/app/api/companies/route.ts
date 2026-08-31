import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';
import { parsePagination, buildPaginationMeta } from '@/lib/utils';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const { searchParams } = new URL(request.url);
    const { page, limit, sortBy, sortOrder } = parsePagination(searchParams);
    const search = (searchParams.get('search') || '').trim();
    const status = searchParams.get('status') || '';

    const where: Prisma.CompanyWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
        { city: { contains: search } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [companies, total] = await Promise.all([
      db.company.findMany({
        where,
        include: {
          _count: {
            select: { mcs: true },
          },
        },
        orderBy: { [sortBy === 'name' ? 'name' : 'createdAt']: sortBy === 'name' ? 'asc' : sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.company.count({ where }),
    ]);

    // Get driver and load counts per company via MCs
    const companyIds = companies.map((c) => c.id);
    const mcData = await db.mC.findMany({
      where: { companyId: { in: companyIds } },
      select: { companyId: true, id: true, _count: { select: { drivers: true } } },
    });

    const companyStats: Record<string, { driverCount: number }> = {};
    for (const mc of mcData) {
      if (!companyStats[mc.companyId]) companyStats[mc.companyId] = { driverCount: 0 };
      companyStats[mc.companyId].driverCount += mc._count.drivers;
    }

    const result = companies.map((c) => ({
      ...c,
      mcCount: c._count.mcs,
      driverCount: companyStats[c.id]?.driverCount || 0,
      _count: undefined,
    }));

    return successResponse({
      companies: result,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/companies error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch companies', 500);
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const body = await request.json();
    const { name, email, phone, address, city, state, zipCode, status, notes } = body;

    if (!name) {
      return errorResponse('VALIDATION_ERROR', 'Company name is required', 400);
    }

    const company = await db.company.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        zipCode: zipCode || null,
        status: status || 'ACTIVE',
        notes: notes || null,
      },
    });

    return successResponse(company, 201);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('POST /api/companies error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create company', 500);
  }
}
