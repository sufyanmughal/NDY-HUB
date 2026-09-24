/* eslint-disable @typescript-eslint/no-unsafe-assignment -- jest.fn() test doubles are untyped; assertions on them are intentional. */
import { ActionExecutionStatus } from '@prisma/client';
import {
  ActionEngineService,
  type ActionRequestInput,
} from './action-engine.service';
import type { ContextBrokerService } from '../context-broker/context-broker.service';
import { PrismaService } from '../prisma/prisma.service';
import { ModuleRef } from '@nestjs/core';
import { WorkspaceService } from '../workspace/workspace.service';
import { NotificationService } from '../notifications/notification.service';

/**
 * Focused tests for the Context Broker WIRING — the one part of that feature
 * that the broker's own unit tests cannot cover. The broker service is tested in
 * isolation; what matters here is that ActionEngineService actually consults it,
 * only for agent-originated requests, with the action's declared scopes, and
 * that a refusal is audited like any other Authorize failure.
 */
function makeService() {
  const prisma = {
    actionLogEntry: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'log-1' }),
    },
    actionDefinition: {
      findUnique: jest.fn().mockResolvedValue({ enabled: true }),
    },
    actionApproval: { create: jest.fn().mockResolvedValue({ id: 'appr-1' }) },
  };
  const moduleRef = { get: jest.fn() };
  const workspaceService = { assertMember: jest.fn().mockResolvedValue({}) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const contextBroker = { assertConsent: jest.fn() };

  const service = new ActionEngineService(
    prisma as unknown as PrismaService,
    moduleRef as unknown as ModuleRef,
    workspaceService as unknown as WorkspaceService,
    notifications as unknown as NotificationService,
    contextBroker as unknown as ContextBrokerService,
  );
  return {
    prisma,
    moduleRef,
    workspaceService,
    notifications,
    contextBroker,
    service,
  };
}

/** task.create is a real registry action (LOW risk, requiredScopes ['tasks']). */
function request(origin: ActionRequestInput['origin']): ActionRequestInput {
  return {
    actionKey: 'task.create',
    workspaceId: 'ws-1',
    requestedByUserId: 'user-1',
    requestedByNdyId: 'NDY-USER-1',
    origin,
    params: {},
    idempotencyKey: 'key-1',
  };
}

describe('ActionEngineService × Context Broker', () => {
  it('does NOT consult the Context Broker for a normal user request', async () => {
    const { service, contextBroker } = makeService();

    await service.submit(request({ type: 'user_direct' }));

    // A human-initiated action is entirely unaffected by the AI consent layer.
    expect(contextBroker.assertConsent).not.toHaveBeenCalled();
  });

  it('audits a refusal when an agent-originated action lacks consent', async () => {
    const { service, prisma, contextBroker } = makeService();
    contextBroker.assertConsent.mockResolvedValue({
      allowed: false,
      reason: 'You have not granted this agent access.',
    });

    const result = await service.submit(
      request({ type: 'agent', detail: 'cl_agent' }),
    );

    // Consulted with the action's declared registry scopes and the agent id.
    expect(contextBroker.assertConsent).toHaveBeenCalledWith(
      'user-1',
      'cl_agent',
      ['tasks'],
    );
    expect(result.status).toBe('rejected');
    expect(result.reason).toContain('not granted');
    // Refused through the same audited reject path as any Authorize failure.
    expect(prisma.actionLogEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: ActionExecutionStatus.REJECTED,
        }),
      }),
    );
  });

  it('proceeds past the broker once consent is granted', async () => {
    const { service, contextBroker } = makeService();
    contextBroker.assertConsent.mockResolvedValue({ allowed: true });

    const result = await service.submit(
      request({ type: 'agent', detail: 'cl_agent' }),
    );

    expect(contextBroker.assertConsent).toHaveBeenCalledTimes(1);
    // Whatever happens next (here: DTO validation of empty params), it is NOT
    // the consent refusal — i.e. granting consent did not itself reject.
    expect(result.reason ?? '').not.toContain('granted this agent');
  });

  it('still enforces membership before the AI check', async () => {
    const { service, workspaceService, contextBroker } = makeService();
    workspaceService.assertMember.mockRejectedValue(new Error('not a member'));

    const result = await service.submit(
      request({ type: 'agent', detail: 'cl_agent' }),
    );

    expect(result.status).toBe('rejected');
    // A non-member never reaches the consent layer at all.
    expect(contextBroker.assertConsent).not.toHaveBeenCalled();
  });
});
