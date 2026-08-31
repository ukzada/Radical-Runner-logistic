'use client';

import { useQuery } from '@tanstack/react-query';
import { UserCircle, Users, Truck, DollarSign, AlertTriangle, Plus, User, Building2, Hash, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { KpiCard } from '@/components/shared/kpi-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingState } from '@/components/shared/loading-state';
import { LOAD_STATUS_LABELS, LOAD_STATUS_COLORS } from '@/lib/constants';
import { useViewStore } from '@/store/view-store';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/shared/data-table';
import { exportCsv } from '@/lib/export-utils';
import { toast } from 'sonner';

export function DashboardView() {
  const setView = useViewStore((s) => s.setView);
  const user = api.getUser();
  const isAdmin = user?.role === 'ADMIN';

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/api/dashboard'),
  });

  if (isLoading) return <LoadingState count={8} />;
  if (!data) {
    return (
      <div className='flex flex-col items-center justify-center py-20 gap-3'>
        <AlertTriangle className='h-10 w-10 text-muted-foreground' />
        <p className='text-muted-foreground'>Failed to load dashboard data</p>
        <Button variant='outline' size='sm' onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  const recentLoads = data.recentLoads || [];
  const dispatcherPerformance = data.dispatcherPerformance || [];

  const loadColumns: ColumnDef<any>[] = [
    {
      accessorKey: 'loadNumber', header: 'Load #',
      cell: ({ row }) => (
        <button className='font-medium text-primary hover:underline' onClick={(e) => { e.stopPropagation(); setView('load-detail', { id: row.original.id }); }}>
          {row.original.loadNumber}
        </button>
      ),
    },
    { id: 'companyName', header: 'Company', cell: ({ row }) => row.original.companyName || '—' },
    { id: 'driverName', header: 'Driver', cell: ({ row }) => row.original.driverName || '—' },
    { id: 'dispatcherName', header: 'Dispatcher', cell: ({ row }) => row.original.dispatcherName || '—' },
    {
      id: 'route', header: 'Route',
      cell: ({ row }) => <span className='text-sm'>{row.original.pickupCity || row.original.origin} → {row.original.deliveryCity || row.original.destination}</span>,
    },
    {
      accessorKey: 'loadPrice', header: 'Price',
      cell: ({ row }) => formatCurrency(row.original.loadPrice),
    },
    {
      accessorKey: 'status', header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} colorMap={LOAD_STATUS_COLORS} labelMap={LOAD_STATUS_LABELS} />,
    },
    {
      accessorKey: 'createdAt', header: 'Date',
      cell: ({ row }) => row.original.createdAt ? formatDate(row.original.createdAt) : '—',
    },
  ];

  const dispatcherColumns: ColumnDef<any>[] = [
    {
      id: 'name', header: 'Dispatcher',
      cell: ({ row }) => (
        <button className='font-medium text-primary hover:underline' onClick={(e) => { e.stopPropagation(); setView('dispatcher-detail', { id: row.original.id }); }}>
          {row.original.name}
        </button>
      ),
    },
    { accessorKey: 'driverCount', header: 'Drivers' },
    { accessorKey: 'loadCount', header: 'Loads' },
    { accessorKey: 'deliveredLoads', header: 'Delivered' },
    { accessorKey: 'totalLoadValue', header: 'Total Value', cell: ({ row }) => formatCurrency(row.original.totalLoadValue) },
  ];

  if (isAdmin) {
    return (
      <div className='space-y-6'>
        <div className='flex items-center justify-between'>
          <h1 className='text-2xl font-bold'>Dashboard</h1>
          <Button
            variant='outline'
            size='sm'
            onClick={async () => {
              try { await exportCsv('main-financial'); }
              catch (e: any) { toast.error(e?.message || 'Export failed'); }
            }}
          >
            <FileText className='mr-2 h-4 w-4' /> Export Main Financial Report
          </Button>
        </div>
        <div className='grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'>
          <KpiCard icon={Building2} label='Companies' value={data.totalCompanies ?? 0} />
          <KpiCard icon={Hash} label='Active MCs' value={data.totalMCs ?? 0} />
          <KpiCard icon={UserCircle} label='Dispatchers' value={data.totalDispatchers ?? 0} />
          <KpiCard icon={Users} label='Drivers' value={data.totalDrivers ?? 0} />
          <KpiCard icon={DollarSign} label='Total Load Value' value={data.totalLoadValue ?? 0} isCurrency />
        </div>

        <div className='grid gap-4 grid-cols-2 lg:grid-cols-4'>
          <KpiCard icon={Users} label='Assigned Drivers' value={data.assignedDrivers ?? 0} />
          <KpiCard icon={Users} label='Unassigned Drivers' value={data.unassignedDrivers ?? 0} />
          <KpiCard icon={Truck} label='Total Loads' value={data.totalLoads ?? 0} />
          <KpiCard icon={Truck} label='Active Dispatchers' value={data.activeDispatchers ?? 0} />
        </div>

        <div className='grid gap-6 lg:grid-cols-3'>
          <Card className='lg:col-span-2'>
            <CardHeader className='pb-3'><CardTitle className='text-base'>Recent Loads</CardTitle></CardHeader>
            <CardContent>
              <DataTable columns={loadColumns} data={recentLoads} onRowClick={(row) => setView('load-detail', { id: row.id })} emptyMessage='No recent loads' />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='pb-3'><CardTitle className='text-base'>Dispatcher Performance</CardTitle></CardHeader>
            <CardContent>
              <DataTable columns={dispatcherColumns} data={dispatcherPerformance} emptyMessage='No dispatchers' />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Dispatcher Dashboard
  return (
    <div className='space-y-6'>
      <div className='grid gap-4 grid-cols-2 lg:grid-cols-3'>
        <KpiCard icon={Users} label='My Drivers' value={data.assignedDriverCount ?? 0} />
        <KpiCard icon={Users} label='Active Drivers' value={data.activeDriverCount ?? 0} />
        <KpiCard icon={Truck} label='Total Loads' value={data.totalLoads ?? 0} />
        <KpiCard icon={Truck} label='Completed Loads' value={data.completedLoads ?? 0} />
        <KpiCard icon={DollarSign} label='Total Load Value' value={data.totalLoadValue ?? 0} isCurrency />
      </div>

      <div className='flex gap-3'>
        <Button onClick={() => setView('loads')}><Plus className='mr-2 h-4 w-4' /> Add New Load</Button>
        <Button variant='outline' onClick={() => setView('drivers')}><User className='mr-2 h-4 w-4' /> View My Drivers</Button>
      </div>

      <Card>
        <CardHeader className='pb-3'><CardTitle className='text-base'>Recent Loads</CardTitle></CardHeader>
        <CardContent>
          <DataTable columns={loadColumns} data={recentLoads} onRowClick={(row) => setView('load-detail', { id: row.id })} emptyMessage='No recent loads' />
        </CardContent>
      </Card>
    </div>
  );
}