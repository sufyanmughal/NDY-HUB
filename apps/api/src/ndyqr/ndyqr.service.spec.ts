import { NdyqrService } from './ndyqr.service';
import { PrismaService } from '../prisma/prisma.service';
import { GeoIpService } from '../common/geo-ip.service';
import { ConfigService } from '@nestjs/config';

function makeService() {
  const prisma = {
    // Slug uniqueness check → free on the first try.
    ndyQrCode: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn((args: { data: unknown }) => args.data),
    },
  };
  const service = new NdyqrService(
    prisma as unknown as PrismaService,
    {} as unknown as GeoIpService,
    {} as unknown as ConfigService,
  );
  return { prisma, service };
}

const DTO = { label: 'Menu', destination: 'https://ndystays.com/room/42' };

describe('NdyqrService — ownership', () => {
  it('attributes a member-created code to the member', async () => {
    const { prisma, service } = makeService();
    await service.create('user-1', DTO as never);
    expect(prisma.ndyQrCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ownerId: 'user-1' }),
      }),
    );
    // Mutually exclusive with the service owner.
    const data = prisma.ndyQrCode.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('oauthClientId');
  });

  it('attributes a service-created code to the OAuth client, with no user owner', async () => {
    const { prisma, service } = makeService();
    await service.createForClient('cl_quiz', DTO as never);
    expect(prisma.ndyQrCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ oauthClientId: 'cl_quiz' }),
      }),
    );
    // Exactly one owner — the migration's CHECK constraint enforces this in the
    // database too, so the application must never send both.
    const data = prisma.ndyQrCode.create.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('ownerId');
  });
});
