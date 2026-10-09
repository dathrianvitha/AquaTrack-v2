import { PrismaClient } from '@prisma/client';

async function test(name, url) {
  console.log(`\n--- TEST: ${name} ---`);
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const res = await prisma.$queryRawUnsafe('SELECT 1');
    console.log('SUCCESS! Result:', res);
    
    // Perform 5 concurrent queries to test pooler behavior
    const results = await Promise.all([
      prisma.$queryRawUnsafe('SELECT 1'),
      prisma.user.findFirst(),
      prisma.farm.findFirst(),
      prisma.site.findFirst(),
      prisma.tank.findFirst(),
    ]);
    console.log('CONCURRENT QUERIES SUCCESS! Count:', results.length);
    return true;
  } catch (err) {
    console.log('FAILED! Error:', err.message);
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

const pass = 'Aquatrackv2%40123';
const ref = 'sktufoozcqltftmvuvgh';
const poolerHost = 'aws-0-ap-southeast-1.pooler.supabase.com';

async function main() {
  // Option 1: session pooler 5432 with connection_limit=5
  await test('Option 1: 5432 with connection_limit=5', `postgresql://postgres.${ref}:${pass}@${poolerHost}:5432/postgres?connection_limit=5`);

  // Option 2: session pooler 5432 with connection_limit=1
  await test('Option 2: 5432 with connection_limit=1', `postgresql://postgres.${ref}:${pass}@${poolerHost}:5432/postgres?connection_limit=1`);

  // Option 3: transaction pooler 6543 with pgbouncer=true&connection_limit=5
  await test('Option 3: 6543 pgbouncer with connection_limit=5', `postgresql://postgres.${ref}:${pass}@${poolerHost}:6543/postgres?pgbouncer=true&connection_limit=5`);

  // Option 4: transaction pooler 6543 with pgbouncer=true&connection_limit=1
  await test('Option 4: 6543 pgbouncer with connection_limit=1', `postgresql://postgres.${ref}:${pass}@${poolerHost}:6543/postgres?pgbouncer=true&connection_limit=1`);

  // Option 5: raw base without params
  await test('Option 5: Raw 5432 base', `postgresql://postgres.${ref}:${pass}@${poolerHost}:5432/postgres`);
}

main();
