'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { LOAD_STATUSES, LOAD_STATUS_LABELS } from '@/lib/constants';
import { Loader2 } from 'lucide-react';

const loadSchema = z.object({
  driverId: z.string().optional(),
  loadDate: z.string().optional(),
  pickup: z.string().min(1, 'Pickup location is required'),
  delivery: z.string().min(1, 'Delivery location is required'),
  pickupCity: z.string().optional(),
  pickupState: z.string().optional(),
  deliveryCity: z.string().optional(),
  deliveryState: z.string().optional(),
  price: z.coerce.number().min(0),
  commodity: z.string().optional(),
  status: z.string(),
  notes: z.string().optional(),
});

type LoadFormValues = z.infer<typeof loadSchema>;

interface LoadFormProps { open: boolean; onClose: () => void; editId: string | null; onSuccess: () => void; }

export function LoadForm({ open, onClose, editId, onSuccess }: LoadFormProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<LoadFormValues>({
    resolver: zodResolver(loadSchema),
    defaultValues: { driverId: '', loadDate: '', pickup: '', delivery: '', pickupCity: '', pickupState: '', deliveryCity: '', deliveryState: '', price: 0, commodity: '', status: 'AVAILABLE', notes: '' },
  });
  const { data: existing } = useQuery({ queryKey: ['load', editId], queryFn: () => api.get(`/api/loads/${editId}`), enabled: !!editId });
  const { data: drivers } = useQuery({ queryKey: ['drivers-list'], queryFn: () => api.get('/api/drivers?limit=100&status=ACTIVE') });

  useEffect(() => {
    if (existing?.load) {
      const l = existing.load;
      reset({
        driverId: l.driverId || '', loadDate: l.loadDate?.split('T')[0] || '',
        pickup: l.pickup || '', delivery: l.delivery || '',
        pickupCity: l.pickupCity || '', pickupState: l.pickupState || '',
        deliveryCity: l.deliveryCity || '', deliveryState: l.deliveryState || '',
        price: l.price || 0, commodity: l.commodity || '',
        status: l.status, notes: l.notes || '',
      });
    }
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (values: LoadFormValues) => editId ? api.put(`/api/loads/${editId}`, values) : api.post('/api/loads', values),
    onSuccess: () => { toast.success(editId ? 'Load updated' : 'Load created'); queryClient.invalidateQueries({ queryKey: ['loads'] }); onSuccess(); },
    onError: (err: any) => toast.error(err?.message || 'Failed to save load'),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='max-w-2xl max-h-[90vh] overflow-y-auto'>
        <DialogHeader><DialogTitle>{editId ? 'Edit Load' : 'New Load'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1'>
              <Label>Driver</Label>
              <Select value={watch('driverId') || ''} onValueChange={(v) => setValue('driverId', v)}>
                <SelectTrigger><SelectValue placeholder='Select driver' /></SelectTrigger>
                <SelectContent>
                  {(drivers?.drivers || []).map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.firstName} {d.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className='space-y-1'>
              <Label>Load Date</Label>
              <Input type='date' {...register('loadDate')} />
            </div>
            <div className='space-y-1'>
              <Label>Pickup Location *</Label>
              <Input {...register('pickup')} placeholder='Full address or location name' />
              {errors.pickup && <p className='text-xs text-red-500'>{errors.pickup.message}</p>}
            </div>
            <div className='space-y-1'>
              <Label>Delivery Location *</Label>
              <Input {...register('delivery')} placeholder='Full address or location name' />
              {errors.delivery && <p className='text-xs text-red-500'>{errors.delivery.message}</p>}
            </div>
            <div className='space-y-1'>
              <Label>Pickup City</Label>
              <Input {...register('pickupCity')} placeholder='City' />
            </div>
            <div className='space-y-1'>
              <Label>Pickup State</Label>
              <Input {...register('pickupState')} placeholder='State' />
            </div>
            <div className='space-y-1'>
              <Label>Delivery City</Label>
              <Input {...register('deliveryCity')} placeholder='City' />
            </div>
            <div className='space-y-1'>
              <Label>Delivery State</Label>
              <Input {...register('deliveryState')} placeholder='State' />
            </div>
            <div className='space-y-1'>
              <Label>Load Price *</Label>
              <Input type='number' step='0.01' {...register('price')} />
              {errors.price && <p className='text-xs text-red-500'>{errors.price.message}</p>}
            </div>
            <div className='space-y-1'>
              <Label>Commodity</Label>
              <Input {...register('commodity')} placeholder='e.g. General freight' />
            </div>
            <div className='space-y-1 sm:col-span-2'>
              <Label>Status</Label>
              <Select value={watch('status')} onValueChange={(v) => setValue('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LOAD_STATUSES.map((s) => <SelectItem key={s} value={s}>{LOAD_STATUS_LABELS[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className='space-y-1'>
            <Label>Notes</Label>
            <Textarea {...register('notes')} rows={3} />
          </div>
          <div className='flex justify-end gap-2 pt-2'>
            <Button type='button' variant='outline' onClick={onClose}>Cancel</Button>
            <Button type='submit' disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {editId ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
