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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';

const dispatcherSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  phone: z.string().optional(),
  isActive: z.boolean(),
});

type DispatcherFormValues = z.infer<typeof dispatcherSchema>;

interface DispatcherFormProps { open: boolean; onClose: () => void; editId: string | null; onSuccess: () => void; }

export function DispatcherForm({ open, onClose, editId, onSuccess }: DispatcherFormProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<DispatcherFormValues>({
    resolver: zodResolver(dispatcherSchema),
    defaultValues: { name: '', email: '', password: '', phone: '', isActive: true },
  });

  const { data: existing } = useQuery({ queryKey: ['dispatcher', editId], queryFn: () => api.get(`/api/dispatchers/${editId}`), enabled: !!editId });

  useEffect(() => {
    if (existing) {
      reset({ name: existing.name, email: existing.email, password: '', phone: existing.phone || '', isActive: existing.isActive !== false });
    }
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (values: DispatcherFormValues) => editId ? api.put(`/api/dispatchers/${editId}`, values) : api.post('/api/dispatchers', values),
    onSuccess: () => { toast.success(editId ? 'Dispatcher updated' : 'Dispatcher created'); queryClient.invalidateQueries({ queryKey: ['dispatchers'] }); reset({ name: '', email: '', password: '', phone: '', isActive: true }); onSuccess(); },
    onError: (err: any) => toast.error(err?.message || 'Failed to save dispatcher'),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editId ? 'Edit Dispatcher' : 'New Dispatcher'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className='space-y-4'>
          <div className='space-y-1'>
            <Label>Name *</Label>
            <Input {...register('name')} />
            {errors.name && <p className='text-xs text-red-500'>{errors.name.message}</p>}
          </div>
          <div className='space-y-1'>
            <Label>Email *</Label>
            <Input type='email' {...register('email')} />
            {errors.email && <p className='text-xs text-red-500'>{errors.email.message}</p>}
          </div>
          {!editId && (
            <div className='space-y-1'>
              <Label>Password *</Label>
              <Input type='password' {...register('password')} />
              {errors.password && <p className='text-xs text-red-500'>{errors.password.message}</p>}
            </div>
          )}
          {editId && (
            <div className='space-y-1'>
              <Label>Password (leave blank to keep current)</Label>
              <Input type='password' {...register('password')} />
            </div>
          )}
          <div className='space-y-1'>
            <Label>Phone</Label>
            <Input {...register('phone')} />
          </div>
          <div className='flex items-center gap-3'>
            <Switch checked={watch('isActive')} onCheckedChange={(v) => setValue('isActive', v)} />
            <Label>Active</Label>
          </div>
          <div className='flex justify-end gap-2'>
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
