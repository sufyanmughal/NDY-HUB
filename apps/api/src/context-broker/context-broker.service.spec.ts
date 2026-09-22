/* eslint-disable @typescript-eslint/no-unsafe-assignment -- jest.fn() test doubles are untyped; assertions on them are intentional. */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AiAgentConsentScope, OAuthClientType } from '@prisma/client';
import { ContextBrokerService } from './context-broker.service';
import { PrismaService } from '../prisma/prisma.service';

function makePrisma() {
  return {
    oAuthClient: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    aiAgentConsent: {
      findUnique: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn((args: { create: unknown }) => args.create),
      update: jest.fn(),
    },
  };
}

function makeService() {
  const prisma = makePrisma();
  const service = new ContextBrokerService(prisma as unknown as PrismaService);
  return { prisma, service };
}

const AGENT = {
  clientId: 'cl_agent',
  clientType: OAuthClientType.AI_AGENT,
  isActive: true,
  name: 'Test Agent',
};

describe('ContextBrokerService', () => {
  describe('assertConsent', () => {
    it('refuses when the request does not identify its client', async () => {
      const { service } = makeService();
      const result = await service.assertConsent('u1', undefined, [
        'email:summarize',
      ]);
      expect(result.allowed).toBe(false);
    });

    it('refuses an unknown client', async () => {
      const { service, prisma } = makeService();
      prisma.oAuthClient.findUnique.mockResolvedValue(null);
      const result = await service.assertConsent('u1', 'cl_nope', [
        'email:summarize',
      ]);
      expect(result.allowed).toBe(false);
    });

    it('refuses a non-AI-agent client', async () => {
      const { service, prisma } = makeService();
      prisma.oAuthClient.findUnique.mockResolvedValue({
        ...AGENT,
        clientType: OAuthClientType.CONFIDENTIAL,
      });
      const result = await service.assertConsent('u1', 'cl_agent', [
        'email:summarize',
      ]);
      expect(result.allowed).toBe(false);
    });

    it('refuses an inactive agent', async () => {
      const { service, prisma } = makeService();
      prisma.oAuthClient.findUnique.mockResolvedValue({
        ...AGENT,
        isActive: false,
      });
      const result = await service.assertConsent('u1', 'cl_agent', [
        'email:summarize',
      ]);
      expect(result.allowed).toBe(false);
    });

    it('refuses when the user has granted nothing', async () => {
      const { service, prisma } = makeService();
      prisma.oAuthClient.findUnique.mockResolvedValue(AGENT);
      prisma.aiAgentConsent.findUnique.mockResolvedValue(null);
      const result = await service.assertConsent('u1', 'cl_agent', [
        'email:summarize',
      ]);
      expect(result.allowed).toBe(false);
    });

    it('refuses a revoked grant', async () => {
      const { service, prisma } = makeService();
      prisma.oAuthClient.findUnique.mockResolvedValue(AGENT);
      prisma.aiAgentConsent.findUnique.mockResolvedValue({
        scopes: [AiAgentConsentScope.EMAIL_SUMMARIZE],
        revokedAt: new Date(),
      });
      const result = await service.assertConsent('u1', 'cl_agent', [
        'email:summarize',
      ]);
      expect(result.allowed).toBe(false);
    });

    it('refuses when the grant is missing a required scope', async () => {
      const { service, prisma } = makeService();
      prisma.oAuthClient.findUnique.mockResolvedValue(AGENT);
      prisma.aiAgentConsent.findUnique.mockResolvedValue({
        scopes: [AiAgentConsentScope.EMAIL_SUMMARIZE],
        revokedAt: null,
      });
      const result = await service.assertConsent('u1', 'cl_agent', [
        'email:draft-reply',
      ]);
      expect(result.allowed).toBe(false);
      if (!result.allowed) expect(result.reason).toContain('EMAIL_DRAFT_REPLY');
    });

    it('allows when the grant covers every required scope', async () => {
      const { service, prisma } = makeService();
      prisma.oAuthClient.findUnique.mockResolvedValue(AGENT);
      prisma.aiAgentConsent.findUnique.mockResolvedValue({
        scopes: [
          AiAgentConsentScope.EMAIL_SUMMARIZE,
          AiAgentConsentScope.EMAIL_DRAFT_REPLY,
        ],
        revokedAt: null,
      });
      const result = await service.assertConsent('u1', 'cl_agent', [
        'email:summarize',
        'email:draft-reply',
      ]);
      expect(result.allowed).toBe(true);
    });

    it('fails closed for a required scope with no consent mapping', async () => {
      const { service, prisma } = makeService();
      prisma.oAuthClient.findUnique.mockResolvedValue(AGENT);
      prisma.aiAgentConsent.findUnique.mockResolvedValue({
        scopes: [AiAgentConsentScope.EMAIL_SUMMARIZE],
        revokedAt: null,
      });
      // 'ndyspace' (and calendar/contacts/tasks) are deliberately UNMAPPED now
      // that the catalog is scoped to the real first consumer — an agent cannot
      // reach them until a consent scope is agreed for them.
      const result = await service.assertConsent('u1', 'cl_agent', [
        'ndyspace',
      ]);
      expect(result.allowed).toBe(false);
    });

    it('allows an action that declares no scopes', async () => {
      const { service, prisma } = makeService();
      prisma.oAuthClient.findUnique.mockResolvedValue(AGENT);
      const result = await service.assertConsent('u1', 'cl_agent', []);
      expect(result.allowed).toBe(true);
    });
  });

  describe('grant', () => {
    it('rejects a non-AI-agent client', async () => {
      const { service, prisma } = makeService();
      prisma.oAuthClient.findUnique.mockResolvedValue({
        ...AGENT,
        clientType: OAuthClientType.PUBLIC,
      });
      await expect(
        service.grant('u1', 'cl_agent', [AiAgentConsentScope.EMAIL_SUMMARIZE]),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an unknown client', async () => {
      const { service, prisma } = makeService();
      prisma.oAuthClient.findUnique.mockResolvedValue(null);
      await expect(
        service.grant('u1', 'cl_nope', [AiAgentConsentScope.EMAIL_SUMMARIZE]),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('deduplicates scopes on grant', async () => {
      const { service, prisma } = makeService();
      prisma.oAuthClient.findUnique.mockResolvedValue(AGENT);
      await service.grant('u1', 'cl_agent', [
        AiAgentConsentScope.EMAIL_SUMMARIZE,
        AiAgentConsentScope.EMAIL_SUMMARIZE,
      ]);
      expect(prisma.aiAgentConsent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            scopes: [AiAgentConsentScope.EMAIL_SUMMARIZE],
          }),
        }),
      );
    });
  });

  describe('revoke', () => {
    it('404s when there is no active grant', async () => {
      const { service, prisma } = makeService();
      prisma.aiAgentConsent.findUnique.mockResolvedValue(null);
      await expect(service.revoke('u1', 'cl_agent')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('soft-revokes by setting revokedAt', async () => {
      const { service, prisma } = makeService();
      prisma.aiAgentConsent.findUnique.mockResolvedValue({
        id: 'grant-1',
        revokedAt: null,
      });
      prisma.aiAgentConsent.update.mockResolvedValue({});
      await service.revoke('u1', 'cl_agent');
      expect(prisma.aiAgentConsent.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ revokedAt: expect.any(Date) }),
        }),
      );
    });
  });
});
