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

    const company = await db.company.findUnique({ where: { id } });
    if (!company) {
      return errorResponse('NOT_FOUND', 'Company not found', 404);
    }

    const mcs = await db.mC.findMany({
      where: { companyId: id },
      include: { _count: { select: { drivers: true } } },
      orderBy: { mcNumber: 'asc' },
    });

    const result = mcs.map((m) => ({
      ...m,
      driverCount: m._count.drivers,
      _count: undefined,
    }));

    return successResponse({ mcs: result });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/companies/[id]/mcs error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch MCs', 500);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const { id: companyId } = await params;

    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return errorResponse('NOT_FOUND', 'Company not found', 404);
    }

    const body = await request.json();
    const { mcNumber, status, notes } = body;

    if (!mcNumber) {
      return errorResponse('VALIDATION_ERROR', 'MC number is required', 400);
    }

    // Check uniqueness within company
    const existing = await db.mC.findUnique({
      where: { mcNumber_companyId: { mcNumber, companyId } },
    });
    if (existing) {
      return errorResponse('CONFLICT', 'This MC number already exists for this company', 409);
    }

    const mc = await db.mC.create({
      data: {
        mcNumber,
        companyId,
        status: status || 'ACTIVE',
        notes: notes || null,
      },
      });

    return successResponse(mc, 201);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('POST /api/companies/[id]/mcs error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to create MC', 500);
  }
}
