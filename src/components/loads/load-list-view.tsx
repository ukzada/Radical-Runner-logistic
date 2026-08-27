'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { LOAD_STATUS_LABELS, LOAD_STATUS_COLORS, LOAD_STATUSES } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useViewStore } from '@/store/view-store';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LoadForm } from './load-form';

export function LoadListView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const setView = useViewStore((s) => s.setView);
  const queryClient = useQueryClient();

  const params = new URLSearchParams({
    page: String(page), limit: '20', search,
    status: statusFilter, dateFrom, dateTo,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['loads', page, search, statusFilter, dateFrom, dateTo],
    queryFn: () => api.get(`/api/loads?${params}`),
  });

  const columns: ColumnDef<any>[] = [
    { accessorKey: 'loadNumber', header: 'Load #', cell: ({ row }) => (
      <button className='font-medium text-primary hover:underline' onClick={(e) => { e.stopPropagation(); setView('load-detail', { id: row.original.id }); }}>{row.original.loadNumber}</button>
    )},
    { id: 'driverName', header: 'Driver', cell: ({ row }) => row.original.driverName || '—' },
    { id: 'route', header: 'Route', cell: ({ row }) => <span className='text-sm'>{row.original.pickupCity || row.original.pickup} → {row.original.deliveryCity || row.original.delivery}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} colorMap={LOAD_STATUS_COLORS} labelMap={LOAD_STATUS_LABELS} /> },
    { id: 'price', header: 'Price', cell: ({ row }) => formatCurrency(row.original.price) },
    { id: 'date', header: 'Date', cell: ({ row }) => row.original.loadDate ? formatDate(row.original.loadDate) : row.original.createdAt ? formatDate(row.original.createdAt) : '—' },
  ];

  return (
    <div className='space-y-4'>
      <PageHeader title='Loads' description='Track and manage all loads' actionLabel='Create Load' actionIcon={Plus} onAction={() => setShowForm(true)} />

      <div className='flex flex-wrap gap-3'>
        <Input placeholder='Search loads...' className='max-w-xs' value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className='w-[150px]'><SelectValue placeholder='All Statuses' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Statuses</SelectItem>
            {LOAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{LOAD_STATUS_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type='date' className='w-[150px]' value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} />
        <Input type='date' className='w-[150px]' value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} />
      </div>

      <DataTable
        columns={columns} data={data?.loads || []} isLoading={isLoading}
        pagination={data?.meta ? { page: data.meta.page, limit: data.meta.limit, total: data.meta.total, totalPages: data.meta.totalPages, onPageChange: setPage } : undefined}
        onRowClick={(row) => setView('load-detail', { id: row.id })}
        emptyMessage='No loads found. Create a new load to get started.'
      />

      <LoadForm open={showForm} onClose={() => setShowForm(false)} onSuccess={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['loads'] }); }} />
    </div>
  );
}
