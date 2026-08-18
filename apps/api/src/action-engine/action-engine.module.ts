import { Module, OnModuleInit } from '@nestjs/common';
import { ActionEngineService } from './action-engine.service';
import { ActionEngineController } from './action-engine.controller';
import { WorkspaceModule } from '../workspace/workspace.module';
import { NotificationModule } from '../notifications/notification.module';
import { NdyspaceModule } from '../ndyspace/ndyspace.module';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { ACTION_REGISTRY } from './action-registry';

/**
 * Imports NdyspaceModule so ModuleRef.get() inside ActionRegistry's
 * execute() closures can actually resolve NdyspaceCalendarService /
 * NdyspaceContactsService / NdyspaceTasksService / NdyspaceNotesService —
 * ModuleRef only resolves providers visible to modules that import (or
 * are imported by) the module doing the resolving. Imports AuthModule for
 * JwtAuthGuard on ActionEngineController — same requirement every other
 * guarded controller in this codebase has (JwtAuthGuard needs JwtService,
 * which only AuthModule's JwtModule import provides).
 */
@Module({
  imports: [WorkspaceModule, NotificationModule, NdyspaceModule, AuthModule],
  controllers: [ActionEngineController],
  providers: [ActionEngineService],
  exports: [ActionEngineService],
})
export class ActionEngineModule implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Keeps the ActionDefinition table in sync with ACTION_REGISTRY on
   * every boot — upsert, never delete, so an action removed from the
   * registry (code) doesn't silently vanish from the audit trail's
   * foreign-key target; it just stops being resolvable by
   * findActionDefinition and any pending approval against it would fail
   * cleanly. This is the "registering an action is a deliberate step"
   * requirement made concrete: the registry array in code is what's
   * actually reviewed in a PR; this just mirrors it into the DB the
   * Approval Center / audit UI query against.
   */
  async onModuleInit() {
    for (const action of ACTION_REGISTRY) {
      await this.prisma.actionDefinition.upsert({
        where: { actionKey: action.actionKey },
        create: {
          actionKey: action.actionKey,
          label: action.label,
          domain: action.domain,
          riskTier: action.riskTier,
          requiredScopes: action.requiredScopes,
          reversible: action.reversible,
          reverseActionKey: action.reverseActionKey,
        },
        update: {
          label: action.label,
          domain: action.domain,
          riskTier: action.riskTier,
          requiredScopes: action.requiredScopes,
          reversible: action.reversible,
          reverseActionKey: action.reverseActionKey,
        },
      });
    }
  }
}
