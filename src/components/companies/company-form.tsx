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
import { COMPANY_STATUSES, COMPANY_STATUS_LABELS } from '@/lib/constants';
import { Loader2 } from 'lucide-react';

const companySchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  status: z.string(),
  notes: z.string().optional(),
});

type CompanyFormValues = z.infer<typeof companySchema>;

interface CompanyFormProps {
  open: boolean;
  onClose: () => void;
  editId: string | null;
  onSuccess: () => void;
}

export function CompanyForm({ open, onClose, editId, onSuccess }: CompanyFormProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '', status: 'ACTIVE', notes: '' },
  });

  const { data: existing } = useQuery({
    queryKey: ['company', editId],
    queryFn: () => api.get(`/api/companies/${editId}`),
    enabled: !!editId,
  });

  useEffect(() => {
    if (existing) {
      reset({ name: existing.name, email: existing.email || '', phone: existing.phone || '', address: existing.address || '', city: existing.city || '', state: existing.state || '', zipCode: existing.zipCode || '', status: existing.status, notes: existing.notes || '' });
    }
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (values: CompanyFormValues) => editId ? api.put(`/api/companies/${editId}`, values) : api.post('/api/companies', values),
    onSuccess: () => { toast.success(editId ? 'Company updated' : 'Company created'); queryClient.invalidateQueries({ queryKey: ['companies'] }); reset({ name: '', email: '', phone: '', address: '', city: '', state: '', zipCode: '', status: 'ACTIVE', notes: '' }); onSuccess(); },
    onError: (err: any) => toast.error(err?.message || 'Failed to save company'),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='max-w-lg max-h-[90vh] overflow-y-auto'>
        <DialogHeader><DialogTitle>{editId ? 'Edit Company' : 'New Company'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className='space-y-4'>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1 col-span-2'><Label>Company Name *</Label><Input {...register('name')} />{errors.name && <p className='text-xs text-red-500'>{errors.name.message}</p>}</div>
            <div className='space-y-1'><Label>Email</Label><Input {...register('email')} />{errors.email && <p className='text-xs text-red-500'>{errors.email.message}</p>}</div>
            <div className='space-y-1'><Label>Phone</Label><Input {...register('phone')} /></div>
            <div className='space-y-1 col-span-2'><Label>Address</Label><Input {...register('address')} /></div>
            <div className='space-y-1'><Label>City</Label><Input {...register('city')} /></div>
            <div className='space-y-1'><Label>State</Label><Input {...register('state')} placeholder='e.g. GA' /></div>
            <div className='space-y-1'><Label>Zip Code</Label><Input {...register('zipCode')} /></div>
            <div className='space-y-1'><Label>Status</Label><Select value={watch('status')} onValueChange={(v) => setValue('status', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{COMPANY_STATUSES.map((s) => <SelectItem key={s} value={s}>{COMPANY_STATUS_LABELS[s]}</SelectItem>)}</SelectContent></Select></div>
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
