import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';
import { hashPassword } from '@/lib/auth';

// GET /api/users/[id] — Admin views a single user
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const { id } = await params;

    const user = await db.user.findUnique({
      where: { id },
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
      return errorResponse('NOT_FOUND', 'User not found', 404);
    }

    return successResponse(user);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('GET /api/users/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch user', 500);
  }
}

// PUT /api/users/[id] — Admin updates a user (name, email, role, phone, status)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const { id } = await params;
    const body = await request.json();
    const { name, email, phone, role, isActive, password } = body;

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'User not found', 404);
    }

    // Prevent self-demotion or self-deactivation
    if (id === authUser.userId) {
      if (role && role !== existing.role) {
        return errorResponse('FORBIDDEN', 'You cannot change your own role', 403);
      }
      if (isActive === false) {
        return errorResponse('FORBIDDEN', 'You cannot deactivate your own account', 403);
      }
    }

    // Check email uniqueness if changing
    if (email && email.toLowerCase() !== existing.email) {
      const duplicate = await db.user.findUnique({ where: { email: email.toLowerCase() } });
      if (duplicate) {
        return errorResponse('DUPLICATE_EMAIL', 'A user with this email already exists', 409);
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();
    if (phone !== undefined) updateData.phone = phone;
    if (role && ['ADMIN', 'DISPATCHER'].includes(role)) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Handle password reset
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
      name: existing.name, email: existing.email, phone: existing.phone,
      role: existing.role, isActive: existing.isActive,
    });

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, email: true, name: true, phone: true,
        profileImage: true, role: true, isActive: true,
        createdAt: true, updatedAt: true,
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: authUser.userId,
        action: 'USER_UPDATED',
        entityType: 'User',
        entityId: id,
        oldValues,
        newValues: JSON.stringify({
          name: user.name, email: user.email, phone: user.phone,
          role: user.role, isActive: user.isActive,
        }),
      },
    });

    return successResponse(user);
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('PUT /api/users/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to update user', 500);
  }
}

// DELETE /api/users/[id] — Admin deactivates a user (soft delete via isActive=false)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const { id } = await params;

    if (id === authUser.userId) {
      return errorResponse('FORBIDDEN', 'You cannot delete your own account', 403);
    }

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return errorResponse('NOT_FOUND', 'User not found', 404);
    }

    // Soft delete — deactivate
    const user = await db.user.update({
      where: { id },
      data: { isActive: false },
      select: { id: true, email: true, isActive: true },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        userId: authUser.userId,
        action: 'USER_DEACTIVATED',
        entityType: 'User',
        entityId: id,
        oldValues: JSON.stringify({ isActive: existing.isActive }),
        newValues: JSON.stringify({ isActive: false }),
      },
    });

    return successResponse({ message: `User ${existing.email} has been deactivated`, ...user });
  } catch (error: any) {
    if (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN') {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('DELETE /api/users/[id] error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to deactivate user', 500);
  }
}