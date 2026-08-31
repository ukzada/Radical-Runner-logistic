'use client';

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Plus, Search, MoreHorizontal, Eye, Pencil, Ban, CheckCircle, KeyRound, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { UserForm } from './user-form';
import { USER_ROLE_LABELS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export function UserListView() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewUser, setViewUser] = useState<any>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: string; user: any } | null>(null);
  const queryClient = useQueryClient();

  const queryParams = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: '20' });
    if (search) p.set('search', search);
    if (roleFilter) p.set('role', roleFilter);
    if (statusFilter) p.set('status', statusFilter);
    return p.toString();
  }, [page, search, roleFilter, statusFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ['users', queryParams],
    queryFn: () => api.get(`/api/users?${queryParams}`),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return api.put(`/api/users/${id}`, { isActive });
    },
    onSuccess: () => {
      toast.success('User status updated');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setConfirmAction(null);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to update status'),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => api.del(`/api/users/${id}`),
    onSuccess: () => {
      toast.success('User deactivated');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setConfirmAction(null);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to deactivate user'),
  });

  const users = data?.users || [];
  const meta = data?.meta;

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className='space-y-4'>
      <PageHeader
        title='User Management'
        description='Manage system users, roles, and access'
        actionLabel='Add User'
        actionIcon={Plus}
        onAction={() => { setEditId(null); setShowForm(true); }}
      />

      {/* Filters */}
      <div className='flex flex-col sm:flex-row gap-3'>
        <div className='relative flex-1 max-w-sm'>
          <Search className='absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
          <Input
            placeholder='Search users by name or email...'
            className='pl-9'
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className='w-full sm:w-[160px]'>
            <SelectValue placeholder='All Roles' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Roles</SelectItem>
            <SelectItem value='ADMIN'>Admin</SelectItem>
            <SelectItem value='DISPATCHER'>Dispatcher</SelectItem>
          </SelectContent>
        </Select>
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

      {/* Users Table */}
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className='hidden md:table-cell'>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='hidden lg:table-cell'>Created</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className='h-4 w-full max-w-[120px]' /></TableCell>
                  ))}
                </TableRow>
              ))}
            {!isLoading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className='h-24 text-center text-muted-foreground'>
                  No users found
                </TableCell>
              </TableRow>
            )}
            {!isLoading && users.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell className='font-medium'>
                  <div className='flex items-center gap-2'>
                    <div className='h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium'>
                      {u.name ? u.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '??'}
                    </div>
                    <div>
                      <div className='font-medium'>{u.name || '—'}</div>
                      <div className='text-xs text-muted-foreground md:hidden'>{u.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className='hidden md:table-cell'>{u.email}</TableCell>
                <TableCell>
                  <Badge variant={u.role === 'ADMIN' ? 'default' : 'secondary'}>
                    {USER_ROLE_LABELS[u.role] || u.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={u.isActive ? 'default' : 'outline'} className={u.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                    {u.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </TableCell>
                <TableCell className='hidden lg:table-cell text-muted-foreground text-sm'>
                  {formatDate(u.createdAt)}
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex items-center justify-end gap-1'>
                    <Button variant='ghost' size='icon' className='h-8 w-8' title='View' onClick={() => setViewUser(u)}>
                      <Eye className='h-4 w-4' />
                    </Button>
                    <Button variant='ghost' size='icon' className='h-8 w-8' title='Edit' onClick={() => { setEditId(u.id); setShowForm(true); }}>
                      <Pencil className='h-4 w-4' />
                    </Button>
                    {u.isActive ? (
                      <Button variant='ghost' size='icon' className='h-8 w-8 text-amber-600' title='Deactivate'
                        onClick={() => setConfirmAction({ type: 'deactivate', user: u })}>
                        <Ban className='h-4 w-4' />
                      </Button>
                    ) : (
                      <Button variant='ghost' size='icon' className='h-8 w-8 text-emerald-600' title='Activate'
                        onClick={() => toggleStatusMutation.mutate({ id: u.id, isActive: true })}>
                        <CheckCircle className='h-4 w-4' />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className='flex items-center justify-between px-2'>
          <p className='text-sm text-muted-foreground'>
            Showing {((meta.page - 1) * meta.limit) + 1} to {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
          </p>
          <div className='flex items-center gap-1'>
            <Button variant='outline' size='sm' onClick={() => setPage(page - 1)} disabled={page <= 1}>Previous</Button>
            <span className='text-sm px-2'>Page {meta.page} of {meta.totalPages}</span>
            <Button variant='outline' size='sm' onClick={() => setPage(page + 1)} disabled={page >= meta.totalPages}>Next</Button>
          </div>
        </div>
      )}

      {/* User Form Dialog */}
      <UserForm
        open={showForm}
        onClose={() => { setShowForm(false); setEditId(null); }}
        editId={editId}
        onSuccess={() => { setShowForm(false); setEditId(null); queryClient.invalidateQueries({ queryKey: ['users'] }); }}
      />

      {/* View User Detail Dialog */}
      <Dialog open={!!viewUser} onOpenChange={(open) => !open && setViewUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
            <DialogDescription>Viewing user account information</DialogDescription>
          </DialogHeader>
          {viewUser && (
            <div className='space-y-4'>
              <div className='flex items-center gap-4'>
                <div className='h-14 w-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold'>
                  {viewUser.name ? viewUser.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '??'}
                </div>
                <div>
                  <h3 className='text-lg font-semibold'>{viewUser.name || '—'}</h3>
                  <p className='text-sm text-muted-foreground'>{viewUser.email}</p>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-4 text-sm'>
                <div><span className='text-muted-foreground'>Role:</span> <Badge variant={viewUser.role === 'ADMIN' ? 'default' : 'secondary'}>{USER_ROLE_LABELS[viewUser.role]}</Badge></div>
                <div><span className='text-muted-foreground'>Status:</span> <Badge className={viewUser.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>{viewUser.isActive ? 'Active' : 'Inactive'}</Badge></div>
                <div><span className='text-muted-foreground'>Phone:</span> {viewUser.phone || '—'}</div>
                <div><span className='text-muted-foreground'>Created:</span> {formatDate(viewUser.createdAt)}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Deactivate Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmAction?.type === 'deactivate' ? 'Deactivate User' : 'Confirm Action'}</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate {confirmAction?.user?.name || confirmAction?.user?.email}? They will no longer be able to log in.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant='outline'>Cancel</Button>
            </DialogClose>
            <Button
              variant='destructive'
              onClick={() => {
                if (confirmAction?.user) {
                  deleteUserMutation.mutate(confirmAction.user.id);
                }
              }}
              disabled={deleteUserMutation.isPending}
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
