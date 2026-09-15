'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft, MapPin, Phone, Mail, IdCard, AlertTriangle,
  CircleDollarSign, Clock, PackageCheck, Truck, Download, Loader2, Percent, Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { downloadTruckReport } from '@/lib/report-download';
import { useViewStore } from '@/store/view-store';
import { cn, formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface TruckDetail {
  truck: {
    id: string;
    driverId: string | null;
    driverName: string;
    phone: string | null;
    email: string | null;
    truckType: string | null;
    driverStatus: string;
    cdlNumber: string | null;
    cdlState: string | null;
    cdlExpiration: string | null;
    mcNumber: string | null;
    activeLoad: { loadNumber: string; status: string; loadPrice: number } | null;
    lastLocation: { location: string; updatedAt: string | null } | null;
  };
  earnings: {
    paid: number;
    pending: number;
    totalLoads: number;
    deliveredLoads: number;
    activeLoads: number;
    dispatcherFees?: number;
    netTotal?: number;
  };
  loadHistory: Array<{
    id: string;
    loadNumber: string;
    status: string;
    origin: string | null;
    destination: string | null;
    loadPrice: number;
    commodity: string | null;
    loadDate: string | null;
    deliveryDate: string | null;
    dispatcherName?: string | null;
    dispatcherFeePercent?: number | null;
    dispatcherFee?: number;
  }>;
}

const loadStatusStyles: Record<string, string> = {
  DELIVERED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  IN_TRANSIT: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  DISPATCHED: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  AVAILABLE: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  CANCELLED: 'bg-red-500/15 text-red-400 border-red-500/30',
};

export function OwnerTruckDetail() {
  const setView = useViewStore((s) => s.setView);
  const viewParams = useViewStore((s) => s.viewParams);
  const truckId = viewParams?.id;
  const [data, setData] = useState<TruckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = () => {
    if (!data) return;
    setExporting(true);
    downloadTruckReport(data.truck.id, data.truck.driverName)
      .then(() => toast.success(`Report downloaded for ${data.truck.driverName}`))
      .catch((e) => toast.error(e?.message || 'Failed to export report'))
      .finally(() => setExporting(false));
  };

  useEffect(() => {
    if (!truckId) return;
    setLoading(true);
    setError(null);
    api
      .get<TruckDetail>(`/api/owner/trucks/${truckId}`)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e?.message || 'Failed to load truck details');
        setLoading(false);
      });
  }, [truckId]);

  if (loading) {
    return (
      <div className='min-h-screen bg-[oklch(0.16_0.02_260)] p-4 sm:p-6'>
        <div className='mx-auto max-w-5xl space-y-4'>
          <Skeleton className='h-9 w-40 bg-white/5' />
          <Skeleton className='h-40 rounded-xl bg-white/5' />
          <Skeleton className='h-96 rounded-xl bg-white/5' />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className='min-h-screen bg-[oklch(0.16_0.02_260)] p-4 sm:p-6'>
        <div className='mx-auto max-w-5xl'>
          <Button
            variant='ghost'
            className='mb-4 text-white/70 hover:bg-white/10 hover:text-white'
            onClick={() => setView('owner-portal')}
          >
            <ArrowLeft className='mr-2 h-4 w-4' /> Back to Fleet
          </Button>
          <div className='flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300'>
            <AlertTriangle className='h-5 w-5 shrink-0' />
            {error || 'Truck not found'}
          </div>
        </div>
      </div>
    );
  }

  const { truck, earnings, loadHistory } = data;
  const cdlDays = truck.cdlExpiration
    ? Math.round((new Date(truck.cdlExpiration).getTime() - Date.now()) / 86_400_000)
    : null;
  const cdlWarning = cdlDays !== null && cdlDays <= 60;

  return (
    <div className='min-h-screen bg-[oklch(0.16_0.02_260)] text-white'>
      <main className='mx-auto max-w-5xl space-y-6 p-4 sm:p-6'>
        <Button
          variant='ghost'
          className='-ml-2 text-white/70 hover:bg-white/10 hover:text-white'
          onClick={() => setView('owner-portal')}
        >
          <ArrowLeft className='mr-2 h-4 w-4' /> Back to Fleet
        </Button>

        {/* Identity card */}
        <div className='rounded-xl border border-white/10 bg-white/5 p-5'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div className='min-w-0'>
              <h1 className='text-xl font-bold'>{truck.driverName}</h1>
              <p className='mt-0.5 text-sm text-white/50'>
                {truck.driverId || '—'} · {truck.truckType || 'Truck'} · MC {truck.mcNumber || '—'}
              </p>
            </div>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                className='border-white/20 bg-transparent text-white/80 hover:bg-white/10 hover:text-white'
                disabled={exporting}
                onClick={handleExport}
              >
                {exporting ? (
                  <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                ) : (
                  <Download className='mr-2 h-4 w-4' />
                )}
                Export Report
              </Button>
              <Badge
                variant='outline'
                className={cn(
                  'border',
                  truck.driverStatus === 'ACTIVE'
                    ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
                    : 'border-zinc-500/30 bg-zinc-500/15 text-zinc-400'
                )}
              >
                {truck.driverStatus.replace('_', ' ')}
              </Badge>
            </div>
          </div>

          <div className='mt-4 grid gap-2 text-sm text-white/70 sm:grid-cols-2'>
            {truck.phone && (
              <p className='flex items-center gap-2'>
                <Phone className='h-4 w-4 shrink-0 text-white/40' /> {truck.phone}
              </p>
            )}
            {truck.email && (
              <p className='flex items-center gap-2 truncate'>
                <Mail className='h-4 w-4 shrink-0 text-white/40' /> {truck.email}
              </p>
            )}
            {truck.cdlNumber && (
              <p className='flex items-center gap-2'>
                <IdCard className='h-4 w-4 shrink-0 text-white/40' />
                CDL {truck.cdlNumber}
                {truck.cdlState ? ` (${truck.cdlState})` : ''}
              </p>
            )}
            {truck.lastLocation && (
              <p className='flex items-center gap-2'>
                <MapPin className='h-4 w-4 shrink-0 text-white/40' />
                Last known: {truck.lastLocation.location}
                {truck.lastLocation.updatedAt
                  ? ` · ${formatDateTime(truck.lastLocation.updatedAt)}`
                  : ''}
              </p>
            )}
            {truck.cdlExpiration && (
              <p className='flex items-center gap-2'>
                <Truck className='h-4 w-4 shrink-0 text-white/40' />
                CDL expires {formatDate(truck.cdlExpiration)}
              </p>
            )}
          </div>

          {cdlWarning && (
            <div className='mt-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300'>
              <AlertTriangle className='h-4 w-4 shrink-0' />
              CDL expires in {cdlDays} day{cdlDays === 1 ? '' : 's'} — schedule renewal soon.
            </div>
          )}
        </div>

        {/* Earnings stats */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          <div className='rounded-xl border border-white/10 bg-white/5 p-4'>
            <div className='flex items-center justify-between'>
              <p className='text-xs font-medium uppercase tracking-wide text-white/50'>Paid</p>
              <CircleDollarSign className='h-4 w-4 text-emerald-400' />
            </div>
            <p className='mt-2 text-xl font-bold tabular-nums text-emerald-400'>{formatCurrency(earnings.paid)}</p>
          </div>
          <div className='rounded-xl border border-white/10 bg-white/5 p-4'>
            <div className='flex items-center justify-between'>
              <p className='text-xs font-medium uppercase tracking-wide text-white/50'>Pending</p>
              <Clock className='h-4 w-4 text-amber-400' />
            </div>
            <p className='mt-2 text-xl font-bold tabular-nums text-amber-400'>{formatCurrency(earnings.pending)}</p>
          </div>
          <div className='rounded-xl border border-white/10 bg-white/5 p-4'>
            <div className='flex items-center justify-between'>
              <p className='text-xs font-medium uppercase tracking-wide text-white/50'>Dispatcher Fees</p>
              <Percent className='h-4 w-4 text-rose-400' />
            </div>
            <p className='mt-2 text-xl font-bold tabular-nums text-rose-400'>
              {formatCurrency(earnings.dispatcherFees || 0)}
            </p>
          </div>
          <div className='rounded-xl border border-white/10 bg-white/5 p-4'>
            <div className='flex items-center justify-between'>
              <p className='text-xs font-medium uppercase tracking-wide text-white/50'>Net after Fees</p>
              <Wallet className='h-4 w-4 text-sky-400' />
            </div>
            <p className='mt-2 text-xl font-bold tabular-nums text-sky-400'>
              {formatCurrency(earnings.netTotal ?? earnings.paid + earnings.pending - (earnings.dispatcherFees || 0))}
            </p>
          </div>
          <div className='rounded-xl border border-white/10 bg-white/5 p-4'>
            <div className='flex items-center justify-between'>
              <p className='text-xs font-medium uppercase tracking-wide text-white/50'>Delivered</p>
              <PackageCheck className='h-4 w-4 text-white/60' />
            </div>
            <p className='mt-2 text-xl font-bold tabular-nums'>{earnings.deliveredLoads}</p>
          </div>
          <div className='rounded-xl border border-white/10 bg-white/5 p-4'>
            <div className='flex items-center justify-between'>
              <p className='text-xs font-medium uppercase tracking-wide text-white/50'>Active Loads</p>
              <Truck className='h-4 w-4 text-blue-400' />
            </div>
            <p className='mt-2 text-xl font-bold tabular-nums'>{earnings.activeLoads}</p>
          </div>
        </div>

        {/* Load history */}
        <div className='rounded-xl border border-white/10 bg-white/5'>
          <div className='border-b border-white/10 px-5 py-4'>
            <h2 className='text-sm font-semibold text-white/80'>Load History ({loadHistory.length})</h2>
          </div>
          {loadHistory.length === 0 ? (
            <p className='p-8 text-center text-sm text-white/50'>No loads recorded for this truck yet.</p>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow className='border-white/10 hover:bg-transparent'>
                    <TableHead className='text-white/50'>Load #</TableHead>
                    <TableHead className='text-white/50'>Status</TableHead>
                    <TableHead className='text-white/50'>Route</TableHead>
                    <TableHead className='text-white/50'>Commodity</TableHead>
                    <TableHead className='text-white/50'>Dispatcher</TableHead>
                    <TableHead className='text-white/50'>Load Date</TableHead>
                    <TableHead className='text-white/50'>Delivered</TableHead>
                    <TableHead className='text-right text-white/50'>Price</TableHead>
                    <TableHead className='text-right text-white/50'>Fee</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadHistory.map((l) => (
                    <TableRow key={l.id} className='border-white/10'>
                      <TableCell className='font-medium text-white/90'>{l.loadNumber}</TableCell>
                      <TableCell>
                        <Badge
                          variant='outline'
                          className={cn('border whitespace-nowrap', loadStatusStyles[l.status] || 'border-white/20 text-white/60')}
                        >
                          {l.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className='max-w-52 truncate text-white/70'>
                        {l.origin || '—'} → {l.destination || '—'}
                      </TableCell>
                      <TableCell className='text-white/70'>{l.commodity || '—'}</TableCell>
                      <TableCell className='whitespace-nowrap text-white/70'>
                        {l.dispatcherName || '—'}
                        {l.dispatcherName && l.dispatcherFeePercent != null && (
                          <span className='ml-1 text-xs text-white/40'>({l.dispatcherFeePercent}%)</span>
                        )}
                      </TableCell>
                      <TableCell className='whitespace-nowrap text-white/70'>
                        {l.loadDate ? formatDate(l.loadDate) : '—'}
                      </TableCell>
                      <TableCell className='whitespace-nowrap text-white/70'>
                        {l.deliveryDate ? formatDate(l.deliveryDate) : '—'}
                      </TableCell>
                      <TableCell className='text-right font-medium tabular-nums text-white/90'>
                        {formatCurrency(l.loadPrice)}
                      </TableCell>
                      <TableCell className='text-right tabular-nums text-rose-300/90'>
                        {l.status === 'CANCELLED' ? '—' : formatCurrency(l.dispatcherFee || 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
