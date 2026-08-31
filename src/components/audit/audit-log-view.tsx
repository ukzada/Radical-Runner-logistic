'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataTable } from '@/components/shared/data-table';
import { PageHeader } from '@/components/shared/page-header';
import { formatDateTime, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Calendar } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { exportCsv } from '@/lib/export-utils';
import { toast } from 'sonner';

const ACTION_TYPES = ['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'LOGIN', 'LOGOUT'];

export function AuditLogView() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const params = new URLSearchParams({
    page: String(page), limit: '20', action: actionFilter, entityType: entityFilter, search,
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, actionFilter, entityFilter, search, dateFrom, dateTo],
    queryFn: () => api.get(`/api/audit-logs?${params}`),
  });

  const handleExport = async () => {
    const filters: Record<string, string> = {
      action: actionFilter,
      entityType: entityFilter,
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
    };
    try { await exportCsv('audit-logs', filters); }
    catch (e: any) { toast.error(e?.message || 'Export failed'); }
  };

  const columns: ColumnDef<any>[] = [
    { accessorKey: 'createdAt', header: 'Time', cell: ({ row }) => formatDateTime(row.original.createdAt) },
    { accessorKey: 'user', header: 'User', cell: ({ row }) => row.original.user?.name || '—' },
    { accessorKey: 'action', header: 'Action', cell: ({ row }) => {
      const action = row.original.action || '';
      const colorClass = action.includes('DELETE') ? 'bg-red-100 text-red-800' : action.includes('CREATE') ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800';
      return <Badge variant='secondary' className={colorClass}>{action}</Badge>;
    }},
    { accessorKey: 'entityType', header: 'Entity' },
    { accessorKey: 'entityId', header: 'ID', cell: ({ row }) => <span className='font-mono text-xs'>{row.original.entityId?.slice(0, 8) || '—'}...</span> },
    { accessorKey: 'newValues', header: 'Details', cell: ({ row }) => {
      try {
        const parsed = row.original.newValues ? JSON.parse(row.original.newValues) : null;
        return <span className='text-sm text-muted-foreground max-w-xs truncate block'>{parsed ? JSON.stringify(parsed) : '—'}</span>;
      } catch {
        return <span className='text-sm text-muted-foreground max-w-xs truncate block'>{row.original.newValues || '—'}</span>;
      }
    }},
    { accessorKey: 'ipAddress', header: 'IP', cell: ({ row }) => <span className='font-mono text-xs'>{row.original.ipAddress || '—'}</span> },
  ];

  return (
    <div className='space-y-4'>
      <PageHeader
        title='Audit Logs'
        description='Track all system activity'
        actionLabel='Export CSV'
        actionIcon={FileText}
        onAction={handleExport}
      />
      <div className='flex flex-wrap gap-3'>
        <Input placeholder='Search logs...' className='max-w-xs' value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Select value={actionFilter || 'all'} onValueChange={(v) => { setActionFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className='w-[150px]'><SelectValue placeholder='All Actions' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Actions</SelectItem>
            {ACTION_TYPES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={entityFilter || 'all'} onValueChange={(v) => { setEntityFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className='w-[150px]'><SelectValue placeholder='All Entities' /></SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Entities</SelectItem>
            <SelectItem value='Load'>Load</SelectItem>
            <SelectItem value='Driver'>Driver</SelectItem>
            <SelectItem value='User'>User</SelectItem>
            <SelectItem value='DriverDispatcher'>Driver Assignment</SelectItem>
            <SelectItem value='Notification'>Notification</SelectItem>
          </SelectContent>
        </Select>
        <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
          <PopoverTrigger asChild>
            <Button variant='outline' className={cn('gap-2', (dateFrom || dateTo) && 'bg-primary/10 text-primary')}>
              <Calendar className='h-4 w-4' />
              <span>Date Range</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className='w-80 p-4' sideOffset={5}>
            <div className='space-y-3'>
              <div className='space-y-1'>
                <label className='text-sm font-medium'>From</label>
                <Input type='date' value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className='w-full' />
              </div>
              <div className='space-y-1'>
                <label className='text-sm font-medium'>To</label>
                <Input type='date' value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className='w-full' />
              </div>
              <div className='flex gap-2'>
                <Button size='sm' className='flex-1' onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}>Clear</Button>
                <Button size='sm' className='flex-1' onClick={() => setShowDatePicker(false)}>Apply</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <DataTable
        columns={columns} data={data?.logs || []} isLoading={isLoading}
        pagination={data?.meta ? { page: data.meta.page, limit: data.meta.limit, total: data.meta.total, totalPages: data.meta.totalPages, onPageChange: setPage } : undefined}
        emptyMessage='No audit logs found'
      />
    </div>
  );
}
