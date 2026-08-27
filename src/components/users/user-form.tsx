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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { USER_ROLES, USER_ROLE_LABELS } from '@/lib/constants';
import { Loader2 } from 'lucide-react';

const userSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional().or(z.literal('')),
  role: z.string(),
});

type UserFormValues = z.infer<typeof userSchema>;

interface UserFormProps { open: boolean; onClose: () => void; editId: string | null; onSuccess: () => void; }

export function UserForm({ open, onClose, editId, onSuccess }: UserFormProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: '', email: '', password: '', role: 'DISPATCHER' },
  });

  const { data: existing } = useQuery({ queryKey: ['user', editId], queryFn: () => api.get(`/api/users/${editId}`), enabled: !!editId });

  useEffect(() => {
    if (existing) {
      reset({ name: existing.name, email: existing.email, password: '', role: existing.role });
    }
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (values: UserFormValues) => editId ? api.put(`/api/users/${editId}`, values) : api.post('/api/users', values),
    onSuccess: () => { toast.success(editId ? 'User updated' : 'User created'); queryClient.invalidateQueries({ queryKey: ['users'] }); reset({ name: '', email: '', password: '', role: 'DISPATCHER' }); onSuccess(); },
    onError: (err: any) => toast.error(err?.message || 'Failed to save user'),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editId ? 'Edit User' : 'New User'}</DialogTitle></DialogHeader>
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
          <div className='space-y-1'>
            <Label>Password {editId ? '(leave blank to keep current)' : '*'}</Label>
            <Input type='password' {...register('password')} />
            {errors.password && <p className='text-xs text-red-500'>{errors.password.message}</p>}
          </div>
          <div className='space-y-1'>
            <Label>Role</Label>
            <Select value={watch('role')} onValueChange={(v) => setValue('role', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{USER_ROLE_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
