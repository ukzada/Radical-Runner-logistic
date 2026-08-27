'use client';

import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn, formatCurrency } from '@/lib/utils';

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  trend?: { value: number; label: string };
  isCurrency?: boolean;
  className?: string;
}

export function KpiCard({ icon: Icon, label, value, trend, isCurrency, className }: KpiCardProps) {
  const displayValue = isCurrency && typeof value === 'number' ? formatCurrency(value) : String(value);

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          {trend && (
            <span
              className={cn(
                'text-xs font-medium',
                trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'
              )}
            >
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </span>
          )}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold tracking-tight">{displayValue}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
