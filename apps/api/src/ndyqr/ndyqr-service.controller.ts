import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { NdyqrService } from './ndyqr.service';
import { NdyQrClientGuard } from './guards/ndyqr-client.guard';
import type { NdyQrClientContext } from './guards/ndyqr-client.guard';
import { RequireNdyQrScope } from './decorators/require-ndyqr-scope.decorator';
import { CreateNdyQrDto } from './dto/ndyqr.dto';

/**
 * Server-to-server NDYQR — another NDY product's backend creating codes on its
 * own behalf, with no logged-in user. Never reachable by an end user's own
 * session (JwtAuthGuard is not used here at all): only a registered OAuthClient
 * holding the `ndyqr:create` scope can call it, exactly like the NDY Economy
 * event-intake endpoint.
 *
 * The returned code's public image is then available at the unauthenticated
 * `GET /q/:slug/image.png|.svg`, so a consuming product needs only this one
 * authenticated call and no renderer of its own — the "One NDYQR Core → many
 * NDY products" principle, made practical.
 */
@UseGuards(NdyQrClientGuard)
@Controller('ndyqr/service')
export class NdyQrServiceController {
  constructor(private readonly ndyqr: NdyqrService) {}

  @Post()
  @RequireNdyQrScope('ndyqr:create')
  create(
    @Body() dto: CreateNdyQrDto,
    @Req() req: Request & { ndyqrClient?: NdyQrClientContext },
  ) {
    const client = req.ndyqrClient;
    if (!client) {
      // The guard sets this; defensive rather than a non-null assertion.
      throw new UnauthorizedException('Missing client context.');
    }
    return this.ndyqr.createForClient(client.clientId, dto);
  }
}
