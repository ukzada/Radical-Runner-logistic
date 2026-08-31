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
import { ArrowLeft, Users, Truck, DollarSign, Edit, Power, PowerOff, Plus, UserMinus, UserPlus, Download, Check, X, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { DispatcherForm } from './dispatcher-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { exportCsv } from '@/lib/export-utils';

const DISPATCHER_STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-emerald-100 text-emerald-800',
  INACTIVE: 'bg-gray-100 text-gray-800',
};

export function DispatcherDetailView() {
  const { viewParams, setView } = useViewStore();
  const id = viewParams.id;
  const [showForm, setShowForm] = useState(false);
  const [showAssignDrivers, setShowAssignDrivers] = useState(false);
  const queryClient = useQueryClient();
  const user = api.getUser();
  const isAdmin = user?.role === 'ADMIN';

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

  const assignDriversMutation = useMutation({
    mutationFn: (driverIds: string[]) => api.post(`/api/dispatchers/${id}/drivers`, { driverIds }),
    onSuccess: () => { toast.success('Drivers assigned'); queryClient.invalidateQueries({ queryKey: ['dispatcher', id] }); queryClient.invalidateQueries({ queryKey: ['drivers'] }); setShowAssignDrivers(false); },
    onError: (err: any) => toast.error(err?.message || 'Failed to assign drivers'),
  });

  const unassignDriverMutation = useMutation({
    mutationFn: (driverId: string) => api.del(`/api/dispatchers/${id}/drivers?driverId=${driverId}`),
    onSuccess: () => { toast.success('Driver unassigned'); queryClient.invalidateQueries({ queryKey: ['dispatcher', id] }); queryClient.invalidateQueries({ queryKey: ['drivers'] }); },
    onError: (err: any) => toast.error(err?.message || 'Failed to unassign driver'),
  });

  // Fetch available drivers (not assigned to this dispatcher)
  const { data: availableDrivers } = useQuery({
    queryKey: ['available-drivers', id],
    queryFn: () => api.get(`/api/dispatchers/${id}/drivers?available=true`),
    enabled: !!id && showAssignDrivers,
    staleTime: 0,
  });

  const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(new Set());
  const [assignSearch, setAssignSearch] = useState('');

  const toggleDriver = (driverId: string) => {
    setSelectedDrivers((prev) => {
      const next = new Set(prev);
      if (next.has(driverId)) next.delete(driverId);
      else next.add(driverId);
      return next;
    });
  };

  const handleAssign = () => {
    if (selectedDrivers.size === 0) return;
    assignDriversMutation.mutate(Array.from(selectedDrivers));
  };

  const availableDriversList = availableDrivers?.drivers || [];
  const filteredDrivers = availableDriversList.filter((d: any) =>
    `${d.firstName} ${d.lastName}`.toLowerCase().includes(assignSearch.toLowerCase())
  );

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
    {
      id: 'actions', header: isAdmin ? 'Actions' : '',
      cell: ({ row }) => isAdmin ? (
        <Button
          variant='ghost' size='sm' className='text-red-600 hover:text-red-700 h-7'
          onClick={(e) => { e.stopPropagation(); unassignDriverMutation.mutate(row.original.id); }}
          disabled={unassignDriverMutation.isPending}
        >
          <X className='mr-1 h-3 w-3' /> Unassign
        </Button>
      ) : null,
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
          {isAdmin && (
            <Button
              variant='outline'
              size='sm'
              onClick={async () => {
                try { await exportCsv('dispatcher-performance'); }
                catch (e: any) { toast.error(e?.message || 'Export failed'); }
              }}
            >
              <FileText className='mr-2 h-4 w-4' /> Export Report
            </Button>
          )}
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
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle className='text-base'>Assigned Drivers</CardTitle>
          {isAdmin && (
            <Dialog open={showAssignDrivers} onOpenChange={setShowAssignDrivers}>
              <DialogTrigger asChild>
                <Button size='sm' variant='outline'><Plus className='mr-2 h-4 w-4' /> Assign Driver</Button>
              </DialogTrigger>
              <DialogContent className='max-w-2xl max-h-[80vh]'>
                <DialogHeader>
                  <DialogTitle>Assign Drivers to {dispatcher.name}</DialogTitle>
                </DialogHeader>
                <div className='space-y-4'>
                  <Input
                    placeholder='Search available drivers...'
                    value={assignSearch}
                    onChange={(e) => setAssignSearch(e.target.value)}
                    className='w-full'
                  />
                  <ScrollArea className='max-h-80'>
                    <div className='space-y-2'>
                      {filteredDrivers.length === 0 && (
                        <p className='text-sm text-muted-foreground text-center py-8'>No available drivers found</p>
                      )}
                      {filteredDrivers.map((d: any) => (
                        <div
                          key={d.id}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors',
                            selectedDrivers.has(d.id) && 'bg-primary/5 border border-primary'
                          )}
                          onClick={() => toggleDriver(d.id)}
                        >
                          <Checkbox
                            checked={selectedDrivers.has(d.id)}
                            onCheckedChange={() => toggleDriver(d.id)}
                          />
                          <div className='flex-1 min-w-0'>
                            <p className='font-medium text-sm truncate'>{d.firstName} {d.lastName}</p>
                            <div className='flex items-center gap-2'>
                              {d.companyName && <span className='text-xs text-muted-foreground'>{d.companyName}</span>}
                              {d.mcNumber && <span className='text-xs font-mono text-muted-foreground'>{d.mcNumber}</span>}
                              <StatusBadge status={d.status} colorMap={DRIVER_STATUS_COLORS} labelMap={DRIVER_STATUS_LABELS} />
                            </div>
                          </div>
                          {selectedDrivers.has(d.id) && <Check className='h-4 w-4 text-primary' />}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  <div className='flex justify-end gap-2 pt-2 border-t'>
                    <Button variant='outline' onClick={() => setShowAssignDrivers(false)}>Cancel</Button>
                    <Button
                      onClick={handleAssign}
                      disabled={assignDriversMutation.isPending || selectedDrivers.size === 0}
                    >
                      {assignDriversMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                      <Check className='mr-1 h-4 w-4' /> Assign {selectedDrivers.size} Driver{selectedDrivers.size > 1 ? 's' : ''}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
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
