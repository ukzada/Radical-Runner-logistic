'use client';

import { useEffect, useState } from 'react';
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

const baseFields = {
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  role: z.enum(['ADMIN', 'DISPATCHER', 'COMPANY_OWNER']),
  companyId: z.string().optional(),
  feePercentage: z.string().optional(),
  isActive: z.boolean(),
};

const passwordRules = (required: boolean) =>
  required
    ? z.string().min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Must contain an uppercase letter')
        .regex(/[a-z]/, 'Must contain a lowercase letter')
        .regex(/[0-9]/, 'Must contain a number')
    : z.string().optional().refine((v) => !v || v.length >= 8, 'Password must be at least 8 characters')
        .refine((v) => !v || /[A-Z]/.test(v), 'Must contain an uppercase letter')
        .refine((v) => !v || /[a-z]/.test(v), 'Must contain a lowercase letter')
        .refine((v) => !v || /[0-9]/.test(v), 'Must contain a number');

// COMPANY_OWNER requires a company; DISPATCHER fee % must be 0-100 when provided
const roleRefinement = (data: {
  role: string;
  companyId?: string;
  feePercentage?: string;
}, ctx: z.RefinementCtx) => {
  if (data.role === 'COMPANY_OWNER' && !data.companyId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['companyId'],
      message: 'Company is required for a company owner',
    });
  }
  if (data.role === 'DISPATCHER' && data.feePercentage) {
    const n = Number(data.feePercentage);
    if (Number.isNaN(n) || n < 0 || n > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['feePercentage'],
        message: 'Fee must be between 0 and 100',
      });
    }
  }
};

const createUserSchema = z
  .object({ ...baseFields, password: passwordRules(true) })
  .superRefine(roleRefinement);

const editUserSchema = z
  .object({ ...baseFields, password: passwordRules(false) })
  .superRefine(roleRefinement);

type CreateUserFormValues = z.infer<typeof createUserSchema>;
type EditUserFormValues = z.infer<typeof editUserSchema>;

interface UserFormProps {
  open: boolean;
  onClose: () => void;
  editId: string | null;
  onSuccess: () => void;
}

const EMPTY_VALUES = {
  name: '',
  email: '',
  password: '',
  role: 'DISPATCHER' as const,
  companyId: '',
  feePercentage: '10',
  isActive: true,
};

export function UserForm({ open, onClose, editId, onSuccess }: UserFormProps) {
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<
    CreateUserFormValues | EditUserFormValues
  >({
    resolver: zodResolver(editId ? editUserSchema : createUserSchema),
    defaultValues: EMPTY_VALUES,
  });

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['user', editId],
    queryFn: () => api.get(`/api/users/${editId}`),
    enabled: !!editId,
  });

  // Companies list for the Company Owner picker
  const { data: companiesData, isLoading: loadingCompanies } = useQuery({
    queryKey: ['companies', 'for-user-form'],
    queryFn: () => api.get('/api/companies?limit=100&sortBy=name'),
    enabled: open,
  });
  const companies: Array<{ id: string; name: string }> = companiesData?.companies || [];

  useEffect(() => {
    if (existing) {
      reset({
        name: existing.name || '',
        email: existing.email,
        password: '',
        role: existing.role,
        companyId: existing.companyId || '',
        feePercentage:
          existing.feePercentage !== undefined && existing.feePercentage !== null
            ? String(existing.feePercentage)
            : '10',
        isActive: existing.isActive,
      });
    }
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (values: any) => {
      // Shape the payload per role
      const payload: any = {
        name: values.name,
        email: values.email,
        role: values.role,
        isActive: values.isActive,
      };
      if (!editId) payload.password = values.password;
      else if (values.password) payload.password = values.password;

      if (values.role === 'COMPANY_OWNER') {
        payload.companyId = values.companyId;
      } else if (values.role === 'DISPATCHER') {
        if (values.feePercentage !== undefined && values.feePercentage !== '') {
          payload.feePercentage = Number(values.feePercentage);
        }
      }
      return editId ? api.put(`/api/users/${editId}`, payload) : api.post('/api/users', payload);
    },
    onSuccess: () => {
      toast.success(editId ? 'User updated successfully' : 'User created successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (editId) queryClient.invalidateQueries({ queryKey: ['user', editId] });
      reset(EMPTY_VALUES);
      onSuccess();
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to save user'),
  });

  const isEdit = !!editId;
  const isActive = watch('isActive');
  const role = watch('role');
  const selectedCompanyId = watch('companyId');

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

            {role === 'COMPANY_OWNER' && (
              <div className='space-y-1.5'>
                <Label>Company *</Label>
                <Select
                  value={selectedCompanyId || undefined}
                  onValueChange={(v) => setValue('companyId', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingCompanies ? 'Loading companies…' : 'Select a company'} />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.companyId && <p className='text-xs text-red-500'>{errors.companyId.message}</p>}
                <p className='text-xs text-muted-foreground'>
                  The owner will see only this company&apos;s fleet and earnings in their portal.
                </p>
              </div>
            )}

            {role === 'DISPATCHER' && (
              <div className='space-y-1.5'>
                <Label htmlFor='user-fee'>Dispatcher Fee (%)</Label>
                <Input
                  id='user-fee'
                  type='number'
                  min='0'
                  max='100'
                  step='0.5'
                  placeholder='10'
                  {...register('feePercentage')}
                />
                {errors.feePercentage && <p className='text-xs text-red-500'>{errors.feePercentage.message}</p>}
                <p className='text-xs text-muted-foreground'>
                  Commission this dispatcher earns on each dispatched load (percentage of the load price). Used in company-owner report exports.
                </p>
              </div>
            )}

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
