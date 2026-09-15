'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useViewStore } from '@/store/view-store';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { KpiCard } from '@/components/shared/kpi-card';
import { DataTable } from '@/components/shared/data-table';
import { LoadingState } from '@/components/shared/loading-state';
import { DRIVER_STATUS_COLORS, DRIVER_STATUS_LABELS } from '@/lib/constants';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Truck, CircleDollarSign, Clock, PackageCheck, Edit, Power, PowerOff, Crown, Building2, Mail, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { OwnerForm } from './owner-form';

export function OwnerDetailView() {
  const { viewParams, setView } = useViewStore();
  const id = viewParams.id;
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['owner', id],
    queryFn: () => api.get(`/api/owners/${id}`),
    enabled: !!id,
  });

  const toggleMutation = useMutation({
    mutationFn: (isActive: boolean) => api.put(`/api/owners/${id}`, { isActive }),
    onSuccess: () => {
      toast.success('Owner status updated');
      queryClient.invalidateQueries({ queryKey: ['owner', id] });
      queryClient.invalidateQueries({ queryKey: ['owners'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to update status'),
  });

  if (isLoading) return <LoadingState count={4} />;
  if (isError) {
    return (
      <div className='flex flex-col items-center justify-center py-20'>
        <p className='text-muted-foreground mb-4'>{(error as any)?.message || 'Failed to load owner'}</p>
        <Button variant='outline' onClick={() => setView('owners')}>Back to Owners</Button>
      </div>
    );
  }
  if (!data) return null;

  const owner = data;
  const trucks = owner.trucks || [];
  const kpis = owner.kpis || { truckCount: 0, totalLoads: 0, paidEarnings: 0, pendingEarnings: 0 };

  const truckCols: ColumnDef<any>[] = [
    {
      id: 'driverName', header: 'Truck (Driver)',
      cell: ({ row }) => (
        <button
          className='font-medium text-primary hover:underline'
          onClick={(e) => { e.stopPropagation(); setView('driver-detail', { id: row.original.id }); }}
        >
          {row.original.driverName}
        </button>
      ),
    },
    { id: 'driverId', header: 'Truck ID', accessorFn: (row) => row.driverId || '—', cell: ({ row }) => <span className='font-mono text-sm'>{row.original.driverId || '—'}</span> },
    { id: 'truckType', header: 'Type', accessorFn: (row) => row.truckType || '—', cell: ({ row }) => row.original.truckType || '—' },
    { id: 'mcNumber', header: 'MC', accessorFn: (row) => row.mcNumber || '—', cell: ({ row }) => row.original.mcNumber ? <span className='font-mono text-sm'>{row.original.mcNumber}</span> : '—' },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} colorMap={DRIVER_STATUS_COLORS} labelMap={DRIVER_STATUS_LABELS} />,
    },
    { accessorKey: 'loads', header: 'Loads', cell: ({ row }) => <span className='tabular-nums'>{row.original.loads}</span> },
    {
      accessorKey: 'paidEarnings', header: 'Paid',
      cell: ({ row }) => <span className='tabular-nums text-emerald-600'>{formatCurrency(row.original.paidEarnings || 0)}</span>,
    },
    {
      accessorKey: 'pendingEarnings', header: 'Pending',
      cell: ({ row }) => <span className='tabular-nums text-amber-600'>{formatCurrency(row.original.pendingEarnings || 0)}</span>,
    },
  ];

  return (
    <div className='space-y-6'>
      <div className='flex items-center gap-3'>
        <Button variant='ghost' size='icon' onClick={() => setView('owners')}><ArrowLeft className='h-4 w-4' /></Button>
        <div className='flex-1'>
          <div className='flex items-center gap-2'>
            <Crown className='h-5 w-5 text-amber-500' />
            <h1 className='text-2xl font-bold'>{owner.name || '—'}</h1>
            <StatusBadge
              status={owner.isActive ? 'ACTIVE' : 'INACTIVE'}
              colorMap={{ ACTIVE: 'bg-emerald-100 text-emerald-800', INACTIVE: 'bg-gray-100 text-gray-800' }}
              labelMap={{ ACTIVE: 'Active', INACTIVE: 'Inactive' }}
            />
          </div>
          <p className='text-sm text-muted-foreground'>{owner.email}{owner.phone ? ` · ${owner.phone}` : ''}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={() => setShowForm(true)}>
            <Edit className='mr-2 h-4 w-4' /> Edit Owner
          </Button>
          <Button
            variant={owner.isActive ? 'destructive' : 'default'}
            onClick={() => toggleMutation.mutate(!owner.isActive)}
            disabled={toggleMutation.isPending}
          >
            {owner.isActive
              ? <><PowerOff className='mr-2 h-4 w-4' /> Deactivate</>
              : <><Power className='mr-2 h-4 w-4' /> Activate</>}
          </Button>
        </div>
      </div>

      {/* Fleet KPIs */}
      <div className='grid gap-4 grid-cols-2 lg:grid-cols-4'>
        <KpiCard icon={Truck} label='Fleet Size' value={kpis.truckCount} />
        <KpiCard icon={PackageCheck} label='Total Loads' value={kpis.totalLoads} />
        <KpiCard icon={CircleDollarSign} label='Paid Earnings' value={kpis.paidEarnings} isCurrency />
        <KpiCard icon={Clock} label='Pending Earnings' value={kpis.pendingEarnings} isCurrency />
      </div>

      {/* Profile + Company */}
      <div className='grid gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader><CardTitle className='text-base'>Owner Information</CardTitle></CardHeader>
          <CardContent>
            <div className='grid gap-3 text-sm'>
              <div className='flex items-center gap-2'>
                <Mail className='h-4 w-4 text-muted-foreground' />
                <span className='text-muted-foreground'>Email:</span> {owner.email}
              </div>
              <div className='flex items-center gap-2'>
                <Phone className='h-4 w-4 text-muted-foreground' />
                <span className='text-muted-foreground'>Phone:</span> {owner.phone || '—'}
              </div>
              <div><span className='text-muted-foreground'>Created:</span> {owner.createdAt ? formatDateTime(owner.createdAt) : '—'}</div>
              <div><span className='text-muted-foreground'>Last Updated:</span> {owner.updatedAt ? formatDateTime(owner.updatedAt) : '—'}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className='text-base'>Linked Company</CardTitle></CardHeader>
          <CardContent>
            {owner.company ? (
              <div className='space-y-3 text-sm'>
                <div className='flex items-center gap-2'>
                  <Building2 className='h-4 w-4 text-muted-foreground' />
                  <button
                    className='font-medium text-primary hover:underline'
                    onClick={() => setView('company-detail', { id: owner.company.id })}
                  >
                    {owner.company.name}
                  </button>
                  <StatusBadge
                    status={owner.company.status}
                    colorMap={{ ACTIVE: 'bg-emerald-100 text-emerald-800', INACTIVE: 'bg-gray-100 text-gray-800' }}
                    labelMap={{ ACTIVE: 'Active', INACTIVE: 'Inactive' }}
                  />
                </div>
                <div><span className='text-muted-foreground'>Location:</span> {[owner.company.city, owner.company.state].filter(Boolean).join(', ') || '—'}</div>
                <div><span className='text-muted-foreground'>Company Email:</span> {owner.company.email || '—'}</div>
                <div><span className='text-muted-foreground'>Company Phone:</span> {owner.company.phone || '—'}</div>
              </div>
            ) : (
              <p className='text-sm text-muted-foreground'>No company linked. Edit the owner to assign one.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fleet */}
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>Fleet ({trucks.length} truck{trucks.length === 1 ? '' : 's'})</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={truckCols}
            data={trucks}
            onRowClick={(row) => setView('driver-detail', { id: row.id })}
            emptyMessage='No trucks in this fleet yet'
          />
        </CardContent>
      </Card>

      <OwnerForm
        open={showForm}
        onClose={() => setShowForm(false)}
        editId={id}
        currentCompanyId={owner.companyId}
        onSuccess={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['owner', id] }); queryClient.invalidateQueries({ queryKey: ['owners'] }); }}
      />
    </div>
  );
}
