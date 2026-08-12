// One-off migration: regenerates every existing user's ndyCoreId + ndyId
// to the new NDY-{TYPE}-{6char} format. Run once, after the ndyCoreId
// column has been added and before any code path relies on it being
// populated. Safe to re-run — skips any user whose ndyCoreId is already
// set, so a partial/interrupted run can just be re-invoked.
//
// Usage (inside the api container, from the repo root):
//   npx ts-node apps/api/scripts/migrate-ndy-ids.ts
import { PrismaClient, Role } from '@prisma/client';
import {
  generateCoreId,
  formatNdyId,
  ndyIdTypeForRole,
} from '../src/common/ndy-id.util';

const prisma = new PrismaClient();

async function main() {
  // schema.prisma declares ndyCoreId as the final non-nullable state, so
  // Prisma's generated types don't allow filtering by `null` directly even
  // though the column is genuinely nullable in the DB during this
  // migration window (step 1 ran, step 2 hasn't yet) -- a raw query sees
  // the real column, unaffected by the generated client's type narrowing.
  const users = await prisma.$queryRaw<
    { id: string; ndyId: string; role: Role }[]
  >`SELECT "id", "ndyId", "role" FROM "User" WHERE "ndyCoreId" IS NULL`;

  console.log(`Found ${users.length} user(s) needing migration.`);

  for (const user of users) {
    let coreId = generateCoreId();
    // Extremely unlikely at this alphabet/length + user count, but retry
    // on collision rather than trust probability, same as identity.service.
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await prisma.user.findUnique({
        where: { ndyCoreId: coreId },
      });
      if (!clash) break;
      coreId = generateCoreId();
    }

    const newNdyId = formatNdyId(coreId, ndyIdTypeForRole(user.role));

    await prisma.user.update({
      where: { id: user.id },
      data: { ndyCoreId: coreId, ndyId: newNdyId },
    });

    console.log(`${user.ndyId}  ->  ${newNdyId}`);
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
