'use client';

import { useEffect, useState } from 'react';
import {
  Truck, CircleDollarSign, Clock, Activity, MapPin, Phone,
  AlertTriangle, RefreshCw, PackageCheck, PackageOpen, UserX,
  Download, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { downloadTruckReport } from '@/lib/report-download';
import { useViewStore } from '@/store/view-store';
import { cn, formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

interface TruckData {
  id: string;
  driverId: string | null;
  driverName: string;
  phone: string | null;
  truckType: string | null;
  driverStatus: string;
  cdlExpiration: string | null;
  mcNumber: string | null;
  truckStatus: 'EMPTY' | 'BOOKED' | 'OFF_DUTY';
  activeLoad: {
    id: string;
    loadNumber: string;
    status: string;
    loadPrice: number;
    pickupCity: string | null;
    pickupState: string | null;
    deliveryCity: string | null;
    deliveryState: string | null;
  } | null;
  lastLocation: { location: string; updatedAt: string | null } | null;
  earnings: { paid: number; pending: number; totalLoads: number; paidLoads: number; pendingLoads: number };
}

interface FleetData {
  kpis: {
    totalTrucks: number;
    booked: number;
    empty: number;
    offDuty: number;
    totalPaidEarnings: number;
    totalPendingEarnings: number;
    totalLoads: number;
  };
  trucks: TruckData[];
}

const statusStyles: Record<string, { label: string; classes: string; icon: React.ElementType }> = {
  BOOKED: { label: 'Booked', classes: 'bg-blue-500/15 text-blue-400 border-blue-500/30', icon: PackageCheck },
  EMPTY: { label: 'Empty', classes: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: PackageOpen },
  OFF_DUTY: { label: 'Off Duty', classes: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30', icon: UserX },
};

function isCdlExpiringSoon(expiration: string | null): boolean {
  if (!expiration) return false;
  const days = (new Date(expiration).getTime() - Date.now()) / 86_400_000;
  return days <= 60;
}

export function OwnerPortal({ onLogout }: { onLogout?: () => void }) {
  const setView = useViewStore((s) => s.setView);
  const [data, setData] = useState<FleetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  const handleExport = (truck: TruckData) => {
    setExportingId(truck.id);
    downloadTruckReport(truck.id, truck.driverName)
      .then(() => toast.success(`Report downloaded for ${truck.driverName}`))
      .catch((e) => toast.error(e?.message || 'Failed to export report'))
      .finally(() => setExportingId(null));
  };

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .get<FleetData>('/api/owner/trucks')
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e?.message || 'Failed to load fleet data');
        setLoading(false);
      });
  };

  useEffect(load, []);

  const kpiCards = data
    ? [
        { label: 'Total Trucks', value: data.kpis.totalTrucks, icon: Truck, accent: 'text-white' },
        { label: 'Booked', value: data.kpis.booked, icon: PackageCheck, accent: 'text-blue-400' },
        { label: 'Empty', value: data.kpis.empty, icon: PackageOpen, accent: 'text-emerald-400' },
        { label: 'Paid Earnings', value: formatCurrency(data.kpis.totalPaidEarnings), icon: CircleDollarSign, accent: 'text-emerald-400' },
        { label: 'Pending Earnings', value: formatCurrency(data.kpis.totalPendingEarnings), icon: Clock, accent: 'text-amber-400' },
      ]
    : [];

  return (
    <div className='min-h-screen bg-[oklch(0.16_0.02_260)] text-white'>
      {/* Dark navbar */}
      <header className='sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-white/10 bg-[oklch(0.2_0.03_260)] px-4 sm:px-6'>
        <div className='flex h-8 w-8 items-center justify-center rounded-md bg-white text-[oklch(0.2_0.03_260)] text-sm font-bold'>RR</div>
        <div className='min-w-0'>
          <p className='truncate text-sm font-semibold'>Fleet Owner Portal</p>
          <p className='truncate text-xs text-white/50'>Radical Runner Logistics</p>
        </div>
        <div className='ml-auto flex items-center gap-2'>
          <Button
            variant='ghost'
            size='icon'
            className='text-white/70 hover:bg-white/10 hover:text-white'
            onClick={load}
            title='Refresh'
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          {onLogout && (
            <Button
              variant='outline'
              size='sm'
              className='border-white/20 bg-transparent text-white/80 hover:bg-white/10 hover:text-white'
              onClick={onLogout}
            >
              Sign Out
            </Button>
          )}
        </div>
      </header>

      <main className='mx-auto max-w-7xl space-y-6 p-4 sm:p-6'>
        {loading && (
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-5'>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className='h-24 rounded-xl bg-white/5' />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className='flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300'>
            <AlertTriangle className='h-5 w-5 shrink-0' />
            <span>{error}</span>
            <Button size='sm' variant='outline' className='ml-auto border-white/20 text-white' onClick={load}>
              Retry
            </Button>
          </div>
        )}

        {!loading && data && (
          <>
            {/* KPI cards */}
            <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-5'>
              {kpiCards.map((k) => (
                <div key={k.label} className='rounded-xl border border-white/10 bg-white/5 p-4'>
                  <div className='flex items-center justify-between'>
                    <p className='text-xs font-medium uppercase tracking-wide text-white/50'>{k.label}</p>
                    <k.icon className={cn('h-4 w-4', k.accent)} />
                  </div>
                  <p className='mt-2 text-2xl font-bold tabular-nums'>{k.value}</p>
                </div>
              ))}
            </div>

            {/* Truck cards */}
            <div>
              <h3 className='mb-3 text-sm font-semibold text-white/80'>
                My Fleet ({data.trucks.length})
              </h3>
              {data.trucks.length === 0 ? (
                <div className='rounded-xl border border-white/10 bg-white/5 p-8 text-center text-sm text-white/50'>
                  No trucks are registered under your company yet.
                </div>
              ) : (
                <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                  {data.trucks.map((t) => {
                    const st = statusStyles[t.truckStatus] || statusStyles.EMPTY;
                    return (
                      <div
                        key={t.id}
                        role='button'
                        tabIndex={0}
                        onClick={() => setView('owner-truck-detail', { id: t.id })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setView('owner-truck-detail', { id: t.id });
                          }
                        }}
                        className={cn(
                          'group flex cursor-pointer flex-col rounded-xl border border-white/10 bg-white/5 p-4 text-left outline-none',
                          'transition-colors hover:border-white/25 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40'
                        )}
                      >
                        {/* Header */}
                        <div className='flex items-start justify-between gap-2'>
                          <div className='min-w-0'>
                            <p className='truncate text-base font-semibold'>{t.driverName}</p>
                            <p className='text-xs text-white/50'>
                              {t.driverId || t.id.slice(-6).toUpperCase()}
                              {t.truckType ? ` · ${t.truckType}` : ''}
                              {t.mcNumber ? ` · ${t.mcNumber}` : ''}
                            </p>
                          </div>
                          <div className='flex shrink-0 items-center gap-1.5'>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-7 w-7 text-white/60 hover:bg-white/10 hover:text-white'
                              disabled={exportingId === t.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExport(t);
                              }}
                              onKeyDown={(e) => e.stopPropagation()}
                              title='Export detailed report (CSV)'
                            >
                              {exportingId === t.id ? (
                                <Loader2 className='h-3.5 w-3.5 animate-spin' />
                              ) : (
                                <Download className='h-3.5 w-3.5' />
                              )}
                            </Button>
                            <Badge variant='outline' className={cn('shrink-0 border', st.classes)}>
                              <st.icon className='mr-1 h-3 w-3' />
                              {st.label}
                            </Badge>
                          </div>
                        </div>

                        {/* Location + phone */}
                        <div className='mt-3 space-y-1.5 text-xs text-white/60'>
                          {t.lastLocation && (
                            <p className='flex items-center gap-1.5'>
                              <MapPin className='h-3.5 w-3.5 shrink-0 text-white/40' />
                              <span className='truncate'>
                                Last known: {t.lastLocation.location}
                              </span>
                            </p>
                          )}
                          {t.phone && (
                            <p className='flex items-center gap-1.5'>
                              <Phone className='h-3.5 w-3.5 shrink-0 text-white/40' />
                              {t.phone}
                            </p>
                          )}
                          {isCdlExpiringSoon(t.cdlExpiration) && (
                            <p className='flex items-center gap-1.5 text-amber-400'>
                              <AlertTriangle className='h-3.5 w-3.5 shrink-0' />
                              CDL expires {t.cdlExpiration ? new Date(t.cdlExpiration).toLocaleDateString() : ''}
                            </p>
                          )}
                        </div>

                        {/* Active load strip */}
                        {t.activeLoad ? (
                          <div className='mt-3 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs'>
                            <p className='flex items-center gap-1.5 font-medium text-blue-300'>
                              <Activity className='h-3.5 w-3.5' />
                              {t.activeLoad.loadNumber} · {t.activeLoad.status.replace('_', ' ')}
                            </p>
                            {(t.activeLoad.pickupCity || t.activeLoad.deliveryCity) && (
                              <p className='mt-0.5 truncate text-white/60'>
                                {t.activeLoad.pickupCity}, {t.activeLoad.pickupState}
                                {' → '}
                                {t.activeLoad.deliveryCity}, {t.activeLoad.deliveryState}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className='mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50'>
                            No active load
                          </div>
                        )}

                        {/* Earnings footer */}
                        <div className='mt-3 flex items-end justify-between border-t border-white/10 pt-3'>
                          <div>
                            <p className='text-[10px] uppercase tracking-wide text-white/40'>Paid</p>
                            <p className='text-sm font-semibold text-emerald-400'>{formatCurrency(t.earnings.paid)}</p>
                          </div>
                          <div className='text-right'>
                            <p className='text-[10px] uppercase tracking-wide text-white/40'>Pending</p>
                            <p className='text-sm font-semibold text-amber-400'>{formatCurrency(t.earnings.pending)}</p>
                          </div>
                          <div className='text-right'>
                            <p className='text-[10px] uppercase tracking-wide text-white/40'>Loads</p>
                            <p className='text-sm font-semibold'>{t.earnings.totalLoads}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
