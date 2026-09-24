/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- jest.fn() test doubles are untyped; assertions on them are intentional. */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SignatureRequestStatus } from '@prisma/client';
import { SignatureService, SIGNATURE_CONSENT_TEXT } from './signature.service';
import { OidcKeysService } from '../oauth/oidc-keys.service';
import { importJWK, jwtVerify, type JWK } from 'jose';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../common/mail.service';
import { NotificationService } from '../notifications/notification.service';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';

const actor: AuthenticatedRequestUser = {
  sub: 'user-1',
  ndyId: 'NDY-USER-1',
  sid: 'sid-1',
};

function makePrisma() {
  return {
    signatureRequest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    signatureRequestSigner: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    signature: { create: jest.fn(), findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
  };
}

function makeService() {
  const prisma = makePrisma();
  const mail = { send: jest.fn().mockResolvedValue(undefined) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const config = {
    get: jest.fn().mockReturnValue(undefined),
    getOrThrow: jest.fn().mockReturnValue('http://localhost:3001'),
  };
  // With no OIDC_RSA_PRIVATE_KEY configured, OidcKeysService generates an
  // ephemeral keypair — which is exactly what lets these tests verify the
  // attestation for real against its published public JWK.
  const keys = new OidcKeysService(config as unknown as ConfigService);
  const service = new SignatureService(
    prisma as unknown as PrismaService,
    mail as unknown as MailService,
    notifications as unknown as NotificationService,
    config as unknown as ConfigService,
    keys,
  );
  return { prisma, mail, notifications, config, keys, service };
}

describe('SignatureService', () => {
  describe('create', () => {
    it('rejects a signer with neither userId nor email', async () => {
      const { service } = makeService();
      await expect(
        service.create(actor, {
          title: 'Contract',
          contentHash: 'a'.repeat(64),
          signers: [{}],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a signer with both userId and email', async () => {
      const { service } = makeService();
      await expect(
        service.create(actor, {
          title: 'Contract',
          contentHash: 'a'.repeat(64),
          signers: [{ userId: 'u2', email: 'u2@example.com' }],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a request, returns sign links once, and emails an email-only signer', async () => {
      const { service, prisma, mail, notifications } = makeService();
      prisma.signatureRequest.create.mockResolvedValue({
        id: 'req-1',
        signers: [
          { id: 'slot-1', userId: 'u2', invitedEmail: null },
          { id: 'slot-2', userId: null, invitedEmail: 'guest@example.com' },
        ],
      });

      const result = await service.create(actor, {
        title: 'Partnership agreement',
        contentHash: 'b'.repeat(64),
        signers: [{ userId: 'u2' }, { email: 'guest@example.com' }],
      });

      // Raw sign links are returned exactly once (only their hashes persist).
      expect(result.signLinks).toHaveLength(2);
      expect(result.signLinks[0].url).toContain('/sign/');
      // A known user gets an in-app notification…
      expect(notifications.notify).toHaveBeenCalledTimes(1);
      // …an email-only signer gets mail instead (no userId to notify).
      expect(mail.send).toHaveBeenCalledTimes(1);
      expect(mail.send.mock.calls[0][0].to).toBe('guest@example.com');
    });
  });

  describe('sign', () => {
    it('rejects an unknown token', async () => {
      const { service, prisma } = makeService();
      prisma.signatureRequestSigner.findUnique.mockResolvedValue(null);
      await expect(service.sign(actor, 'nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects an already-signed slot', async () => {
      const { service, prisma } = makeService();
      prisma.signatureRequestSigner.findUnique.mockResolvedValue({
        id: 'slot-1',
        signatureRequestId: 'req-1',
        userId: 'user-1',
        invitedEmail: null,
        signedAt: new Date(),
        declinedAt: null,
        expiresAt: new Date(Date.now() + 1000),
        signatureRequest: {
          id: 'req-1',
          status: SignatureRequestStatus.PENDING,
          contentHash: 'c'.repeat(64),
          title: 'Doc',
          createdByUserId: 'creator-1',
          expiresAt: null,
        },
      });
      await expect(service.sign(actor, 'tok')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("refuses to let a signed-in user sign someone else's assigned slot", async () => {
      const { service, prisma } = makeService();
      prisma.signatureRequestSigner.findUnique.mockResolvedValue({
        id: 'slot-1',
        signatureRequestId: 'req-1',
        userId: 'someone-else',
        invitedEmail: null,
        signedAt: null,
        declinedAt: null,
        expiresAt: new Date(Date.now() + 1000),
        signatureRequest: {
          id: 'req-1',
          status: SignatureRequestStatus.PENDING,
          contentHash: 'c'.repeat(64),
          title: 'Doc',
          createdByUserId: 'creator-1',
          expiresAt: null,
        },
      });
      await expect(service.sign(actor, 'tok')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('signs, copies the contentHash, and flips the request to SIGNED when all slots are in', async () => {
      const { service, prisma, notifications } = makeService();
      prisma.signatureRequestSigner.findUnique.mockResolvedValue({
        id: 'slot-1',
        signatureRequestId: 'req-1',
        userId: 'user-1',
        invitedEmail: null,
        signedAt: null,
        declinedAt: null,
        expiresAt: new Date(Date.now() + 1000),
        signatureRequest: {
          id: 'req-1',
          status: SignatureRequestStatus.PENDING,
          contentHash: 'd'.repeat(64),
          title: 'Doc',
          createdByUserId: 'creator-1',
          expiresAt: null,
        },
      });
      prisma.signature.create.mockResolvedValue({ id: 'sig-1' });
      prisma.signatureRequestSigner.findMany.mockResolvedValue([
        { signedAt: new Date(), declinedAt: null },
      ]);
      prisma.signatureRequest.update.mockResolvedValue({});

      const result = await service.sign(actor, 'tok', '1.2.3.4', 'jest');

      expect(prisma.signature.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          signerUserId: 'user-1',
          signerNdyId: 'NDY-USER-1',
          contentHash: 'd'.repeat(64),
          ip: '1.2.3.4',
          // The exact wording shown is stored verbatim — server-owned, so the
          // record proves what was displayed rather than what a caller claims.
          consentText: SIGNATURE_CONSENT_TEXT,
        }),
      });
      expect(result.requestStatus).toBe(SignatureRequestStatus.SIGNED);
      expect(notifications.notify).toHaveBeenCalledTimes(1);
    });

    it('attests the signature with a JWS that verifies against the published key', async () => {
      const { prisma, keys, service } = makeService();
      prisma.signatureRequestSigner.findUnique.mockResolvedValue({
        id: 'slot-1',
        signatureRequestId: 'req-1',
        userId: 'user-1',
        invitedEmail: null,
        signedAt: null,
        declinedAt: null,
        expiresAt: new Date(Date.now() + 1000),
        signatureRequest: {
          id: 'req-1',
          status: SignatureRequestStatus.PENDING,
          contentHash: 'd'.repeat(64),
          title: 'Doc',
          createdByUserId: 'creator-1',
          expiresAt: null,
        },
      });
      prisma.signature.create.mockResolvedValue({ id: 'sig-1' });
      prisma.signatureRequestSigner.findMany.mockResolvedValue([
        { signedAt: new Date(), declinedAt: null },
      ]);
      prisma.signatureRequest.update.mockResolvedValue({});

      await service.sign(actor, 'tok');

      const data = prisma.signature.create.mock.calls[0][0].data as {
        id: string;
        attestation: string;
        attestationKeyId: string;
      };
      expect(data.attestationKeyId).toBe(keys.keyId);

      // The real assertion: the token verifies against the SAME public JWK the
      // server publishes, and carries the claims a third party would check.
      const publicKey = await importJWK(keys.publicJwk as JWK, 'RS256');
      const { payload } = await jwtVerify(data.attestation, publicKey);
      expect(payload.sub).toBe('NDY-USER-1');
      expect(payload.iss).toBe('http://localhost:3001');
      expect(payload.aud).toBe('ndy-signature');
      expect(payload.jti).toBe(data.id);
      expect(payload.contentHash).toBe('d'.repeat(64));
      expect(payload.consentText).toBe(SIGNATURE_CONSENT_TEXT);
    });

    it('binds an email-invited slot to the caller when the emails match', async () => {
      const { service, prisma } = makeService();
      prisma.signatureRequestSigner.findUnique.mockResolvedValue({
        id: 'slot-2',
        signatureRequestId: 'req-1',
        userId: null,
        invitedEmail: 'me@example.com',
        signedAt: null,
        declinedAt: null,
        expiresAt: new Date(Date.now() + 1000),
        signatureRequest: {
          id: 'req-1',
          status: SignatureRequestStatus.PENDING,
          contentHash: 'e'.repeat(64),
          title: 'Doc',
          createdByUserId: 'creator-1',
          expiresAt: null,
        },
      });
      prisma.user.findUnique.mockResolvedValue({ email: 'me@example.com' });
      prisma.signature.create.mockResolvedValue({ id: 'sig-2' });
      prisma.signatureRequestSigner.findMany.mockResolvedValue([
        { signedAt: new Date(), declinedAt: null },
      ]);
      prisma.signatureRequest.update.mockResolvedValue({});

      await expect(service.sign(actor, 'tok')).resolves.toBeDefined();
      expect(prisma.signatureRequestSigner.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
    });
  });

  describe('decline', () => {
    it('marks the slot declined and the request DECLINED', async () => {
      const { service, prisma } = makeService();
      prisma.signatureRequestSigner.findUnique.mockResolvedValue({
        id: 'slot-1',
        signatureRequestId: 'req-1',
        userId: 'user-1',
        invitedEmail: null,
        signedAt: null,
        declinedAt: null,
        expiresAt: new Date(Date.now() + 1000),
        signatureRequest: {
          id: 'req-1',
          status: SignatureRequestStatus.PENDING,
          contentHash: 'f'.repeat(64),
          title: 'Doc',
          createdByUserId: 'creator-1',
          expiresAt: null,
        },
      });
      prisma.signatureRequestSigner.update.mockResolvedValue({});

      await service.decline(actor, 'tok');

      expect(prisma.signatureRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: SignatureRequestStatus.DECLINED },
        }),
      );
    });
  });

  describe('revoke', () => {
    it('refuses a non-creator', async () => {
      const { service, prisma } = makeService();
      prisma.signatureRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        createdByUserId: 'someone-else',
        status: SignatureRequestStatus.PENDING,
      });
      await expect(service.revoke(actor, 'req-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('refuses to revoke an already-resolved request', async () => {
      const { service, prisma } = makeService();
      prisma.signatureRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        createdByUserId: 'user-1',
        status: SignatureRequestStatus.SIGNED,
      });
      await expect(service.revoke(actor, 'req-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('verify', () => {
    it('returns only the verification fields', async () => {
      const { service, prisma } = makeService();
      const signedAt = new Date();
      prisma.signature.findUnique.mockResolvedValue({
        id: 'sig-1',
        signatureRequestId: 'req-1',
        contentHash: 'a'.repeat(64),
        signerNdyId: 'NDY-USER-1',
        signedAt,
        attestation: 'header.payload.signature',
        attestationKeyId: 'dev-ephemeral',
        // Fields that must NOT leak:
        signerUserId: 'user-1',
        ip: '1.2.3.4',
        userAgent: 'secret-agent',
      });

      const result = await service.verify('sig-1');

      expect(result).toEqual({
        signatureId: 'sig-1',
        signatureRequestId: 'req-1',
        contentHash: 'a'.repeat(64),
        signerNdyId: 'NDY-USER-1',
        signedAt,
        attestation: 'header.payload.signature',
        attestationKeyId: 'dev-ephemeral',
        jwksUri: expect.stringContaining('/.well-known/jwks.json') as unknown,
      });
      expect(result).not.toHaveProperty('ip');
      expect(result).not.toHaveProperty('userAgent');
    });

    it('404s for an unknown signature', async () => {
      const { service, prisma } = makeService();
      prisma.signature.findUnique.mockResolvedValue(null);
      await expect(service.verify('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
