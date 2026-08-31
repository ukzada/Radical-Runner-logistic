'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useViewStore } from '@/store/view-store';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { KpiCard } from '@/components/shared/kpi-card';
import { DataTable } from '@/components/shared/data-table';
import { LoadingState } from '@/components/shared/loading-state';
import { LOAD_STATUS_LABELS, LOAD_STATUS_COLORS, DRIVER_STATUS_COLORS, DRIVER_STATUS_LABELS } from '@/lib/constants';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Users, Truck, DollarSign, Edit, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { DispatcherForm } from './dispatcher-form';

const DISPATCHER_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
};

export function DispatcherDetailView() {
  const { viewParams, setView } = useViewStore();
  const id = viewParams.id;
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['dispatcher', id],
    queryFn: () => api.get(`/api/dispatchers/${id}`),
    enabled: !!id,
  });

  const toggleMutation = useMutation({
    mutationFn: (isActive: boolean) => api.put(`/api/dispatchers/${id}`, { isActive }),
    onSuccess: () => { toast.success('Dispatcher status updated'); queryClient.invalidateQueries({ queryKey: ['dispatcher', id] }); queryClient.invalidateQueries({ queryKey: ['dispatchers'] }); },
    onError: (err: any) => toast.error(err?.message || 'Failed to update status'),
  });

  if (isLoading) return <LoadingState count={4} />;
  if (isError) {
    return (
      <div className='flex flex-col items-center justify-center py-20'>
        <p className='text-muted-foreground mb-4'>{(error as any)?.message || 'Failed to load data'}</p>
        <Button variant='outline' onClick={() => setView('dashboard')}>Go to Dashboard</Button>
      </div>
    );
  }
  if (!data) return null;

  const dispatcher = data;
  const drivers = dispatcher.assignedDrivers || [];
  const recentLoads = dispatcher.recentLoads || [];

  const driverCols: ColumnDef<any>[] = [
    {
      id: 'name', header: 'Name',
      cell: ({ row }) => (
        <button className='font-medium text-primary hover:underline' onClick={(e) => { e.stopPropagation(); setView('driver-detail', { id: row.original.id }); }}>
          {row.original.firstName} {row.original.lastName}
        </button>
      ),
    },
    {
      id: 'companyName', header: 'Company',
      cell: ({ row }) => row.original.companyName || '—',
    },
    {
      id: 'mcNumber', header: 'MC',
      cell: ({ row }) => row.original.mcNumber ? <span className='font-mono text-sm'>{row.original.mcNumber}</span> : '—',
    },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} colorMap={DRIVER_STATUS_COLORS} labelMap={DRIVER_STATUS_LABELS} />,
    },
  ];

  const loadCols: ColumnDef<any>[] = [
    {
      accessorKey: 'loadNumber', header: 'Load #',
      cell: ({ row }) => (
        <button className='text-primary hover:underline' onClick={(e) => { e.stopPropagation(); setView('load-detail', { id: row.original.id }); }}>{row.original.loadNumber}</button>
      ),
    },
    { id: 'driverName', header: 'Driver', cell: ({ row }) => row.original.driverName || '—' },
    { id: 'route', header: 'Route', cell: ({ row }) => <span>{row.original.pickupCity || row.original.origin} → {row.original.deliveryCity || row.original.destination}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} colorMap={LOAD_STATUS_COLORS} labelMap={LOAD_STATUS_LABELS} /> },
    { accessorKey: 'loadPrice', header: 'Price', cell: ({ row }) => formatCurrency(row.original.loadPrice) },
    { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => row.original.createdAt ? formatDate(row.original.createdAt) : '—' },
  ];

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-3'>
        <Button variant='ghost' size='icon' onClick={() => setView('dispatchers')}><ArrowLeft className='h-4 w-4' /></Button>
        <div className='flex-1'>
          <div className='flex items-center gap-2'>
            <h1 className='text-2xl font-bold'>{dispatcher.name}</h1>
            <StatusBadge status={dispatcher.isActive ? 'ACTIVE' : 'INACTIVE'} colorMap={DISPATCHER_STATUS_COLORS} labelMap={{ ACTIVE: 'Active', INACTIVE: 'Inactive' }} />
          </div>
          <p className='text-sm text-muted-foreground'>{dispatcher.email} · {dispatcher.phone || 'No phone'}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={() => setShowForm(true)}><Edit className='mr-2 h-4 w-4' /> Edit</Button>
          <Button variant={dispatcher.isActive ? 'destructive' : 'default'} onClick={() => toggleMutation.mutate(!dispatcher.isActive)} disabled={toggleMutation.isPending}>
            {dispatcher.isActive ? <><PowerOff className='mr-2 h-4 w-4' /> Deactivate</> : <><Power className='mr-2 h-4 w-4' /> Activate</>}
          </Button>
        </div>
      </div>

      <div className='grid gap-4 grid-cols-2 lg:grid-cols-3'>
        <KpiCard icon={Users} label='Assigned Drivers' value={dispatcher.driverCount || 0} />
        <KpiCard icon={Truck} label='Total Loads' value={dispatcher.loadCount || 0} />
        <KpiCard icon={DollarSign} label='Total Load Value' value={dispatcher.totalLoadValue || 0} isCurrency />
      </div>

      <Card>
        <CardHeader><CardTitle className='text-base'>Profile Information</CardTitle></CardHeader>
        <CardContent>
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm'>
            <div><span className='text-muted-foreground'>Email:</span> {dispatcher.email}</div>
            <div><span className='text-muted-foreground'>Phone:</span> {dispatcher.phone || '—'}</div>
            <div><span className='text-muted-foreground'>Created:</span> {dispatcher.createdAt ? formatDateTime(dispatcher.createdAt) : '—'}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className='text-base'>Assigned Drivers</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={driverCols} data={drivers} onRowClick={(row) => setView('driver-detail', { id: row.id })} emptyMessage='No drivers assigned' />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className='text-base'>Recent Loads</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={loadCols} data={recentLoads} onRowClick={(row) => setView('load-detail', { id: row.id })} emptyMessage='No recent loads' />
        </CardContent>
      </Card>

      <DispatcherForm open={showForm} onClose={() => setShowForm(false)} editId={id} onSuccess={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['dispatcher', id] }); queryClient.invalidateQueries({ queryKey: ['dispatchers'] }); }} />
    </div>
  );
}
