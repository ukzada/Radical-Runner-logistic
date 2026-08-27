'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/lib/api';
import { MC_STATUSES, MC_STATUS_LABELS } from '@/lib/constants';
import { Loader2 } from 'lucide-react';

const mcSchema = z.object({
  mcNumber: z.string().min(1, 'MC number is required'),
  status: z.string(),
  notes: z.string().optional(),
});

type McFormValues = z.infer<typeof mcSchema>;

interface McFormProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  editId: string | null;
  editMcNumber?: string;
  onSuccess: () => void;
}

export function McForm({ open, onClose, companyId, editId, editMcNumber, onSuccess }: McFormProps) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<McFormValues>({
    resolver: zodResolver(mcSchema),
    defaultValues: { mcNumber: '', status: 'ACTIVE', notes: '' },
  });

  useEffect(() => {
    if (editId && editMcNumber) {
      reset({ mcNumber: editMcNumber, status: 'ACTIVE', notes: '' });
    } else {
      reset({ mcNumber: '', status: 'ACTIVE', notes: '' });
    }
  }, [editId, editMcNumber, reset, open]);

  const mutation = useMutation({
    mutationFn: (values: McFormValues) => {
      if (editId) return api.put(`/api/mcs/${editId}`, values);
      return api.post(`/api/companies/${companyId}/mcs`, values);
    },
    onSuccess: () => {
      toast.success(editId ? 'MC updated' : 'MC added');
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      reset({ mcNumber: '', status: 'ACTIVE', notes: '' });
      onSuccess();
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to save MC'),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className='max-w-md'>
        <DialogHeader><DialogTitle>{editId ? 'Edit MC' : 'Add MC Number'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className='space-y-4'>
          <div className='space-y-1'>
            <Label>MC Number *</Label>
            <Input {...register('mcNumber')} placeholder='e.g. MC-123456' />
            {errors.mcNumber && <p className='text-xs text-red-500'>{errors.mcNumber.message}</p>}
          </div>
          <div className='space-y-1'>
            <Label>Status</Label>
            <Select value={watch('status')} onValueChange={(v) => setValue('status', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MC_STATUSES.map((s) => <SelectItem key={s} value={s}>{MC_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className='space-y-1'>
            <Label>Notes</Label>
            <Textarea {...register('notes')} rows={2} />
          </div>
          <div className='flex justify-end gap-2 pt-2'>
            <Button type='button' variant='outline' onClick={onClose}>Cancel</Button>
            <Button type='submit' disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
              {editId ? 'Update' : 'Add MC'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
