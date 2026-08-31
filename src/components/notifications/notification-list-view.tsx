'use client';

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingState } from '@/components/shared/loading-state';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

function relativeTime(date: string): string {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateTime(date);
}

export function NotificationListView() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get('/api/notifications'),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.put(`/api/notifications/${id}`, { isRead: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notifications'] }); },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.put('/api/notifications/mark-all-read', {}),
    onSuccess: () => { toast.success('All notifications marked as read'); queryClient.invalidateQueries({ queryKey: ['notifications'] }); },
    onError: (err: any) => toast.error(err?.message || 'Failed to mark all as read'),
  });

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const handleMarkAllRead = () => markAllReadMutation.mutate();

  if (isLoading) {
    return (
      <div className='space-y-4'>
        <PageHeader title='Notifications' description='Stay up to date with system activity' />
        <LoadingState count={4} />
      </div>
    );
  }

  if (!isLoading && notifications.length === 0) {
    return (
      <div className='space-y-4'>
        <PageHeader title='Notifications' description='Stay up to date with system activity' />
        <EmptyState icon={Bell} title='No notifications' description='You’re all caught up! New notifications will appear here.' />
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      <PageHeader
        title='Notifications'
        description={unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'You’re all caught up!'}
        actionLabel='Mark all as read'
        actionIcon={CheckCheck}
        onAction={handleMarkAllRead}
      />
      <div className='space-y-2'>
        {notifications.map((n: any) => (
          <button
            key={n.id}
            className={cn(
              'w-full text-left rounded-lg border px-4 py-3 transition-colors hover:bg-muted/50',
              !n.isRead && 'bg-primary/5 border-primary/20'
            )}
            onClick={() => { if (!n.isRead) markReadMutation.mutate(n.id); }}
          >
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2'>
                  <p className={cn('text-sm font-medium truncate', !n.isRead && 'font-semibold')}>{n.title}</p>
                  {!n.isRead && <span className='shrink-0 h-2 w-2 rounded-full bg-primary' />}
                </div>
                <p className='mt-0.5 text-sm text-muted-foreground line-clamp-2'>{n.message}</p>
              </div>
              <span className='shrink-0 text-xs text-muted-foreground whitespace-nowrap mt-0.5'>
                {n.createdAt ? relativeTime(n.createdAt) : ''}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
