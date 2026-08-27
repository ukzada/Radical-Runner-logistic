import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';
import { parsePagination, buildPaginationMeta } from '@/lib/utils';

// GET /api/admin/reset-requests — Admin lists all reset requests
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const status = searchParams.get('status') || '';

    const where: any = {};
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      db.passwordResetRequest.findMany({
        where,
        include: {
          user: { select: { id: true, email: true, name: true, role: true, phone: true } },
          reviewer: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.passwordResetRequest.count({ where }),
    ]);

    return successResponse({
      requests,
      meta: buildPaginationMeta(total, page, limit),
    });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/admin/reset-requests error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch reset requests', 500);
  }
}
