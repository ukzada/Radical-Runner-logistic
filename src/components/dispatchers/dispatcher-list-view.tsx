'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useViewStore } from '@/store/view-store';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { DispatcherForm } from './dispatcher-form';
import { exportCsv } from '@/lib/export-utils';
import { toast } from 'sonner';

const DISPATCHER_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
};

export function DispatcherListView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const setView = useViewStore((s) => s.setView);
  const queryClient = useQueryClient();

  const user = api.getUser();
  const isAdmin = user?.role === 'ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['dispatchers', page, search],
    queryFn: () => api.get(`/api/dispatchers?page=${page}&limit=20&search=${search}`),
  });

  const columns: ColumnDef<any>[] = [
    {
      id: 'name', header: 'Name',
      cell: ({ row }) => (
        <button className='font-medium text-primary hover:underline' onClick={(e) => { e.stopPropagation(); setView('dispatcher-detail', { id: row.original.id }); }}>
          {row.original.name}
        </button>
      ),
    },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'phone', header: 'Phone' },
    {
      accessorKey: 'isActive', header: 'Status',
      cell: ({ row }) => (
        <StatusBadge status={row.original.isActive ? 'ACTIVE' : 'INACTIVE'} colorMap={DISPATCHER_STATUS_COLORS} labelMap={{ ACTIVE: 'Active', INACTIVE: 'Inactive' }} />
      ),
    },
    { accessorKey: 'driverCount', header: 'Drivers' },
    { accessorKey: 'loadCount', header: 'Loads' },
    { accessorKey: 'totalLoadValue', header: 'Total Value', cell: ({ row }) => formatCurrency(row.original.totalLoadValue || 0) },
    { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => row.original.createdAt ? formatDate(row.original.createdAt) : '—' },
  ];

  return (
    <div className='space-y-4'>
      <PageHeader title='Dispatchers' description='Manage your dispatcher team' actionLabel='Add Dispatcher' actionIcon={Plus} onAction={() => setShowForm(true)} />
      {isAdmin && (
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={async () => { try { await exportCsv('dispatcher-performance'); } catch (e: any) { toast.error(e?.message || 'Export failed'); } }}>
            <FileText className='mr-2 h-4 w-4' /> Export Dispatcher Report
          </Button>
        </div>
      )}
      <div className='flex flex-col sm:flex-row gap-3'>
        <Input placeholder='Search dispatchers...' className='max-w-xs' value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>
      <DataTable
        columns={columns} data={data?.dispatchers || []} isLoading={isLoading}
        pagination={data?.meta ? { page: data.meta.page, limit: data.meta.limit, total: data.meta.total, totalPages: data.meta.totalPages, onPageChange: setPage } : undefined}
        onRowClick={(row) => setView('dispatcher-detail', { id: row.id })}
        emptyMessage='No dispatchers found'
      />
      <DispatcherForm open={showForm} onClose={() => setShowForm(false)} editId={null} onSuccess={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['dispatchers'] }); }} />
    </div>
  );
}
