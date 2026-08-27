'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, UserCircle, Users, Search, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useViewStore } from '@/store/view-store';
import { StatusBadge } from '@/components/shared/status-badge';
import { DRIVER_STATUS_COLORS, DRIVER_STATUS_LABELS } from '@/lib/constants';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function DriverAssignView() {
  const setView = useViewStore((s) => s.setView);
  const queryClient = useQueryClient();
  const [selectedDispatcher, setSelectedDispatcher] = useState<string | null>(null);
  const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(new Set());
  const [dispatcherSearch, setDispatcherSearch] = useState('');
  const [driverSearch, setDriverSearch] = useState('');

  const { data: dispatchersData, isLoading: dispatchersLoading } = useQuery({
    queryKey: ['dispatchers-all'],
    queryFn: () => api.get('/api/dispatchers?limit=100&search=' + dispatcherSearch),
  });

  const { data: driversData, isLoading: driversLoading } = useQuery({
    queryKey: ['drivers-all', driverSearch],
    queryFn: () => api.get('/api/drivers?limit=100&search=' + driverSearch),
  });

  const assignMutation = useMutation({
    mutationFn: ({ dispatcherId, driverIds }: { dispatcherId: string; driverIds: string[] }) =>
      api.post('/api/dispatchers/assign-drivers', { dispatcherId, driverIds }),
    onSuccess: () => {
      toast.success('Drivers assigned successfully');
      setSelectedDrivers(new Set());
      queryClient.invalidateQueries({ queryKey: ['dispatchers-all'] });
      queryClient.invalidateQueries({ queryKey: ['drivers-all'] });
      queryClient.invalidateQueries({ queryKey: ['dispatchers'] });
      queryClient.invalidateQueries({ queryKey: ['drivers'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to assign drivers'),
  });

  const unassignMutation = useMutation({
    mutationFn: ({ driverId }: { driverId: string }) =>
      api.del(`/api/dispatchers/${selectedDispatcher}/drivers/${driverId}`),
    onSuccess: () => {
      toast.success('Driver unassigned');
      queryClient.invalidateQueries({ queryKey: ['dispatchers-all'] });
      queryClient.invalidateQueries({ queryKey: ['drivers-all'] });
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to unassign driver'),
  });

  const toggleDriver = useCallback((driverId: string) => {
    setSelectedDrivers((prev) => {
      const next = new Set(prev);
      if (next.has(driverId)) next.delete(driverId);
      else next.add(driverId);
      return next;
    });
  }, []);

  const dispatchers = (dispatchersData?.dispatchers || []).filter((d: any) => d.isActive !== false);
  const drivers = driversData?.drivers || [];
  const currentDispatcher = dispatchers.find((d: any) => d.userId === selectedDispatcher);

  const handleAssign = () => {
    if (!selectedDispatcher || selectedDrivers.size === 0) return;
    assignMutation.mutate({
      dispatcherId: selectedDispatcher,
      driverIds: Array.from(selectedDrivers),
    });
  };

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-3'>
        <Button variant='ghost' size='icon' onClick={() => setView('drivers')}><ArrowLeft className='h-4 w-4' /></Button>
        <div>
          <h1 className='text-2xl font-bold'>Assign Drivers to Dispatchers</h1>
          <p className='text-sm text-muted-foreground'>Select a dispatcher, then choose drivers to assign</p>
        </div>
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        {/* Left Panel: Dispatchers */}
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base flex items-center gap-2'>
              <UserCircle className='h-4 w-4' /> Dispatchers
            </CardTitle>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground' />
              <Input
                placeholder='Search dispatchers...'
                className='pl-8 h-8'
                value={dispatcherSearch}
                onChange={(e) => setDispatcherSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className='p-0'>
            <ScrollArea className='max-h-96'>
              <div className='divide-y'>
                {dispatchersLoading && (
                  <div className='flex items-center justify-center py-8'><Loader2 className='h-5 w-5 animate-spin text-muted-foreground' /></div>
                )}
                {dispatchers.length === 0 && !dispatchersLoading && (
                  <p className='text-sm text-muted-foreground text-center py-8'>No dispatchers found</p>
                )}
                {dispatchers.map((d: any) => (
                  <button
                    key={d.userId}
                    className={cn(
                      'w-full px-4 py-3 text-left flex items-center gap-3 transition-colors hover:bg-muted/50',
                      selectedDispatcher === d.userId && 'bg-primary/5 border-l-2 border-l-primary',
                    )}
                    onClick={() => { setSelectedDispatcher(d.userId); setSelectedDrivers(new Set()); }}
                  >
                    <div className='flex-1 min-w-0'>
                      <p className='font-medium text-sm truncate'>{d.name}</p>
                      <p className='text-xs text-muted-foreground'>{d.driverCount || 0} drivers</p>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right Panel: Drivers */}
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base flex items-center gap-2'>
              <Users className='h-4 w-4' /> Drivers
              {currentDispatcher && (
                <Badge variant='secondary'>Assigned to {currentDispatcher.name}</Badge>
              )}
            </CardTitle>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground' />
              <Input
                placeholder='Search drivers...'
                className='pl-8 h-8'
                value={driverSearch}
                onChange={(e) => setDriverSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className='p-0'>
            <ScrollArea className='max-h-96'>
              <div className='divide-y'>
                {driversLoading && (
                  <div className='flex items-center justify-center py-8'><Loader2 className='h-5 w-5 animate-spin text-muted-foreground' /></div>
                )}
                {drivers.length === 0 && !driversLoading && (
                  <p className='text-sm text-muted-foreground text-center py-8'>No drivers found</p>
                )}
                {drivers.map((d: any) => (
                  <div
                    key={d.id}
                    className='px-4 py-3 flex items-center gap-3 hover:bg-muted/50'
                  >
                    <Checkbox
                      checked={selectedDrivers.has(d.id)}
                      onCheckedChange={() => toggleDriver(d.id)}
                    />
                    <div className='flex-1 min-w-0'>
                      <p className='font-medium text-sm truncate'>{d.firstName} {d.lastName}</p>
                      <div className='flex items-center gap-2'>
                        <span className='text-xs text-muted-foreground'>{d.cdlNumber || d.phone || ''}</span>
                        <StatusBadge status={d.status} colorMap={DRIVER_STATUS_COLORS} labelMap={DRIVER_STATUS_LABELS} />
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      {d.dispatcherId && d.dispatcherId !== selectedDispatcher && (
                        <span className='text-xs text-muted-foreground'>{d.dispatcherName}</span>
                      )}
                      {d.dispatcherId === selectedDispatcher && (
                        <Button
                          variant='ghost' size='sm'
                          className='text-red-500 hover:text-red-700 h-7 text-xs'
                          onClick={() => unassignMutation.mutate({ driverId: d.id })}
                          disabled={unassignMutation.isPending}
                        >
                          Unassign
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
          {selectedDispatcher && selectedDrivers.size > 0 && (
            <div className='border-t p-3 flex items-center justify-between'>
              <span className='text-sm text-muted-foreground'>{selectedDrivers.size} driver{selectedDrivers.size > 1 ? 's' : ''} selected</span>
              <Button
                size='sm'
                onClick={handleAssign}
                disabled={assignMutation.isPending}
              >
                {assignMutation.isPending && <Loader2 className='mr-2 h-3 w-3 animate-spin' />}
                <Check className='mr-1 h-3 w-3' /> Assign to {currentDispatcher?.name}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
