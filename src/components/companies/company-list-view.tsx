'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { StatusBadge } from '@/components/shared/status-badge';
import { COMPANY_STATUS_COLORS, COMPANY_STATUS_LABELS } from '@/lib/constants';
import { useViewStore } from '@/store/view-store';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CompanyForm } from './company-form';
import { useQueryClient } from '@tanstack/react-query';

export function CompanyListView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const setView = useViewStore((s) => s.setView);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['companies', page, search, statusFilter],
    queryFn: () => api.get(`/api/companies?page=${page}&limit=20&search=${search}&status=${statusFilter}`),
  });

  const columns: ColumnDef<any>[] = [
    {
      id: 'name',
      header: 'Company',
      cell: ({ row }) => (
        <button
          className='font-medium text-primary hover:underline'
          onClick={(e) => { e.stopPropagation(); setView('company-detail', { id: row.original.id }); }}
        >
          {row.original.name}
        </button>
      ),
    },
    { accessorKey: 'city', header: 'City', cell: ({ row }) => row.original.city || '—' },
    { accessorKey: 'state', header: 'State', cell: ({ row }) => row.original.state || '—' },
    {
      accessorKey: 'mcCount',
      header: 'MCs',
      cell: ({ row }) => (
        <span className='font-medium'>{row.original.mcCount || 0}</span>
      ),
    },
    {
      accessorKey: 'driverCount',
      header: 'Drivers',
      cell: ({ row }) => row.original.driverCount || 0,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} colorMap={COMPANY_STATUS_COLORS} labelMap={COMPANY_STATUS_LABELS} />,
    },
  ];

  return (
    <div className='space-y-4'>
      <PageHeader
        title='Companies'
        description='Manage your carrier companies and their MC numbers'
        actionLabel='Add Company'
        actionIcon={Plus}
        onAction={() => setShowForm(true)}
      />
      <div className='flex flex-col sm:flex-row gap-3'>
        <Input placeholder='Search companies...' className='max-w-xs' value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className='w-[160px]'><SelectValue placeholder='All Statuses' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Statuses</SelectItem>
            {Object.entries(COMPANY_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <DataTable
        columns={columns} data={data?.companies || []} isLoading={isLoading}
        pagination={data?.meta ? { page: data.meta.page, limit: data.meta.limit, total: data.meta.total, totalPages: data.meta.totalPages, onPageChange: setPage } : undefined}
        onRowClick={(row) => setView('company-detail', { id: row.id })}
        emptyMessage='No companies found'
      />
      <CompanyForm open={showForm} onClose={() => setShowForm(false)} editId={null} onSuccess={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['companies'] }); }} />
    </div>
  );
}
