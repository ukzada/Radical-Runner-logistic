import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();

async function main() {
  console.log('Seeding users...');

  const adminEmail = 'admin@rrl.com';
  const dispatcherEmail = 'dispatcher@rrl.com';

  // Upsert admin
  const adminHash = await bcrypt.hash('Admin@2026', 12);
  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminHash,
      name: 'System Admin',
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log(`Admin: ${admin.email}`);

  // Upsert dispatcher
  const dispHash = await bcrypt.hash('Dispatch@2026', 12);
  const dispatcher = await db.user.upsert({
    where: { email: dispatcherEmail },
    update: {},
    create: {
      email: dispatcherEmail,
      passwordHash: dispHash,
      name: 'John Dispatcher',
      phone: '(555) 200-0001',
      role: 'DISPATCHER',
      isActive: true,
    },
  });
  console.log(`Dispatcher: ${dispatcher.email}`);

  console.log('Done!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
