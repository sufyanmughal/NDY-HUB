// One-off backfill for Phase 1 (workspace/tenancy foundation): creates a
// PERSONAL Workspace + OWNER WorkspaceMembership for every existing user
// who doesn't have a defaultWorkspaceId yet, and sets that pointer.
// New signups get this automatically via IdentityService.createUser ->
// WorkspaceService.getOrCreatePersonalWorkspace; this script is only for
// the users who existed before that hook was added.
//
// Plain JS (not TS) — deliberately, following the same workaround used for
// migrate-ndy-ids.ts: the production image has no tsconfig.json for
// ts-node to resolve, so `npx ts-node` fails there with a moduleResolution
// error. Run directly with `node` instead.
//
// Usage (inside the api container, from the repo root):
//   node apps/api/scripts/backfill-personal-workspaces.js
//
// Safe to re-run — skips any user who already has a defaultWorkspaceId.
const { PrismaClient, WorkspaceType, WorkspaceRole } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { defaultWorkspaceId: null },
    select: { id: true, fullName: true, ndyId: true },
  });

  console.log(`Found ${users.length} user(s) needing a personal workspace.`);

  for (const user of users) {
    // Same defensive check as WorkspaceService.getOrCreatePersonalWorkspace
    // itself: if a membership already exists (e.g. a partially-run prior
    // pass), just point defaultWorkspaceId at it instead of creating a
    // duplicate workspace.
    const existingMembership = await prisma.workspaceMembership.findFirst({
      where: {
        userId: user.id,
        role: WorkspaceRole.OWNER,
        workspace: { type: WorkspaceType.PERSONAL },
      },
    });

    let workspaceId;
    if (existingMembership) {
      workspaceId = existingMembership.workspaceId;
    } else {
      const workspace = await prisma.$transaction(async (tx) => {
        const created = await tx.workspace.create({
          data: {
            type: WorkspaceType.PERSONAL,
            name: user.fullName ?? user.ndyId,
            ownerUserId: user.id,
          },
        });
        await tx.workspaceMembership.create({
          data: { workspaceId: created.id, userId: user.id, role: WorkspaceRole.OWNER },
        });
        return created;
      });
      workspaceId = workspace.id;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { defaultWorkspaceId: workspaceId },
    });

    console.log(`${user.ndyId}  ->  workspace ${workspaceId}`);
  }

  console.log('Done.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
