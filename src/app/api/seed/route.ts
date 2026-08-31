import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/auth-helpers';
import { generateLoadNumber } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    // Check if data already seeded
    const existingAdmin = await db.user.findUnique({
      where: { email: 'admin@rrl.com' },
    });
    if (existingAdmin) {
      return errorResponse('ALREADY_SEEDED', 'Database already contains seed data', 400);
    }

    const adminPasswordHash = await hashPassword('admin123');
    const dispatcherPasswordHash = await hashPassword('dispatch123');

    // 1. Create admin user
    const admin = await db.user.create({
      data: {
        email: 'admin@rrl.com',
        passwordHash: adminPasswordHash,
        name: 'System Admin',
        role: 'ADMIN',
        isActive: true,
      },
    });

    // 2. Create 3 dispatchers
    const dispatchers = await Promise.all([
      db.user.create({
        data: { email: 'dispatcher1@rrl.com', passwordHash: dispatcherPasswordHash, name: 'Sarah Johnson', phone: '(555) 201-1001', role: 'DISPATCHER', isActive: true },
      }),
      db.user.create({
        data: { email: 'dispatcher2@rrl.com', passwordHash: dispatcherPasswordHash, name: 'Mike Chen', phone: '(555) 201-1002', role: 'DISPATCHER', isActive: true },
      }),
      db.user.create({
        data: { email: 'dispatcher3@rrl.com', passwordHash: dispatcherPasswordHash, name: 'Lisa Martinez', phone: '(555) 201-1003', role: 'DISPATCHER', isActive: true },
      }),
    ]);

    // 3. Create 3 companies
    const companies = await Promise.all([
      db.company.create({
        data: { name: 'ABC Logistics', email: 'info@abclogistics.com', phone: '(555) 300-1001', city: 'Atlanta', state: 'GA', status: 'ACTIVE' },
      }),
      db.company.create({
        data: { name: 'Swift Freight Inc', email: 'ops@swiftfreight.com', phone: '(555) 300-2001', city: 'Dallas', state: 'TX', status: 'ACTIVE' },
      }),
      db.company.create({
        data: { name: 'Midwest Haulers LLC', email: 'contact@midwesthaulers.com', phone: '(555) 300-3001', city: 'Chicago', state: 'IL', status: 'ACTIVE' },
      }),
    ]);

    // 4. Create 7 MCs (2-3 per company)
    const mcs = await Promise.all([
      db.mC.create({ data: { mcNumber: 'MC-123456', companyId: companies[0].id, status: 'ACTIVE' } }),
      db.mC.create({ data: { mcNumber: 'MC-234567', companyId: companies[0].id, status: 'ACTIVE' } }),
      db.mC.create({ data: { mcNumber: 'MC-345678', companyId: companies[0].id, status: 'INACTIVE' } }),
      db.mC.create({ data: { mcNumber: 'MC-456789', companyId: companies[1].id, status: 'ACTIVE' } }),
      db.mC.create({ data: { mcNumber: 'MC-567890', companyId: companies[1].id, status: 'ACTIVE' } }),
      db.mC.create({ data: { mcNumber: 'MC-678901', companyId: companies[2].id, status: 'ACTIVE' } }),
      db.mC.create({ data: { mcNumber: 'MC-789012', companyId: companies[2].id, status: 'ACTIVE' } }),
    ]);

    // 5. Create 8 drivers assigned to MCs
    const drivers = await Promise.all([
      db.driver.create({ data: { firstName: 'Marcus', lastName: 'Thompson', phone: '(555) 111-0001', email: 'marcus.t@email.com', driverId: 'DRV-001', cdlNumber: 'CDL-T1234567', cdlState: 'GA', cdlExpiration: new Date('2026-08-15'), status: 'ACTIVE', mcId: mcs[0].id, companyId: companies[0].id, truckType: 'Dry Van' } }),
      db.driver.create({ data: { firstName: 'Elena', lastName: 'Rodriguez', phone: '(555) 111-0002', email: 'elena.r@email.com', driverId: 'DRV-002', cdlNumber: 'CDL-R2345678', cdlState: 'TX', cdlExpiration: new Date('2026-03-20'), status: 'ACTIVE', mcId: mcs[1].id, companyId: companies[0].id, truckType: 'Reefer' } }),
      db.driver.create({ data: { firstName: 'James', lastName: 'Patterson', phone: '(555) 111-0003', email: 'james.p@email.com', driverId: 'DRV-003', cdlNumber: 'CDL-P3456789', cdlState: 'TX', cdlExpiration: new Date('2027-01-10'), status: 'ACTIVE', mcId: mcs[3].id, companyId: companies[1].id, truckType: 'Flatbed' } }),
      db.driver.create({ data: { firstName: 'David', lastName: 'Kim', phone: '(555) 111-0004', email: 'david.k@email.com', driverId: 'DRV-004', cdlNumber: 'CDL-K4567890', cdlState: 'IL', cdlExpiration: new Date('2025-12-05'), status: 'ACTIVE', mcId: mcs[4].id, companyId: companies[1].id, truckType: 'Dry Van' } }),
      db.driver.create({ data: { firstName: 'Carlos', lastName: 'Mendez', phone: '(555) 111-0005', email: 'carlos.m@email.com', driverId: 'DRV-005', cdlNumber: 'CDL-M5678901', cdlState: 'IL', cdlExpiration: new Date('2026-06-30'), status: 'ON_LEAVE', mcId: mcs[5].id, companyId: companies[2].id, truckType: 'Step Deck' } }),
      db.driver.create({ data: { firstName: 'Robert', lastName: 'Williams', phone: '(555) 111-0006', email: 'robert.w@email.com', driverId: 'DRV-006', cdlNumber: 'CDL-W6789012', cdlState: 'FL', cdlExpiration: new Date('2026-09-22'), status: 'ACTIVE', mcId: mcs[5].id, companyId: companies[2].id, truckType: 'Dry Van' } }),
      db.driver.create({ data: { firstName: 'Angela', lastName: 'Brooks', phone: '(555) 111-0007', email: 'angela.b@email.com', driverId: 'DRV-007', cdlNumber: 'CDL-B7890123', cdlState: 'GA', cdlExpiration: new Date('2027-03-15'), status: 'ACTIVE', mcId: mcs[6].id, companyId: companies[2].id, truckType: 'Reefer' } }),
      db.driver.create({ data: { firstName: 'Tyler', lastName: 'Jackson', phone: '(555) 111-0008', email: 'tyler.j@email.com', driverId: 'DRV-008', cdlNumber: 'CDL-J8901234', cdlState: 'AL', cdlExpiration: new Date('2026-11-30'), status: 'ACTIVE', mcId: mcs[1].id, companyId: companies[0].id, truckType: 'Flatbed' } }),
    ]);

    // 6. Assign drivers to dispatchers
    await Promise.all([
      db.driverDispatcher.create({ data: { driverId: drivers[0].id, dispatcherId: dispatchers[0].id } }),
      db.driverDispatcher.create({ data: { driverId: drivers[1].id, dispatcherId: dispatchers[0].id } }),
      db.driverDispatcher.create({ data: { driverId: drivers[2].id, dispatcherId: dispatchers[1].id } }),
      db.driverDispatcher.create({ data: { driverId: drivers[3].id, dispatcherId: dispatchers[1].id } }),
      db.driverDispatcher.create({ data: { driverId: drivers[4].id, dispatcherId: dispatchers[2].id } }),
      db.driverDispatcher.create({ data: { driverId: drivers[5].id, dispatcherId: dispatchers[2].id } }),
      db.driverDispatcher.create({ data: { driverId: drivers[6].id, dispatcherId: dispatchers[2].id } }),
      // Tyler Jackson (driver 7) is intentionally unassigned
    ]);

    // 7. Create ~20 loads
    const loadsData = [
      { driverId: drivers[0].id, createdBy: dispatchers[0].id, status: 'DELIVERED', pickupCity: 'Atlanta', pickupState: 'GA', deliveryCity: 'Miami', deliveryState: 'FL', loadPrice: 3500, commodity: 'Electronics', loadDate: new Date('2025-06-01'), pickupDate: new Date('2025-06-01'), deliveryDate: new Date('2025-06-02') },
      { driverId: drivers[1].id, createdBy: dispatchers[0].id, status: 'IN_TRANSIT', pickupCity: 'Jacksonville', pickupState: 'FL', deliveryCity: 'Charlotte', deliveryState: 'NC', loadPrice: 2800, commodity: 'Produce', loadDate: new Date('2025-06-10'), pickupDate: new Date('2025-06-10') },
      { driverId: drivers[0].id, createdBy: dispatchers[0].id, status: 'DELIVERED', pickupCity: 'Nashville', pickupState: 'TN', deliveryCity: 'Birmingham', deliveryState: 'AL', loadPrice: 1850, commodity: 'Auto Parts', loadDate: new Date('2025-05-15'), pickupDate: new Date('2025-05-15'), deliveryDate: new Date('2025-05-16') },
      { driverId: drivers[1].id, createdBy: dispatchers[0].id, status: 'DISPATCHED', pickupCity: 'Orlando', pickupState: 'FL', deliveryCity: 'Tampa', deliveryState: 'FL', loadPrice: 950, commodity: 'Frozen Foods', loadDate: new Date('2025-06-12'), pickupDate: new Date('2025-06-12') },
      { driverId: drivers[0].id, createdBy: dispatchers[0].id, status: 'DELIVERED', pickupCity: 'Memphis', pickupState: 'TN', deliveryCity: 'New Orleans', deliveryState: 'LA', loadPrice: 2200, commodity: 'Paper Products', loadDate: new Date('2025-04-20'), pickupDate: new Date('2025-04-20'), deliveryDate: new Date('2025-04-21') },
      { driverId: drivers[1].id, createdBy: dispatchers[0].id, status: 'AVAILABLE', pickupCity: 'Tallahassee', pickupState: 'FL', deliveryCity: 'Atlanta', deliveryState: 'GA', loadPrice: 1200, commodity: 'Lumber', loadDate: new Date('2025-06-14') },
      { driverId: drivers[0].id, createdBy: dispatchers[0].id, status: 'CANCELLED', pickupCity: 'Raleigh', pickupState: 'NC', deliveryCity: 'Savannah', deliveryState: 'GA', loadPrice: 0, commodity: 'Furniture', loadDate: new Date('2025-06-08'), notes: 'Customer cancelled' },
      { driverId: drivers[2].id, createdBy: dispatchers[1].id, status: 'DELIVERED', pickupCity: 'Dallas', pickupState: 'TX', deliveryCity: 'Denver', deliveryState: 'CO', loadPrice: 5800, commodity: 'Steel Components', loadDate: new Date('2025-06-05'), pickupDate: new Date('2025-06-05'), deliveryDate: new Date('2025-06-07') },
      { driverId: drivers[2].id, createdBy: dispatchers[1].id, status: 'IN_TRANSIT', pickupCity: 'Houston', pickupState: 'TX', deliveryCity: 'Phoenix', deliveryState: 'AZ', loadPrice: 7200, commodity: 'Machinery', loadDate: new Date('2025-06-11'), pickupDate: new Date('2025-06-11') },
      { driverId: drivers[3].id, createdBy: dispatchers[1].id, status: 'DELIVERED', pickupCity: 'San Antonio', pickupState: 'TX', deliveryCity: 'Austin', deliveryState: 'TX', loadPrice: 1200, commodity: 'Building Materials', loadDate: new Date('2025-06-03'), pickupDate: new Date('2025-06-03'), deliveryDate: new Date('2025-06-04') },
      { driverId: drivers[2].id, createdBy: dispatchers[1].id, status: 'CANCELLED', pickupCity: 'El Paso', pickupState: 'TX', deliveryCity: 'Albuquerque', deliveryState: 'NM', loadPrice: 0, commodity: 'Consumer Goods', loadDate: new Date('2025-06-08'), notes: 'Rate too low' },
      { driverId: drivers[3].id, createdBy: dispatchers[1].id, status: 'AVAILABLE', pickupCity: 'Oklahoma City', pickupState: 'OK', deliveryCity: 'Kansas City', deliveryState: 'MO', loadPrice: 2400, commodity: 'Agricultural', loadDate: new Date('2025-06-13') },
      { driverId: drivers[2].id, createdBy: dispatchers[1].id, status: 'DELIVERED', pickupCity: 'Austin', pickupState: 'TX', deliveryCity: 'San Antonio', deliveryState: 'TX', loadPrice: 950, commodity: 'Textiles', loadDate: new Date('2025-05-20'), pickupDate: new Date('2025-05-20'), deliveryDate: new Date('2025-05-20') },
      { driverId: drivers[4].id, createdBy: dispatchers[2].id, status: 'DELIVERED', pickupCity: 'Chicago', pickupState: 'IL', deliveryCity: 'Detroit', deliveryState: 'MI', loadPrice: 1950, commodity: 'Automotive Parts', loadDate: new Date('2025-05-20'), pickupDate: new Date('2025-05-20'), deliveryDate: new Date('2025-05-21') },
      { driverId: drivers[5].id, createdBy: dispatchers[2].id, status: 'DISPATCHED', pickupCity: 'Indianapolis', pickupState: 'IN', deliveryCity: 'Columbus', deliveryState: 'OH', loadPrice: 1600, commodity: 'Pharmaceuticals', loadDate: new Date('2025-06-14'), pickupDate: new Date('2025-06-14') },
      { driverId: drivers[6].id, createdBy: dispatchers[2].id, status: 'DELIVERED', pickupCity: 'Milwaukee', pickupState: 'WI', deliveryCity: 'Minneapolis', deliveryState: 'MN', loadPrice: 2600, commodity: 'Dairy Products', loadDate: new Date('2025-06-06'), pickupDate: new Date('2025-06-06'), deliveryDate: new Date('2025-06-07') },
      { driverId: drivers[5].id, createdBy: dispatchers[2].id, status: 'AVAILABLE', pickupCity: 'St. Louis', pickupState: 'MO', deliveryCity: 'Kansas City', deliveryState: 'MO', loadPrice: 1800, commodity: 'Grain', loadDate: new Date('2025-06-13') },
      { driverId: drivers[6].id, createdBy: dispatchers[2].id, status: 'DELIVERED', pickupCity: 'Cleveland', pickupState: 'OH', deliveryCity: 'Pittsburgh', deliveryState: 'PA', loadPrice: 1450, commodity: 'Steel Coils', loadDate: new Date('2025-04-10'), pickupDate: new Date('2025-04-10'), deliveryDate: new Date('2025-04-11') },
      { driverId: drivers[4].id, createdBy: dispatchers[2].id, status: 'IN_TRANSIT', pickupCity: 'Cincinnati', pickupState: 'OH', deliveryCity: 'Nashville', deliveryState: 'TN', loadPrice: 2100, commodity: 'Chemicals', loadDate: new Date('2025-06-15'), pickupDate: new Date('2025-06-15') },
    ];

    const loads = await Promise.all(
      loadsData.map((ld) =>
        db.load.create({
          data: {
            ...ld,
            loadNumber: generateLoadNumber(),
            origin: ld.pickupCity ? `${ld.pickupCity}, ${ld.pickupState}` : undefined,
            destination: ld.deliveryCity ? `${ld.deliveryCity}, ${ld.deliveryState}` : undefined,
          },
        })
      )
    );

    return successResponse({
      message: 'Seed data created successfully',
      counts: { users: 4, companies: 3, mcs: 7, drivers: 8, loads: loads.length },
    });
  } catch (error: any) {
    console.error('Seed error:', error);
    return errorResponse('SEED_ERROR', error.message || 'Failed to seed database', 500);
  }
}
