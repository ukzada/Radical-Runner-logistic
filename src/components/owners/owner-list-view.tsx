'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import { Plus, Search, Eye, Pencil, Ban, CheckCircle, Crown } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { OwnerForm } from './owner-form';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useViewStore } from '@/store/view-store';
import { toast } from 'sonner';

export function OwnerListView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewOwner, setViewOwner] = useState<any>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'deactivate' | 'activate'; owner: any } | null>(null);
  const setView = useViewStore((s) => s.setView);
  const queryClient = useQueryClient();

  const queryParams = new URLSearchParams({ page: String(page), limit: '20' });
  if (search) queryParams.set('search', search);
  if (statusFilter) queryParams.set('status', statusFilter);

  const { data, isLoading } = useQuery({
    queryKey: ['owners', queryParams.toString()],
    queryFn: () => api.get(`/api/owners?${queryParams.toString()}`),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/api/owners/${id}`, { isActive }),
    onSuccess: () => {
      toast.success('Owner status updated');
      queryClient.invalidateQueries({ queryKey: ['owners'] });
      queryClient.invalidateQueries({ queryKey: ['owner'] });
      setConfirmAction(null);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to update status'),
  });

  const owners = data?.owners || [];
  const meta = data?.meta;

  const openCreate = () => { setEditId(null); setShowForm(true); };
  const openEdit = (id: string) => { setEditId(id); setShowForm(true); };

  const columns: ColumnDef<any>[] = [
    {
      id: 'name', header: 'Owner',
      cell: ({ row }) => (
        <button
          className='font-medium text-primary hover:underline text-left'
          onClick={(e) => { e.stopPropagation(); setView('owner-detail', { id: row.original.id }); }}
        >
          {row.original.name || '—'}
        </button>
      ),
    },
    { accessorKey: 'email', header: 'Email' },
    { id: 'company', header: 'Company', accessorFn: (row) => row.companyName || '—', cell: ({ row }) => row.original.companyName || '—' },
    { id: 'phone', header: 'Phone', accessorFn: (row) => row.phone || '—', cell: ({ row }) => row.original.phone || '—' },
    {
      accessorKey: 'truckCount', header: 'Fleet',
      cell: ({ row }) => (
        <span className='tabular-nums'>{row.original.truckCount} truck{row.original.truckCount === 1 ? '' : 's'}</span>
      ),
    },
    {
      accessorKey: 'paidEarnings', header: 'Paid Earnings',
      cell: ({ row }) => <span className='tabular-nums'>{formatCurrency(row.original.paidEarnings || 0)}</span>,
    },
    {
      accessorKey: 'pendingEarnings', header: 'Pending',
      cell: ({ row }) => <span className='tabular-nums'>{formatCurrency(row.original.pendingEarnings || 0)}</span>,
    },
    {
      accessorKey: 'isActive', header: 'Status',
      cell: ({ row }) => (
        <Badge
          variant='outline'
          className={row.original.isActive
            ? 'bg-emerald-100 text-emerald-800 border-transparent'
            : 'bg-red-100 text-red-800 border-transparent'}
        >
          {row.original.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      accessorKey: 'createdAt', header: 'Created',
      cell: ({ row }) => <span className='text-muted-foreground text-sm'>{formatDate(row.original.createdAt)}</span>,
    },
    {
      id: 'actions', header: '', enableSorting: false,
      cell: ({ row }) => (
        <div className='flex items-center justify-end gap-1' onClick={(e) => e.stopPropagation()}>
          <Button variant='ghost' size='icon' className='h-8 w-8' title='View' onClick={() => setViewOwner(row.original)}>
            <Eye className='h-4 w-4' />
          </Button>
          <Button variant='ghost' size='icon' className='h-8 w-8' title='Edit' onClick={() => openEdit(row.original.id)}>
            <Pencil className='h-4 w-4' />
          </Button>
          {row.original.isActive ? (
            <Button
              variant='ghost' size='icon' className='h-8 w-8 text-amber-600' title='Deactivate'
              onClick={() => setConfirmAction({ type: 'deactivate', owner: row.original })}
            >
              <Ban className='h-4 w-4' />
            </Button>
          ) : (
            <Button
              variant='ghost' size='icon' className='h-8 w-8 text-emerald-600' title='Activate'
              onClick={() => setConfirmAction({ type: 'activate', owner: row.original })}
            >
              <CheckCircle className='h-4 w-4' />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className='space-y-4'>
      <PageHeader
        title='Company Owners'
        description='Manage fleet owners, their companies, and portal access'
        actionLabel='Add Owner'
        actionIcon={Plus}
        onAction={openCreate}
      />

      {/* Filters */}
      <div className='flex flex-col sm:flex-row gap-3'>
        <div className='relative flex-1 max-w-sm'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Search owners by name, email, company...'
            className='pl-9'
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className='w-full sm:w-[160px]'>
            <SelectValue placeholder='All Status' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Status</SelectItem>
            <SelectItem value='active'>Active</SelectItem>
            <SelectItem value='inactive'>Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Owners Table */}
      <DataTable
        columns={columns}
        data={owners}
        isLoading={isLoading}
        pagination={meta ? {
          page: meta.page, limit: meta.limit, total: meta.total, totalPages: meta.totalPages, onPageChange: setPage,
        } : undefined}
        onRowClick={(row) => setView('owner-detail', { id: row.id })}
        emptyMessage='No company owners found. Click "Add Owner" to create one.'
      />

      {/* Create / Edit Form */}
      <OwnerForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditId(null); }}
        editId={editId}
        currentCompanyId={editId ? owners.find((o: any) => o.id === editId)?.companyId : null}
        onSuccess={() => { setShowForm(false); setEditId(null); queryClient.invalidateQueries({ queryKey: ['owners'] }); }}
      />

      {/* Quick View Dialog */}
      <Dialog open={!!viewOwner} onOpenChange={(open) => !open && setViewOwner(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Owner Details</DialogTitle>
            <DialogDescription>Company owner account information</DialogDescription>
          </DialogHeader>
          {viewOwner && (
            <div className='space-y-4'>
              <div className='flex items-center gap-4'>
                <div className='h-14 w-14 rounded-full bg-muted flex items-center justify-center'>
                  <Crown className='h-6 w-6 text-amber-500' />
                </div>
                <div>
                  <h3 className='text-lg font-semibold'>{viewOwner.name || '—'}</h3>
                  <p className='text-sm text-muted-foreground'>{viewOwner.email}</p>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-4 text-sm'>
                <div><span className='text-muted-foreground'>Company:</span> {viewOwner.companyName || '—'}</div>
                <div><span className='text-muted-foreground'>Phone:</span> {viewOwner.phone || '—'}</div>
                <div><span className='text-muted-foreground'>Fleet:</span> {viewOwner.truckCount} truck{viewOwner.truckCount === 1 ? '' : 's'}</div>
                <div>
                  <span className='text-muted-foreground'>Status:</span>{' '}
                  <Badge className={viewOwner.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                    {viewOwner.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div><span className='text-muted-foreground'>Paid Earnings:</span> {formatCurrency(viewOwner.paidEarnings || 0)}</div>
                <div><span className='text-muted-foreground'>Pending:</span> {formatCurrency(viewOwner.pendingEarnings || 0)}</div>
              </div>
              <div className='flex justify-end gap-2'>
                <Button variant='outline' onClick={() => { const id = viewOwner.id; setViewOwner(null); openEdit(id); }}>
                  <Pencil className='mr-2 h-4 w-4' /> Edit
                </Button>
                <Button onClick={() => { const id = viewOwner.id; setViewOwner(null); setView('owner-detail', { id }); }}>
                  Open Full Profile
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Activate / Deactivate */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction?.type === 'deactivate' ? 'Deactivate Owner' : 'Activate Owner'}</DialogTitle>
            <DialogDescription>
              {confirmAction?.type === 'deactivate'
                ? `Are you sure you want to deactivate ${confirmAction?.owner?.name || confirmAction?.owner?.email}? They will no longer be able to sign in to their portal.`
                : `Reactivate ${confirmAction?.owner?.name || confirmAction?.owner?.email}? They will regain portal access.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant='outline'>Cancel</Button>
            </DialogClose>
            <Button
              variant={confirmAction?.type === 'deactivate' ? 'destructive' : 'default'}
              disabled={toggleStatusMutation.isPending}
              onClick={() => {
                if (confirmAction?.owner) {
                  toggleStatusMutation.mutate({
                    id: confirmAction.owner.id,
                    isActive: confirmAction.type === 'activate',
                  });
                }
              }}
            >
              {confirmAction?.type === 'deactivate' ? 'Deactivate' : 'Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
