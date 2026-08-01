import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Role, RoleChangeRequestStatus } from '@prisma/client';
import { RoleChangeRequestService } from './role-change-request.service';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminActor } from './admin.service';

const founder: AdminActor = { id: 'founder-1', ndyId: 'NDY-FOUNDER' };
const superAdminA: AdminActor = { id: 'super-a', ndyId: 'NDY-SUPER-A' };
const superAdminB: AdminActor = { id: 'super-b', ndyId: 'NDY-SUPER-B' };

function makePrisma() {
  return {
    user: { findUnique: jest.fn(), update: jest.fn() },
    roleChangeRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    auditLogEntry: { create: jest.fn() },
    $transaction: jest.fn(),
  };
}

describe('RoleChangeRequestService', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: RoleChangeRequestService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new RoleChangeRequestService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('lets a Super Admin request an ordinary role change', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'target-1',
        ndyId: 'NDY-TARGET',
        role: Role.USER,
      });
      prisma.roleChangeRequest.create.mockResolvedValue({ id: 'req-1' });

      await service.create(
        superAdminA,
        'target-1',
        Role.SUPPORT,
        'promoting to support',
      );

      expect(prisma.roleChangeRequest.create).toHaveBeenCalledWith({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- jest.fn() mocks are untyped
        data: expect.objectContaining({
          targetUserId: 'target-1',
          requestedRole: Role.SUPPORT,
          previousRole: Role.USER,
          requestedByUserId: superAdminA.id,
        }),
      });
    });

    it('blocks a Super Admin from requesting FOUNDER or SUPER_ADMIN — only a Founder can', async () => {
      // The actor lookup for the FOUNDER-only check happens before the
      // target lookup, so this fails without ever touching the target.
      prisma.user.findUnique.mockResolvedValue({ role: Role.SUPER_ADMIN });

      await expect(
        service.create(superAdminA, 'target-1', Role.SUPER_ADMIN),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.create(superAdminA, 'target-1', Role.FOUNDER),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.roleChangeRequest.create).not.toHaveBeenCalled();
    });

    it('lets a Founder request assigning FOUNDER or SUPER_ADMIN', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: Role.FOUNDER }) // actor check
        .mockResolvedValueOnce({
          id: 'target-1',
          ndyId: 'NDY-TARGET',
          role: Role.USER,
        }); // target lookup
      prisma.roleChangeRequest.create.mockResolvedValue({ id: 'req-2' });

      await expect(
        service.create(founder, 'target-1', Role.SUPER_ADMIN),
      ).resolves.toBeDefined();
    });

    it('404s when the target user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.create(superAdminA, 'ghost-user', Role.SUPPORT),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('approve', () => {
    function pendingRequest(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        id: 'req-1',
        status: RoleChangeRequestStatus.PENDING,
        requestedByUserId: superAdminA.id,
        requestedRole: Role.SUPPORT,
        previousRole: Role.USER,
        targetUserId: 'target-1',
        targetNdyId: 'NDY-TARGET',
        requestedByNdyId: superAdminA.ndyId,
        ...overrides,
      };
    }

    it('blocks the requester from approving their own request', async () => {
      prisma.roleChangeRequest.findUnique.mockResolvedValue(pendingRequest());

      await expect(service.approve(superAdminA, 'req-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('lets a different admin approve an ordinary role request', async () => {
      prisma.roleChangeRequest.findUnique.mockResolvedValue(pendingRequest());
      prisma.user.findUnique.mockResolvedValue({
        id: 'target-1',
        ndyId: 'NDY-TARGET',
      });
      prisma.$transaction.mockResolvedValue([
        {},
        { id: 'req-1', status: 'APPROVED' },
      ]);

      const result = await service.approve(superAdminB, 'req-1', 'looks good');

      expect(result).toEqual({ id: 'req-1', status: 'APPROVED' });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('404s for a request id that does not exist', async () => {
      prisma.roleChangeRequest.findUnique.mockResolvedValue(null);
      await expect(service.approve(superAdminB, 'no-such-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('409s when the request was already resolved', async () => {
      prisma.roleChangeRequest.findUnique.mockResolvedValue(
        pendingRequest({ status: RoleChangeRequestStatus.APPROVED }),
      );
      await expect(service.approve(superAdminB, 'req-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('blocks a non-Founder from approving a request for FOUNDER/SUPER_ADMIN, even if not self-review', async () => {
      prisma.roleChangeRequest.findUnique.mockResolvedValue(
        pendingRequest({
          requestedRole: Role.SUPER_ADMIN,
          requestedByUserId: founder.id,
        }),
      );
      prisma.user.findUnique.mockResolvedValue({ role: Role.SUPER_ADMIN });

      await expect(service.approve(superAdminA, 'req-1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('lets a Founder approve a request for FOUNDER/SUPER_ADMIN', async () => {
      prisma.roleChangeRequest.findUnique.mockResolvedValue(
        pendingRequest({
          requestedRole: Role.SUPER_ADMIN,
          requestedByUserId: superAdminA.id,
        }),
      );
      prisma.user.findUnique
        .mockResolvedValueOnce({ role: Role.FOUNDER }) // assertActorCanDecide
        .mockResolvedValueOnce({ id: 'target-1', ndyId: 'NDY-TARGET' }); // target lookup
      prisma.$transaction.mockResolvedValue([
        {},
        { id: 'req-1', status: 'APPROVED' },
      ]);

      await expect(service.approve(founder, 'req-1')).resolves.toBeDefined();
    });
  });

  describe('reject', () => {
    it('blocks the requester from rejecting their own request', async () => {
      prisma.roleChangeRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: RoleChangeRequestStatus.PENDING,
        requestedByUserId: superAdminA.id,
        requestedRole: Role.SUPPORT,
      });
      await expect(service.reject(superAdminA, 'req-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lets a different admin reject a pending request', async () => {
      prisma.roleChangeRequest.findUnique.mockResolvedValue({
        id: 'req-1',
        status: RoleChangeRequestStatus.PENDING,
        requestedByUserId: superAdminA.id,
        requestedByNdyId: superAdminA.ndyId,
        requestedRole: Role.SUPPORT,
        targetUserId: 'target-1',
        targetNdyId: 'NDY-TARGET',
      });
      prisma.roleChangeRequest.update.mockResolvedValue({
        id: 'req-1',
        status: 'REJECTED',
      });

      const result = await service.reject(
        superAdminB,
        'req-1',
        'not appropriate',
      );

      expect(result).toEqual({ id: 'req-1', status: 'REJECTED' });
    });
  });
});
