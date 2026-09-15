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
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { Loader2 } from 'lucide-react';

const ownerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().optional()
    .refine((v) => !v || v.length >= 8, 'Password must be at least 8 characters')
    .refine((v) => !v || /[A-Z]/.test(v), 'Must contain an uppercase letter')
    .refine((v) => !v || /[a-z]/.test(v), 'Must contain a lowercase letter')
    .refine((v) => !v || /[0-9]/.test(v), 'Must contain a number'),
  phone: z.string().optional(),
  companyId: z.string().optional(),
  isActive: z.boolean(),
});

type OwnerFormValues = z.infer<typeof ownerSchema>;

interface OwnerFormProps {
  open: boolean;
  onClose: () => void;
  editId: string | null;
  currentCompanyId?: string | null;
  onSuccess: () => void;
}

export function OwnerForm({ open, onClose, editId, currentCompanyId, onSuccess }: OwnerFormProps) {
  const queryClient = useQueryClient();
  const isEdit = !!editId;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<OwnerFormValues>({
    resolver: zodResolver(ownerSchema),
    defaultValues: { name: '', email: '', password: '', phone: '', companyId: '', isActive: true },
  });

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['owner', editId],
    queryFn: () => api.get(`/api/owners/${editId}`),
    enabled: !!editId,
  });

  const { data: companiesData, isLoading: loadingCompanies } = useQuery({
    queryKey: ['companies', 'for-owner-form'],
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
        phone: existing.phone || '',
        companyId: existing.companyId || '',
        isActive: existing.isActive !== false,
      });
    }
  }, [existing, reset]);

  const mutation = useMutation({
    mutationFn: (values: OwnerFormValues) => {
      const payload: any = {
        name: values.name,
        email: values.email,
        phone: values.phone || null,
        isActive: values.isActive,
      };
      const effectiveCompanyId = values.companyId || (isEdit ? currentCompanyId : '');
      if (!effectiveCompanyId) {
        return Promise.reject(new Error('Please select a company'));
      }
      payload.companyId = effectiveCompanyId;
      if (values.password) payload.password = values.password;
      return isEdit ? api.put(`/api/owners/${editId}`, payload) : api.post('/api/owners', payload);
    },
    onSuccess: () => {
      toast.success(isEdit ? 'Owner updated successfully' : 'Owner created successfully');
      queryClient.invalidateQueries({ queryKey: ['owners'] });
      if (editId) queryClient.invalidateQueries({ queryKey: ['owner', editId] });
      reset({ name: '', email: '', password: '', phone: '', companyId: '', isActive: true });
      onSuccess();
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to save owner'),
  });

  const selectedCompanyId = watch('companyId') || (isEdit ? currentCompanyId || '' : '');
  const isActive = watch('isActive');
  const companyIdError = !selectedCompanyId && (errors.companyId || (mutation.isError && !isEdit));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Company Owner' : 'Add Company Owner'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update the owner information. Leave the password blank to keep the current one.'
              : 'Create a company owner account linked to a company. The owner will manage that fleet in their portal.'}
          </DialogDescription>
        </DialogHeader>
        {loadingExisting ? (
          <div className='flex items-center justify-center py-8'><Loader2 className='h-6 w-6 animate-spin' /></div>
        ) : (
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className='space-y-4'>
            <div className='space-y-1.5'>
              <Label htmlFor='owner-name'>Full Name *</Label>
              <Input id='owner-name' placeholder='John Smith' {...register('name')} />
              {errors.name && <p className='text-xs text-red-500'>{errors.name.message}</p>}
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='owner-email'>Email *</Label>
              <Input id='owner-email' type='email' placeholder='owner@example.com' {...register('email')} />
              {errors.email && <p className='text-xs text-red-500'>{errors.email.message}</p>}
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='owner-password'>
                Password {isEdit ? '(leave blank to keep current)' : '*'}
              </Label>
              <Input
                id='owner-password'
                type='password'
                placeholder={isEdit ? 'Leave blank to keep current' : 'Min 8 chars, uppercase, lowercase, number'}
                {...register('password')}
              />
              {errors.password && <p className='text-xs text-red-500'>{errors.password.message}</p>}
              {!isEdit && (
                <p className='text-xs text-muted-foreground'>
                  The owner will use this to sign in to their fleet portal.
                </p>
              )}
            </div>

            <div className='space-y-1.5'>
              <Label htmlFor='owner-phone'>Phone</Label>
              <Input id='owner-phone' placeholder='(555) 000-0000' {...register('phone')} />
            </div>

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
              {companyIdError && (
                <p className='text-xs text-red-500'>Company is required</p>
              )}
              <p className='text-xs text-muted-foreground'>
                The owner will see only this company&apos;s fleet and earnings.
              </p>
            </div>

            <div className='flex items-center gap-3'>
              <Switch
                checked={isActive}
                onCheckedChange={(checked) => setValue('isActive', checked)}
                id='owner-status'
              />
              <Label htmlFor='owner-status' className='cursor-pointer'>
                {isActive ? 'Active' : 'Inactive'}
              </Label>
            </div>

            <div className='flex justify-end gap-2 pt-2'>
              <Button type='button' variant='outline' onClick={onClose}>Cancel</Button>
              <Button type='submit' disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
                {isEdit ? 'Update Owner' : 'Create Owner'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
