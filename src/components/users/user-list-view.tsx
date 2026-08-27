'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { UserForm } from './user-form';
import { USER_ROLE_LABELS } from '@/lib/constants';

export function UserListView() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['users', page],
    queryFn: () => api.get(`/api/users?page=${page}&limit=20`),
  });

  const columns: ColumnDef<any>[] = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'role', header: 'Role', cell: ({ row }) => (
      <Badge variant={row.original.role === 'ADMIN' ? 'default' : 'secondary'}>{USER_ROLE_LABELS[row.original.role] || row.original.role}</Badge>
    )},
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => (
      <Badge variant={row.original.isActive !== false ? 'default' : 'secondary'}>{row.original.isActive !== false ? 'Active' : 'Inactive'}</Badge>
    )},
  ];

  return (
    <div className='space-y-4'>
      <PageHeader title='User Management' description='Manage system users and access' actionLabel='Add User' actionIcon={Plus} onAction={() => { setEditId(null); setShowForm(true); }} />
      <DataTable
        columns={columns} data={data?.users || []} isLoading={isLoading}
        pagination={data?.meta ? { page: data.meta.page, limit: data.meta.limit, total: data.meta.total, totalPages: data.meta.totalPages, onPageChange: setPage } : undefined}
        emptyMessage='No users found'
      />
      <UserForm open={showForm} onClose={() => setShowForm(false)} editId={editId} onSuccess={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['users'] }); }} />
    </div>
  );
}
