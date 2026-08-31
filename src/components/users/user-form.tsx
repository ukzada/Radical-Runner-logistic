'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import { USER_ROLES, USER_ROLE_LABELS } from '@/lib/constants';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[a-z]/, 'Must contain a lowercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  role: z.enum(['ADMIN', 'DISPATCHER']),
  isActive: z.boolean(),
});

const editUserSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().optional().refine((v) => !v || v.length >= 8, 'Password must be at least 8 characters')
    .refine((v) => !v || /[A-Z]/.test(v), 'Must contain an uppercase letter')
    .refine((v) => !v || /[a-z]/.test(v), 'Must contain a lowercase letter')
    .refine((v) => !v || /[0-9]/.test(v), 'Must contain a number'),
  role: z.enum(['ADMIN', 'DISPATCHER']),
  isActive: z.boolean(),
});

type CreateUserFormValues = z.infer<typeof createUserSchema>;
type EditUserFormValues = z.infer<typeof editUserSchema>;

interface UserFormProps {
  open: boolean;
  onClose: () => void;
  editId: string | null;
  onSuccess: () => void;
}

export function UserForm({ open, onClose, editId, onSuccess }: UserFormProps) {
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<CreateUserFormValues | EditUserFormValues>({
    resolver: zodResolver(editId ? editUserSchema : createUserSchema),
    defaultValues: { name: '', email: '', password: '', role: 'DISPATCHER', isActive: true },
  });

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['user', editId],
    queryFn: () => api.get(`/api/users/${editId}`),
    enabled: !!editId,
  });

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name || '',
        email: existing.email,
        password: '',
        role: existing.role,
        isActive: existing.isActive,
      });
    }
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (values: any) =>
      editId ? api.put(`/api/users/${editId}`, values) : api.post('/api/users', values),
    onSuccess: () => {
      toast.success(editId ? 'User updated successfully' : 'User created successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (editId) queryClient.invalidateQueries({ queryKey: ['user', editId] });
      reset({ name: '', email: '', password: '', role: 'DISPATCHER', isActive: true });
      onSuccess();
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to save user'),
  });

  const isEdit = !!editId;
  const isActive = watch('isActive');
  const role = watch('role');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit User' : 'Create New User'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update user information. Leave password blank to keep current.' : 'Create a new system user with the specified role.'}
          </DialogDescription>
        </DialogHeader>
        {loadingExisting ? (
          <div className='flex items-center justify-center py-8'><Loader2 className='h-6 w-6 animate-spin' /></div>
        ) : (
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className='space-y-4'>
            <div className='space-y-1.5'>
              <Label htmlFor='user-name'>Full Name *</Label>
              <Input id='user-name' placeholder='John Smith' {...register('name')} />
              {errors.name && <p className='text-xs text-red-500'>{errors.name.message}</p>}
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='user-email'>Email *</Label>
              <Input id='user-email' type='email' placeholder='john@example.com' {...register('email')} />
              {errors.email && <p className='text-xs text-red-500'>{errors.email.message}</p>}
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='user-password'>Password {isEdit ? '(leave blank to keep current)' : '*'}</Label>
              <div className='relative'>
                <Input
                  id='user-password'
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isEdit ? 'Leave blank to keep current' : 'Min 8 chars, uppercase, lowercase, number'}
                  {...register('password')}
                />
                <button
                  type='button'
                  className='absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground'
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}
                </button>
              </div>
              {errors.password && <p className='text-xs text-red-500'>{errors.password.message}</p>}
            </div>

            <div className='space-y-1.5'>
              <Label>Role *</Label>
              <Select value={role} onValueChange={(v: any) => setValue('role', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {USER_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{USER_ROLE_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.role && <p className='text-xs text-red-500'>{(errors.role as any).message}</p>}
            </div>

            <div className='flex items-center gap-3'>
              <Switch
                checked={isActive}
                onCheckedChange={(checked) => setValue('isActive', checked)}
                id='user-status'
              />
              <Label htmlFor='user-status' className='cursor-pointer'>
                {isActive ? 'Active' : 'Inactive'}
              </Label>
            </div>

            <div className='flex justify-end gap-2 pt-2'>
              <Button type='button' variant='outline' onClick={onClose}>Cancel</Button>
              <Button type='submit' disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                {isEdit ? 'Update User' : 'Create User'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
