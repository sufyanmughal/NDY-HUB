import * as crypto from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, importJWK, jwtVerify, type JWK } from 'jose';
import {
  NotificationCategory,
  NotificationChannel,
  SignatureAttestationStatus,
  SignatureRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../common/mail.service';
import { NotificationService } from '../notifications/notification.service';
import { OidcKeysService } from '../oauth/oidc-keys.service';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';
import {
  CreateSignatureRequestDto,
  SignatureSignerDto,
} from './dto/signature.dto';

const SIGNER_TOKEN_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * The exact statement a signer agrees to, stored verbatim on the Signature so
 * it can be proved later even if the wording changes (client decision Q9).
 *
 * Deliberately SERVER-owned: the client displays this and cannot substitute its
 * own text, so the stored record proves what was actually shown rather than
 * what a caller claims was shown.
 *
 * v1 is an internal / verified NDY attestation (client decision Q8) — this text
 * must NOT claim legal e-signature weight until the legal framework supports it.
 */
export const SIGNATURE_CONSENT_TEXT =
  'I intend to sign this document as my NDY identity. I understand this records a verified NDY digital attestation, and is not presented as a legally-binding electronic signature.';

/**
 * NDY Signature (Phase 8, second half) — the signing lifecycle.
 *
 * Separated from the Action Engine on purpose (docs/phase8-signature-trust-
 * design.md §2): a signature has to be a durable, independently-verifiable
 * artifact a third party can check without trusting NDY HUB's database, which
 * an internal ActionLogEntry is not. This reuses what already works — the
 * single-use-token shape from WorkspaceInvite, the denormalized actor snapshot
 * from AuditLogEntry, and NotificationService for alerts — rather than
 * reinventing any of them.
 *
 * NOTE on attribution: `Signature.signerUserId`/`signerNdyId` are required, so
 * a signature is always attributable to a real NDY identity. That means the
 * sign route is authenticated (a JWT identifies *who*; the emailed token
 * authorizes *which slot*). An email-only invited signer is bound to a real
 * account at sign time by matching the authenticated account's email — the
 * same rule WorkspaceInvite.accept() uses.
 */
@Injectable()
export class SignatureService {
  private readonly logger = new Logger(SignatureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationService,
    private readonly config: ConfigService,
    private readonly keys: OidcKeysService,
  ) {}

  /** Creates a request and one signer slot per signer, minting a single-use
   * token for each. Returns the raw sign links ONCE (only the hash is stored,
   * same "shown once" contract as an OAuth client secret / workspace invite
   * link) so the creator can share them out-of-band when email isn't
   * configured. */
  async create(
    actor: AuthenticatedRequestUser,
    dto: CreateSignatureRequestDto,
  ) {
    const signerDefaults: SignatureSignerDto[] = dto.signers.map((s, index) => {
      if (!s.userId && !s.email) {
        throw new BadRequestException(
          `signers[${index}] must have either userId or email.`,
        );
      }
      if (s.userId && s.email) {
        throw new BadRequestException(
          `signers[${index}] must have only one of userId or email.`,
        );
      }
      return s;
    });

    const requestExpiry = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (requestExpiry && requestExpiry.getTime() <= Date.now()) {
      throw new BadRequestException('expiresAt must be in the future.');
    }
    const signerExpiry =
      requestExpiry ?? new Date(Date.now() + SIGNER_TOKEN_TTL_MS);

    // Mint raw tokens up front so the created rows store only their hashes.
    const tokens = signerDefaults.map(() =>
      crypto.randomBytes(32).toString('hex'),
    );

    const request = await this.prisma.signatureRequest.create({
      data: {
        title: dto.title,
        contentHash: dto.contentHash,
        contentRef: dto.contentRef ?? null,
        createdByUserId: actor.sub,
        createdByNdyId: actor.ndyId,
        expiresAt: requestExpiry,
        signers: {
          create: signerDefaults.map((s, i) => ({
            userId: s.userId ?? null,
            invitedEmail: s.email ?? null,
            tokenHash: hashToken(tokens[i]),
            expiresAt: signerExpiry,
          })),
        },
      },
      include: { signers: true },
    });

    const webBase = this.config.getOrThrow<string>('WEB_APP_URL');
    const signLinks = request.signers.map((signer, i) => ({
      signerId: signer.id,
      userId: signer.userId,
      email: signer.invitedEmail,
      url: `${webBase}/sign/${tokens[i]}`,
    }));

    // Best-effort fan-out; a notification/mail failure must not roll back a
    // request that already, correctly, exists.
    await Promise.all(
      request.signers.map((signer, i) =>
        this.deliverSignRequest(actor, request.id, signer, tokens[i]).catch(
          (err) =>
            this.logger.warn(
              `Failed to deliver signature request to signer ${signer.id}: ${
                (err as Error).message
              }`,
            ),
        ),
      ),
    );

    return { request, signLinks };
  }

  private async deliverSignRequest(
    actor: AuthenticatedRequestUser,
    requestId: string,
    signer: { id: string; userId: string | null; invitedEmail: string | null },
    rawToken: string,
  ): Promise<void> {
    const webBase = this.config.getOrThrow<string>('WEB_APP_URL');
    const url = `${webBase}/sign/${rawToken}`;
    const title = 'You have a document to sign';

    if (signer.userId) {
      await this.notifications.notify({
        userId: signer.userId,
        category: NotificationCategory.SIGNATURE,
        channel: NotificationChannel.IN_APP,
        title,
        body: `${actor.ndyId} asked you to sign a document on NDY HUB.`,
        linkUrl: url,
        sourceEventId: `signature-request:${requestId}:${signer.id}`,
      });
      return;
    }

    if (signer.invitedEmail) {
      await this.mail.send({
        to: signer.invitedEmail,
        subject: 'You have a document to sign on NDY HUB',
        html: `<p>${escapeHtml(
          actor.ndyId,
        )} asked you to sign a document on NDY HUB.</p><p><a href="${escapeHtml(
          url,
        )}">Review and sign</a></p><p>You'll be asked to sign in as the NDY account for this email address before signing.</p>`,
      });
    }
  }

  /** Records a signature for the signer slot identified by `rawToken`, by the
   * authenticated `actor`. */
  async sign(
    actor: AuthenticatedRequestUser,
    rawToken: string,
    ip?: string,
    userAgent?: string,
  ) {
    const signer = await this.loadSignerForSigning(rawToken);
    await this.assertSignerIdentity(signer, actor);

    // Generated up front so the attestation can bind to it as its `jti` — that
    // is what ties the cryptographic proof to this exact signature row.
    const signatureId = crypto.randomUUID();
    const contentHash = signer.signatureRequest.contentHash;
    const attestation = await this.attest({
      signatureId,
      signerNdyId: actor.ndyId,
      contentHash,
      requestId: signer.signatureRequestId,
      issuedAt: new Date(),
    });

    const signature = await this.prisma.signature.create({
      data: {
        id: signatureId,
        signatureRequestId: signer.signatureRequestId,
        signerUserId: actor.sub,
        signerNdyId: actor.ndyId,
        // Copy the hash at sign time — proves what was actually signed even if
        // the request row is later altered.
        contentHash,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
        // Verbatim record of what the signer agreed to.
        consentText: SIGNATURE_CONSENT_TEXT,
        // Cryptographic attestation over the claims above, verifiable against
        // NDY HUB's published JWKS. Only a VALIDATED proof counts as verified —
        // see attest().
        attestation: attestation.jws,
        attestationKeyId: attestation.keyId,
        attestationStatus: attestation.status,
        attestationAttempts: 1,
        attestationLastError: attestation.error,
        attestedAt:
          attestation.status === SignatureAttestationStatus.VERIFIED
            ? new Date()
            : null,
      },
    });

    await this.prisma.signatureRequestSigner.update({
      where: { id: signer.id },
      data: { signedAt: new Date(), userId: actor.sub },
    });

    const status = await this.recomputeStatus(signer.signatureRequestId);

    await this.notifications
      .notify({
        userId: signer.signatureRequest.createdByUserId,
        category: NotificationCategory.SIGNATURE,
        channel: NotificationChannel.IN_APP,
        title: 'Your document was signed',
        body: `${actor.ndyId} signed "${signer.signatureRequest.title}".`,
        sourceEventId: `signature-signed:${signature.id}`,
      })
      .catch((err) =>
        this.logger.warn(
          `Failed to notify creator of signature ${signature.id}: ${err}`,
        ),
      );

    return { signature, requestStatus: status };
  }

  async decline(actor: AuthenticatedRequestUser, rawToken: string) {
    const signer = await this.loadSignerForSigning(rawToken);
    await this.assertSignerIdentity(signer, actor);

    await this.prisma.signatureRequestSigner.update({
      where: { id: signer.id },
      data: { declinedAt: new Date(), userId: actor.sub },
    });

    await this.prisma.signatureRequest.update({
      where: { id: signer.signatureRequestId },
      data: { status: SignatureRequestStatus.DECLINED },
    });

    await this.notifications
      .notify({
        userId: signer.signatureRequest.createdByUserId,
        category: NotificationCategory.SIGNATURE,
        channel: NotificationChannel.IN_APP,
        title: 'Your document was declined',
        body: `${actor.ndyId} declined to sign "${signer.signatureRequest.title}".`,
        sourceEventId: `signature-declined:${signer.id}`,
      })
      .catch((err) =>
        this.logger.warn(
          `Failed to notify creator of decline ${signer.id}: ${err}`,
        ),
      );

    return { declined: true };
  }

  /** Revokes a whole request — creator only. */
  async revoke(actor: AuthenticatedRequestUser, requestId: string) {
    const request = await this.prisma.signatureRequest.findUnique({
      where: { id: requestId },
    });
    if (!request)
      throw new NotFoundException('No signature request with that id.');
    if (request.createdByUserId !== actor.sub) {
      throw new ForbiddenException('Only the creator can revoke this request.');
    }
    if (request.status !== SignatureRequestStatus.PENDING) {
      throw new ConflictException(
        `This request is already ${request.status.toLowerCase()} and can't be revoked.`,
      );
    }
    return this.prisma.signatureRequest.update({
      where: { id: requestId },
      data: { status: SignatureRequestStatus.REVOKED },
    });
  }

  /** Read-only preview for the /sign/[token] page — what a signer sees before
   * committing. Deliberately does NOT mutate the slot (unlike sign/decline):
   * opening a page isn't a decision. Mirrors WorkspaceInviteService.preview. */
  async preview(rawToken: string) {
    const signer = await this.prisma.signatureRequestSigner.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { signatureRequest: true },
    });
    if (!signer) throw new NotFoundException('Invalid signing link.');
    return {
      title: signer.signatureRequest.title,
      contentRef: signer.signatureRequest.contentRef,
      status: signer.signatureRequest.status,
      createdByNdyId: signer.signatureRequest.createdByNdyId,
      invitedEmail: signer.invitedEmail,
      expiresAt: signer.expiresAt,
      signedAt: signer.signedAt,
      declinedAt: signer.declinedAt,
      // The exact statement the signer is agreeing to — the UI shows this
      // rather than hardcoding its own wording.
      consentText: SIGNATURE_CONSENT_TEXT,
    };
  }

  /**
   * Signs this signature's claims with NDY HUB's OIDC keypair, producing a
   * compact JWS a third party can verify against the published JWKS — the
   * "cryptographic proof + independent verification" half of the client's v1
   * definition, with no new key material to distribute or rotate.
   *
   * Scoped claim: this proves **NDY HUB attested this record**. It does NOT
   * prove the signer personally held a private key — that needs a per-user
   * signing key and is a later assurance level, not something to imply now.
   *
   * Deliberately fail-soft: if signing throws (misconfigured key material), the
   * signature is still recorded with a null attestation. The signature already
   * happened; losing it because of a key problem would be the worse failure.
   */
  private async attest(params: {
    signatureId: string;
    signerNdyId: string;
    contentHash: string;
    requestId: string;
    issuedAt: Date;
  }): Promise<{
    jws: string | null;
    keyId: string | null;
    status: SignatureAttestationStatus;
    error: string | null;
  }> {
    try {
      const jws = await new SignJWT({
        contentHash: params.contentHash,
        consentText: SIGNATURE_CONSENT_TEXT,
        signatureRequestId: params.requestId,
      })
        .setProtectedHeader({ alg: 'RS256', kid: this.keys.keyId, typ: 'JWT' })
        .setIssuer(this.config.getOrThrow<string>('WEB_APP_URL'))
        .setAudience('ndy-signature')
        .setSubject(params.signerNdyId)
        .setJti(params.signatureId)
        .setIssuedAt(Math.floor(params.issuedAt.getTime() / 1000))
        .sign(this.keys.privateKey);

      // Validate before claiming anything. The client's bar is that the proof
      // "exists AND has been validated", so VERIFIED is set only after the token
      // we just produced verifies against our own published key with the required
      // issuer and audience — not merely because signing returned a string.
      const key = await importJWK(this.keys.publicJwk as JWK, 'RS256');
      await jwtVerify(jws, key, {
        issuer: this.config.getOrThrow<string>('WEB_APP_URL'),
        audience: 'ndy-signature',
      });

      return {
        jws,
        keyId: this.keys.keyId,
        status: SignatureAttestationStatus.VERIFIED,
        error: null,
      };
    } catch (err) {
      // Fail-soft by design: the signature already happened, so a proof problem
      // must not discard the user's action. It is recorded as FAILED instead,
      // which is exactly the state the retry path below recovers from.
      const message = (err as Error).message;
      this.logger.warn(
        `Failed to attest signature ${params.signatureId}: ${message}`,
      );
      return {
        jws: null,
        keyId: null,
        status: SignatureAttestationStatus.FAILED,
        error: message,
      };
    }
  }

  /**
   * Retries attestation for a signature whose proof failed or was never
   * produced — the audited recovery path. Idempotent: an already-verified
   * signature is returned untouched. Every attempt increments the stored attempt
   * count and records the outcome, so both the failure and the recovery are
   * provable after the fact.
   */
  async reattest(signatureId: string) {
    const signature = await this.prisma.signature.findUnique({
      where: { id: signatureId },
    });
    if (!signature) throw new NotFoundException('No signature with that id.');

    if (signature.attestationStatus === SignatureAttestationStatus.VERIFIED) {
      return {
        status: signature.attestationStatus,
        attempts: signature.attestationAttempts,
      };
    }

    const result = await this.attest({
      signatureId: signature.id,
      signerNdyId: signature.signerNdyId,
      contentHash: signature.contentHash,
      requestId: signature.signatureRequestId,
      issuedAt: signature.signedAt,
    });

    const updated = await this.prisma.signature.update({
      where: { id: signature.id },
      data: {
        attestation: result.jws,
        attestationKeyId: result.keyId,
        attestationStatus: result.status,
        attestationAttempts: signature.attestationAttempts + 1,
        attestationLastError: result.error,
        attestedAt:
          result.status === SignatureAttestationStatus.VERIFIED
            ? new Date()
            : signature.attestedAt,
      },
    });

    this.logger.log(
      `Re-attestation for signature ${signature.id}: ${result.status} (attempt ${updated.attestationAttempts}).`,
    );
    return {
      status: updated.attestationStatus,
      attempts: updated.attestationAttempts,
    };
  }

  /** Public, unauthenticated verification — the actual "independently
   * verifiable artifact" surface. Returns only what a third party needs and
   * nothing more (no emails, no PII beyond the public ndyId). */
  async verify(signatureId: string) {
    const signature = await this.prisma.signature.findUnique({
      where: { id: signatureId },
    });
    if (!signature) throw new NotFoundException('No signature with that id.');
    const apiUrl =
      this.config.get<string>('API_URL') ??
      `http://localhost:${this.config.get('PORT') ?? 3000}`;
    const verified =
      signature.attestationStatus === SignatureAttestationStatus.VERIFIED;
    return {
      signatureId: signature.id,
      signatureRequestId: signature.signatureRequestId,
      contentHash: signature.contentHash,
      signerNdyId: signature.signerNdyId,
      signedAt: signature.signedAt,
      // The authoritative answer to "is this cryptographically verified?".
      attestationStatus: signature.attestationStatus,
      // The proof is returned ONLY when it exists AND has been validated. A
      // pending or failed attestation is reported as its status — never handed
      // out as though it were a cryptographic attestation.
      attestation: verified ? signature.attestation : null,
      attestationKeyId: verified ? signature.attestationKeyId : null,
      jwksUri: `${apiUrl}/.well-known/jwks.json`,
    };
  }

  /** Requests the caller created, plus outstanding slots they're asked to
   * sign. Email-only invited slots don't appear here until they're bound to
   * an account at sign time — the emailed link is their entry point. */
  async listForUser(actor: AuthenticatedRequestUser) {
    const [created, toSign] = await Promise.all([
      this.prisma.signatureRequest.findMany({
        where: { createdByUserId: actor.sub },
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: {
          _count: { select: { signers: true, signatures: true } },
        },
      }),
      this.prisma.signatureRequestSigner.findMany({
        where: { userId: actor.sub, signedAt: null, declinedAt: null },
        orderBy: { expiresAt: 'asc' },
        take: 100,
        include: { signatureRequest: true },
      }),
    ]);
    return { created, toSign };
  }

  // --- internals -----------------------------------------------------------

  /** Shared validation for sign/decline: token must exist, be unused/unexpired,
   * and belong to the caller; the parent request must still be actionable. */
  private async loadSignerForSigning(rawToken: string) {
    const signer = await this.prisma.signatureRequestSigner.findUnique({
      where: { tokenHash: hashToken(rawToken) },
      include: { signatureRequest: true },
    });
    if (!signer) throw new NotFoundException('Invalid signing link.');
    if (signer.signedAt)
      throw new ConflictException('This document is already signed.');
    if (signer.declinedAt) {
      throw new ConflictException(
        'You already declined to sign this document.',
      );
    }
    if (signer.expiresAt.getTime() <= Date.now()) {
      throw new ConflictException('This signing link has expired.');
    }

    const request = signer.signatureRequest;
    if (request.status === SignatureRequestStatus.REVOKED) {
      throw new ConflictException('This request has been revoked.');
    }
    if (request.status === SignatureRequestStatus.SIGNED) {
      throw new ConflictException('This request is already fully signed.');
    }
    if (request.status === SignatureRequestStatus.DECLINED) {
      throw new ConflictException('This request was already declined.');
    }
    if (request.expiresAt && request.expiresAt.getTime() <= Date.now()) {
      await this.prisma.signatureRequest.update({
        where: { id: request.id },
        data: { status: SignatureRequestStatus.EXPIRED },
      });
      throw new ConflictException('This request has expired.');
    }
    return signer;
  }

  /** Who may sign a given slot. The emailed/in-app token authorizes *which
   * slot*; the authenticated identity determines *who* — they must agree, or a
   * signed-in user could sign a slot that was meant for someone else. */
  private async assertSignerIdentity(
    signer: { userId: string | null; invitedEmail: string | null },
    actor: AuthenticatedRequestUser,
  ): Promise<void> {
    if (signer.userId) {
      if (signer.userId !== actor.sub) {
        throw new ForbiddenException(
          'This signing link belongs to a different account.',
        );
      }
      return;
    }
    if (signer.invitedEmail) {
      const user = await this.prisma.user.findUnique({
        where: { id: actor.sub },
        select: { email: true },
      });
      if (!user) throw new NotFoundException('No user with that id.');
      if (user.email !== signer.invitedEmail) {
        throw new ForbiddenException(
          'This signing link was sent to a different email address.',
        );
      }
    }
  }

  /** Flips the request to SIGNED once every signer slot has signed. */
  private async recomputeStatus(
    requestId: string,
  ): Promise<SignatureRequestStatus> {
    const signers = await this.prisma.signatureRequestSigner.findMany({
      where: { signatureRequestId: requestId },
      select: { signedAt: true, declinedAt: true },
    });
    const allSigned = signers.every((s) => s.signedAt !== null);
    if (allSigned) {
      await this.prisma.signatureRequest.update({
        where: { id: requestId },
        data: { status: SignatureRequestStatus.SIGNED },
      });
      return SignatureRequestStatus.SIGNED;
    }
    return SignatureRequestStatus.PENDING;
  }
}
