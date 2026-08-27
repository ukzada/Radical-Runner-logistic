'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Link2 } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { DRIVER_STATUS_COLORS, DRIVER_STATUS_LABELS } from '@/lib/constants';
import { useViewStore } from '@/store/view-store';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DriverForm } from './driver-form';

export function DriverListView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const setView = useViewStore((s) => s.setView);
  const queryClient = useQueryClient();

  const user = api.getUser();
  const isAdmin = user?.role === 'ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['drivers', page, search, statusFilter],
    queryFn: () => api.get(`/api/drivers?page=${page}&limit=20&search=${search}&status=${statusFilter}`),
  });

  const columns: ColumnDef<any>[] = [
    {
      id: 'name', header: 'Name',
      cell: ({ row }) => `${row.original.firstName} ${row.original.lastName}`,
    },
    {
      id: 'companyName', header: 'Company',
      cell: ({ row }) => row.original.companyName || <span className='text-muted-foreground'>—</span>,
    },
    {
      id: 'mcNumber', header: 'MC',
      cell: ({ row }) => row.original.mcNumber ? <span className='font-mono text-sm'>{row.original.mcNumber}</span> : <span className='text-muted-foreground'>—</span>,
    },
    { accessorKey: 'phone', header: 'Phone' },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} colorMap={DRIVER_STATUS_COLORS} labelMap={DRIVER_STATUS_LABELS} />,
    },
    {
      id: 'dispatcherName', header: 'Dispatcher',
      cell: ({ row }) => {
        const d = row.original.dispatchers?.[0];
        return d ? (
          <button className='text-primary hover:underline' onClick={(e) => { e.stopPropagation(); setView('dispatcher-detail', { id: d.id }); }}>{d.name}</button>
        ) : <span className='text-muted-foreground'>Unassigned</span>;
      },
    },
  ];

  return (
    <div className='space-y-4'>
      <PageHeader
        title={isAdmin ? 'Drivers' : 'My Drivers'}
        description={isAdmin ? 'Manage your driver roster' : 'View your assigned drivers'}
        actionLabel={isAdmin ? 'Add Driver' : undefined}
        actionIcon={Plus}
        onAction={isAdmin ? () => setShowForm(true) : undefined}
      />
      {isAdmin && (
        <div className='flex gap-2'>
          <Button variant='outline' size='sm' onClick={() => setView('driver-assign')}><Link2 className='mr-2 h-4 w-4' /> Assign Drivers</Button>
        </div>
      )}
      <div className='flex flex-col sm:flex-row gap-3'>
        <Input placeholder='Search drivers...' className='max-w-xs' value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className='w-[160px]'><SelectValue placeholder='All Statuses' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Statuses</SelectItem>
            {Object.entries(DRIVER_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns} data={data?.drivers || []} isLoading={isLoading}
        pagination={data?.meta ? { page: data.meta.page, limit: data.meta.limit, total: data.meta.total, totalPages: data.meta.totalPages, onPageChange: setPage } : undefined}
        onRowClick={(row) => setView('driver-detail', { id: row.id })}
        emptyMessage='No drivers found'
      />
      <DriverForm open={showForm} onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['drivers'] }); }} />
    </div>
  );
}
