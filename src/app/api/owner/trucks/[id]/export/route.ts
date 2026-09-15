import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, errorResponse } from '@/lib/auth-helpers';

/**
 * GET /api/owner/trucks/[id]/export
 * Truck-wise detailed report export (CSV) for company owners.
 *
 * Report structure:
 *   1. Truck & driver profile (company, driver, truck type, MC, CDL)
 *   2. Earnings summary (paid / pending / totals + dispatcher fees & net)
 *   3. Full load-by-load detail table (route, dates, dispatcher, fee %, fee $, price, classification)
 *   4. Dispatcher fee summary (per-dispatcher breakdown)
 *
 * Enforces that the driver belongs to the owner's company.
 */

function csvCell(value: unknown): string {
  // Escape per RFC 4180: wrap in quotes when the value contains a comma,
  // quote, newline, or leading/trailing whitespace; double inner quotes.
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]|^\s|\s$/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',') + '\r\n';
}

function fmtDate(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDateTime(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtMoney(value: number): string {
  return value.toFixed(2);
}

function classify(status: string): string {
  if (status === 'DELIVERED') return 'PAID';
  if (status === 'CANCELLED') return 'CANCELLED';
  return 'PENDING';
}

/** Dispatcher fee for a load: percentage of the load price, per the dispatching user's feePercentage. Cancelled loads carry no fee. */
function dispatcherFeePercent(l: { dispatcher?: { feePercentage?: number | null } | null }): number {
  const pct = l.dispatcher?.feePercentage;
  return typeof pct === 'number' ? pct : 0;
}

function loadDispatcherFee(l: { status: string; loadPrice: number; dispatcher?: { feePercentage?: number | null } | null }): number {
  if (l.status === 'CANCELLED') return 0;
  return ((l.loadPrice || 0) * dispatcherFeePercent(l)) / 100;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['COMPANY_OWNER']);

    const owner = await db.user.findUnique({
      where: { id: authUser.userId },
      select: { companyId: true },
    });

    if (!owner?.companyId) {
      return errorResponse('NO_COMPANY', 'Your account is not linked to a company', 400);
    }

    const company = await db.company.findUnique({
      where: { id: owner.companyId },
      select: { name: true },
    });

    const { id } = await params;

    const driver = await db.driver.findFirst({
      where: { id, companyId: owner.companyId },
      include: { mc: { select: { mcNumber: true } } },
    });

    if (!driver) {
      return errorResponse('NOT_FOUND', 'Truck not found in your fleet', 404);
    }

    const loads = await db.load.findMany({
      where: { driverId: driver.id },
      orderBy: { loadDate: 'desc' },
      include: {
        dispatcher: { select: { name: true, email: true, feePercentage: true } },
      },
    });

    const paid = loads
      .filter((l) => l.status === 'DELIVERED')
      .reduce((sum, l) => sum + (l.loadPrice || 0), 0);
    const pending = loads
      .filter((l) => l.status !== 'DELIVERED' && l.status !== 'CANCELLED')
      .reduce((sum, l) => sum + (l.loadPrice || 0), 0);
    const total = paid + pending;
    const cancelledCount = loads.filter((l) => l.status === 'CANCELLED').length;

    // Dispatcher fees (percentage of load price per dispatching user; none on cancelled loads)
    const feeOnPaid = loads
      .filter((l) => l.status === 'DELIVERED')
      .reduce((sum, l) => sum + loadDispatcherFee(l), 0);
    const feeOnPending = loads
      .filter((l) => l.status !== 'DELIVERED' && l.status !== 'CANCELLED')
      .reduce((sum, l) => sum + loadDispatcherFee(l), 0);
    const totalFees = feeOnPaid + feeOnPending;
    const netTotal = total - totalFees;

    // Per-dispatcher fee breakdown (loads dispatched on this truck, grouped by dispatcher)
    const feeByDispatcher = new Map<
      string,
      { name: string; email: string; feePercentage: number; loads: number; gross: number; fee: number }
    >();
    for (const l of loads) {
      if (l.status === 'CANCELLED' || !l.dispatcher) continue;
      const key = l.dispatcher.email || l.dispatcher.name || 'Unknown';
      const entry = feeByDispatcher.get(key) || {
        name: l.dispatcher.name || l.dispatcher.email || 'Unknown',
        email: l.dispatcher.email || '',
        feePercentage: dispatcherFeePercent(l),
        loads: 0,
        gross: 0,
        fee: 0,
      };
      entry.loads += 1;
      entry.gross += l.loadPrice || 0;
      entry.fee += loadDispatcherFee(l);
      feeByDispatcher.set(key, entry);
    }

    const driverName = `${driver.firstName} ${driver.lastName}`;
    const generatedAt = new Date();

    // ---------- Build CSV ----------
    const lines: string[] = [];

    // Section 1: report header + truck/driver profile
    lines.push(csvRow(['RADICAL RUNNER LOGISTICS - TRUCK DETAILED REPORT']));
    lines.push(csvRow([]));
    lines.push(csvRow(['Company', company?.name || '']));
    lines.push(csvRow(['Driver', driverName]));
    lines.push(csvRow(['Driver ID', driver.driverId || '']));
    lines.push(csvRow(['Truck Type', driver.truckType || '']));
    lines.push(csvRow(['MC Number', driver.mc?.mcNumber || '']));
    lines.push(csvRow(['Driver Status', driver.status || '']));
    lines.push(csvRow(['Phone', driver.phone || '']));
    lines.push(csvRow(['Email', driver.email || '']));
    lines.push(csvRow(['CDL Number', driver.cdlNumber || '']));
    lines.push(csvRow(['CDL State', driver.cdlState || '']));
    lines.push(csvRow(['CDL Expiration', fmtDate(driver.cdlExpiration)]));
    lines.push(csvRow(['Report Generated', fmtDateTime(generatedAt)]));

    // Section 2: earnings summary
    lines.push(csvRow([]));
    lines.push(csvRow(['EARNINGS SUMMARY']));
    lines.push(csvRow(['Metric', 'Value']));
    lines.push(csvRow(['Total Loads', loads.length]));
    lines.push(csvRow(['Delivered Loads', loads.filter((l) => l.status === 'DELIVERED').length]));
    lines.push(csvRow(['Active Loads', loads.filter((l) => !['DELIVERED', 'CANCELLED'].includes(l.status)).length]));
    lines.push(csvRow(['Cancelled Loads', cancelledCount]));
    lines.push(csvRow(['Paid Earnings (USD)', fmtMoney(paid)]));
    lines.push(csvRow(['Pending Earnings (USD)', fmtMoney(pending)]));
    lines.push(csvRow(['Total Earnings (USD)', fmtMoney(total)]));
    lines.push(csvRow(['Dispatcher Fees on Paid Loads (USD)', fmtMoney(feeOnPaid)]));
    lines.push(csvRow(['Dispatcher Fees on Pending Loads (USD)', fmtMoney(feeOnPending)]));
    lines.push(csvRow(['Total Dispatcher Fees (USD)', fmtMoney(totalFees)]));
    lines.push(csvRow(['Net Earnings after Dispatcher Fees (USD)', fmtMoney(netTotal)]));

    // Section 3: load-by-load detail
    lines.push(csvRow([]));
    lines.push(csvRow(['LOAD DETAILS']));
    lines.push(
      csvRow([
        'Load #',
        'Status',
        'Classification',
        'Origin',
        'Destination',
        'Pickup City',
        'Pickup State',
        'Delivery City',
        'Delivery State',
        'Commodity',
        'Load Date',
        'Pickup Date',
        'Delivery Date',
        'Dispatcher',
        'Dispatcher Fee %',
        'Price (USD)',
        'Dispatcher Fee (USD)',
        'Notes',
      ])
    );
    for (const l of loads) {
      lines.push(
        csvRow([
          l.loadNumber,
          l.status,
          classify(l.status),
          l.origin || '',
          l.destination || '',
          l.pickupCity || '',
          l.pickupState || '',
          l.deliveryCity || '',
          l.deliveryState || '',
          l.commodity || '',
          fmtDate(l.loadDate),
          fmtDate(l.pickupDate),
          fmtDate(l.deliveryDate),
          l.dispatcher?.name || l.dispatcher?.email || '',
          l.dispatcher ? `${dispatcherFeePercent(l)}%` : '',
          fmtMoney(l.loadPrice || 0),
          fmtMoney(loadDispatcherFee(l)),
          l.notes || '',
        ])
      );
    }

    // Section 4: dispatcher fee summary (per dispatcher)
    const dispatcherSummaries = Array.from(feeByDispatcher.values()).sort((a, b) => b.fee - a.fee);
    lines.push(csvRow([]));
    lines.push(csvRow(['DISPATCHER FEE SUMMARY']));
    lines.push(
      csvRow([
        'Dispatcher',
        'Fee %',
        'Loads Dispatched',
        'Gross Revenue (USD)',
        'Dispatcher Fee (USD)',
      ])
    );
    for (const d of dispatcherSummaries) {
      lines.push(
        csvRow([
          d.name,
          `${d.feePercentage}%`,
          d.loads,
          fmtMoney(d.gross),
          fmtMoney(d.fee),
        ])
      );
    }
    if (dispatcherSummaries.length > 0) {
      lines.push(
        csvRow([
          'TOTAL',
          '',
          dispatcherSummaries.reduce((s, d) => s + d.loads, 0),
          fmtMoney(dispatcherSummaries.reduce((s, d) => s + d.gross, 0)),
          fmtMoney(dispatcherSummaries.reduce((s, d) => s + d.fee, 0)),
        ])
      );
    }

    const csv = '\ufeff' + lines.join(''); // BOM so Excel opens UTF-8 correctly

    const slug =
      driverName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'truck';

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="truck-report-${slug}-${fmtDate(generatedAt)}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    if (error.status) {
      return errorResponse(error.code, error.message, error.status);
    }
    console.error('Owner truck report export error:', error);
    return errorResponse('OWNER_TRUCK_EXPORT_ERROR', error.message || 'Failed to export truck report', 500);
  }
}
