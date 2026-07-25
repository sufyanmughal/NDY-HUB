import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { customAlphabet } from 'nanoid';
import { PrismaService } from '../prisma/prisma.service';
import { ALL_SCOPES } from './scopes';

const generateClientId = customAlphabet(
  'abcdefghijklmnopqrstuvwxyz0123456789',
  20,
);

@Injectable()
export class OAuthClientService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const clients = await this.prisma.oAuthClient.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return clients.map(serializeClient);
  }

  async create(params: {
    name: string;
    redirectUris: string[];
    allowedScopes: string[];
  }) {
    const invalidScopes = params.allowedScopes.filter(
      (s) => !ALL_SCOPES.includes(s),
    );
    if (invalidScopes.length > 0) {
      throw new BadRequestException(
        `Unknown scope(s): ${invalidScopes.join(', ')}`,
      );
    }
    if (params.redirectUris.length === 0) {
      throw new BadRequestException('At least one redirect URI is required.');
    }

    const clientId = generateClientId();
    // The plaintext secret is returned exactly once, here. Only its hash is
    // ever stored — same pattern as refresh tokens elsewhere in this schema.
    const clientSecret = randomBytes(32).toString('base64url');

    const client = await this.prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecretHash: hashSecret(clientSecret),
        name: params.name,
        redirectUris: params.redirectUris,
        allowedScopes: params.allowedScopes,
      },
    });

    return { ...serializeClient(client), clientSecret };
  }

  async setActive(id: string, isActive: boolean) {
    const client = await this.prisma.oAuthClient.update({
      where: { id },
      data: { isActive },
    });
    return serializeClient(client);
  }

  async findByClientId(clientId: string) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: { clientId },
    });
    if (!client || !client.isActive) {
      throw new NotFoundException('Unknown or inactive client.');
    }
    return client;
  }

  /** Public-safe lookup for the consent screen — no secret hash, no redirect
   * URI list (that's the RP's own config, not something to expose to the
   * browser rendering the consent page). */
  async getPublicInfo(clientId: string) {
    const client = await this.findByClientId(clientId);
    return {
      clientId: client.clientId,
      name: client.name,
      allowedScopes: client.allowedScopes,
    };
  }

  verifySecret(
    client: { clientSecretHash: string },
    providedSecret: string,
  ): boolean {
    return client.clientSecretHash === hashSecret(providedSecret);
  }
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function serializeClient(client: {
  id: string;
  clientId: string;
  name: string;
  redirectUris: string[];
  allowedScopes: string[];
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: client.id,
    clientId: client.clientId,
    name: client.name,
    redirectUris: client.redirectUris,
    allowedScopes: client.allowedScopes,
    isActive: client.isActive,
    createdAt: client.createdAt,
  };
}
