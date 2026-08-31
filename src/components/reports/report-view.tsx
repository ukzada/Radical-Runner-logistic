'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/shared/data-table';
import { LoadingState } from '@/components/shared/loading-state';
import { PageHeader } from '@/components/shared/page-header';
import { formatCurrency, formatDate } from '@/lib/utils';
import { ColumnDef } from '@tanstack/react-table';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { api } from '@/lib/api';

const REPORT_TYPES = [
  { value: 'dispatcher-revenue', label: 'Dispatcher Revenue' },
  { value: 'driver-performance', label: 'Driver Performance' },
  { value: 'load-status', label: 'Load Status' },
  { value: 'financial', label: 'Financial' },
];

export function ReportView() {
  const [reportType, setReportType] = useState('dispatcher-revenue');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['report', reportType, dateFrom, dateTo],
    queryFn: () => api.get(`/api/reports?type=${reportType}&dateFrom=${dateFrom}&dateTo=${dateTo}`),
    enabled: !!dateFrom && !!dateTo,
  });

  return (
    <div className='space-y-6'>
      <PageHeader title='Reports' description='Generate and view reports' />

      <Card>
        <CardContent className='p-4'>
          <div className='flex flex-wrap gap-4 items-end'>
            <div className='space-y-1'>
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger className='w-[200px]'><SelectValue /></SelectTrigger>
                <SelectContent>{REPORT_TYPES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className='space-y-1'><Label>From</Label><Input type='date' value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
            <div className='space-y-1'><Label>To</Label><Input type='date' value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {(!dateFrom || !dateTo) && (
        <div className='text-center py-12 text-muted-foreground'>Select a date range to generate a report</div>
      )}

      {isLoading && <LoadingState count={4} />}

      {isError && (
        <div className='flex flex-col items-center justify-center py-20 gap-3'>
          <p className='text-muted-foreground'>Failed to generate report</p>
          <Button variant='outline' size='sm' onClick={() => refetch()}>Retry</Button>
        </div>
      )}

      {data && !isLoading && (
        <div className='space-y-6'>
          {data.chartData && data.chartData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className='text-base'>Chart</CardTitle></CardHeader>
              <CardContent>
                <div className='h-72'>
                  <ResponsiveContainer width='100%' height='100%'>
                    {reportType === 'financial' ? (
                      <LineChart data={data.chartData}>
                        <CartesianGrid strokeDasharray='3 3' />
                        <XAxis dataKey='label' fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                        <Line type='monotone' dataKey='gross' stroke='#10b981' name='Gross' />
                        <Line type='monotone' dataKey='net' stroke='#6366f1' name='Net' />
                      </LineChart>
                    ) : (
                      <BarChart data={data.chartData}>
                        <CartesianGrid strokeDasharray='3 3' />
                        <XAxis dataKey='label' fontSize={12} />
                        <YAxis fontSize={12} />
                        <Tooltip formatter={(value: any) => typeof value === 'number' && reportType !== 'load-status' ? formatCurrency(value) : value} />
                        <Bar dataKey='value' fill='#10b981' name='Value' />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {data.summary && (
            <div className='grid gap-4 grid-cols-2 lg:grid-cols-4'>
              {data.summary.map((item: any, i: number) => (
                <Card key={i}><CardContent className='p-4'><p className='text-xs text-muted-foreground'>{item.label}</p><p className='text-xl font-bold'>{item.isCurrency ? formatCurrency(item.value) : item.value}</p></CardContent></Card>
              ))}
            </div>
          )}

          {data.tableData && data.tableData.length > 0 && (
            <Card>
              <CardHeader><CardTitle className='text-base'>Details</CardTitle></CardHeader>
              <CardContent>
                <ReportTable data={data.tableData} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function ReportTable({ data }: { data: Record<string, any>[] }) {
  if (!data.length) return null;
  const keys = Object.keys(data[0]).filter((k) => k !== 'id');
  const columns: ColumnDef<any>[] = keys.map((key) => ({
    accessorKey: key,
    header: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
    cell: ({ row }) => {
      const val = row.original[key];
      const isCurrencyKey = typeof val === 'number' && (key.toLowerCase().includes('revenue') || key.toLowerCase().includes('amount') || key.toLowerCase().includes('fee') || key.toLowerCase().includes('total') || key.toLowerCase().includes('gross') || key.toLowerCase().includes('net') || key.toLowerCase().includes('value') || key.toLowerCase().includes('price'));
      if (isCurrencyKey) {
        return formatCurrency(val);
      }
      if (typeof val === 'number') return val;
      if (typeof val === 'string' && val.includes('T00:00')) return formatDate(val);
      return String(val ?? '');
    },
  }));

  return <DataTable columns={columns} data={data} emptyMessage='No data' />;
}
