import { db } from '@/lib/db';
import { getAuthUserAsync, requireRole, successResponse, errorResponse } from '@/lib/auth-helpers';
import { Prisma } from '@prisma/client';

function escapeCsv(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function generateCsv(headers: string[], rows: any[][]): string {
  const headerRow = headers.map(escapeCsv).join(',');
  const dataRows = rows.map(row => row.map(escapeCsv).join(',')).join('\n');
  return headerRow + '\n' + dataRows;
}

function parsePreset(preset: string | null): { gte: Date | undefined; lte: Date | undefined } {
  const now = new Date();
  let gte: Date | undefined;
  let lte: Date | undefined;

  switch (preset) {
    case 'today':
      gte = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      lte = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;
    case 'this_week':
      const dayOfWeek = now.getDay();
      gte = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek);
      lte = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 7);
      break;
    case 'this_month':
      gte = new Date(now.getFullYear(), now.getMonth(), 1);
      lte = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case 'previous_month':
      gte = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      lte = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'this_year':
      gte = new Date(now.getFullYear(), 0, 1);
      lte = new Date(now.getFullYear() + 1, 0, 1);
      break;
    case 'all':
    default:
      break;
  }

  if (preset) return { gte, lte };

  if (gte) return { gte: new Date(gte) };
  if (lte) return { lte: new Date(lte) };

  return { gte: undefined, lte: undefined };
}

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserAsync(request);
    requireRole(authUser, ['ADMIN']);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'audit-logs';
    const { gte, lte } = parsePreset(searchParams.get('preset'));

    let csvContent = '';
    let filename = '';

    // Audit logs export
    if (type === 'audit-logs') {
      const action = searchParams.get('action') || '';
      const entityType = searchParams.get('entityType') || '';
      const entityId = searchParams.get('entityId') || '';
      const userId = searchParams.get('userId') || '';

      const where: Prisma.AuditLogWhereInput = {};
      if (action) where.action = action;
      if (entityType) where.entityType = entityType;
      if (entityId) where.entityId = entityId;
      if (userId) where.userId = userId;
      if (gte || lte) {
        where.createdAt = {};
        if (gte) (where.createdAt as Prisma.DateTimeNullableFilter).gte = gte;
        if (lte) (where.createdAt as Prisma.DateTimeNullableFilter).lte = lte;
      }

      const logs = await db.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
        orderBy: { createdAt: 'desc' },
      });

      const headers = [
        'Log ID', 'Date', 'Time', 'User', 'User ID', 'User Role',
        'Action', 'Action Type', 'Resource/Entity', 'Resource ID',
        'Previous Value', 'New Value', 'Description', 'IP Address', 'Timestamp'
      ];

      const rows = logs.map(log => [
        log.id,
        log.createdAt.toISOString().split('T')[0],
        log.createdAt.toISOString().split('T')[1]?.substring(0, 8) || '',
        log.user?.name || 'System',
        log.user?.id || '',
        log.user?.role || '',
        log.action,
        log.entityType || '',
        log.entityId || '',
        log.oldValues || '',
        log.newValues || '',
        log.reason || '',
        log.ipAddress || '',
        log.createdAt.toISOString(),
      ]);

      csvContent = generateCsv(headers, rows);
      filename = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    }
    // Dispatcher performance export
    else if (type === 'dispatcher-performance') {
      const dispatcherIds = await db.user.findMany({ where: { role: 'DISPATCHER' } }).then(d => d.map(x => x.id));
      const loadStats = await db.load.groupBy({
        by: ['createdBy'],
        _count: { id: true },
        _sum: { loadPrice: true },
        where: { createdBy: { in: dispatcherIds }, ...(gte || lte ? { createdAt: { ...(gte && { gte }), ...(lte && { lte }) } } : {}) },
      });

      const loadStatsMap = Object.fromEntries(
        loadStats.filter(s => s.createdBy).map(s => [s.createdBy!, { loadCount: s._count.id, totalLoadValue: s._sum.loadPrice || 0 }])
      );

      const loadDetails = await db.load.findMany({
        where: { createdBy: { in: dispatcherIds }, ...(gte || lte ? { createdAt: { ...(gte && { gte }), ...(lte && { lte }) } } : {}) },
        include: { driver: { select: { id: true, firstName: true, lastName: true } } },
      });

      const driverLoadMap = new Map<string, { completed: number; pending: number; cancelled: number; totalValue: number }>();
      for (const load of loadDetails) {
        const dispatcherId = load.createdBy!.toString();
        const key = dispatcherId;
        if (!driverLoadMap.has(key)) driverLoadMap.set(key, { completed: 0, pending: 0, cancelled: 0, totalValue: 0 });
        const stats = driverLoadMap.get(key)!;
        if (load.status === 'DELIVERED') { stats.completed++; stats.totalValue += load.loadPrice; }
        else if (load.status === 'CANCELLED') stats.cancelled++;
        else stats.pending++;
      }

      const headers = [
        'Dispatcher ID', 'Dispatcher Name', 'Email', 'Status',
        'Number of Assigned Drivers', 'Driver Names',
        'Total Loads', 'Completed Loads', 'Pending Loads', 'Cancelled Loads',
        'Total Revenue Generated', 'Dispatcher Earnings / Commission',
        'Total Driver Earnings', 'Average Load Value', 'Total Miles',
        'Date Range', 'Performance/Progress %'
      ];

      const rows = dispatchers.map(d => {
        const stats = loadStatsMap[d.id] || { loadCount: 0, totalLoadValue: 0 };
        const driverStats = driverLoadMap.get(d.id) || { completed: 0, pending: 0, cancelled: 0, totalValue: 0 };
        const driverNames = d.driverAssignments.map(da => `${da.driver.firstName} ${da.driver.lastName}`).join('; ');
        const progress = stats.loadCount > 0 ? ((driverStats.completed / stats.loadCount) * 100).toFixed(1) + '%' : '0%';
        const avgLoadValue = stats.loadCount > 0 ? (stats.totalLoadValue / stats.loadCount).toFixed(2) : '0';
        const driverEarnings = driverStats.totalValue * 0.6;
        const dispatcherEarnings = stats.totalLoadValue * 0.05;

        return [
          d.id,
          d.name || '',
          d.email || '',
          d.isActive ? 'ACTIVE' : 'INACTIVE',
          d.driverAssignments.length,
          driverNames,
          stats.loadCount,
          driverStats.completed,
          driverStats.pending,
          driverStats.cancelled,
          stats.totalLoadValue.toFixed(2),
          dispatcherEarnings.toFixed(2),
          driverEarnings.toFixed(2),
          avgLoadValue,
          'N/A',
          gte ? `${gte.toISOString().split('T')[0]} to ${lte?.toISOString().split('T')[0] || 'present'}` : 'All time',
          progress,
        ];
      });

      csvContent = generateCsv(headers, rows);
      filename = `dispatcher-performance-${new Date().toISOString().split('T')[0]}.csv`;
    }
    // Driver details export
    else if (type === 'driver-details') {
      const driverId = searchParams.get('driverId') || '';
      const status = searchParams.get('status') || '';
      const dispatcherId = searchParams.get('dispatcherId') || '';
      const companyId = searchParams.get('companyId') || '';

      const where: Prisma.DriverWhereInput = {};
      if (status) where.status = status;
      if (driverId) where.id = driverId;
      if (dispatcherId) where.dispatcherAssignments = { some: { dispatcherId } };
      if (companyId) {
        const companyMcIds = await db.mC.findMany({ where: { companyId }, select: { id: true } }).then(m => m.map(x => x.id));
        where.mcId = { in: companyMcIds };
      }

      const drivers = await db.driver.findMany({
        where,
        include: {
          mc: { select: { id: true, mcNumber: true, company: { select: { id: true, name: true } } } },
          dispatcherAssignments: { include: { dispatcher: { select: { id: true, name: true, email: true } } } },
          loads: { where: gte || lte ? { createdAt: { ...(gte && { gte }), ...(lte && { lte }) } } : {} },
        },
        orderBy: { createdAt: 'desc' },
      });

      const headers = [
        'Driver ID', 'Driver Name', 'Phone', 'Email', 'Status',
        'Assigned Dispatcher', 'Number of Trips', 'Completed Trips',
        'Pending Trips', 'Cancelled Trips', 'Total Revenue Generated',
        'Total Driver Earnings', 'Average Trip Value', 'Trip Dates',
        'Origin', 'Destination', 'Load/Customer/Company',
        'Trip Cost/Revenue', "Driver's Earnings", 'Dispatcher Associated'
      ];

      const rows: string[][] = [];
      for (const d of drivers) {
        const dispatcher = d.dispatcherAssignments[0]?.dispatcher;
        const loads = d.loads;
        const completedLoads = loads.filter(l => l.status === 'DELIVERED');
        const pendingLoads = loads.filter(l => l.status !== 'DELIVERED' && l.status !== 'CANCELLED');
        const cancelledLoads = loads.filter(l => l.status === 'CANCELLED');
        const totalRevenue = completedLoads.reduce((sum, l) => sum + l.loadPrice, 0);
        const driverEarnings = totalRevenue * 0.6;
        const avgTripValue = completedLoads.length > 0 ? (totalRevenue / completedLoads.length).toFixed(2) : '0';

        if (loads.length > 0) {
          for (const load of loads) {
            const loadRevenue = load.loadPrice;
            const loadDriverEarnings = loadRevenue * 0.6;
            rows.push([
              d.id,
              `${d.firstName} ${d.lastName}`,
              d.phone || '',
              d.email || '',
              d.status,
              dispatcher?.name || 'Unassigned',
              loads.length.toString(),
              completedLoads.length.toString(),
              pendingLoads.length.toString(),
              cancelledLoads.length.toString(),
              totalRevenue.toFixed(2),
              driverEarnings.toFixed(2),
              avgTripValue,
              load.createdAt.toISOString().split('T')[0],
              load.pickupCity || load.origin || '',
              load.deliveryCity || load.destination || '',
              load.commodity || d.mc?.company?.name || '',
              loadRevenue.toFixed(2),
              loadDriverEarnings.toFixed(2),
              dispatcher?.name || 'Unassigned',
            ]);
          }
        } else {
          rows.push([
            d.id,
            `${d.firstName} ${d.lastName}`,
            d.phone || '',
            d.email || '',
            d.status,
            dispatcher?.name || 'Unassigned',
            '0', '0', '0', '0', '0', '0', '0',
            '', '', '', '', '', '', dispatcher?.name || 'Unassigned',
          ]);
        }
      }

      csvContent = generateCsv(headers, rows);
      filename = `driver-details-${new Date().toISOString().split('T')[0]}.csv`;
    }
    // Company performance export
    else if (type === 'company-performance') {
      const companyId = searchParams.get('companyId') || '';
      const where: Prisma.CompanyWhereInput = {};
      if (companyId) where.id = companyId;

      const companies = await db.company.findMany({
        where,
        include: {
          mcs: { include: { drivers: { include: { loads: { where: gte || lte ? { createdAt: { ...(gte && { gte }), ...(lte && { lte }) } } : {} } } } } },
        },
        orderBy: { name: 'asc' },
      });

      const headers = [
        'Company ID', 'Company Name', 'Number of Loads/Trips',
        'Total Revenue', 'Total Amount Paid/Generated',
        'Total Company Revenue', 'Total Amount Generated Through Company',
        'Number of Drivers', 'Driver Names',
        'Revenue Generated by Each Driver', 'Number of Trips per Driver',
        'Revenue per Driver', 'Total Company-Level Revenue', 'Date Range'
      ];

      const rows: string[][] = [];
      for (const company of companies) {
        const allDrivers = company.mcs.flatMap(mc => mc.drivers);
        const allLoads = allDrivers.flatMap(d => d.loads);
        const completedLoads = allLoads.filter(l => l.status === 'DELIVERED');
        const totalRevenue = completedLoads.reduce((sum, l) => sum + l.loadPrice, 0);
        const driverNames = allDrivers.map(d => `${d.firstName} ${d.lastName}`).join('; ');

        const driverBreakdown = allDrivers.map(d => {
          const dLoads = d.loads;
          const dCompleted = dLoads.filter(l => l.status === 'DELIVERED');
          const dRevenue = dCompleted.reduce((sum, l) => sum + l.loadPrice, 0);
          return `${d.firstName} ${d.lastName}: ${dLoads.length} trips, $${dRevenue.toFixed(2)}`;
        }).join('; ');

        rows.push([
          company.id,
          company.name,
          allLoads.length.toString(),
          totalRevenue.toFixed(2),
          totalRevenue.toFixed(2),
          totalRevenue.toFixed(2),
          totalRevenue.toFixed(2),
          allDrivers.length.toString(),
          driverNames,
          driverBreakdown,
          '',
          '',
          totalRevenue.toFixed(2),
          gte ? `${gte.toISOString().split('T')[0]} to ${lte?.toISOString().split('T')[0] || 'present'}` : 'All time',
        ]);
      }

      csvContent = generateCsv(headers, rows);
      filename = `company-performance-${new Date().toISOString().split('T')[0]}.csv`;
    }
    // Main financial export
    else if (type === 'main-financial') {
      // Use the loads API
      const loadApiResult = await fetch('/api/loads?limit=100', {
        headers: { Authorization: `Bearer ${authUser.userId}` }
      });
      const loadData = await loadApiResult.json();
      const loads = Array.isArray(loadData.loads) ? loadData.loads : (loadData.loads && loadData.loads.length > 0 ? loadData.loads : []);

      const headers = [
        'Trip ID', 'Date', 'Company', 'Dispatcher', 'Driver',
        'Origin', 'Destination', 'Load Amount', 'Driver Cost',
        'Dispatcher Commission', 'Company Revenue', 'Radical Runner Revenue'
      ];

      const rows = loads.map(load => {
        const loadAmount = load.loadPrice || 0;
        const driverCost = loadAmount * 0.6;
        const dispatcherCommission = loadAmount * 0.05;
        const companyRevenue = loadAmount;
        const radicalRunnerRevenue = loadAmount - driverCost - dispatcherCommission;

        return [
          load.loadNumber || '—',
          load.createdAt ? load.createdAt.toISOString().split('T')[0] : '—',
          '—',
          '—',
          '—',
          '—',
          '—',
          loadAmount.toFixed(2),
          driverCost.toFixed(2),
          dispatcherCommission.toFixed(2),
          companyRevenue.toFixed(2),
          radicalRunnerRevenue.toFixed(2),
        ];
      });

      csvContent = generateCsv(headers, rows);
      filename = `main-financial-${new Date().toISOString().split('T')[0]}.csv`;
    }
    else {
      return errorResponse('VALIDATION_ERROR', 'Invalid export type', 400);
    }

    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('GET /api/exports error:', error);
    return errorResponse('INTERNAL_ERROR', 'Failed to generate CSV export', 500);
  }
}