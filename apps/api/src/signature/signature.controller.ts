import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequestUser } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SignatureService } from './signature.service';
import {
  CreateSignatureRequestDto,
  SignDocumentDto,
} from './dto/signature.dto';

/**
 * NDY Signature routes.
 *
 * Creating, listing, signing and declining all require a real session: a
 * signature is always attributable to a real NDY identity (the schema's
 * signerUserId/signerNdyId are non-null), so we can't record one for an
 * anonymous caller. The emailed token in the path authorizes a specific
 * signer slot; the JWT says who is filling it, and the service requires the
 * two to agree.
 *
 * `verify` is the one PUBLIC route — it's the third-party-checkable artifact
 * surface, and it returns only what verification needs (no PII beyond the
 * public ndyId). It's throttled because it's unauthenticated.
 */
@Controller('signature')
export class SignatureController {
  constructor(private readonly signatures: SignatureService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @Body() dto: CreateSignatureRequestDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.signatures.create(user, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  list(@CurrentUser() user: AuthenticatedRequestUser) {
    return this.signatures.listForUser(user);
  }

  /** Preview for the sign page — requires a session, since the page itself
   * does (a signature is always attributable to a real identity). Does not
   * mutate the slot. */
  @UseGuards(JwtAuthGuard)
  @Get(':token/preview')
  preview(
    @Param('token') token: string,
    @CurrentUser() _user: AuthenticatedRequestUser,
  ) {
    return this.signatures.preview(token);
  }

  /** Public — no guard. Verifies a signature by id; returns contentHash +
   * signerNdyId + signedAt only. */
  @Get('verify/:signatureId')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  verify(@Param('signatureId') signatureId: string) {
    return this.signatures.verify(signatureId);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':token/sign')
  sign(
    @Param('token') token: string,
    @Body() _dto: SignDocumentDto,
    @CurrentUser() user: AuthenticatedRequestUser,
    @Req() req: Request,
  ) {
    const userAgent = req.headers['user-agent'];
    return this.signatures.sign(
      user,
      token,
      req.ip,
      Array.isArray(userAgent) ? userAgent[0] : userAgent,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post(':token/decline')
  decline(
    @Param('token') token: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.signatures.decline(user, token);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/revoke')
  revoke(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.signatures.revoke(user, id);
  }
}
