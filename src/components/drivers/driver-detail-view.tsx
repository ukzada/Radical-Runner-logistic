'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useViewStore } from '@/store/view-store';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { KpiCard } from '@/components/shared/kpi-card';
import { DataTable } from '@/components/shared/data-table';
import { LoadingState } from '@/components/shared/loading-state';
import { DRIVER_STATUS_COLORS, DRIVER_STATUS_LABELS, LOAD_STATUS_LABELS, LOAD_STATUS_COLORS } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Truck, DollarSign, MapPin, UserCircle, Building2, Hash } from 'lucide-react';
import { useState } from 'react';
import { DriverForm } from './driver-form';

export function DriverDetailView() {
  const { viewParams, setView } = useViewStore();
  const id = viewParams.id;
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['driver', id],
    queryFn: () => api.get(`/api/drivers/${id}`),
    enabled: !!id,
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

  const driver = data;
  const loads = driver.loadHistory || [];
  const stats = driver.stats || {};

  const loadCols: ColumnDef<any>[] = [
    { accessorKey: 'loadNumber', header: 'Load #', cell: ({ row }) => (
      <button className='text-primary hover:underline' onClick={(e) => { e.stopPropagation(); setView('load-detail', { id: row.original.id }); }}>{row.original.loadNumber}</button>
    )},
    { id: 'route', header: 'Route', cell: ({ row }) => <span>{row.original.pickupCity || row.original.origin} → {row.original.deliveryCity || row.original.destination}</span> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} colorMap={LOAD_STATUS_COLORS} labelMap={LOAD_STATUS_LABELS} /> },
    { accessorKey: 'loadPrice', header: 'Price', cell: ({ row }) => formatCurrency(row.original.loadPrice) },
    { accessorKey: 'createdAt', header: 'Date', cell: ({ row }) => row.original.createdAt ? formatDate(row.original.createdAt) : '—' },
  ];

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-3'>
        <Button variant='ghost' size='icon' onClick={() => setView('drivers')}><ArrowLeft className='h-4 w-4' /></Button>
        <div className='flex-1'>
          <div className='flex items-center gap-2'>
            <h1 className='text-2xl font-bold'>{driver.firstName} {driver.lastName}</h1>
            <StatusBadge status={driver.status} colorMap={DRIVER_STATUS_COLORS} labelMap={DRIVER_STATUS_LABELS} />
          </div>
          <p className='text-sm text-muted-foreground'>
            {driver.companyName ? `${driver.companyName} · ` : ''}
            {driver.mcNumber ? `MC ${driver.mcNumber} · ` : ''}
            {driver.dispatcherName || 'Unassigned'}
          </p>
        </div>
        <Button variant='outline' onClick={() => setShowForm(true)}>Edit</Button>
      </div>

      <div className='grid gap-4 grid-cols-2 lg:grid-cols-2'>
        <KpiCard icon={Truck} label='Total Loads' value={stats.totalLoads || 0} />
        <KpiCard icon={DollarSign} label='Total Value (Delivered)' value={stats.totalValue || 0} isCurrency />
      </div>

      <Card>
        <CardHeader><CardTitle className='text-base'>Driver Information</CardTitle></CardHeader>
        <CardContent>
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm'>
            <div><span className='text-muted-foreground'>Email:</span> {driver.email || '—'}</div>
            <div><span className='text-muted-foreground'>Phone:</span> {driver.phone || '—'}</div>
            <div><span className='text-muted-foreground'>CDL #:</span> {driver.cdlNumber || '—'}</div>
            <div><span className='text-muted-foreground'>CDL State:</span> {driver.cdlState || '—'}</div>
            <div><span className='text-muted-foreground'>CDL Expiry:</span> {driver.cdlExpiration ? formatDate(driver.cdlExpiration) : '—'}</div>
            <div>
              <span className='text-muted-foreground'>Dispatcher:</span>{' '}
              {driver.dispatcherName ? (
                <button className='text-primary hover:underline' onClick={() => driver.dispatcherId && setView('dispatcher-detail', { id: driver.dispatcherId })}>
                  {driver.dispatcherName}
                </button>
              ) : (
                <span className='text-muted-foreground'>Unassigned</span>
              )}
            </div>
            <div>
              <span className='text-muted-foreground'>Company:</span>{' '}
              {driver.companyName ? (
                <button className='text-primary hover:underline' onClick={() => driver.companyId && setView('company-detail', { id: driver.companyId })}>
                  {driver.companyName}
                </button>
              ) : <span className='text-muted-foreground'>—</span>}
            </div>
            <div>
              <span className='text-muted-foreground'>MC Number:</span>{' '}
              <span className='font-mono'>{driver.mcNumber || '—'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className='text-base'>Load History</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={loadCols} data={loads} onRowClick={(row) => setView('load-detail', { id: row.id })} emptyMessage='No loads for this driver' />
        </CardContent>
      </Card>

      <DriverForm open={showForm} onClose={() => setShowForm(false)} editId={id} onSuccess={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['driver', id] }); }} />
    </div>
  );
}
