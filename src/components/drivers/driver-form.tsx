'use client';

import { useEffect } from 'react';
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
import { DRIVER_STATUSES, DRIVER_STATUS_LABELS } from '@/lib/constants';
import { Loader2 } from 'lucide-react';

const driverSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  cdlNumber: z.string().optional(),
  cdlState: z.string().optional(),
  cdlExpiration: z.string().optional(),
  status: z.string(),
  notes: z.string().optional(),
  mcId: z.string().optional(),
});

type DriverFormValues = z.infer<typeof driverSchema>;

interface DriverFormProps {
  open: boolean;
  onClose: () => void;
  editId: string | null;
  onSuccess: () => void;
}

export function DriverForm({ open, onClose, editId, onSuccess }: DriverFormProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<DriverFormValues>({
    resolver: zodResolver(driverSchema),
    defaultValues: { firstName: '', lastName: '', email: '', phone: '', cdlNumber: '', cdlState: '', cdlExpiration: '', status: 'ACTIVE', notes: '', mcId: '' },
  });

  const { data: existing } = useQuery({
    queryKey: ['driver', editId],
    queryFn: () => api.get(`/api/drivers/${editId}`),
    enabled: !!editId,
  });

  // Fetch all MCs for the dropdown
  const { data: mcData } = useQuery({
    queryKey: ['mcs-all'],
    queryFn: () => api.get('/api/search?q='),
    select: (data: any) => data?.results?.mcs || [],
    staleTime: 60000,
  });

  // Build a flat list of MCs with company names for the dropdown
  const { data: companiesData } = useQuery({
    queryKey: ['companies-list'],
    queryFn: () => api.get('/api/companies?limit=100'),
    select: (data: any) => data?.companies || [],
    staleTime: 60000,
  });

  // Get all MCs for all companies
  const { data: allMcs } = useQuery({
    queryKey: ['all-mcs'],
    queryFn: async () => {
      const companies = companiesData || [];
      const mcsPromises = companies.map((c: any) => api.get(`/api/companies/${c.id}/mcs`));
      const mcsResults = await Promise.all(mcsPromises);
      const flat: any[] = [];
      mcsResults.forEach((result: any, idx: number) => {
        const companyName = companies[idx]?.name || '';
        (result?.mcs || []).forEach((mc: any) => {
          flat.push({ ...mc, companyName });
        });
      });
      return flat;
    },
    enabled: !!(companiesData && companiesData.length > 0),
    staleTime: 60000,
  });

  useEffect(() => {
    if (existing) {
      reset({ firstName: existing.firstName, lastName: existing.lastName, email: existing.email || '', phone: existing.phone || '', cdlNumber: existing.cdlNumber || '', cdlState: existing.cdlState || '', cdlExpiration: existing.cdlExpiration?.split('T')[0] || '', status: existing.status, notes: existing.notes || '', mcId: existing.mcId || '' });
    }
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (values: DriverFormValues) => editId ? api.put(`/api/drivers/${editId}`, values) : api.post('/api/drivers', values),
    onSuccess: () => { toast.success(editId ? 'Driver updated' : 'Driver created'); queryClient.invalidateQueries({ queryKey: ['drivers'] }); reset({ firstName: '', lastName: '', email: '', phone: '', cdlNumber: '', cdlState: '', cdlExpiration: '', status: 'ACTIVE', notes: '', mcId: '' }); onSuccess(); },
    onError: (err: any) => toast.error(err?.message || 'Failed to save driver'),
  });

  const mcs = allMcs || [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='max-w-lg max-h-[90vh] overflow-y-auto'>
        <DialogHeader><DialogTitle>{editId ? 'Edit Driver' : 'New Driver'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1'><Label>First Name *</Label><Input {...register('firstName')} />{errors.firstName && <p className='text-xs text-red-500'>{errors.firstName.message}</p>}</div>
            <div className='space-y-1'><Label>Last Name *</Label><Input {...register('lastName')} />{errors.lastName && <p className='text-xs text-red-500'>{errors.lastName.message}</p>}</div>
            <div className='space-y-1'><Label>Email</Label><Input {...register('email')} />{errors.email && <p className='text-xs text-red-500'>{errors.email.message}</p>}</div>
            <div className='space-y-1'><Label>Phone</Label><Input {...register('phone')} /></div>
            <div className='space-y-1'><Label>CDL Number</Label><Input {...register('cdlNumber')} /></div>
            <div className='space-y-1'><Label>CDL State</Label><Input {...register('cdlState')} placeholder='e.g. TX' /></div>
            <div className='space-y-1'><Label>CDL Expiry</Label><Input type='date' {...register('cdlExpiration')} /></div>
            <div className='space-y-1'>
              <Label>Status</Label>
              <Select value={watch('status')} onValueChange={(v) => setValue('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DRIVER_STATUSES.map((s) => <SelectItem key={s} value={s}>{DRIVER_STATUS_LABELS[s]}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div className='space-y-1'>
            <Label>MC Number</Label>
            <Select value={watch('mcId') || '_none'} onValueChange={(v) => setValue('mcId', v === '_none' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder='Select MC...' /></SelectTrigger>
              <SelectContent>
                <SelectItem value='_none'>None (Unassigned)</SelectItem>
                {mcs.filter((mc: any) => mc.status === 'ACTIVE').map((mc: any) => (
                  <SelectItem key={mc.id} value={mc.id}>{mc.mcNumber} — {mc.companyName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-1'><Label>Notes</Label><Textarea {...register('notes')} rows={3} /></div>
          <div className='flex justify-end gap-2 pt-2'>
            <Button type='button' variant='outline' onClick={onClose}>Cancel</Button>
            <Button type='submit' disabled={mutation.isPending}>{mutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}{editId ? 'Update' : 'Create'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
