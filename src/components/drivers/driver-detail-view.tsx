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
import { DRIVER_STATUS_COLORS, DRIVER_STATUS_LABELS, LOAD_STATUS_LABELS, LOAD_STATUS_COLORS } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Truck, DollarSign, MapPin, UserCircle, Building2, Hash, UserPlus, UserMinus, Loader2, FileText } from 'lucide-react';
import { useState } from 'react';
import { DriverForm } from './driver-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { exportCsv } from '@/lib/export-utils';

export function DriverDetailView() {
  const { viewParams, setView } = useViewStore();
  const id = viewParams.id;
  const [showForm, setShowForm] = useState(false);
  const [showAssignDispatcher, setShowAssignDispatcher] = useState(false);
  const queryClient = useQueryClient();
  const user = api.getUser();
  const isAdmin = user?.role === 'ADMIN';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['driver', id],
    queryFn: () => api.get(`/api/drivers/${id}`),
    enabled: !!id,
  });

  // Fetch available dispatchers for assignment
  const { data: dispatchersData } = useQuery({
    queryKey: ['dispatchers-all'],
    queryFn: () => api.get('/api/dispatchers?limit=100'),
    enabled: isAdmin && showAssignDispatcher,
    staleTime: 0,
  });

  const [selectedDispatcherId, setSelectedDispatcherId] = useState<string>('');

  const assignDispatcherMutation = useMutation({
    mutationFn: (dispatcherId: string) => api.post(`/api/dispatchers/${dispatcherId}/drivers`, { driverIds: [id] }),
    onSuccess: () => {
      toast.success('Dispatcher assigned');
      queryClient.invalidateQueries({ queryKey: ['driver', id] });
      queryClient.invalidateQueries({ queryKey: ['dispatchers'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setShowAssignDispatcher(false);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to assign dispatcher'),
  });

  const unassignDispatcherMutation = useMutation({
    mutationFn: (dispatcherId: string) => api.del(`/api/dispatchers/${dispatcherId}/drivers?driverId=${id}`),
    onSuccess: () => {
      toast.success('Dispatcher unassigned');
      queryClient.invalidateQueries({ queryKey: ['driver', id] });
      queryClient.invalidateQueries({ queryKey: ['dispatchers'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to unassign dispatcher'),
  });

  const reassignDispatcherMutation = useMutation({
    mutationFn: (newDispatcherId: string) => api.put(`/api/dispatchers/${driver.dispatcherId}/drivers`, { driverId: id, newDispatcherId }),
    onSuccess: () => {
      toast.success('Dispatcher reassigned');
      queryClient.invalidateQueries({ queryKey: ['driver', id] });
      queryClient.invalidateQueries({ queryKey: ['dispatchers'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
      setShowAssignDispatcher(false);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to reassign dispatcher'),
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
          {isAdmin && (
            <Button
              variant='outline'
              size='sm'
              onClick={async () => {
                try { await exportCsv('driver-details', { driverId: id }); }
                catch (e: any) { toast.error(e?.message || 'Export failed'); }
              }}
            >
              <FileText className='mr-2 h-4 w-4' /> Export Report
            </Button>
          )}
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
            <div><span className='text-muted-foreground'>Truck Type:</span> {driver.truckType || '—'}</div>
            <div>
              <span className='text-muted-foreground'>Dispatcher:</span>{' '}
              {driver.dispatcherName ? (
                <button className='text-primary hover:underline' onClick={() => driver.dispatcherId && setView('dispatcher-detail', { id: driver.dispatcherId })}>
                  {driver.dispatcherName}
                </button>
              ) : (
                <span className='text-muted-foreground'>Unassigned</span>
              )}
              {isAdmin && (
                <div className='flex items-center gap-2 ml-2'>
                  <Dialog open={showAssignDispatcher} onOpenChange={setShowAssignDispatcher}>
                    <DialogTrigger asChild>
                      <Button variant='outline' size='sm' className='h-7'>
                        {driver.dispatcherName ? <UserMinus className='mr-1 h-3 w-3' /> : <UserPlus className='mr-1 h-3 w-3' />}
                        {driver.dispatcherName ? 'Change' : 'Assign'}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{driver.dispatcherName ? 'Reassign Dispatcher' : 'Assign Dispatcher'}</DialogTitle>
                      </DialogHeader>
                      <div className='space-y-4'>
                        <Select
                          value={selectedDispatcherId}
                          onValueChange={setSelectedDispatcherId}
                        >
                          <SelectTrigger className='w-full'>
                            <SelectValue placeholder='Select dispatcher...' />
                          </SelectTrigger>
                          <SelectContent>
                            {(dispatchersData?.dispatchers || []).map((d: any) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name} ({d.driverCount || 0} drivers)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className='flex justify-end gap-2'>
                          <Button variant='outline' onClick={() => setShowAssignDispatcher(false)}>Cancel</Button>
                          <Button
                            onClick={() => {
                              if (driver.dispatcherId) {
                                reassignDispatcherMutation.mutate(selectedDispatcherId);
                              } else {
                                assignDispatcherMutation.mutate(selectedDispatcherId);
                              }
                            }}
                            disabled={(assignDispatcherMutation.isPending || reassignDispatcherMutation.isPending) || !selectedDispatcherId}
                          >
                            {(assignDispatcherMutation.isPending || reassignDispatcherMutation.isPending) && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                            {driver.dispatcherName ? 'Reassign' : 'Assign'}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  {driver.dispatcherId && (
                    <Button
                      variant='ghost' size='sm' className='text-red-600 hover:text-red-700 h-7'
                      onClick={() => unassignDispatcherMutation.mutate(driver.dispatcherId!)}
                      disabled={unassignDispatcherMutation.isPending}
                    >
                      <UserMinus className='mr-1 h-3 w-3' /> Remove
                    </Button>
                  )}
                </div>
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
