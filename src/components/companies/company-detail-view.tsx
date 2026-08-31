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
import { COMPANY_STATUS_COLORS, COMPANY_STATUS_LABELS, MC_STATUS_COLORS, MC_STATUS_LABELS, DRIVER_STATUS_COLORS, DRIVER_STATUS_LABELS, LOAD_STATUS_LABELS, LOAD_STATUS_COLORS } from '@/lib/constants';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, Building2, Users, Truck, DollarSign, Plus, Edit, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { CompanyForm } from './company-form';
import { McForm } from './mc-form';
import { DriverForm } from '@/components/drivers/driver-form';
import { Badge } from '@/components/ui/badge';

export function CompanyDetailView() {
  const { viewParams, setView } = useViewStore();
  const id = viewParams.id;
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [showMcForm, setShowMcForm] = useState(false);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [editMc, setEditMc] = useState<{ id: string; mcNumber: string } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['company', id],
    queryFn: () => api.get(`/api/companies/${id}`),
    enabled: !!id,
  });

  const toggleMutation = useMutation({
    mutationFn: () => api.put(`/api/companies/${id}`, { status: data?.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }),
    onSuccess: () => { toast.success('Company status updated'); queryClient.invalidateQueries({ queryKey: ['company', id] }); queryClient.invalidateQueries({ queryKey: ['companies'] }); },
    onError: (err: any) => toast.error(err?.message || 'Failed to update status'),
  });

  const toggleMcMutation = useMutation({
    mutationFn: (mcId: string) => api.put(`/api/mcs/${mcId}`, { status: 'INACTIVE' }),
    onSuccess: () => { toast.success('MC deactivated'); queryClient.invalidateQueries({ queryKey: ['company', id] }); },
    onError: (err: any) => toast.error(err?.message || 'Failed to deactivate MC'),
  });

  if (isLoading) return <LoadingState count={4} />;
  if (isError) {
    return (
      <div className='flex flex-col items-center justify-center py-20'>
        <p className='text-muted-foreground mb-4'>{(error as any)?.message || 'Failed to load data'}</p>
        <Button variant='outline' onClick={() => setView('companies')}>Go to Companies</Button>
      </div>
    );
  }
  if (!data) return null;

  const company = data;
  const mcs = company.mcs || [];
  const drivers = company.drivers || [];

  const mcColumns: ColumnDef<any>[] = [
    {
      id: 'mcNumber', header: 'MC Number',
      cell: ({ row }) => <span className='font-mono font-medium'>{row.original.mcNumber}</span>,
    },
    {
      accessorKey: 'driverCount', header: 'Drivers',
      cell: ({ row }) => <span>{row.original.driverCount || 0}</span>,
    },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} colorMap={MC_STATUS_COLORS} labelMap={MC_STATUS_LABELS} />,
    },
    {
      id: 'actions', header: '',
      cell: ({ row }) => (
        <div className='flex gap-1'>
          <Button variant='ghost' size='sm' onClick={(e) => { e.stopPropagation(); setEditMc({ id: row.original.id, mcNumber: row.original.mcNumber }); setShowMcForm(true); }}>Edit</Button>
          {row.original.status === 'ACTIVE' && row.original.driverCount === 0 && (
            <Button variant='ghost' size='sm' className='text-red-600' onClick={(e) => { e.stopPropagation(); toggleMcMutation.mutate(row.original.id); }}>Deactivate</Button>
          )}
        </div>
      ),
    },
  ];

  const driverColumns: ColumnDef<any>[] = [
    {
      id: 'name', header: 'Driver',
      cell: ({ row }) => (
        <button className='font-medium text-primary hover:underline' onClick={(e) => { e.stopPropagation(); setView('driver-detail', { id: row.original.id }); }}>
          {row.original.firstName} {row.original.lastName}
        </button>
      ),
    },
    {
      id: 'mcNumber', header: 'MC',
      cell: ({ row }) => <span className='font-mono text-sm'>{row.original.mcNumber || '—'}</span>,
    },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} colorMap={DRIVER_STATUS_COLORS} labelMap={DRIVER_STATUS_LABELS} />,
    },
    {
      id: 'dispatcher', header: 'Dispatcher',
      cell: ({ row }) => row.original.dispatchers?.[0]?.name || <span className='text-muted-foreground'>Unassigned</span>,
    },
    {
      accessorKey: 'loadCount', header: 'Loads',
      cell: ({ row }) => row.original.loadCount || 0,
    },
  ];

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center gap-3'>
        <Button variant='ghost' size='icon' onClick={() => setView('companies')}><ArrowLeft className='h-4 w-4' /></Button>
        <div className='flex-1'>
          <div className='flex items-center gap-2'>
            <h1 className='text-2xl font-bold'>{company.name}</h1>
            <StatusBadge status={company.status} colorMap={COMPANY_STATUS_COLORS} labelMap={COMPANY_STATUS_LABELS} />
          </div>
          <p className='text-sm text-muted-foreground'>{company.city}{company.state ? `, ${company.state}` : ''}{company.email ? ` · ${company.email}` : ''}</p>
        </div>
        <div className='flex gap-2'>
          <Button variant='outline' onClick={() => setShowCompanyForm(true)}><Edit className='mr-2 h-4 w-4' /> Edit</Button>
          <Button variant={company.status === 'ACTIVE' ? 'destructive' : 'default'} onClick={() => toggleMutation.mutate()} disabled={toggleMutation.isPending}>
            {company.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className='grid gap-4 grid-cols-2 lg:grid-cols-4'>
        <KpiCard icon={Hash} label='MC Numbers' value={mcs.length} />
        <KpiCard icon={Users} label='Total Drivers' value={drivers.length} />
        <KpiCard icon={Truck} label='Total Loads' value={company.totalLoads || 0} />
        <KpiCard icon={DollarSign} label='Total Load Value' value={company.totalLoadValue || 0} isCurrency />
      </div>

      {/* Company Info */}
      <Card>
        <CardHeader><CardTitle className='text-base'>Company Information</CardTitle></CardHeader>
        <CardContent>
          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm'>
            <div><span className='text-muted-foreground'>Email:</span> {company.email || '—'}</div>
            <div><span className='text-muted-foreground'>Phone:</span> {company.phone || '—'}</div>
            <div><span className='text-muted-foreground'>Address:</span> {company.address || '—'}</div>
            <div><span className='text-muted-foreground'>City:</span> {company.city || '—'}</div>
            <div><span className='text-muted-foreground'>State:</span> {company.state || '—'}</div>
            <div><span className='text-muted-foreground'>Zip Code:</span> {company.zipCode || '—'}</div>
            {company.notes && <div className='col-span-full'><span className='text-muted-foreground'>Notes:</span> {company.notes}</div>}
          </div>
        </CardContent>
      </Card>

      {/* MC Numbers */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle className='text-base'>MC Numbers ({mcs.length})</CardTitle>
          <Button size='sm' onClick={() => { setEditMc(null); setShowMcForm(true); }}><Plus className='mr-2 h-4 w-4' /> Add MC</Button>
        </CardHeader>
        <CardContent>
          <DataTable columns={mcColumns} data={mcs} emptyMessage='No MC numbers' />
        </CardContent>
      </Card>

      {/* Drivers under this company */}
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle className='text-base'>All Drivers ({drivers.length})</CardTitle>
          <Button size='sm' onClick={() => setShowDriverForm(true)}><Plus className='mr-2 h-4 w-4' /> Add Driver</Button>
        </CardHeader>
        <CardContent>
          <DataTable columns={driverColumns} data={drivers} onRowClick={(row) => setView('driver-detail', { id: row.id })} emptyMessage='No drivers in this company' />
        </CardContent>
      </Card>

      <CompanyForm open={showCompanyForm} onClose={() => setShowCompanyForm(false)} editId={id} onSuccess={() => { setShowCompanyForm(false); queryClient.invalidateQueries({ queryKey: ['company', id] }); }} />
      <McForm open={showMcForm} onClose={() => { setShowMcForm(false); setEditMc(null); }} companyId={id} editId={editMc?.id || null} editMcNumber={editMc?.mcNumber} onSuccess={() => { setShowMcForm(false); setEditMc(null); }} />
      <DriverForm open={showDriverForm} onClose={() => setShowDriverForm(false)} editId={null} onSuccess={() => { setShowDriverForm(false); queryClient.invalidateQueries({ queryKey: ['company', id] }); queryClient.invalidateQueries({ queryKey: ['drivers'] }); }} defaultCompanyId={id} />
    </div>
  );
}
