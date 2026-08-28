import { db } from '@/lib/db';
import { getAuthUserAsync, successResponse, errorResponse } from '@/lib/auth-helpers';

// GET /api/auth/profile — Get own profile
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);

    const user = await db.user.findUnique({
      where: { id: authUser.userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        profileImage: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return errorResponse('USER_NOT_FOUND', 'User not found', 404);
    }

    if (!user.isActive) {
      return errorResponse('ACCOUNT_DISABLED', 'Account has been disabled', 403);
    }

    return successResponse(user);
  } catch (error: any) {
    if (error.status) {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/auth/profile error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch profile', 500);
  }
}

// PUT /api/auth/profile — Update own profile (name, phone)
export async function PUT(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);

    const body = await request.json();
    const { name, phone } = body;

    // Only allow updating name and phone for own profile
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;

    if (Object.keys(updateData).length === 0) {
      return errorResponse('VALIDATION_ERROR', 'No fields to update', 400);
    }

    const user = await db.user.update({
      where: { id: authUser.userId },
      data: updateData,
      select: {
        id: true, email: true, name: true, phone: true,
        profileImage: true, role: true, isActive: true,
        createdAt: true, updatedAt: true,
      },
    });

    // Update localStorage user info in the client is handled by the frontend

    return successResponse(user);
  } catch (error: any) {
    if (error.status) {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('PUT /api/auth/profile error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update profile', 500);
  }
}
