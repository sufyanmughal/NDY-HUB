import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AiAgentConsentScope, OAuthClientType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Maps an action's declared `requiredScopes` (the existing contract in
 * action-registry.ts / ActionDefinition.requiredScopes) onto the AI-agent
 * consent scopes a user grants.
 *
 * Deliberately derived from the registry rather than pattern-matching action
 * keys: the registry is what's already reviewed in a PR, so a new action's AI
 * exposure is decided at the same moment its scopes are.
 *
 * FAIL CLOSED: a requiredScope with no mapping here means "no AI consent scope
 * is defined for this" — the agent is refused rather than silently allowed.
 * That is the same discipline as this codebase's permission guard ("a route
 * wired to the guard with no permission declared throws rather than defaulting
 * to open"), and it means registering a new action can't accidentally expose it
 * to agents before someone decides what consent it needs.
 */
export const ACTION_SCOPE_TO_CONSENT: Record<string, AiAgentConsentScope> = {
  calendar: AiAgentConsentScope.CALENDAR,
  contacts: AiAgentConsentScope.CONTACTS,
  tasks: AiAgentConsentScope.TASKS,
  // note.create declares the broader 'ndyspace' scope in the registry; the
  // (placeholder) consent vocabulary names the tighter NOTES.
  ndyspace: AiAgentConsentScope.NOTES,
  // Reserved — no economy action is registered yet (see ECONOMY_READ).
  economy: AiAgentConsentScope.ECONOMY_READ,
};

/** Every scope a user can grant, for the consent UI. */
export const AI_AGENT_SCOPES: AiAgentConsentScope[] = [
  AiAgentConsentScope.CALENDAR,
  AiAgentConsentScope.CONTACTS,
  AiAgentConsentScope.TASKS,
  AiAgentConsentScope.NOTES,
  AiAgentConsentScope.ECONOMY_READ,
];

export type ConsentCheck =
  | { allowed: true }
  | { allowed: false; reason: string };

/** Registry scope string -> the consent scope it needs, or null if unmapped. */
export function consentScopeFor(
  requiredScope: string,
): AiAgentConsentScope | null {
  return ACTION_SCOPE_TO_CONSENT[requiredScope] ?? null;
}

/**
 * Context Broker — the gate between an AI/agent-driven action and the products
 * it touches (docs on the AI external-service permission layer).
 *
 * The agent is an ordinary OAuthClient with clientType AI_AGENT; this service
 * adds ONE extra check on top of the Action Engine's existing Authorize step:
 * "does this user's AI-consent record permit this agent to invoke this action?"
 * It does not fork the pipeline — a non-AI caller is unaffected, and an AI
 * caller still goes through membership, validation, risk tier and audit exactly
 * as a human does.
 */
@Injectable()
export class ContextBrokerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The check the Action Engine's Authorize step calls, additively, for
   * requests whose origin is an agent. Returns rather than throws so the caller
   * can turn a refusal into the same audited `reject()` path every other
   * Authorize failure uses.
   */
  async assertConsent(
    userId: string,
    oauthClientId: string | undefined,
    requiredScopes: string[],
  ): Promise<ConsentCheck> {
    if (!oauthClientId) {
      return {
        allowed: false,
        reason:
          'An AI-agent request must identify its OAuth client (origin.detail).',
      };
    }

    const client = await this.prisma.oAuthClient.findUnique({
      where: { clientId: oauthClientId },
      select: { clientType: true, isActive: true, name: true },
    });
    if (!client) {
      return { allowed: false, reason: `Unknown OAuth client "${oauthClientId}".` };
    }
    if (client.clientType !== OAuthClientType.AI_AGENT) {
      return {
        allowed: false,
        reason: `OAuth client "${oauthClientId}" is not an AI agent.`,
      };
    }
    if (!client.isActive) {
      return { allowed: false, reason: `AI agent "${client.name}" is not active.` };
    }

    // Nothing declared to gate — same as any action with no required scopes.
    if (requiredScopes.length === 0) return { allowed: true };

    const needed: AiAgentConsentScope[] = [];
    for (const scope of requiredScopes) {
      const mapped = consentScopeFor(scope);
      if (!mapped) {
        return {
          allowed: false,
          reason: `No AI-agent consent scope is defined for "${scope}" — refusing by default.`,
        };
      }
      if (!needed.includes(mapped)) needed.push(mapped);
    }

    const consent = await this.prisma.aiAgentConsent.findUnique({
      where: { userId_oauthClientId: { userId, oauthClientId } },
    });
    if (!consent || consent.revokedAt) {
      return {
        allowed: false,
        reason: `You haven't granted "${client.name}" access to act on your behalf.`,
      };
    }

    const missing = needed.filter((s) => !consent.scopes.includes(s));
    if (missing.length > 0) {
      return {
        allowed: false,
        reason: `"${client.name}" isn't allowed to do this — missing consent scope(s): ${missing.join(', ')}.`,
      };
    }

    return { allowed: true };
  }

  /** Active grants for the consent screen, with the agent's display name. */
  async listGrants(userId: string) {
    const grants = await this.prisma.aiAgentConsent.findMany({
      where: { userId, revokedAt: null },
      orderBy: { grantedAt: 'desc' },
    });
    if (grants.length === 0) return [];

    const clients = await this.prisma.oAuthClient.findMany({
      where: { clientId: { in: grants.map((g) => g.oauthClientId) } },
      select: { clientId: true, name: true },
    });
    const nameById = new Map(clients.map((c) => [c.clientId, c.name]));
    return grants.map((grant) => ({
      ...grant,
      clientName: nameById.get(grant.oauthClientId) ?? grant.oauthClientId,
    }));
  }

  /** Grants (or re-grants) access for one agent. Only AI_AGENT clients may be
   * granted — a normal OAuth client never needs this and shouldn't be able to
   * acquire it by accident. */
  async grant(
    userId: string,
    oauthClientId: string,
    scopes: AiAgentConsentScope[],
  ) {
    const client = await this.prisma.oAuthClient.findUnique({
      where: { clientId: oauthClientId },
      select: { clientType: true, isActive: true, name: true },
    });
    if (!client) {
      throw new NotFoundException(`Unknown OAuth client "${oauthClientId}".`);
    }
    if (client.clientType !== OAuthClientType.AI_AGENT) {
      throw new BadRequestException(
        `OAuth client "${oauthClientId}" is not an AI agent.`,
      );
    }
    if (!client.isActive) {
      throw new BadRequestException(`AI agent "${client.name}" is not active.`);
    }

    const uniqueScopes = [...new Set(scopes)];
    return this.prisma.aiAgentConsent.upsert({
      where: { userId_oauthClientId: { userId, oauthClientId } },
      create: { userId, oauthClientId, scopes: uniqueScopes },
      // Re-granting after a revoke reactivates the SAME row (keeping its
      // history) rather than creating a second one.
      update: { scopes: uniqueScopes, revokedAt: null, grantedAt: new Date() },
    });
  }

  async revoke(userId: string, oauthClientId: string) {
    const existing = await this.prisma.aiAgentConsent.findUnique({
      where: { userId_oauthClientId: { userId, oauthClientId } },
    });
    if (!existing || existing.revokedAt) {
      throw new NotFoundException('No active grant for that agent.');
    }
    return this.prisma.aiAgentConsent.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });
  }
}
