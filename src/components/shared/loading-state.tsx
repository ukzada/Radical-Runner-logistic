'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface LoadingStateProps {
  count?: number;
  className?: string;
}

export function LoadingState({ count = 6, className }: LoadingStateProps) {
  return (
    <div className={className ?? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
