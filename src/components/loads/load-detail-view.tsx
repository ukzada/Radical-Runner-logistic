'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useViewStore } from '@/store/view-store';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/shared/status-badge';
import { LoadingState } from '@/components/shared/loading-state';
import { LOAD_STATUS_LABELS, LOAD_STATUS_COLORS, VALID_STATUS_TRANSITIONS } from '@/lib/constants';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { ArrowLeft, User, MapPin, DollarSign, Edit, Loader2, UserCircle, Building2, Hash } from 'lucide-react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { LoadForm } from './load-form';

export function LoadDetailView() {
  const { viewParams, setView } = useViewStore();
  const id = viewParams.id;
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['load', id],
    queryFn: () => api.get(`/api/loads/${id}`),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.put(`/api/loads/${id}`, { status }),
    onSuccess: () => { toast.success('Status updated'); queryClient.invalidateQueries({ queryKey: ['load', id] }); },
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

  const load = data.load || data;
  const transitions = VALID_STATUS_TRANSITIONS[load.status] || [];

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col sm:flex-row sm:items-center gap-3'>
        <div className='flex items-center gap-3'>
          <Button variant='ghost' size='icon' onClick={() => setView('loads')}><ArrowLeft className='h-4 w-4' /></Button>
          <div>
            <div className='flex items-center gap-2'>
              <h1 className='text-2xl font-bold'>{load.loadNumber}</h1>
              <StatusBadge status={load.status} colorMap={LOAD_STATUS_COLORS} labelMap={LOAD_STATUS_LABELS} />
            </div>
            <p className='text-sm text-muted-foreground'>{load.pickupCity || load.origin} → {load.deliveryCity || load.destination}</p>
          </div>
        </div>
        <div className='flex items-center gap-2 sm:ml-auto'>
          {transitions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant='outline'><ChevronDown className='mr-2 h-4 w-4' /> Change Status</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {transitions.map((t) => (
                  <DropdownMenuItem key={t} onClick={() => statusMutation.mutate(t)} disabled={statusMutation.isPending}>
                    {LOAD_STATUS_LABELS[t]} {statusMutation.isPending && <Loader2 className='ml-2 h-3 w-3 animate-spin' />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant='outline' onClick={() => setShowForm(true)}><Edit className='mr-2 h-4 w-4' /> Edit</Button>
        </div>
      </div>

      {/* Info cards */}
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        <Card className='cursor-pointer hover:bg-muted/50 transition-colors' onClick={() => load.driverId && setView('driver-detail', { id: load.driverId })}>
          <CardContent className='p-4'>
            <div className='flex items-center gap-2 text-sm text-muted-foreground'><User className='h-4 w-4' /> Driver</div>
            <p className='mt-1 font-medium'>{load.driverName || '—'}</p>
          </CardContent>
        </Card>
        <Card className='cursor-pointer hover:bg-muted/50 transition-colors' onClick={() => load.createdBy && setView('dispatcher-detail', { id: load.createdBy })}>
          <CardContent className='p-4'>
            <div className='flex items-center gap-2 text-sm text-muted-foreground'><UserCircle className='h-4 w-4' /> Dispatcher</div>
            <p className='mt-1 font-medium'>{load.dispatcherName || '—'}</p>
          </CardContent>
        </Card>
        <Card className='cursor-pointer hover:bg-muted/50 transition-colors' onClick={() => load.companyId && setView('company-detail', { id: load.companyId })}>
          <CardContent className='p-4'>
            <div className='flex items-center gap-2 text-sm text-muted-foreground'><Building2 className='h-4 w-4' /> Company</div>
            <p className='mt-1 font-medium'>{load.companyName || '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className='p-4'>
            <div className='flex items-center gap-2 text-sm text-muted-foreground'><DollarSign className='h-4 w-4' /> Load Price</div>
            <p className='mt-1 font-medium'>{formatCurrency(load.loadPrice)}</p>
          </CardContent>
        </Card>
      </div>

      {/* MC info row */}
      {load.mcNumber && (
        <div className='flex items-center gap-4 text-sm'>
          <div className='flex items-center gap-1.5 text-muted-foreground'><Hash className='h-3.5 w-3.5' /> MC:</div>
          <span className='font-mono font-medium'>{load.mcNumber}</span>
        </div>
      )}

      <div className='grid gap-6 lg:grid-cols-2'>
        <Card>
          <CardHeader><CardTitle className='text-base'>Load Details</CardTitle></CardHeader>
          <CardContent>
            <div className='space-y-3 text-sm'>
              <div className='flex justify-between'><span className='text-muted-foreground'>Pickup Location</span><span>{load.origin || '—'}</span></div>
              <div className='flex justify-between'><span className='text-muted-foreground'>Pickup City/State</span><span>{load.pickupCity || '—'}{load.pickupState ? `, ${load.pickupState}` : ''}</span></div>
              <div className='flex justify-between'><span className='text-muted-foreground'>Delivery Location</span><span>{load.destination || '—'}</span></div>
              <div className='flex justify-between'><span className='text-muted-foreground'>Delivery City/State</span><span>{load.deliveryCity || '—'}{load.deliveryState ? `, ${load.deliveryState}` : ''}</span></div>
              <div className='flex justify-between'><span className='text-muted-foreground'>Load Date</span><span>{load.loadDate ? formatDate(load.loadDate) : '—'}</span></div>
              <div className='flex justify-between'><span className='text-muted-foreground'>Commodity</span><span>{load.commodity || '—'}</span></div>
              {load.createdAt && <div className='flex justify-between'><span className='text-muted-foreground'>Created</span><span>{formatDateTime(load.createdAt)}</span></div>}
              {load.updatedAt && <div className='flex justify-between'><span className='text-muted-foreground'>Updated</span><span>{formatDateTime(load.updatedAt)}</span></div>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className='text-base flex items-center gap-2'><MapPin className='h-4 w-4' /> Notes</CardTitle></CardHeader>
          <CardContent>
            <p className='text-sm'>{load.notes || 'No notes for this load.'}</p>
          </CardContent>
        </Card>
      </div>

      <LoadForm open={showForm} onClose={() => setShowForm(false)} editId={id} onSuccess={() => { setShowForm(false); queryClient.invalidateQueries({ queryKey: ['load', id] }); }} />
    </div>
  );
}