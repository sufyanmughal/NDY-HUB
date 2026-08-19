import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { customAlphabet } from 'nanoid';
import { OAuthClientType } from '@prisma/client';
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
    clientType?: OAuthClientType;
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

    const clientType = params.clientType ?? OAuthClientType.CONFIDENTIAL;
    const clientId = generateClientId();

    // PUBLIC clients (native/mobile apps — see OAuthClientType's schema
    // doc comment) never receive a secret at all: baking one into an APK
    // isn't a secret, and PKCE is what actually protects the exchange for
    // them. Only CONFIDENTIAL clients get one, same as before this change.
    const clientSecret =
      clientType === OAuthClientType.CONFIDENTIAL
        ? randomBytes(32).toString('base64url')
        : null;

    const client = await this.prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecretHash: clientSecret ? hashSecret(clientSecret) : null,
        clientType,
        name: params.name,
        redirectUris: params.redirectUris,
        allowedScopes: params.allowedScopes,
      },
    });

    // clientSecret is null for PUBLIC clients — the admin panel should
    // show "no secret — this is a public client, PKCE only" rather than a
    // blank/missing value.
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

  /**
   * PUBLIC clients have no secret to verify — presenting one at all (even
   * a garbage value) is a no-op success, since TokenController's PKCE
   * check is what actually authenticates the request for them. Only
   * CONFIDENTIAL clients (clientSecretHash set) go through the real
   * comparison.
   */
  verifySecret(
    client: { clientType: OAuthClientType; clientSecretHash: string | null },
    providedSecret: string | undefined,
  ): boolean {
    if (client.clientType === OAuthClientType.PUBLIC) return true;
    if (!client.clientSecretHash || !providedSecret) return false;
    return client.clientSecretHash === hashSecret(providedSecret);
  }
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

function serializeClient(client: {
  id: string;
  clientId: string;
  clientType: OAuthClientType;
  name: string;
  redirectUris: string[];
  allowedScopes: string[];
  isActive: boolean;
  createdAt: Date;
}) {
  return {
    id: client.id,
    clientId: client.clientId,
    clientType: client.clientType,
    name: client.name,
    redirectUris: client.redirectUris,
    allowedScopes: client.allowedScopes,
    isActive: client.isActive,
    createdAt: client.createdAt,
  };
}
