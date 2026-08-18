import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ActionApprovalStatus,
  ActionExecutionStatus,
  ActionRiskTier,
  NotificationCategory,
  NotificationChannel,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { NotificationService } from '../notifications/notification.service';
import { ACTION_REGISTRY, findActionDefinition } from './action-registry';

const APPROVAL_TTL_HOURS = 48;

export interface ActionOrigin {
  type: 'user_direct' | 'ai_command' | 'agent' | 'trigger' | 'external_api';
  detail?: string;
}

export interface ActionRequestInput {
  actionKey: string;
  workspaceId: string;
  requestedByUserId: string;
  requestedByNdyId: string;
  origin: ActionOrigin;
  params: Record<string, unknown>;
  idempotencyKey: string;
  /** Required when origin.type is "agent" or "external_api" — not
   * validated in v1 (no external callers exist yet, per
   * docs/action-engine-design.md §6). Field kept in the contract now so
   * v2+ needs no shape change to start enforcing it. */
  intentToken?: string;
}

export interface ActionResult {
  status: 'executed' | 'pending_approval' | 'rejected';
  actionLogId: string;
  approvalId?: string;
  result?: unknown;
  reason?: string;
}

/**
 * Implements the flow from docs/action-engine-design.md §4 verbatim:
 *
 *   UNDERSTAND -> AUTHORIZE -> VALIDATE -> risk-tier check -> CONFIRM (if
 *   required) -> EXECUTE -> LOG
 *
 * "Understand" happens entirely on the caller's side (a button click
 * today; the Fabric/AI layer eventually) — out of scope here, this
 * service only ever receives an already-formed ActionRequestInput.
 *
 * Trust-zone principle: this service never trusts *why* a request was
 * made, only *what* it is — origin is logged, never used to skip a check.
 * An ai_command-originated request goes through exactly the same
 * Authorize/Validate/risk-tier pipeline as a user_direct one.
 */
@Injectable()
export class ActionEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
    private readonly workspaceService: WorkspaceService,
    private readonly notifications: NotificationService,
  ) {}

  async submit(input: ActionRequestInput): Promise<ActionResult> {
    // Idempotency — a repeated key returns the original outcome rather
    // than re-running anything. Checked before any other step: even a
    // request that would ultimately be rejected shouldn't be re-rejected
    // (and re-logged) twice for the same key.
    const existingLog = await this.prisma.actionLogEntry.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { approval: true },
    });
    if (existingLog) {
      return this.toResult(existingLog, existingLog.approval ?? undefined);
    }

    const definition = findActionDefinition(input.actionKey);
    if (!definition) {
      return this.reject(input, null, `Unknown action "${input.actionKey}".`);
    }

    const dbDefinition = await this.prisma.actionDefinition.findUnique({
      where: { actionKey: input.actionKey },
    });
    if (!dbDefinition || !dbDefinition.enabled) {
      return this.reject(
        input,
        definition.riskTier,
        `Action "${input.actionKey}" is not currently enabled.`,
      );
    }

    // AUTHORIZE — membership in the target workspace is the baseline
    // check for every action in v1 (no per-scope-beyond-membership
    // permission model exists yet; requiredScopes on ActionDefinition is
    // reserved for when one does — see the design doc's own note that
    // this reuses "existing RBAC + workspace-membership check").
    let membership;
    try {
      membership = await this.workspaceService.assertMember(
        input.requestedByUserId,
        input.workspaceId,
      );
    } catch {
      return this.reject(
        input,
        definition.riskTier,
        'You are not a member of this workspace.',
      );
    }
    void membership;

    // VALIDATE — the exact same class-validator DTO the corresponding
    // controller uses, run here instead of (or in addition to) there.
    const dtoInstance = plainToInstance(definition.dto, input.params);
    const errors = await validate(dtoInstance, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (errors.length > 0) {
      const reason = errors
        .flatMap((e) => Object.values(e.constraints ?? {}))
        .join('; ');
      return this.reject(
        input,
        definition.riskTier,
        reason || 'Invalid params.',
      );
    }

    // Risk-tier check
    if (definition.riskTier === ActionRiskTier.LOW) {
      return this.execute(input, definition, dtoInstance);
    }

    // MEDIUM / HIGH / CRITICAL — create a PENDING approval, execute later
    // via resolveApproval() once a human confirms.
    const log = await this.writeLog(input, {
      status: ActionExecutionStatus.PENDING_APPROVAL,
      riskTier: definition.riskTier,
    });

    const approval = await this.prisma.actionApproval.create({
      data: {
        actionLogId: log.id,
        riskTier: definition.riskTier,
        requiresStrongAuth: definition.riskTier === ActionRiskTier.CRITICAL,
        expiresAt: new Date(Date.now() + APPROVAL_TTL_HOURS * 60 * 60 * 1000),
      },
    });

    // Tell the requester something is pending — best-effort, per
    // NotificationService's own non-fatal-on-delivery-failure design.
    await this.notifications.notify({
      userId: input.requestedByUserId,
      workspaceId: input.workspaceId,
      category: NotificationCategory.ACTION_APPROVAL,
      channel: NotificationChannel.IN_APP,
      title: `Approval needed: ${definition.label}`,
      body: `Your request to ${definition.label.toLowerCase()} needs confirmation before it runs.`,
      sourceEventId: `action-approval-created:${approval.id}`,
    });

    return {
      status: 'pending_approval',
      actionLogId: log.id,
      approvalId: approval.id,
    };
  }

  /**
   * Resolves a PENDING approval — CONFIRM, then EXECUTE if approved.
   * `approve: false` denies it instead; the underlying action never runs.
   * Anyone with access to this endpoint today is implicitly the
   * requester themselves (no separate approver role exists in v1 — that's
   * a Phase 4+/Business Center concern once teams exist) — see
   * ActionEngineController for the actual auth check.
   */
  async resolveApproval(
    approvalId: string,
    resolvedByUserId: string,
    approve: boolean,
  ): Promise<ActionResult> {
    const approval = await this.prisma.actionApproval.findUnique({
      where: { id: approvalId },
      include: { actionLog: true },
    });
    if (!approval) throw new NotFoundException('No approval with that id.');
    if (approval.status !== ActionApprovalStatus.PENDING) {
      throw new BadRequestException('This approval has already been resolved.');
    }
    if (approval.expiresAt < new Date()) {
      await this.prisma.actionApproval.update({
        where: { id: approval.id },
        data: { status: ActionApprovalStatus.EXPIRED },
      });
      throw new BadRequestException('This approval has expired.');
    }

    const log = approval.actionLog;
    const definition = findActionDefinition(log.actionKey);
    if (!definition) {
      throw new BadRequestException(`Unknown action "${log.actionKey}".`);
    }

    if (!approve) {
      await this.prisma.$transaction([
        this.prisma.actionApproval.update({
          where: { id: approval.id },
          data: {
            status: ActionApprovalStatus.DENIED,
            resolvedByUserId,
            resolvedAt: new Date(),
          },
        }),
        this.prisma.actionLogEntry.update({
          where: { id: log.id },
          data: { status: ActionExecutionStatus.DENIED },
        }),
      ]);
      return {
        status: 'rejected',
        actionLogId: log.id,
        reason: 'Denied by user.',
      };
    }

    await this.prisma.actionApproval.update({
      where: { id: approval.id },
      data: {
        status: ActionApprovalStatus.APPROVED,
        resolvedByUserId,
        resolvedAt: new Date(),
      },
    });

    const dtoInstance = plainToInstance(
      definition.dto,
      log.params as Record<string, unknown>,
    );

    const input: ActionRequestInput = {
      actionKey: log.actionKey,
      workspaceId: log.workspaceId,
      requestedByUserId: log.requestedByUserId,
      requestedByNdyId: log.requestedByNdyId,
      origin: log.origin as unknown as ActionOrigin,
      params: log.params as Record<string, unknown>,
      idempotencyKey: log.idempotencyKey,
    };

    return this.execute(input, definition, dtoInstance, log.id);
  }

  async listPendingApprovals(workspaceId: string) {
    return this.prisma.actionApproval.findMany({
      where: {
        status: ActionApprovalStatus.PENDING,
        actionLog: { workspaceId },
      },
      include: { actionLog: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async execute(
    input: ActionRequestInput,
    definition: (typeof ACTION_REGISTRY)[number],
    dtoInstance: object,
    existingLogId?: string,
  ): Promise<ActionResult> {
    try {
      const result = await definition.execute(
        this.moduleRef,
        input.requestedByUserId,
        dtoInstance,
      );

      const resultSummary = summarize(result);

      const log = existingLogId
        ? await this.prisma.actionLogEntry.update({
            where: { id: existingLogId },
            data: {
              status: ActionExecutionStatus.EXECUTED,
              resultSummary: resultSummary as Prisma.InputJsonValue,
            },
          })
        : await this.writeLog(input, {
            status: ActionExecutionStatus.EXECUTED,
            riskTier: definition.riskTier,
            resultSummary,
          });

      return { status: 'executed', actionLogId: log.id, result };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Execution failed.';
      const log = existingLogId
        ? await this.prisma.actionLogEntry.update({
            where: { id: existingLogId },
            data: { status: ActionExecutionStatus.REJECTED, reason },
          })
        : await this.writeLog(input, {
            status: ActionExecutionStatus.REJECTED,
            riskTier: definition.riskTier,
            reason,
          });
      return { status: 'rejected', actionLogId: log.id, reason };
    }
  }

  private async reject(
    input: ActionRequestInput,
    riskTier: ActionRiskTier | null,
    reason: string,
  ): Promise<ActionResult> {
    const log = await this.writeLog(input, {
      status: ActionExecutionStatus.REJECTED,
      riskTier: riskTier ?? ActionRiskTier.LOW,
      reason,
    });
    return { status: 'rejected', actionLogId: log.id, reason };
  }

  private async writeLog(
    input: ActionRequestInput,
    extra: {
      status: ActionExecutionStatus;
      riskTier: ActionRiskTier;
      reason?: string;
      resultSummary?: unknown;
    },
  ) {
    return this.prisma.actionLogEntry.create({
      data: {
        actionKey: input.actionKey,
        workspaceId: input.workspaceId,
        requestedByUserId: input.requestedByUserId,
        requestedByNdyId: input.requestedByNdyId,
        origin: input.origin as unknown as Prisma.InputJsonValue,
        params: input.params as Prisma.InputJsonValue,
        status: extra.status,
        riskTier: extra.riskTier,
        reason: extra.reason,
        resultSummary: extra.resultSummary as Prisma.InputJsonValue | undefined,
        idempotencyKey: input.idempotencyKey,
      },
    });
  }

  private toResult(
    log: { id: string; status: ActionExecutionStatus; reason: string | null },
    approval?: { id: string; status: ActionApprovalStatus },
  ): ActionResult {
    if (log.status === ActionExecutionStatus.EXECUTED) {
      return { status: 'executed', actionLogId: log.id };
    }
    if (log.status === ActionExecutionStatus.PENDING_APPROVAL) {
      return {
        status: 'pending_approval',
        actionLogId: log.id,
        approvalId: approval?.id,
      };
    }
    return {
      status: 'rejected',
      actionLogId: log.id,
      reason: log.reason ?? undefined,
    };
  }
}

/** Keeps ActionLogEntry.resultSummary small and stable rather than
 * dumping an entire domain object (which may contain fields that
 * shouldn't be duplicated into an audit log verbatim, e.g. as the schema
 * grows) — just enough to identify what was created. */
function summarize(result: unknown): { id?: string } | undefined {
  if (result && typeof result === 'object' && 'id' in result) {
    return { id: String(result.id) };
  }
  return undefined;
}
